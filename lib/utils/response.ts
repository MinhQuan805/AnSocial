import { NextResponse } from 'next/server';

import { AppError } from '@/lib/core/errors';

export function ok<T>(payload: T, status = 200): NextResponse {
  return NextResponse.json(payload, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Unexpected server error.',
      },
    },
    { status: 500 }
  );
}
