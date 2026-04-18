import { NextRequest } from 'next/server';
import { z } from 'zod';

import { ValidationError } from '@/lib/core/errors';
import { fail, ok } from '@/lib/utils/response';

const requestSchema = z.object({
  url: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z.record(z.string(), z.string()).default({}),
  params: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        value: z.string().default(''),
      })
    )
    .default([]),
  body: z.string().optional(),
});

const BLOCKED_HEADER_KEYS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);

function sanitizeHeaders(input: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    const value = rawValue.trim();

    if (!key || !value) {
      continue;
    }

    const normalized = key.toLowerCase();
    if (BLOCKED_HEADER_KEYS.has(normalized)) {
      continue;
    }

    // Keep header names strictly token-safe.
    if (!/^[A-Za-z0-9-]+$/.test(key)) {
      continue;
    }

    output[key] = value;
  }

  return output;
}

function shouldSendBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

async function parseUpstreamBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const payload = requestSchema.parse(raw);

    const targetUrl = new URL(payload.url);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new ValidationError('Only http:// or https:// URLs are supported.');
    }

    if (payload.params.length > 0) {
      targetUrl.search = '';
      for (const parameter of payload.params) {
        targetUrl.searchParams.set(parameter.key.trim(), parameter.value);
      }
    }

    const outboundHeaders = sanitizeHeaders(payload.headers);
    const includeBody = shouldSendBody(payload.method);

    const upstream = await fetch(targetUrl.toString(), {
      method: payload.method,
      headers: outboundHeaders,
      body: includeBody ? payload.body : undefined,
      cache: 'no-store',
    });

    const upstreamData = await parseUpstreamBody(upstream);

    const upstreamHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      upstreamHeaders[key] = value;
    });

    return ok({
      request: {
        url: targetUrl.toString(),
        method: payload.method,
        headers: outboundHeaders,
        params: Array.from(targetUrl.searchParams.entries()).map(([key, value]) => ({
          key,
          value,
        })),
        body: includeBody ? payload.body : undefined,
      },
      response: {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstreamHeaders,
        data: upstreamData,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return fail(new ValidationError(issue?.message ?? 'Invalid HTTP request payload.'));
    }

    if (error instanceof TypeError) {
      return fail(new ValidationError('Unable to reach target URL.'));
    }

    return fail(error);
  }
}
