/**
 * Instagram Graph API Endpoint Registry
 *
 * Defines all available endpoints, their parameters, metrics, fields,
 * and validation rules based on official Meta documentation (v25.0).
 *
 * Structure: /{id_type}/{edge}
 *   - id_type: ig_user_id, ig_media_id
 *   - edge: insights, media, tags, children, comments, collaborators, product_tags, etc.
 */

import type { InsightBreakdown, InsightTimeframe } from '@/lib/core/domain';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type IdType = 'ig_user_id' | 'ig_media_id';

export type EndpointEdge =
  // ig_user_id edges
  | '' // base node (fields only)
  | 'insights'
  | 'media'
  | 'tags'
  // ig_media_id edges
  | 'children'
  | 'collaborators'
  | 'comments'
  | 'product_tags';

export type EndpointId = `${IdType}/${EndpointEdge}`;

export interface FieldOption {
  key: string;
  label: string;
  description: string;
  group: string;
  /** Which media_product_type this field applies to (for media-type-specific fields) */
  mediaTypes?: string[];
}

export interface MetricOption {
  key: string;
  label: string;
  description: string;
  group: string;
  /** Which period values are allowed for this metric */
  allowedPeriods: string[];
  /** Which timeframe values are allowed (demographic metrics only) */
  allowedTimeframes?: string[];
  /** Which breakdowns are compatible */
  allowedBreakdowns: string[];
  /** Which metric_type values this metric supports */
  allowedMetricTypes: string[];
  /** Which media_product_type this metric applies to (for media insights) */
  mediaTypes?: string[];
  /** Whether this metric is deprecated */
  deprecated?: boolean;
}

export type EndpointType = 'fields' | 'insights' | 'fields_and_edges';

export interface EndpointDefinition {
  id: EndpointId;
  idType: IdType;
  edge: EndpointEdge;
  label: string;
  description: string;
  path: string;
  method: 'GET' | 'POST';
  type: EndpointType;
  /** Available fields for field-based endpoints */
  fields?: FieldOption[];
  /** Default fields to select */
  defaultFields?: string[];
  /** Available metrics for insight endpoints */
  metrics?: MetricOption[];
  /** Default metrics */
  defaultMetrics?: string[];
  /** Whether this endpoint supports `limit` parameter */
  supportsLimit?: boolean;
  /** Whether this endpoint supports `since`/`until` parameters */
  supportsSinceUntil?: boolean;
  /** Whether this endpoint supports `period` parameter */
  supportsPeriod?: boolean;
  /** Extra required query parameters */
  requiredParams?: string[];
  /** Permissions required */
  permissions?: string[];
}

// ---------------------------------------------------------------------------
// ID Type definitions
// ---------------------------------------------------------------------------

export const ID_TYPE_OPTIONS: Array<{ value: IdType; label: string; description: string }> = [
  { value: 'ig_user_id', label: 'Instagram User', description: '/{ig_user_id}' },
  { value: 'ig_media_id', label: 'Instagram Media', description: '/{ig_media_id}' },
];

// ---------------------------------------------------------------------------
// ig_user_id base – GET /{ig_user_id}
// ---------------------------------------------------------------------------

const IG_USER_FIELDS: FieldOption[] = [
  { key: 'id', label: 'User ID', description: 'App-scoped user ID.', group: 'BASIC' },
  { key: 'username', label: 'Username', description: 'Profile username.', group: 'BASIC' },
  { key: 'name', label: 'Name', description: 'Profile display name.', group: 'BASIC' },
  { key: 'biography', label: 'Biography', description: 'Bio text from profile.', group: 'BASIC' },
  { key: 'website', label: 'Website', description: 'Website URL from profile.', group: 'BASIC' },
  {
    key: 'profile_picture_url',
    label: 'Profile Picture URL',
    description: 'URL of profile picture.',
    group: 'BASIC',
  },
  {
    key: 'has_profile_pic',
    label: 'Has Profile Picture',
    description: 'Whether the account has a profile picture.',
    group: 'BASIC',
  },
  {
    key: 'is_published',
    label: 'Is Published',
    description: 'Whether the Instagram account is published.',
    group: 'BASIC',
  },
  {
    key: 'followers_count',
    label: 'Followers Count',
    description: 'Total followers.',
    group: 'STATS',
  },
  {
    key: 'follows_count',
    label: 'Follows Count',
    description: 'Total accounts followed.',
    group: 'STATS',
  },
  {
    key: 'media_count',
    label: 'Media Count',
    description: 'Total media published.',
    group: 'STATS',
  },
  {
    key: 'shopping_product_tag_eligibility',
    label: 'Shopping Tag Eligibility',
    description: 'Whether shop tagging is available.',
    group: 'COMMERCE',
  },
];

// ---------------------------------------------------------------------------
// ig_user_id/insights – GET /{ig_user_id}/insights
// ---------------------------------------------------------------------------

const IG_USER_INSIGHT_METRICS: MetricOption[] = [
  {
    key: 'accounts_engaged',
    label: 'Accounts Engaged',
    description: 'Number of accounts that interacted with your content.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'comments',
    label: 'Comments',
    description: 'Number of comments on posts, reels, videos and live videos.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['media_product_type'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'engaged_audience_demographics',
    label: 'Engaged Audience Demographics',
    description: 'Demographics of the engaged audience (age, city, country, gender).',
    group: 'DEMOGRAPHIC',
    allowedPeriods: ['lifetime'],
    allowedTimeframes: [
      'this_week',
      'this_month',
      'last_14_days',
      'last_30_days',
      'last_90_days',
      'prev_month',
    ],
    allowedBreakdowns: ['age', 'city', 'country', 'gender'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'follows_and_unfollows',
    label: 'Follows & Unfollows',
    description: 'Number of follows and unfollows in the selected period.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['follow_type'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'follower_demographics',
    label: 'Follower Demographics',
    description: 'Demographics of followers (age, city, country, gender).',
    group: 'DEMOGRAPHIC',
    allowedPeriods: ['lifetime'],
    allowedTimeframes: [
      'this_week',
      'this_month',
      'last_14_days',
      'last_30_days',
      'last_90_days',
      'prev_month',
    ],
    allowedBreakdowns: ['age', 'city', 'country', 'gender'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'likes',
    label: 'Likes',
    description: 'Number of likes on posts, reels, and videos.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['media_product_type'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'profile_links_taps',
    label: 'Profile Links Taps',
    description: 'Taps on business address, call button, email button and text button.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['contact_button_type'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'reach',
    label: 'Reach',
    description: 'Unique accounts that have seen your content. Estimated.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['media_product_type', 'follow_type'],
    allowedMetricTypes: ['total_value', 'time_series'],
  },
  {
    key: 'replies',
    label: 'Replies',
    description: 'Number of replies from stories (text + quick reactions).',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'reposts',
    label: 'Reposts',
    description: 'Number of reposts of your content.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'saves',
    label: 'Saves',
    description: 'Number of saves of your posts, reels, and videos.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['media_product_type'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'shares',
    label: 'Shares',
    description: 'Number of shares of your content.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['media_product_type'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'total_interactions',
    label: 'Total Interactions',
    description: 'Total interactions across all content types.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['media_product_type'],
    allowedMetricTypes: ['total_value'],
  },
  {
    key: 'views',
    label: 'Views',
    description: 'Number of times content was displayed. In development.',
    group: 'INTERACTION',
    allowedPeriods: ['day'],
    allowedBreakdowns: ['follower_type', 'media_product_type'],
    allowedMetricTypes: ['total_value'],
  },
];

// ---------------------------------------------------------------------------
// ig_user_id/media – GET/POST /{ig_user_id}/media
// ---------------------------------------------------------------------------

const IG_USER_MEDIA_FIELDS: FieldOption[] = [
  { key: 'id', label: 'Media ID', description: 'Unique media identifier.', group: 'BASIC' },
  {
    key: 'media_type',
    label: 'Media Type',
    description: 'IMAGE, VIDEO, or CAROUSEL_ALBUM.',
    group: 'BASIC',
  },
  { key: 'media_url', label: 'Media URL', description: 'URL of the media file.', group: 'BASIC' },
  { key: 'permalink', label: 'Permalink', description: 'Permanent Instagram URL.', group: 'BASIC' },
  {
    key: 'thumbnail_url',
    label: 'Thumbnail URL',
    description: 'Thumbnail URL (video only).',
    group: 'BASIC',
    mediaTypes: ['VIDEO', 'REELS'],
  },
  {
    key: 'timestamp',
    label: 'Timestamp',
    description: 'ISO 8601 creation timestamp.',
    group: 'BASIC',
  },
  { key: 'caption', label: 'Caption', description: 'Media caption text.', group: 'CONTENT' },
  { key: 'shortcode', label: 'Shortcode', description: 'Instagram shortcode.', group: 'BASIC' },
  { key: 'username', label: 'Username', description: 'Creator username.', group: 'PUBLISHER' },
  { key: 'owner', label: 'Owner', description: 'Owner object with ID.', group: 'PUBLISHER' },
  {
    key: 'media_product_type',
    label: 'Media Product Type',
    description: 'AD, FEED, STORY or REELS.',
    group: 'CLASSIFICATION',
  },
  {
    key: 'is_comment_enabled',
    label: 'Comments Enabled',
    description: 'Whether comments are enabled.',
    group: 'CLASSIFICATION',
  },
  {
    key: 'is_shared_to_feed',
    label: 'Shared To Feed',
    description: 'Whether reel appears in feed tab.',
    group: 'CLASSIFICATION',
  },
  {
    key: 'comments_count',
    label: 'Comments Count',
    description: 'Number of comments.',
    group: 'ENGAGEMENT',
  },
  { key: 'like_count', label: 'Like Count', description: 'Number of likes.', group: 'ENGAGEMENT' },
  {
    key: 'alt_text',
    label: 'Alt Text',
    description: 'Alternative text for images.',
    group: 'ACCESSIBILITY',
  },
];

// ---------------------------------------------------------------------------
// ig_user_id/tags – GET /{ig_user_id}/tags
// ---------------------------------------------------------------------------

const IG_USER_TAGS_FIELDS: FieldOption[] = [
  { key: 'id', label: 'Media ID', description: 'ID of tagged media.', group: 'BASIC' },
  {
    key: 'media_type',
    label: 'Media Type',
    description: 'IMAGE, VIDEO, or CAROUSEL_ALBUM.',
    group: 'BASIC',
  },
  { key: 'media_url', label: 'Media URL', description: 'URL of tagged media.', group: 'BASIC' },
  { key: 'permalink', label: 'Permalink', description: 'Permanent URL.', group: 'BASIC' },
  { key: 'timestamp', label: 'Timestamp', description: 'ISO 8601 creation date.', group: 'BASIC' },
  { key: 'caption', label: 'Caption', description: 'Caption text.', group: 'CONTENT' },
  { key: 'username', label: 'Username', description: 'Creator username.', group: 'PUBLISHER' },
  {
    key: 'comments_count',
    label: 'Comments Count',
    description: 'Comment count.',
    group: 'ENGAGEMENT',
  },
  { key: 'like_count', label: 'Like Count', description: 'Like count.', group: 'ENGAGEMENT' },
];

// ---------------------------------------------------------------------------
// ig_media_id base – GET /{ig_media_id}
// ---------------------------------------------------------------------------

const IG_MEDIA_FIELDS: FieldOption[] = [
  { key: 'id', label: 'Media ID', description: 'Media object ID.', group: 'BASIC' },
  {
    key: 'media_type',
    label: 'Media Type',
    description: 'IMAGE, VIDEO, or CAROUSEL_ALBUM.',
    group: 'BASIC',
  },
  { key: 'media_url', label: 'Media URL', description: 'URL of media file.', group: 'BASIC' },
  { key: 'permalink', label: 'Permalink', description: 'Permanent URL.', group: 'BASIC' },
  {
    key: 'thumbnail_url',
    label: 'Thumbnail URL',
    description: 'Thumbnail for video.',
    group: 'BASIC',
    mediaTypes: ['VIDEO', 'REELS'],
  },
  {
    key: 'timestamp',
    label: 'Timestamp',
    description: 'ISO 8601 creation timestamp.',
    group: 'BASIC',
  },
  { key: 'shortcode', label: 'Shortcode', description: 'Instagram shortcode.', group: 'BASIC' },
  {
    key: 'caption',
    label: 'Caption',
    description: 'Caption text. Not available for album children.',
    group: 'CONTENT',
  },
  {
    key: 'alt_text',
    label: 'Alt Text',
    description: 'Accessibility text.',
    group: 'CONTENT',
    mediaTypes: ['IMAGE', 'FEED'],
  },
  { key: 'username', label: 'Username', description: 'Creator username.', group: 'PUBLISHER' },
  { key: 'owner', label: 'Owner', description: 'Owner object.', group: 'PUBLISHER' },
  {
    key: 'media_product_type',
    label: 'Media Product Type',
    description: 'AD, FEED, STORY, REELS.',
    group: 'CLASSIFICATION',
  },
  {
    key: 'is_comment_enabled',
    label: 'Comments Enabled',
    description: 'Comments on/off. Not for album children.',
    group: 'CLASSIFICATION',
  },
  {
    key: 'is_shared_to_feed',
    label: 'Shared To Feed',
    description: 'Reel appears in feed tab.',
    group: 'CLASSIFICATION',
    mediaTypes: ['REELS'],
  },
  {
    key: 'comments_count',
    label: 'Comments Count',
    description: 'Comment count.',
    group: 'ENGAGEMENT',
  },
  { key: 'like_count', label: 'Like Count', description: 'Like count.', group: 'ENGAGEMENT' },
  {
    key: 'view_count',
    label: 'View Count',
    description: 'Reel view count (organic + paid). Business Discovery only.',
    group: 'ENGAGEMENT',
    mediaTypes: ['REELS'],
  },
  {
    key: 'copyright_check_information{status}',
    label: 'Copyright Check',
    description: 'Copyright detection status.',
    group: 'COPYRIGHT',
    mediaTypes: ['VIDEO', 'REELS'],
  },
  {
    key: 'boost_eligibility_info',
    label: 'Boost Eligibility',
    description: 'Ad boost eligibility info.',
    group: 'ADS',
  },
  {
    key: 'boost_ads_list',
    label: 'Boost Ads List',
    description: 'Related active ads overview.',
    group: 'ADS',
  },
];

// ---------------------------------------------------------------------------
// ig_media_id/insights – GET /{ig_media_id}/insights
// ---------------------------------------------------------------------------

const IG_MEDIA_INSIGHT_METRICS: MetricOption[] = [
  {
    key: 'comments',
    label: 'Comments',
    description: 'Number of comments on the media.',
    group: 'ENGAGEMENT',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'REELS'],
  },
  {
    key: 'follows',
    label: 'Follows',
    description: 'Number of new followers from this media.',
    group: 'ENGAGEMENT',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'STORY'],
  },
  {
    key: 'ig_reels_avg_watch_time',
    label: 'Avg Watch Time (Reels)',
    description: 'Average time spent playing the reel.',
    group: 'REELS',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['REELS'],
  },
  {
    key: 'ig_reels_video_view_total_time',
    label: 'Total View Time (Reels)',
    description: 'Total time reel was played including replays.',
    group: 'REELS',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['REELS'],
  },
  {
    key: 'likes',
    label: 'Likes',
    description: 'Number of likes on the media.',
    group: 'ENGAGEMENT',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'REELS'],
  },
  {
    key: 'navigation',
    label: 'Navigation',
    description: 'Total navigation actions from story (exit, forward, back, next).',
    group: 'STORY',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: ['story_navigation_action_type'],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['STORY'],
  },
  {
    key: 'profile_activity',
    label: 'Profile Activity',
    description: 'Actions taken when visiting your profile after engaging with post.',
    group: 'ENGAGEMENT',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: ['action_type'],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'STORY'],
  },
  {
    key: 'profile_visits',
    label: 'Profile Visits',
    description: 'Number of profile visits from this media.',
    group: 'ENGAGEMENT',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'STORY'],
  },
  {
    key: 'reach',
    label: 'Reach',
    description: 'Unique accounts that saw this media. Estimated.',
    group: 'OVERVIEW',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'REELS', 'STORY'],
  },
  {
    key: 'replies',
    label: 'Replies',
    description: 'Total replies on story media.',
    group: 'STORY',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['STORY'],
  },
  {
    key: 'saved',
    label: 'Saved',
    description: 'Number of saves.',
    group: 'ENGAGEMENT',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'REELS'],
  },
  {
    key: 'shares',
    label: 'Shares',
    description: 'Number of shares.',
    group: 'ENGAGEMENT',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'REELS', 'STORY'],
  },
  {
    key: 'total_interactions',
    label: 'Total Interactions',
    description: 'Likes, saves, comments, shares minus unlikes, unsaves, deleted comments.',
    group: 'OVERVIEW',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'REELS', 'STORY'],
  },
  {
    key: 'views',
    label: 'Views',
    description: 'Total times the media was seen. In development.',
    group: 'OVERVIEW',
    allowedPeriods: ['lifetime'],
    allowedBreakdowns: [],
    allowedMetricTypes: ['total_value'],
    mediaTypes: ['FEED', 'REELS', 'STORY'],
  },
];

// ---------------------------------------------------------------------------
// ig_media_id/children – GET /{ig_media_id}/children
// ---------------------------------------------------------------------------

const IG_MEDIA_CHILDREN_FIELDS: FieldOption[] = [
  { key: 'id', label: 'Media ID', description: 'Child media ID.', group: 'BASIC' },
  { key: 'media_type', label: 'Media Type', description: 'IMAGE or VIDEO.', group: 'BASIC' },
  { key: 'media_url', label: 'Media URL', description: 'URL of child media.', group: 'BASIC' },
  { key: 'timestamp', label: 'Timestamp', description: 'Creation timestamp.', group: 'BASIC' },
];

// ---------------------------------------------------------------------------
// ig_media_id/collaborators – GET /{ig_media_id}/collaborators
// ---------------------------------------------------------------------------

const IG_MEDIA_COLLABORATORS_FIELDS: FieldOption[] = [
  { key: 'id', label: 'User ID', description: 'Collaborator user ID.', group: 'BASIC' },
  { key: 'username', label: 'Username', description: 'Collaborator username.', group: 'BASIC' },
];

// ---------------------------------------------------------------------------
// ig_media_id/comments – GET /{ig_media_id}/comments
// ---------------------------------------------------------------------------

const IG_MEDIA_COMMENTS_FIELDS: FieldOption[] = [
  { key: 'id', label: 'Comment ID', description: 'Comment identifier.', group: 'BASIC' },
  { key: 'text', label: 'Text', description: 'Comment text content.', group: 'CONTENT' },
  { key: 'timestamp', label: 'Timestamp', description: 'Creation timestamp.', group: 'BASIC' },
  { key: 'username', label: 'Username', description: 'Commenter username.', group: 'PUBLISHER' },
  {
    key: 'like_count',
    label: 'Like Count',
    description: 'Likes on this comment.',
    group: 'ENGAGEMENT',
  },
  {
    key: 'hidden',
    label: 'Hidden',
    description: 'Whether comment is hidden.',
    group: 'MODERATION',
  },
  {
    key: 'from',
    label: 'From',
    description: 'Object with commenter id and username.',
    group: 'PUBLISHER',
  },
];

// ---------------------------------------------------------------------------
// ig_media_id/product_tags – GET /{ig_media_id}/product_tags
// ---------------------------------------------------------------------------

const IG_MEDIA_PRODUCT_TAGS_FIELDS: FieldOption[] = [
  { key: 'product_id', label: 'Product ID', description: 'Tagged product ID.', group: 'BASIC' },
  { key: 'image_url', label: 'Image URL', description: 'Product image URL.', group: 'BASIC' },
  { key: 'name', label: 'Name', description: 'Product name.', group: 'BASIC' },
  {
    key: 'x',
    label: 'X Position',
    description: 'Horizontal tag position (0.0-1.0).',
    group: 'POSITION',
  },
  {
    key: 'y',
    label: 'Y Position',
    description: 'Vertical tag position (0.0-1.0).',
    group: 'POSITION',
  },
];

// ---------------------------------------------------------------------------
// ENDPOINT REGISTRY
// ---------------------------------------------------------------------------

export const ENDPOINT_REGISTRY: EndpointDefinition[] = [
  // ────────── ig_user_id ──────────
  {
    id: 'ig_user_id/',
    idType: 'ig_user_id',
    edge: '',
    label: 'User Profile',
    description: 'Get profile fields for an Instagram Business/Creator account.',
    path: '/{ig_user_id}',
    method: 'GET',
    type: 'fields',
    fields: IG_USER_FIELDS,
    defaultFields: ['id', 'username', 'name', 'biography', 'followers_count', 'media_count'],
  },
  {
    id: 'ig_user_id/insights',
    idType: 'ig_user_id',
    edge: 'insights',
    label: 'Account Insights',
    description: 'Social interaction metrics for an IG Business/Creator account.',
    path: '/{ig_user_id}/insights',
    method: 'GET',
    type: 'insights',
    metrics: IG_USER_INSIGHT_METRICS,
    defaultMetrics: ['reach', 'accounts_engaged'],
    supportsPeriod: true,
    supportsSinceUntil: true,
  },
  {
    id: 'ig_user_id/media',
    idType: 'ig_user_id',
    edge: 'media',
    label: 'Account Media',
    description: 'Collection of IG Media objects published by the user.',
    path: '/{ig_user_id}/media',
    method: 'GET',
    type: 'fields',
    fields: IG_USER_MEDIA_FIELDS,
    defaultFields: ['id', 'media_type', 'media_url', 'permalink', 'timestamp'],
    supportsLimit: true,
  },
  {
    id: 'ig_user_id/tags',
    idType: 'ig_user_id',
    edge: 'tags',
    label: 'Tagged Media',
    description: 'Media where the user has been tagged by others.',
    path: '/{ig_user_id}/tags',
    method: 'GET',
    type: 'fields',
    fields: IG_USER_TAGS_FIELDS,
    defaultFields: ['id', 'media_type', 'permalink', 'timestamp'],
    supportsLimit: true,
  },

  // ────────── ig_media_id ──────────
  {
    id: 'ig_media_id/',
    idType: 'ig_media_id',
    edge: '',
    label: 'Media Details',
    description: 'Get fields and edges for an Instagram Media object.',
    path: '/{ig_media_id}',
    method: 'GET',
    type: 'fields',
    fields: IG_MEDIA_FIELDS,
    defaultFields: ['id', 'media_type', 'media_url', 'permalink', 'timestamp', 'caption'],
  },
  {
    id: 'ig_media_id/insights',
    idType: 'ig_media_id',
    edge: 'insights',
    label: 'Media Insights',
    description: 'Engagement metrics for a specific media object.',
    path: '/{ig_media_id}/insights',
    method: 'GET',
    type: 'insights',
    metrics: IG_MEDIA_INSIGHT_METRICS,
    defaultMetrics: ['reach', 'views', 'total_interactions'],
    supportsPeriod: true,
  },
  {
    id: 'ig_media_id/children',
    idType: 'ig_media_id',
    edge: 'children',
    label: 'Carousel Children',
    description: 'Child media objects within a carousel album.',
    path: '/{ig_media_id}/children',
    method: 'GET',
    type: 'fields',
    fields: IG_MEDIA_CHILDREN_FIELDS,
    defaultFields: ['id', 'media_type', 'media_url', 'timestamp'],
  },
  {
    id: 'ig_media_id/collaborators',
    idType: 'ig_media_id',
    edge: 'collaborators',
    label: 'Collaborators',
    description: 'Users added as collaborators on the media.',
    path: '/{ig_media_id}/collaborators',
    method: 'GET',
    type: 'fields',
    fields: IG_MEDIA_COLLABORATORS_FIELDS,
    defaultFields: ['id', 'username'],
  },
  {
    id: 'ig_media_id/comments',
    idType: 'ig_media_id',
    edge: 'comments',
    label: 'Media Comments',
    description: 'Comments on a media object.',
    path: '/{ig_media_id}/comments',
    method: 'GET',
    type: 'fields',
    fields: IG_MEDIA_COMMENTS_FIELDS,
    defaultFields: ['id', 'text', 'timestamp', 'username'],
    supportsLimit: true,
  },
  {
    id: 'ig_media_id/product_tags',
    idType: 'ig_media_id',
    edge: 'product_tags',
    label: 'Product Tags',
    description: 'Product tags on the media.',
    path: '/{ig_media_id}/product_tags',
    method: 'GET',
    type: 'fields',
    fields: IG_MEDIA_PRODUCT_TAGS_FIELDS,
    defaultFields: ['product_id', 'name'],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getEndpointsForIdType(idType: IdType): EndpointDefinition[] {
  return ENDPOINT_REGISTRY.filter((ep) => ep.idType === idType);
}

export function getEndpointById(id: EndpointId): EndpointDefinition | undefined {
  return ENDPOINT_REGISTRY.find((ep) => ep.id === id);
}

export function getEdgeOptionsForIdType(
  idType: IdType
): Array<{ value: string; label: string; description: string }> {
  return getEndpointsForIdType(idType).map((ep) => ({
    value: ep.id,
    label: ep.label,
    description: ep.path,
  }));
}

// ---------------------------------------------------------------------------
// Insight validation
// ---------------------------------------------------------------------------

export type MetricGroup = 'INTERACTION' | 'DEMOGRAPHIC';

export interface InsightValidationResult {
  effectiveMetrics: string[];
  droppedMetrics: string[];
  unknownMetrics: string[];
  resolvedPeriod: string;
  resolvedTimeframe?: string;
  resolvedBreakdown?: string;
  allowedBreakdowns: string[];
  allowedPeriods: string[];
  allowedTimeframes: string[];
  metricType: string;
  group: MetricGroup;
  warnings: string[];
  errors: string[];
}

export function validateInsightSelection(
  endpoint: EndpointDefinition,
  selectedMetrics: string[],
  period?: string,
  timeframe?: string,
  breakdown?: string
): InsightValidationResult {
  const allMetrics = endpoint.metrics ?? [];
  const metricMap = new Map(allMetrics.map((m) => [m.key, m]));

  const unknownMetrics = selectedMetrics.filter((m) => !metricMap.has(m));
  const knownMetrics = selectedMetrics.filter((m) => metricMap.has(m));
  const warnings: string[] = [];
  const errors: string[] = [];

  if (unknownMetrics.length > 0) {
    warnings.push(`Unknown metrics ignored: ${unknownMetrics.join(', ')}`);
  }

  const effective = knownMetrics.length > 0 ? knownMetrics : (endpoint.defaultMetrics ?? []);

  // Determine group from first metric
  const firstMetric = metricMap.get(effective[0] ?? '');
  const group: MetricGroup = firstMetric?.group === 'DEMOGRAPHIC' ? 'DEMOGRAPHIC' : 'INTERACTION';

  // Filter metrics to same group
  const droppedMetrics = effective.filter((m) => {
    const def = metricMap.get(m);
    if (!def) return false;
    const mGroup: MetricGroup = def.group === 'DEMOGRAPHIC' ? 'DEMOGRAPHIC' : 'INTERACTION';
    return mGroup !== group;
  });

  const effectiveMetrics = effective.filter((m) => !droppedMetrics.includes(m));

  if (droppedMetrics.length > 0) {
    errors.push(
      `Cannot combine metrics from different groups. Dropped: ${droppedMetrics.join(', ')}. Only showing ${group} metrics.`
    );
  }

  // Compute allowed periods (intersection)
  const allowedPeriods =
    effectiveMetrics.length > 0
      ? effectiveMetrics.reduce<string[]>((acc, m) => {
          const def = metricMap.get(m);
          if (!def) return acc;
          if (acc.length === 0) return [...def.allowedPeriods];
          return acc.filter((p) => def.allowedPeriods.includes(p));
        }, [])
      : ['day'];

  const resolvedPeriod =
    period && allowedPeriods.includes(period) ? period : (allowedPeriods[0] ?? 'day');

  // Auto-resolve period silently — no warning needed since the UI auto-selects

  // Compute allowed timeframes
  const allowedTimeframes =
    group === 'DEMOGRAPHIC'
      ? effectiveMetrics.reduce<string[]>((acc, m) => {
          const def = metricMap.get(m);
          if (!def?.allowedTimeframes) return acc;
          if (acc.length === 0) return [...def.allowedTimeframes];
          return acc.filter((t) => def.allowedTimeframes!.includes(t));
        }, [])
      : [];

  let resolvedTimeframe: string | undefined;
  if (group === 'DEMOGRAPHIC') {
    resolvedTimeframe =
      timeframe && allowedTimeframes.includes(timeframe)
        ? timeframe
        : (allowedTimeframes[0] ?? 'this_week');
  }

  // Compute allowed breakdowns (intersection)
  const allowedBreakdowns =
    effectiveMetrics.length > 0
      ? effectiveMetrics.reduce<string[]>((acc, m) => {
          const def = metricMap.get(m);
          if (!def) return acc;
          if (acc.length === 0) return [...def.allowedBreakdowns];
          return acc.filter((b) => def.allowedBreakdowns.includes(b));
        }, [])
      : [];

  let resolvedBreakdown: string | undefined;
  if (breakdown && allowedBreakdowns.includes(breakdown)) {
    resolvedBreakdown = breakdown;
  } else if (breakdown && !allowedBreakdowns.includes(breakdown)) {
    warnings.push(
      `Breakdown "${breakdown}" is not compatible with selected metrics. Breakdown was removed.`
    );
  }

  // Determine metric_type
  const allSupportTimeSeries = effectiveMetrics.every((m) => {
    const def = metricMap.get(m);
    return def?.allowedMetricTypes.includes('time_series');
  });

  const metricType =
    group === 'DEMOGRAPHIC' || resolvedBreakdown || !allSupportTimeSeries
      ? 'total_value'
      : 'time_series';

  return {
    effectiveMetrics,
    droppedMetrics,
    unknownMetrics,
    resolvedPeriod,
    resolvedTimeframe,
    resolvedBreakdown,
    allowedBreakdowns,
    allowedPeriods,
    allowedTimeframes,
    metricType,
    group,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Media-type-aware helpers
// ---------------------------------------------------------------------------

/**
 * Filter fields by media_product_type. Fields without mediaTypes are always included.
 */
export function getFieldsForMediaType(fields: FieldOption[], mediaType?: string): FieldOption[] {
  if (!mediaType || mediaType === 'ALL') return fields;
  return fields.filter((f) => !f.mediaTypes || f.mediaTypes.includes(mediaType));
}

/**
 * Filter metrics by media_product_type. Metrics without mediaTypes are always included.
 */
export function getMetricsForMediaType(
  metrics: MetricOption[],
  mediaType?: string
): MetricOption[] {
  if (!mediaType || mediaType === 'ALL') return metrics;
  return metrics.filter((m) => !m.mediaTypes || m.mediaTypes.includes(mediaType));
}
