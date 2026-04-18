export type MediaFieldOption = {
  key: string;
  label: string;
  description: string;
  uiGroup: string;
  deprecatedFor?: 'tagged_media' | 'account_media';
};

export const ACCOUNT_MEDIA_FIELD_OPTIONS: MediaFieldOption[] = [
  {
    key: 'id',
    label: 'Media ID',
    description: 'Unique identifier for the media object.',
    uiGroup: 'BASIC MEDIA INFO',
  },
  {
    key: 'media_type',
    label: 'Media Type',
    description: 'IMAGE, VIDEO, or CAROUSEL_ALBUM.',
    uiGroup: 'BASIC MEDIA INFO',
  },
  {
    key: 'media_url',
    label: 'Media URL',
    description: 'URL of the media file.',
    uiGroup: 'BASIC MEDIA INFO',
  },
  {
    key: 'permalink',
    label: 'Permalink',
    description: 'Permanent Instagram URL for the media.',
    uiGroup: 'BASIC MEDIA INFO',
  },
  {
    key: 'thumbnail_url',
    label: 'Thumbnail URL',
    description: 'Thumbnail URL (video media only).',
    uiGroup: 'BASIC MEDIA INFO',
  },
  {
    key: 'timestamp',
    label: 'Published Time',
    description: 'ISO 8601 creation timestamp.',
    uiGroup: 'BASIC MEDIA INFO',
  },
  {
    key: 'username',
    label: 'Username',
    description: 'Username of the Instagram account',
    uiGroup: 'BASIC MEDIA INFO',
    deprecatedFor: 'tagged_media',
  },
  {
    key: 'shortcode',
    label: 'Shortcode',
    description: 'Instagram shortcode for the media.',
    uiGroup: 'BASIC MEDIA INFO',
  },
  {
    key: 'owner',
    label: 'Owner',
    description: 'Owner object for the media.',
    uiGroup: 'PUBLISHER',
  },
  {
    key: 'media_product_type',
    label: 'Media Product Type',
    description: 'Feed, Reel, Story, etc.',
    uiGroup: 'MEDIA CLASSIFICATION',
  },
  {
    key: 'is_comment_enabled',
    label: 'Is Comment Enabled',
    description: 'Whether comments are enabled for this media.',
    uiGroup: 'MEDIA CLASSIFICATION',
  },
  {
    key: 'comments_count',
    label: 'Comments Count',
    description: 'Number of comments on the media.',
    uiGroup: 'ENGAGEMENT',
  },
  {
    key: 'like_count',
    label: 'Like Count',
    description: 'Number of likes on the media.',
    uiGroup: 'ENGAGEMENT',
  },
  {
    key: 'collaborators',
    label: 'Collaborators',
    description: 'A list of users who are added as collaborators.',
    uiGroup: 'Edges',
  },
];

export const DEFAULT_ACCOUNT_MEDIA_FIELDS = [
  'id',
  'media_type',
  'media_url',
  'permalink',
  'timestamp',
];

// Note: tagged_media endpoint does not support 'username' field
// See: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag/recent-media
export const DEFAULT_TAGGED_MEDIA_FIELDS = [
  'id',
  'media_type',
  'media_url',
  'permalink',
  'timestamp',
];
