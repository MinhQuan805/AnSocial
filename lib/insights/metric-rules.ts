import type {
  InsightBreakdown,
  InsightMetricType,
  InsightPeriod,
  InsightRangeDays,
  InsightTimeframe,
} from '@/lib/core/domain';

export type InsightMetricGroup = 'interaction' | 'demographic';

export type InsightMetricOption = {
  key: string;
  label: string;
  description: string;
  uiGroup: string;
};

type MetricRule = {
  group: InsightMetricGroup;
  allowedMetricTypes: InsightMetricType[];
  allowedBreakdowns: InsightBreakdown[];
};

export const INSIGHT_METRIC_OPTIONS: InsightMetricOption[] = [
  {
    key: 'reach',
    label: 'Reach',
    description: 'The number of unique accounts that have seen your content',
    uiGroup: 'ACCOUNT OVERVIEW',
  },
  {
    key: 'views',
    label: 'Views',
    description: 'Total times your content was viewed across surfaces.',

    uiGroup: 'ACCOUNT OVERVIEW',
  },
  {
    key: 'accounts_engaged',
    label: 'Accounts Engaged',
    description: 'Unique accounts that interacted with your content.',

    uiGroup: 'ACCOUNT OVERVIEW',
  },
  {
    key: 'total_interactions',
    label: 'Total Interactions',
    description: 'Total interactions across posts, stories, reels, and videos.',

    uiGroup: 'ACCOUNT OVERVIEW',
  },
  {
    key: 'likes',
    label: 'Likes',
    description: 'Total likes on posts, reels, and videos.',

    uiGroup: 'CONTENT ENGAGEMENT',
  },
  {
    key: 'comments',
    label: 'Comments',
    description: 'Total comments on posts, reels, videos, and live videos.',
    uiGroup: 'CONTENT ENGAGEMENT',
  },
  {
    key: 'shares',
    label: 'Shares',
    description: 'Total shares of your content.',
    uiGroup: 'CONTENT ENGAGEMENT',
  },
  {
    key: 'saves',
    label: 'Saves',
    description: 'Total saves of your content.',
    uiGroup: 'CONTENT ENGAGEMENT',
  },
  {
    key: 'replies',
    label: 'Replies',
    description: 'Replies received from stories.',
    uiGroup: 'CONTENT ENGAGEMENT',
  },
  {
    key: 'reposts',
    label: 'Reposts',
    description: 'Total reposts of your content.',
    uiGroup: 'CONTENT ENGAGEMENT',
  },
  {
    key: 'profile_links_taps',
    label: 'Profile Links Taps',
    description: 'Taps on profile links and contact actions.',

    uiGroup: 'PROFILE ACTIONS',
  },
  {
    key: 'engaged_audience_demographics',
    label: 'Engaged Audience Demographics',
    description: 'Demographics of the engaged audience.',

    uiGroup: 'AUDIENCE DEMOGRAPHICS',
  },
  {
    key: 'follower_demographics',
    label: 'Follower Demographics',
    description: 'Demographics of followers.',
    uiGroup: 'AUDIENCE DEMOGRAPHICS',
  },
];

const METRIC_RULES: Record<string, MetricRule> = {
  reach: {
    group: 'interaction',
    allowedMetricTypes: ['total_value', 'time_series'],
    allowedBreakdowns: ['media_product_type', 'follow_type'],
  },
  views: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['follower_type', 'media_product_type'],
  },
  accounts_engaged: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: [],
  },
  total_interactions: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['media_product_type'],
  },
  likes: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['media_product_type'],
  },
  comments: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['media_product_type'],
  },
  shares: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['media_product_type'],
  },
  saves: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['media_product_type'],
  },
  replies: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: [],
  },
  reposts: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: [],
  },
  profile_links_taps: {
    group: 'interaction',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['contact_button_type'],
  },
  engaged_audience_demographics: {
    group: 'demographic',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['age', 'city', 'country', 'gender'],
  },
  follower_demographics: {
    group: 'demographic',
    allowedMetricTypes: ['total_value'],
    allowedBreakdowns: ['age', 'city', 'country', 'gender'],
  },
};

const DEFAULT_METRICS = ['reach'];

function normalizeRangeDays(rangeDays: InsightRangeDays): number {
  if (typeof rangeDays === 'number') {
    return rangeDays;
  }

  switch (rangeDays) {
    case 'today':
      return 1;
    case 'yesterday':
      return 1;
    case 'this_month':
      return 30;
    case 'last_month':
      return 30;
    case 'custom':
      return 30; // Default for custom
    default:
      return 7;
  }
}

function uniqueOrdered(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }

    seen.add(item);
    output.push(item);
  }

  return output;
}

function intersectBreakdowns(metrics: string[]): InsightBreakdown[] {
  if (metrics.length === 0) {
    return [];
  }

  const [first, ...rest] = metrics;
  const firstRule = METRIC_RULES[first];

  if (!firstRule) {
    return [];
  }

  let intersection = firstRule.allowedBreakdowns;

  for (const metric of rest) {
    const rule = METRIC_RULES[metric];
    if (!rule) {
      continue;
    }

    intersection = intersection.filter((item) => rule.allowedBreakdowns.includes(item));
  }

  return intersection;
}

export type ResolvedInsightRequest = {
  requestedMetrics: string[];
  effectiveMetrics: string[];
  droppedMetrics: string[];
  unknownMetrics: string[];
  group: InsightMetricGroup;
  metricType: InsightMetricType;
  period: 'day' | 'lifetime';
  rangeDays: InsightRangeDays;
  timeframe?: InsightTimeframe;
  breakdown?: InsightBreakdown;
  allowedBreakdowns: InsightBreakdown[];
  warnings: string[];
};

export function resolveInsightRequest(args: {
  metrics: string[];
  period: InsightPeriod;
  rangeDays: InsightRangeDays;
  breakdown?: InsightBreakdown;
  timeframe?: InsightTimeframe;
}): ResolvedInsightRequest {
  const requestedMetrics = uniqueOrdered(args.metrics.filter((item) => item.trim().length > 0));
  const unknownMetrics = requestedMetrics.filter((metric) => !METRIC_RULES[metric]);
  const knownMetrics = requestedMetrics.filter((metric) => METRIC_RULES[metric]);
  const warnings: string[] = [];

  if (unknownMetrics.length > 0) {
    warnings.push(`Unsupported metrics in v25 were ignored: ${unknownMetrics.join(', ')}.`);
  }

  const normalizedKnown = knownMetrics.length > 0 ? knownMetrics : DEFAULT_METRICS;
  const group = METRIC_RULES[normalizedKnown[0]].group;
  const effectiveMetrics = normalizedKnown.filter((metric) => METRIC_RULES[metric].group === group);
  const droppedMetrics = normalizedKnown.filter((metric) => !effectiveMetrics.includes(metric));

  if (droppedMetrics.length > 0) {
    warnings.push(
      `Some metrics can't be combined. Showing only the first compatible group (${group}): ${effectiveMetrics.join(
        ', '
      )}.`
    );
  }

  let period: 'day' | 'lifetime' = 'day';
  let timeframe: InsightTimeframe | undefined;
  let rangeDays: InsightRangeDays = args.rangeDays;

  if (group === 'demographic') {
    period = 'lifetime';
    const normalizedDays = normalizeRangeDays(args.rangeDays);
    timeframe = args.timeframe ?? (normalizedDays <= 7 ? 'this_week' : 'this_month');
    rangeDays = timeframe === 'this_week' ? 7 : 30;
  }

  const allowedBreakdowns = intersectBreakdowns(effectiveMetrics);
  const breakdown =
    args.breakdown && allowedBreakdowns.includes(args.breakdown) ? args.breakdown : undefined;

  if (args.breakdown && !breakdown) {
    warnings.push(
      `Breakdown \"${args.breakdown}\" is not compatible with current metrics. Breakdown was removed.`
    );
  }

  const supportsTimeSeries =
    effectiveMetrics.length > 0 &&
    effectiveMetrics.every((metric) =>
      METRIC_RULES[metric].allowedMetricTypes.includes('time_series')
    );

  const metricType: InsightMetricType =
    group === 'demographic' || breakdown || !supportsTimeSeries ? 'total_value' : 'time_series';

  return {
    requestedMetrics,
    effectiveMetrics,
    droppedMetrics,
    unknownMetrics,
    group,
    metricType,
    period,
    rangeDays,
    timeframe,
    breakdown,
    allowedBreakdowns,
    warnings,
  };
}
