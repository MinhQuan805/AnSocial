export type IntegrationGuideSlug =
  | 'facebook-ads'
  | 'facebook-pages'
  | 'facebook-leads'
  | 'instagram'
  | 'google-search-console'
  | 'youtube-public-data'
  | 'trustpilot';

export type NotionGuidePair = {
  tutorial: string;
  connect: string;
};

// Paste public Notion page URLs (or page IDs) for each integration guide.
export const INTEGRATION_NOTION_GUIDES: Record<IntegrationGuideSlug, NotionGuidePair> = {
  'facebook-ads': { tutorial: '', connect: '' },
  'facebook-pages': { tutorial: '', connect: '' },
  'facebook-leads': { tutorial: '', connect: '' },
  instagram: { tutorial: '', connect: '' },
  'google-search-console': { tutorial: '', connect: '' },
  'youtube-public-data': { tutorial: '', connect: '' },
  trustpilot: { tutorial: '', connect: '' },
};
