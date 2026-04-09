import { ExternalApiError } from "@/lib/core/errors";

export interface ApiClientRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retryCount?: number;
}

export class ApiClient {
  public async requestJson<T>(request: ApiClientRequest): Promise<T> {
    const method = request.method ?? "GET";
    const timeoutMs = request.timeoutMs ?? 15_000;
    const retryCount = request.retryCount ?? 2;

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retryCount) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(request.url, {
          method,
          headers: request.headers,
          body: request.body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();

          if ((response.status === 429 || response.status >= 500) && attempt < retryCount) {
            await this.backoff(attempt, response.headers.get("Retry-After"));
            attempt += 1;
            continue;
          }

          throw new ExternalApiError(
            `External API error ${response.status}: ${text.slice(0, 300)}`,
            response.status,
          );
        }

        const data = (await response.json()) as T;
        return data;
      } catch (error) {
        lastError = error;
        if (attempt >= retryCount) {
          break;
        }
        await this.backoff(attempt, null);
      } finally {
        clearTimeout(timeout);
      }

      attempt += 1;
    }

    if (lastError instanceof Error && lastError.name === "AbortError") {
      throw new ExternalApiError("External API timeout exceeded", 504);
    }

    if (lastError instanceof ExternalApiError) {
      throw lastError;
    }

    throw new ExternalApiError("Unable to reach external API");
  }

  private async backoff(attempt: number, retryAfterHeader: string | null): Promise<void> {
    if (retryAfterHeader) {
      const seconds = Number(retryAfterHeader);
      if (!Number.isNaN(seconds) && seconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1_000));
        return;
      }
    }

    const delay = Math.min(800 * 2 ** attempt, 5_000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
