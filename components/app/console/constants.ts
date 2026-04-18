import type { InsightBreakdown, InsightRangeDays, InsightTimeframe } from '@/lib/core/domain';
import {
  ENDPOINT_REGISTRY,
  ID_TYPE_OPTIONS,
  type EndpointDefinition,
  type IdType,
} from '@/lib/insights/endpoint-registry';
import { ACCOUNT_MEDIA_FIELD_OPTIONS } from '@/lib/insights/media-fields';
import { INSIGHT_METRIC_OPTIONS } from '@/lib/insights/metric-rules';

import type { EndpointKey } from '@/components/app/console/types';

export const GRAPH_BASE_URL = 'https://graph.facebook.com/v25.0/';

// Re-export ID_TYPE_OPTIONS and ENDPOINT_REGISTRY for easy access
export { ID_TYPE_OPTIONS, ENDPOINT_REGISTRY };

/**
 * Legacy endpoint options — preserved for backward compatibility.
 * The new UI uses getEdgeOptionsForIdType() from the registry.
 */
export const ENDPOINT_OPTIONS: Array<{ key: EndpointKey; label: string; path: string }> = [
  { key: 'account_insights', label: 'Account Insights', path: '/{ig_account_id}/insights' },
  { key: 'account_media', label: 'Account Media', path: '/{ig_account_id}/media' },
  { key: 'tagged_media', label: 'Tagged Media', path: '/{ig_account_id}/tags' },
];

export const METRIC_GROUPS = Object.entries(
  INSIGHT_METRIC_OPTIONS.reduce<Record<string, typeof INSIGHT_METRIC_OPTIONS>>((acc, item) => {
    const groupItems = acc[item.uiGroup] ?? [];
    acc[item.uiGroup] = [...groupItems, item];
    return acc;
  }, {})
).map(([title, options]) => ({ title, options }));

export const METRIC_OPTIONS = INSIGHT_METRIC_OPTIONS;

export const MEDIA_FIELD_GROUPS = Object.entries(
  ACCOUNT_MEDIA_FIELD_OPTIONS.reduce<Record<string, typeof ACCOUNT_MEDIA_FIELD_OPTIONS>>(
    (acc, item) => {
      const groupItems = acc[item.uiGroup] ?? [];
      acc[item.uiGroup] = [...groupItems, item];
      return acc;
    },
    {}
  )
).map(([title, options]) => ({ title, options }));

export const BREAKDOWN_LABELS: Record<InsightBreakdown, string> = {
  contact_button_type: 'Contact Button Type',
  follow_type: 'Follow Type',
  follower_type: 'Follower Type',
  media_product_type: 'Media Product Type',
  age: 'Age',
  city: 'City',
  country: 'Country',
  gender: 'Gender',
};

/** Extended breakdown labels for media insight breakdowns */
export const MEDIA_BREAKDOWN_LABELS: Record<string, string> = {
  ...BREAKDOWN_LABELS,
  action_type: 'Action Type',
  story_navigation_action_type: 'Story Navigation',
};

export const TIMEFRAME_OPTIONS: Array<{ label: string; value: InsightTimeframe }> = [
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last 14 Days', value: 'last_14_days' },
  { label: 'Last 30 Days', value: 'last_30_days' },
  { label: 'Last 90 Days', value: 'last_90_days' },
  { label: 'Previous Month', value: 'prev_month' },
  { label: 'Last Month (legacy)', value: 'last_month' },
];

export const DATE_RANGE_OPTIONS: Array<{ label: string; value: InsightRangeDays }> = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 14 Days', value: 14 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Custom (Max 30 days)', value: 'custom' },
];

export const INSIGHT_ALLOWED_PARAM_KEYS = new Set([
  'metric',
  'metric_type',
  'period',
  'timeframe',
  'breakdown',
  'since',
  'until',
]);

export const MEDIA_ALLOWED_PARAM_KEYS = new Set(['fields', 'limit']);
export const DEFAULT_INSIGHT_METRICS = ['reach', 'accounts_engaged'];

/**
 * Get grouped field options from an endpoint definition.
 */
export function getFieldGroupsFromEndpoint(
  endpoint: EndpointDefinition
): Array<{ title: string; options: Array<{ key: string; label: string; description: string }> }> {
  if (!endpoint.fields) return [];

  const groups = new Map<string, Array<{ key: string; label: string; description: string }>>();

  for (const field of endpoint.fields) {
    const groupKey = field.group ?? 'OTHER';
    const existing = groups.get(groupKey) ?? [];
    existing.push({ key: field.key, label: field.label, description: field.description });
    groups.set(groupKey, existing);
  }

  return Array.from(groups.entries()).map(([title, options]) => ({ title, options }));
}

/**
 * Get grouped metric options from an endpoint definition.
 */
export function getMetricGroupsFromEndpoint(
  endpoint: EndpointDefinition
): Array<{ title: string; options: Array<{ key: string; label: string; description: string }> }> {
  if (!endpoint.metrics) return [];

  const groups = new Map<string, Array<{ key: string; label: string; description: string }>>();

  for (const metric of endpoint.metrics) {
    const groupKey = metric.group ?? 'OTHER';
    const existing = groups.get(groupKey) ?? [];
    existing.push({ key: metric.key, label: metric.label, description: metric.description });
    groups.set(groupKey, existing);
  }

  return Array.from(groups.entries()).map(([title, options]) => ({ title, options }));
}
