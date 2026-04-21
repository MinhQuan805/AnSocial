export type ProviderKey = 'facebook' | 'instagram' | 'youtube' | 'generic';

export interface ProviderParserHints {
  defaultRootArrayPath?: string;
  excludeFieldKeywords?: string[];
  explodeTimeSeries?: boolean;
}

export interface ProviderParserResult {
  provider: ProviderKey;
  payload: unknown;
  hints: ProviderParserHints;
}

interface ProviderParserContext {
  requestUrl?: string;
  payload: unknown;
}

function detectProvider(requestUrl?: string): ProviderKey {
  if (!requestUrl) {
    return 'generic';
  }

  const value = requestUrl.toLowerCase();

  if (value.includes('facebook.com') || value.includes('graph.facebook.com')) {
    return 'facebook';
  }

  if (value.includes('instagram.com') || value.includes('graph.instagram.com')) {
    return 'instagram';
  }

  if (value.includes('youtube.com') || value.includes('googleapis.com/youtube')) {
    return 'youtube';
  }

  return 'generic';
}

function parseFacebook(payload: unknown): ProviderParserResult {
  return {
    provider: 'facebook',
    payload,
    hints: {
      defaultRootArrayPath: '$.data',
      excludeFieldKeywords: ['paging', 'summary'],
      explodeTimeSeries: true,
    },
  };
}

function parseInstagram(payload: unknown): ProviderParserResult {
  return {
    provider: 'instagram',
    payload,
    hints: {
      defaultRootArrayPath: '$.data',
      excludeFieldKeywords: ['paging'],
      explodeTimeSeries: true,
    },
  };
}

function parseYouTube(payload: unknown): ProviderParserResult {
  return {
    provider: 'youtube',
    payload,
    hints: {
      defaultRootArrayPath: '$.items',
      excludeFieldKeywords: ['etag', 'kind'],
      explodeTimeSeries: false,
    },
  };
}

function parseGeneric(payload: unknown): ProviderParserResult {
  return {
    provider: 'generic',
    payload,
    hints: {
      explodeTimeSeries: true,
    },
  };
}

export function parseProviderPayload(context: ProviderParserContext): ProviderParserResult {
  const provider = detectProvider(context.requestUrl);

  if (provider === 'facebook') {
    return parseFacebook(context.payload);
  }

  if (provider === 'instagram') {
    return parseInstagram(context.payload);
  }

  if (provider === 'youtube') {
    return parseYouTube(context.payload);
  }

  return parseGeneric(context.payload);
}
