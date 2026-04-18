import type { ExtendedRecordMap } from 'notion-types';

type PublicNotionPageResponse = {
  pageId: string;
  recordMap: ExtendedRecordMap;
};

type PublicNotionPageError = {
  error?: string;
};

export async function fetchPublicNotionPage(
  target: string,
  signal?: AbortSignal
): Promise<PublicNotionPageResponse> {
  const response = await fetch(`/api/notion/public-page?target=${encodeURIComponent(target)}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  const payload = (await response.json().catch(() => ({}))) as
    | PublicNotionPageResponse
    | (PublicNotionPageResponse & PublicNotionPageError);

  if (!response.ok || !('recordMap' in payload)) {
    const errorMessage =
      'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Unable to load public Notion page.';
    throw new Error(errorMessage);
  }

  return payload;
}
