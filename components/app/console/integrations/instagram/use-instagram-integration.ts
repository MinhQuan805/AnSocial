'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { format } from 'date-fns';

import {
  BREAKDOWN_LABELS,
  DATE_RANGE_OPTIONS,
  DEFAULT_INSIGHT_METRICS,
  GRAPH_BASE_URL,
  ID_TYPE_OPTIONS,
  INSIGHT_ALLOWED_PARAM_KEYS,
  MEDIA_ALLOWED_PARAM_KEYS,
  METRIC_OPTIONS,
  TIMEFRAME_OPTIONS,
} from '@/components/app/console/constants';
import { InstagramBuilderCard } from '@/components/app/console/cards/builder/instagram-builder-card';
import { type SingleSelectDropdownOption } from '@/components/app/console/forms/single-select-dropdown-field';
import type {
  EndpointKey,
  InsightReport,
  MediaReport,
  RequestParameterRow,
  SessionView,
} from '@/components/app/console/types';
import type {
  InsightBreakdown,
  InsightPeriod,
  InsightRangeDays,
  InsightTimeframe,
} from '@/lib/core/domain';
import {
  ACCOUNT_MEDIA_FIELD_OPTIONS,
  DEFAULT_ACCOUNT_MEDIA_FIELDS,
} from '@/lib/insights/media-fields';
import {
  type EndpointDefinition,
  type EndpointId,
  type IdType,
  getEdgeOptionsForIdType,
  getEndpointById,
  getFieldsForMediaType,
  getMetricsForMediaType,
  validateInsightSelection,
} from '@/lib/insights/endpoint-registry';
import { resolveInsightRequest } from '@/lib/insights/metric-rules';
import {
  buildGraphApiUrl,
  buildGraphMediaApiUrl,
  buildGraphMediaIdApiUrl,
} from '@/lib/utils/api-url';
import { fetchWithAuth } from '@/lib/utils/use-auth-headers';
import { unixRangeFromDays } from '@/lib/utils/query';

type AuthMode = 'oauth' | 'token' | 'basic';

type SyncUrlResult = {
  error?: string;
  status?: string;
};

interface UseInstagramIntegrationOptions {
  session: SessionView;
  authMode: AuthMode;
  editableUrl: string;
  setEditableUrl: Dispatch<SetStateAction<string>>;
}

interface UseInstagramIntegrationResult {
  hasOAuthConnection: boolean;
  isInstagramOAuthLinked: boolean;
  builderCardProps: ComponentProps<typeof InstagramBuilderCard>;
  requestParameterRows: RequestParameterRow[];
  parameterDrafts: Record<string, string>;
  setParameterDrafts: (value: Record<string, string>) => void;
  newParamKey: string;
  setNewParamKey: (value: string) => void;
  newParamValue: string;
  setNewParamValue: (value: string) => void;
  removeParameter: (key: string, required: boolean) => void;
  addParameter: () => void;
  commitParameterDraft: (key: string) => void;
  setEditableUrlFromInput: (value: string) => void;
  syncFromUrlInputInstagram: () => SyncUrlResult;
  runOauth: () => Promise<string>;
  isInsightEndpoint: boolean;
  isMediaEndpoint: boolean;
  insightReport: InsightReport | null;
  mediaReport: MediaReport | null;
  clearReports: () => void;
  mediaTableFields: string[];
  mediaRows: Array<{
    key: string;
    accountHandle: string;
    item: Record<string, unknown>;
  }>;
  formatMediaCellValue: (value: unknown) => string;
  getOutputFields: () => string[];
  buildSourceAccount: () => string;
}

type MediaFormat = 'ALL' | 'IMAGE' | 'VIDEO' | 'REEL' | 'CAROUSEL_ALBUM';

const NO_BREAKDOWN_VALUE = '__none__';

function uniqueOrdered(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) {
      continue;
    }

    seen.add(item);
    output.push(item);
  }

  return output;
}

function parseCsvValues(raw: string, allowedValues: Set<string>): string[] {
  const cleaned = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return uniqueOrdered(cleaned).filter((item) => allowedValues.has(item));
}

function sanitizeSingleUrlInput(raw: string): string {
  const compact = raw.replace(/\r?\n/g, ' ').trim();
  const [firstToken] = compact.split(/\s+/);
  return firstToken ?? '';
}

function normalizeGraphUrl(raw: string, fallback: string): URL {
  const fallbackUrl = new URL(fallback);
  const singleLine = sanitizeSingleUrlInput(raw);

  let parsed: URL;
  try {
    parsed = new URL(singleLine);
  } catch {
    parsed = fallbackUrl;
  }

  const normalized = new URL(GRAPH_BASE_URL);
  const fallbackPath = fallbackUrl.pathname.replace(/^\/v\d+\.\d+\/?/i, '/');
  const nextPath = parsed.pathname.replace(/^\/v\d+\.\d+\/?/i, '/');

  normalized.pathname = nextPath === '/' || nextPath.length === 0 ? fallbackPath : nextPath;
  normalized.search = parsed.search;
  return normalized;
}

function getFirstQueryValue(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  if (values.length === 0) {
    return undefined;
  }

  const [first] = values;
  return first?.trim() ? first.trim() : undefined;
}

function isValidDate(date: Date | undefined): date is Date {
  return Boolean(date && !Number.isNaN(date.getTime()));
}

function parseUnixDate(raw: string | undefined): Date | undefined {
  if (!raw) {
    return undefined;
  }

  const unix = Number(raw);
  if (!Number.isFinite(unix) || unix <= 0) {
    return undefined;
  }

  const parsed = new Date(unix * 1000);
  return isValidDate(parsed) ? parsed : undefined;
}

function validateCustomDateRange(
  startDate: Date | undefined,
  endDate: Date | undefined
): string | null {
  if (!startDate || !endDate) {
    return 'Both start and end dates are required';
  }

  if (startDate > endDate) {
    return 'Start date must be before end date';
  }

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return `Date range must be 30 days or less (current: ${diffDays} days)`;
  }

  return null;
}

function parseRangeDays(raw: string): InsightRangeDays {
  if (
    raw === 'today' ||
    raw === 'yesterday' ||
    raw === 'this_month' ||
    raw === 'last_month' ||
    raw === 'custom'
  ) {
    return raw;
  }

  const parsed = Number(raw);
  if (parsed === 1 || parsed === 7 || parsed === 14 || parsed === 30) {
    return parsed;
  }

  return 7;
}

export function useInstagramIntegration({
  session,
  authMode,
  editableUrl,
  setEditableUrl,
}: UseInstagramIntegrationOptions): UseInstagramIntegrationResult {
  const [selectedIdType, setSelectedIdType] = useState<IdType>('ig_user_id');
  const [selectedEndpointId, setSelectedEndpointId] = useState<EndpointId>('ig_user_id/insights');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    session.accounts[0]?.id ? [session.accounts[0].id] : []
  );
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_INSIGHT_METRICS);
  const [mediaFields, setMediaFields] = useState<string[]>(DEFAULT_ACCOUNT_MEDIA_FIELDS);
  const [mediaLimit, setMediaLimit] = useState(25);
  const [period, setPeriod] = useState<InsightPeriod>('day');
  const [rangeDays, setRangeDays] = useState<InsightRangeDays>(7);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
  const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<InsightTimeframe>('this_week');
  const [breakdown, setBreakdown] = useState<InsightBreakdown | ''>('');
  const [selectedMediaId, setSelectedMediaId] = useState<string>('');
  const [accountMediaList, setAccountMediaList] = useState<
    Array<{
      id: string;
      media_type: string;
      media_product_type?: string;
      permalink?: string;
      caption?: string;
      timestamp?: string;
    }>
  >([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedMediaType, setSelectedMediaType] = useState<string>('ALL');
  const [urlInputDirty, setUrlInputDirty] = useState(false);
  const [parameterDrafts, setParameterDrafts] = useState<Record<string, string>>({});
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [httpQueryParameters, setHttpQueryParameters] = useState<
    Array<{ key: string; value: string }>
  >([]);
  const [insightReport, setInsightReport] = useState<InsightReport | null>(null);
  const [mediaReport, setMediaReport] = useState<MediaReport | null>(null);

  const endpoint: EndpointKey = useMemo(() => {
    if (selectedEndpointId === 'ig_user_id/insights') return 'account_insights';
    if (selectedEndpointId === 'ig_user_id/media') return 'account_media';
    if (selectedEndpointId === 'ig_user_id/tags') return 'tagged_media';
    return 'account_media';
  }, [selectedEndpointId]);

  const activeEndpoint = useMemo<EndpointDefinition | undefined>(
    () => getEndpointById(selectedEndpointId),
    [selectedEndpointId]
  );

  const isMediaIdType = selectedIdType === 'ig_media_id';
  const isInsightEndpoint = activeEndpoint?.type === 'insights' || endpoint === 'account_insights';
  const isMediaEndpoint =
    activeEndpoint?.type === 'fields' ||
    endpoint === 'account_media' ||
    endpoint === 'tagged_media';
  const hasOAuthConnection = session.facebookConnected && session.accounts.length > 0;
  const isInstagramOAuthLinked = authMode === 'oauth' && hasOAuthConnection;
  const activeAccountId = selectedAccountIds[0] ?? session.accounts[0]?.id ?? '';
  const mediaFormat: MediaFormat = 'ALL';

  const resolvedSelection = useMemo(
    () =>
      resolveInsightRequest({
        metrics,
        period,
        rangeDays,
        timeframe,
        breakdown: breakdown || undefined,
      }),
    [metrics, period, rangeDays, timeframe, breakdown]
  );

  const metricKeySet = useMemo(() => new Set(METRIC_OPTIONS.map((item) => item.key)), []);
  const mediaFieldKeySet = useMemo(
    () => new Set(ACCOUNT_MEDIA_FIELD_OPTIONS.map((item) => item.key)),
    []
  );
  const timeframeValueSet = useMemo(() => new Set(TIMEFRAME_OPTIONS.map((item) => item.value)), []);
  const breakdownValueSet = useMemo(() => new Set(Object.keys(BREAKDOWN_LABELS)), []);

  const compatibilityWarning = useMemo(
    () =>
      resolvedSelection.warnings.find((item) => item.toLowerCase().includes("can't be combined")) ??
      null,
    [resolvedSelection.warnings]
  );

  const selectionWarning = useMemo(
    () =>
      compatibilityWarning ??
      resolvedSelection.warnings.filter(
        (warning) => !warning.toLowerCase().includes('period')
      )[0] ??
      null,
    [compatibilityWarning, resolvedSelection.warnings]
  );

  const idTypeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () =>
      ID_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.description,
      })),
    []
  );

  const edgeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () =>
      getEdgeOptionsForIdType(selectedIdType).map((option) => ({
        value: option.value,
        label: option.label,
        description: option.description,
      })),
    [selectedIdType]
  );

  const registryValidation = useMemo(() => {
    if (!activeEndpoint || activeEndpoint.type !== 'insights') {
      return null;
    }

    return validateInsightSelection(
      activeEndpoint,
      metrics,
      period,
      timeframe,
      breakdown || undefined
    );
  }, [activeEndpoint, metrics, period, timeframe, breakdown]);

  const registryWarnings = useMemo(() => {
    if (!registryValidation) {
      return [];
    }

    return [...registryValidation.errors, ...registryValidation.warnings];
  }, [registryValidation]);

  const activeMetricOptions = useMemo(() => {
    if (!activeEndpoint?.metrics) {
      return [];
    }

    const filtered = getMetricsForMediaType(activeEndpoint.metrics, selectedMediaType);
    return filtered.map((metric) => ({
      key: metric.key,
      label: metric.label,
      description: metric.description,
      uiGroup: metric.group,
    }));
  }, [activeEndpoint, selectedMediaType]);

  const activeFieldOptions = useMemo(() => {
    if (!activeEndpoint?.fields) {
      return [];
    }

    const filtered = getFieldsForMediaType(activeEndpoint.fields, selectedMediaType);
    return filtered.map((field) => ({
      key: field.key,
      label: field.label,
      description: field.description,
      uiGroup: field.group,
    }));
  }, [activeEndpoint, selectedMediaType]);

  const periodDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => [
      { value: 'day', label: 'Daily' },
      { value: 'week', label: 'Weekly' },
      { value: 'month', label: 'Monthly' },
    ],
    []
  );

  const timeframeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => TIMEFRAME_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  const dateRangeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () =>
      DATE_RANGE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label })),
    []
  );

  const breakdownDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => [
      { value: NO_BREAKDOWN_VALUE, label: 'No breakdown' },
      ...resolvedSelection.allowedBreakdowns.map((item) => ({
        value: item,
        label: BREAKDOWN_LABELS[item],
      })),
    ],
    [resolvedSelection.allowedBreakdowns]
  );

  const requestParameterRows = useMemo<Array<RequestParameterRow>>(() => {
    if (!isInstagramOAuthLinked) {
      return httpQueryParameters.map((item) => ({
        key: item.key,
        value: item.value,
        required: false,
      }));
    }

    if (isMediaEndpoint) {
      return [
        { key: 'fields', value: mediaFields.join(','), required: true },
        { key: 'limit', value: String(mediaLimit), required: true },
      ];
    }

    const range = unixRangeFromDays(resolvedSelection.rangeDays, customStartDate, customEndDate);
    const rows: RequestParameterRow[] = [
      { key: 'metric', value: resolvedSelection.effectiveMetrics.join(','), required: true },
      { key: 'metric_type', value: resolvedSelection.metricType, required: true },
      { key: 'period', value: resolvedSelection.period, required: true },
    ];

    if (resolvedSelection.timeframe) {
      rows.push({ key: 'timeframe', value: resolvedSelection.timeframe, required: false });
    }

    if (resolvedSelection.breakdown) {
      rows.push({ key: 'breakdown', value: resolvedSelection.breakdown, required: false });
    }

    if (resolvedSelection.period === 'day') {
      rows.push({ key: 'since', value: String(range.sinceUnix), required: false });
      rows.push({ key: 'until', value: String(range.untilUnix), required: false });
    }

    return rows;
  }, [
    customEndDate,
    customStartDate,
    httpQueryParameters,
    isInstagramOAuthLinked,
    isMediaEndpoint,
    mediaFields,
    mediaLimit,
    resolvedSelection,
  ]);

  const apiUrlPreview = useMemo(() => {
    const accountId = activeAccountId || '<ig_account_id>';

    if (isMediaIdType && activeEndpoint) {
      const mediaId = selectedMediaId || '<ig_media_id>';
      const edge = activeEndpoint.edge;
      if (edge === 'insights' && activeEndpoint.metrics) {
        const effectiveMetrics = registryValidation?.effectiveMetrics ?? metrics;
        return buildGraphMediaIdApiUrl({
          mediaId,
          edge: 'insights',
          metrics: effectiveMetrics,
          metricType: registryValidation?.metricType ?? 'total_value',
          period: registryValidation?.resolvedPeriod ?? 'lifetime',
        });
      }

      return buildGraphMediaIdApiUrl({
        mediaId,
        edge,
        fields: mediaFields,
      });
    }

    if (isMediaEndpoint && !isMediaIdType) {
      const mediaEndpointType = endpoint === 'tagged_media' ? 'tagged_media' : 'account_media';
      return buildGraphMediaApiUrl({
        accountId,
        fields: mediaFields,
        limit: mediaLimit,
        endpoint: mediaEndpointType,
      });
    }

    return buildGraphApiUrl({
      accountId,
      metrics: resolvedSelection.effectiveMetrics,
      period: resolvedSelection.period,
      rangeDays: resolvedSelection.rangeDays,
      timeframe: resolvedSelection.timeframe,
      breakdown: resolvedSelection.breakdown,
      customStartDate,
      customEndDate,
    });
  }, [
    activeAccountId,
    activeEndpoint,
    customEndDate,
    customStartDate,
    endpoint,
    isMediaEndpoint,
    isMediaIdType,
    mediaFields,
    mediaLimit,
    metrics,
    registryValidation,
    resolvedSelection.breakdown,
    resolvedSelection.effectiveMetrics,
    resolvedSelection.period,
    resolvedSelection.rangeDays,
    resolvedSelection.timeframe,
    selectedMediaId,
  ]);

  const mediaPickerOptions = useMemo<SingleSelectDropdownOption[]>(() => {
    if (accountMediaList.length === 0) {
      return [];
    }

    return accountMediaList.map((item) => {
      const typeLabel =
        item.media_type === 'VIDEO'
          ? '🎬'
          : item.media_type === 'IMAGE'
            ? '🖼️'
            : item.media_type === 'CAROUSEL_ALBUM'
              ? '📸'
              : '📄';
      const dateLabel = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '';

      return {
        value: item.id,
        label: `${typeLabel} ${item.id}`,
        description: item.caption ? `${dateLabel} • ${item.caption}` : dateLabel,
      };
    });
  }, [accountMediaList]);

  const mediaTableFields = useMemo(() => {
    const fields = mediaReport?.query.fields ?? mediaFields;
    const normalized = Array.from(new Set(['id', ...fields])).filter((item) => item.length > 0);
    return normalized.slice(0, 8);
  }, [mediaFields, mediaReport?.query.fields]);

  const mediaRows = useMemo(
    () =>
      (mediaReport?.accounts ?? []).flatMap((account) =>
        account.items.map((item, index) => ({
          key: `${account.accountId}-${String(item.id ?? index)}`,
          accountHandle: account.accountHandle,
          item,
        }))
      ),
    [mediaReport?.accounts]
  );

  useEffect(() => {
    if (session.accounts.length === 0) {
      setSelectedAccountIds([]);
      return;
    }

    setSelectedAccountIds((previous) => {
      const available = new Set(session.accounts.map((item) => item.id));
      const valid = previous.filter((item) => available.has(item));
      if (valid.length > 0) {
        return [valid[0]];
      }

      return [session.accounts[0].id];
    });
  }, [session.accounts]);

  useEffect(() => {
    const edges = getEdgeOptionsForIdType(selectedIdType);
    if (edges.length > 0 && !edges.some((edge) => edge.value === selectedEndpointId)) {
      setSelectedEndpointId(edges[0].value as EndpointId);
    }
  }, [selectedIdType, selectedEndpointId]);

  useEffect(() => {
    if (!activeEndpoint) {
      return;
    }

    if (activeEndpoint.type === 'insights' && activeEndpoint.defaultMetrics) {
      setMetrics(activeEndpoint.defaultMetrics);
    }

    if (activeEndpoint.type === 'fields' && activeEndpoint.defaultFields) {
      setMediaFields(activeEndpoint.defaultFields);
    }

    setSelectedMediaType('ALL');
  }, [activeEndpoint]);

  useEffect(() => {
    if (!isMediaIdType) {
      setAccountMediaList([]);
      setSelectedMediaId('');
      return;
    }

    if (!activeAccountId || !session.facebookConnected) {
      return;
    }

    let cancelled = false;
    setLoadingMedia(true);

    fetchWithAuth('/api/media', {
      method: 'POST',
      body: JSON.stringify({
        accountInputs: [],
        selectedAccountIds: [activeAccountId],
        endpoint: 'account_media',
        fields: ['id', 'media_type', 'media_product_type', 'permalink', 'caption', 'timestamp'],
        limit: 50,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return;
        }

        const items = data?.accounts?.[0]?.items ?? [];
        setAccountMediaList(
          items.map((item: Record<string, unknown>) => ({
            id: String(item.id ?? ''),
            media_type: String(item.media_type ?? 'UNKNOWN'),
            media_product_type: item.media_product_type
              ? String(item.media_product_type)
              : undefined,
            permalink: item.permalink ? String(item.permalink) : undefined,
            caption: item.caption ? String(item.caption).slice(0, 80) : undefined,
            timestamp: item.timestamp ? String(item.timestamp) : undefined,
          }))
        );

        if (items.length > 0 && !selectedMediaId) {
          setSelectedMediaId(String(items[0].id ?? ''));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccountMediaList([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMedia(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMediaIdType, activeAccountId, selectedMediaId, session.facebookConnected]);

  useEffect(() => {
    if (!selectedMediaId || accountMediaList.length === 0) {
      return;
    }

    const media = accountMediaList.find((item) => item.id === selectedMediaId);
    if (media?.media_product_type) {
      setSelectedMediaType(media.media_product_type);
    }
  }, [selectedMediaId, accountMediaList]);

  useEffect(() => {
    if (!registryValidation) {
      return;
    }

    const { allowedPeriods } = registryValidation;
    if (allowedPeriods.length > 0 && !allowedPeriods.includes(period)) {
      setPeriod(allowedPeriods[0] as InsightPeriod);
    }
  }, [registryValidation, period]);

  useEffect(() => {
    if (breakdown && !resolvedSelection.allowedBreakdowns.includes(breakdown)) {
      setBreakdown('');
    }
  }, [breakdown, resolvedSelection.allowedBreakdowns]);

  useEffect(() => {
    if (rangeDays !== 'custom') {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
      setCustomDateError(null);
    }
  }, [rangeDays]);

  useEffect(() => {
    if (!isInstagramOAuthLinked || urlInputDirty) {
      return;
    }

    setEditableUrl(apiUrlPreview);
  }, [apiUrlPreview, isInstagramOAuthLinked, setEditableUrl, urlInputDirty]);

  useEffect(() => {
    if (isInstagramOAuthLinked) {
      return;
    }

    setEditableUrl((previousValue) => {
      const singleUrl = sanitizeSingleUrlInput(previousValue);
      if (!singleUrl) {
        return previousValue;
      }

      try {
        const parsed = new URL(singleUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return previousValue;
        }

        parsed.search = '';
        for (const parameter of httpQueryParameters) {
          const key = parameter.key.trim();
          if (!key) {
            continue;
          }

          parsed.searchParams.set(key, parameter.value);
        }

        const normalized = parsed.toString();
        return normalized === previousValue ? previousValue : normalized;
      } catch {
        return previousValue;
      }
    });
  }, [httpQueryParameters, isInstagramOAuthLinked, setEditableUrl]);

  const resetRequiredParameter = (key: string) => {
    if (isMediaEndpoint) {
      if (key === 'fields') {
        setMediaFields(DEFAULT_ACCOUNT_MEDIA_FIELDS);
      }

      if (key === 'limit') {
        setMediaLimit(25);
      }

      return;
    }

    switch (key) {
      case 'metric':
        setMetrics(DEFAULT_INSIGHT_METRICS);
        break;
      case 'period':
        setPeriod('day');
        break;
      default:
        break;
    }
  };

  const applyParameter = (rawKey: string, rawValue: string) => {
    const key = rawKey.trim().toLowerCase();
    const normalizedKey = rawKey.trim();
    const value = rawValue.trim();

    if (!isInstagramOAuthLinked) {
      if (!normalizedKey) {
        return;
      }

      setHttpQueryParameters((previous) => {
        const next = previous.filter(
          (item) => item.key.trim().toLowerCase() !== normalizedKey.toLowerCase()
        );
        next.push({ key: normalizedKey, value });
        return next;
      });
      return;
    }

    if (isMediaEndpoint) {
      if (!MEDIA_ALLOWED_PARAM_KEYS.has(key)) {
        return;
      }

      if (key === 'fields') {
        const nextFields = parseCsvValues(value, mediaFieldKeySet);
        setMediaFields(nextFields.length > 0 ? nextFields : DEFAULT_ACCOUNT_MEDIA_FIELDS);
        return;
      }

      if (key === 'limit') {
        const parsedLimit = Number(value);
        if (!Number.isFinite(parsedLimit)) {
          setMediaLimit(25);
          return;
        }

        setMediaLimit(Math.min(100, Math.max(1, Math.round(parsedLimit))));
      }

      return;
    }

    if (!INSIGHT_ALLOWED_PARAM_KEYS.has(key)) {
      return;
    }

    if (key === 'metric') {
      const nextMetrics = parseCsvValues(value, metricKeySet);
      setMetrics(nextMetrics.length > 0 ? nextMetrics : DEFAULT_INSIGHT_METRICS);
      return;
    }

    if (key === 'period') {
      if (value === 'day' || value === 'week' || value === 'month') {
        setPeriod(value);
      } else {
        setPeriod('day');
      }
      return;
    }

    if (key === 'timeframe') {
      if (!value || !timeframeValueSet.has(value as InsightTimeframe)) {
        setTimeframe('this_week');
        return;
      }

      setTimeframe(value as InsightTimeframe);
      return;
    }

    if (key === 'breakdown') {
      if (!value || !breakdownValueSet.has(value)) {
        setBreakdown('');
        return;
      }

      setBreakdown(value as InsightBreakdown);
      return;
    }

    if (key === 'since') {
      const parsedDate = parseUnixDate(value);
      if (!parsedDate) {
        setCustomStartDate(undefined);
        setCustomDateError(null);
        return;
      }

      setRangeDays('custom');
      setCustomStartDate(parsedDate);
      if (customEndDate) {
        setCustomDateError(validateCustomDateRange(parsedDate, customEndDate));
      }
      return;
    }

    if (key === 'until') {
      const parsedDate = parseUnixDate(value);
      if (!parsedDate) {
        setCustomEndDate(undefined);
        setCustomDateError(null);
        return;
      }

      setRangeDays('custom');
      setCustomEndDate(parsedDate);
      if (customStartDate) {
        setCustomDateError(validateCustomDateRange(customStartDate, parsedDate));
      }
    }
  };

  const removeParameter = (key: string, required: boolean) => {
    if (!isInstagramOAuthLinked) {
      const normalizedKey = key.trim().toLowerCase();
      setHttpQueryParameters((previous) =>
        previous.filter((item) => item.key.trim().toLowerCase() !== normalizedKey)
      );
      return;
    }

    if (required) {
      resetRequiredParameter(key);
      return;
    }

    if (isMediaEndpoint) {
      if (key === 'fields') {
        setMediaFields(DEFAULT_ACCOUNT_MEDIA_FIELDS);
      }

      return;
    }

    if (key === 'timeframe') {
      setTimeframe('this_week');
      return;
    }

    if (key === 'breakdown') {
      setBreakdown('');
      return;
    }

    if (key === 'since' || key === 'until') {
      setRangeDays(7);
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
      setCustomDateError(null);
    }
  };

  const commitParameterDraft = (key: string) => {
    const draftValue = parameterDrafts[key];
    if (draftValue === undefined) {
      return;
    }

    applyParameter(key, draftValue);
    setParameterDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const addParameter = () => {
    if (!newParamKey.trim()) {
      return;
    }

    applyParameter(newParamKey, newParamValue);
    setNewParamKey('');
    setNewParamValue('');
  };

  const setEditableUrlFromInput = (value: string) => {
    setEditableUrl(value);
    setUrlInputDirty(true);
  };

  const syncFromUrlInputInstagram = (): SyncUrlResult => {
    const singleUrl = sanitizeSingleUrlInput(editableUrl);
    if (!singleUrl) {
      return {};
    }

    try {
      const parsed = new URL(singleUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http:// and https:// URLs are supported.');
      }

      if (!isInstagramOAuthLinked) {
        const parsedParams = new Map<string, string>();
        parsed.searchParams.forEach((paramValue, paramKey) => {
          const key = paramKey.trim();
          if (!key) {
            return;
          }

          parsedParams.set(key, paramValue);
        });

        setHttpQueryParameters(
          Array.from(parsedParams.entries()).map(([paramKey, paramValue]) => ({
            key: paramKey,
            value: paramValue,
          }))
        );
        setEditableUrl(parsed.toString());
        setUrlInputDirty(false);
        return {};
      }
    } catch (reason) {
      return {
        error: reason instanceof Error ? reason.message : 'Invalid URL.',
      };
    }

    const fallbackUrl = apiUrlPreview || `${GRAPH_BASE_URL}<ig_account_id>/insights`;
    const normalizedUrl = normalizeGraphUrl(editableUrl, fallbackUrl);
    const pathParts = normalizedUrl.pathname.split('/').filter(Boolean);
    const versionIndex = pathParts.findIndex((part) => /^v\d+\.\d+$/i.test(part));
    const scopedPath = versionIndex >= 0 ? pathParts.slice(versionIndex + 1) : pathParts;
    const [accountIdFromPath, endpointPath] = scopedPath;

    if (endpointPath === 'insights') {
      setSelectedIdType('ig_user_id');
      setSelectedEndpointId('ig_user_id/insights');
    } else if (endpointPath === 'media') {
      setSelectedIdType('ig_user_id');
      setSelectedEndpointId('ig_user_id/media');
    } else if (endpointPath === 'tags') {
      setSelectedIdType('ig_user_id');
      setSelectedEndpointId('ig_user_id/tags');
    }

    if (accountIdFromPath) {
      const matchedAccount = session.accounts.find((item) => item.id === accountIdFromPath);
      if (matchedAccount) {
        setSelectedAccountIds([matchedAccount.id]);
      }
    }

    const params = normalizedUrl.searchParams;

    if (endpointPath === 'media' || endpointPath === 'tags') {
      const fieldsParam = getFirstQueryValue(params, 'fields') ?? '';
      const parsedFields = parseCsvValues(fieldsParam, mediaFieldKeySet);
      setMediaFields(parsedFields.length > 0 ? parsedFields : DEFAULT_ACCOUNT_MEDIA_FIELDS);

      const limitParam = getFirstQueryValue(params, 'limit');
      const parsedLimit = Number(limitParam);
      setMediaLimit(
        Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.round(parsedLimit))) : 25
      );
    }

    if (endpointPath === 'insights') {
      const metricParam = getFirstQueryValue(params, 'metric') ?? '';
      const parsedMetrics = parseCsvValues(metricParam, metricKeySet);
      setMetrics(parsedMetrics.length > 0 ? parsedMetrics : DEFAULT_INSIGHT_METRICS);

      const periodParam = getFirstQueryValue(params, 'period');
      if (periodParam === 'day' || periodParam === 'week' || periodParam === 'month') {
        setPeriod(periodParam);
      } else {
        setPeriod('day');
      }

      const timeframeParam = getFirstQueryValue(params, 'timeframe');
      if (timeframeParam && timeframeValueSet.has(timeframeParam as InsightTimeframe)) {
        setTimeframe(timeframeParam as InsightTimeframe);
      }

      const breakdownParam = getFirstQueryValue(params, 'breakdown');
      setBreakdown(
        breakdownParam && breakdownValueSet.has(breakdownParam)
          ? (breakdownParam as InsightBreakdown)
          : ''
      );

      const parsedSinceDate = parseUnixDate(getFirstQueryValue(params, 'since'));
      const parsedUntilDate = parseUnixDate(getFirstQueryValue(params, 'until'));

      if (parsedSinceDate || parsedUntilDate) {
        setRangeDays('custom');
        setCustomStartDate(parsedSinceDate);
        setCustomEndDate(parsedUntilDate);
        setCustomDateError(validateCustomDateRange(parsedSinceDate, parsedUntilDate));
      } else {
        setRangeDays(7);
        setCustomStartDate(undefined);
        setCustomEndDate(undefined);
        setCustomDateError(null);
      }
    }

    setEditableUrl(normalizedUrl.toString());
    setUrlInputDirty(false);
    return {};
  };

  const runOauth = async (): Promise<string> => {
    if (!isInstagramOAuthLinked) {
      throw new Error('Instagram Builder is only linked when OAuth mode is active.');
    }

    if (isInsightEndpoint && rangeDays === 'custom') {
      const dateError = validateCustomDateRange(customStartDate, customEndDate);
      if (dateError) {
        throw new Error(dateError);
      }
    }

    const selectedIds = activeAccountId ? [activeAccountId] : [];
    if (selectedIds.length === 0 && session.accounts[0]) {
      selectedIds.push(session.accounts[0].id);
    }

    if (selectedIds.length === 0) {
      throw new Error('No Instagram account available for this session.');
    }

    const response = await fetchWithAuth(isInsightEndpoint ? '/api/insights' : '/api/media', {
      method: 'POST',
      body: JSON.stringify(
        isInsightEndpoint
          ? {
              accountInputs: [],
              selectedAccountIds: selectedIds,
              metrics,
              period,
              rangeDays,
              customStartDate: customStartDate ? format(customStartDate, 'yyyy-MM-dd') : undefined,
              customEndDate: customEndDate ? format(customEndDate, 'yyyy-MM-dd') : undefined,
              timeframe,
              breakdown: breakdown || undefined,
              mediaFormat,
            }
          : {
              accountInputs: [],
              selectedAccountIds: selectedIds,
              endpoint,
              fields: mediaFields,
              limit: mediaLimit,
            }
      ),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload?.error?.message ??
          (isInsightEndpoint ? 'Failed to fetch insight data.' : 'Failed to fetch media data.')
      );
    }

    if (isInsightEndpoint) {
      const nextReport = payload as InsightReport;
      setInsightReport(nextReport);
      setMediaReport(null);

      if (nextReport.query.warnings.length > 0) {
        return `Insight data fetched with warnings: ${nextReport.query.warnings[0]}`;
      }

      return 'Insight data fetched successfully.';
    }

    const nextReport = payload as MediaReport;
    setMediaReport(nextReport);
    setInsightReport(null);
    return 'Account media data fetched successfully.';
  };

  const clearReports = () => {
    setInsightReport(null);
    setMediaReport(null);
  };

  const getOutputFields = () => {
    if (mediaReport?.query.fields) {
      return mediaReport.query.fields;
    }

    if (insightReport) {
      const metricsFromQuery = insightReport.query.metrics;
      const metricsFromResults = insightReport.accounts.flatMap((account) =>
        account.metricResults.map((metricResult) => metricResult.metric)
      );
      const allMetrics = Array.from(new Set([...metricsFromQuery, ...metricsFromResults]));

      return ['generatedAt', 'endTime', 'metric', 'period', 'totalValue', ...allMetrics];
    }

    return [];
  };

  const buildSourceAccount = () => {
    if (insightReport?.accounts[0]?.accountId) {
      return `instagram:${insightReport.accounts[0].accountId}`;
    }

    if (mediaReport?.accounts[0]?.accountId) {
      return `instagram:${mediaReport.accounts[0].accountId}`;
    }

    return 'instagram:unknown';
  };

  const formatMediaCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  const builderCardProps = useMemo<ComponentProps<typeof InstagramBuilderCard>>(
    () => ({
      selectedIdType,
      setSelectedIdType,
      selectedEndpointId,
      setSelectedEndpointId,
      activeEndpoint,
      isMediaIdType,
      idTypeDropdownOptions,
      edgeDropdownOptions,
      loadingMedia,
      selectedMediaId,
      setSelectedMediaId,
      mediaPickerOptions,
      accountMediaList,
      selectedMediaType,
      setSelectedMediaType,
      isInsightEndpoint,
      isMediaEndpoint,
      metrics,
      setMetrics,
      activeMetricOptions,
      period,
      setPeriod,
      timeframe,
      setTimeframe,
      breakdown,
      setBreakdown,
      rangeDays,
      setRangeDays,
      registryValidation,
      registryWarnings,
      selectionWarning,
      customStartDate,
      setCustomStartDate,
      customEndDate,
      setCustomEndDate,
      customDateError,
      setCustomDateError,
      startDatePopoverOpen,
      setStartDatePopoverOpen,
      endDatePopoverOpen,
      setEndDatePopoverOpen,
      mediaFields,
      setMediaFields,
      mediaLimit,
      setMediaLimit,
      activeFieldOptions,
      periodDropdownOptions,
      timeframeDropdownOptions,
      breakdownDropdownOptions,
      dateRangeDropdownOptions,
      NO_BREAKDOWN_VALUE,
      parseRangeDays,
      validateCustomDateRange,
    }),
    [
      selectedIdType,
      selectedEndpointId,
      activeEndpoint,
      isMediaIdType,
      idTypeDropdownOptions,
      edgeDropdownOptions,
      loadingMedia,
      selectedMediaId,
      mediaPickerOptions,
      accountMediaList,
      selectedMediaType,
      isInsightEndpoint,
      isMediaEndpoint,
      metrics,
      activeMetricOptions,
      period,
      timeframe,
      breakdown,
      rangeDays,
      registryValidation,
      registryWarnings,
      selectionWarning,
      customStartDate,
      customEndDate,
      customDateError,
      startDatePopoverOpen,
      endDatePopoverOpen,
      mediaFields,
      mediaLimit,
      activeFieldOptions,
      periodDropdownOptions,
      timeframeDropdownOptions,
      breakdownDropdownOptions,
      dateRangeDropdownOptions,
    ]
  );

  return {
    hasOAuthConnection,
    isInstagramOAuthLinked,
    builderCardProps,
    requestParameterRows,
    parameterDrafts,
    setParameterDrafts,
    newParamKey,
    setNewParamKey,
    newParamValue,
    setNewParamValue,
    removeParameter,
    addParameter,
    commitParameterDraft,
    setEditableUrlFromInput,
    syncFromUrlInputInstagram,
    runOauth,
    isInsightEndpoint,
    isMediaEndpoint,
    insightReport,
    mediaReport,
    clearReports,
    mediaTableFields,
    mediaRows,
    formatMediaCellValue,
    getOutputFields,
    buildSourceAccount,
  };
}
