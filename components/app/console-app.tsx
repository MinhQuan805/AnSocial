"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Info,
  LoaderCircle,
} from "lucide-react";

import {
  BREAKDOWN_LABELS,
  DATE_RANGE_OPTIONS,
  DEFAULT_INSIGHT_METRICS,
  ENDPOINT_OPTIONS,
  GRAPH_BASE_URL,
  ID_TYPE_OPTIONS,
  INSIGHT_ALLOWED_PARAM_KEYS,
  MEDIA_ALLOWED_PARAM_KEYS,
  MEDIA_BREAKDOWN_LABELS,
  METRIC_OPTIONS,
  TIMEFRAME_OPTIONS,
  getFieldGroupsFromEndpoint,
  getMetricGroupsFromEndpoint,
} from "@/components/app/console/constants";
import { MultiSelectDropdownField } from "@/components/app/console/forms/multi-select-dropdown-field";
import {
  SingleSelectDropdownField,
  type SingleSelectDropdownOption,
} from "@/components/app/console/forms/single-select-dropdown-field";
import { OutputCard } from "@/components/app/console/output/output-card";
import { ConsoleSidebar } from "@/components/app/console/sidebar/console-sidebar";
import { TutorialDialog } from "@/components/app/console/tutorial/tutorial-dialog";
import { InstagramBuilderCard } from "@/components/app/console/cards/builder/instagram-builder-card";
import { HttpRequestCard } from "@/components/app/console/cards/http-request/http-request-card";
import type {
  EndpointKey,
  HttpRequestReport,
  InsightReport,
  MediaReport,
  RequestParameterRow,
  SessionView,
} from "@/components/app/console/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  InsightBreakdown,
  InsightPeriod,
  InsightRangeDays,
  InsightTimeframe,
} from "@/lib/core/domain";
import {
  ACCOUNT_MEDIA_FIELD_OPTIONS,
  DEFAULT_ACCOUNT_MEDIA_FIELDS,
} from "@/lib/insights/media-fields";
import {
  type EndpointDefinition,
  type EndpointId,
  type IdType,
  getEdgeOptionsForIdType,
  getEndpointById,
  getFieldsForMediaType,
  getMetricsForMediaType,
  validateInsightSelection,
} from "@/lib/insights/endpoint-registry";
import { resolveInsightRequest } from "@/lib/insights/metric-rules";
import { buildGraphApiUrl, buildGraphMediaApiUrl, buildGraphMediaIdApiUrl } from "@/lib/utils/api-url";
import { cn } from "@/lib/utils/cn";
import { fetchWithAuth } from "@/lib/utils/use-auth-headers";
import { unixRangeFromDays } from "@/lib/utils/query";

interface ConsoleAppProps {
  session: SessionView;
}

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
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return uniqueOrdered(cleaned).filter((item) => allowedValues.has(item));
}

function sanitizeSingleUrlInput(raw: string): string {
  const compact = raw.replace(/\r?\n/g, " ").trim();
  const [firstToken] = compact.split(/\s+/);
  return firstToken ?? "";
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
  const fallbackPath = fallbackUrl.pathname.replace(/^\/v\d+\.\d+\/?/i, "/");
  const nextPath = parsed.pathname.replace(/^\/v\d+\.\d+\/?/i, "/");

  normalized.pathname = nextPath === "/" || nextPath.length === 0 ? fallbackPath : nextPath;
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

function validateCustomDateRange(startDate: Date | undefined, endDate: Date | undefined): string | null {
  if (!startDate || !endDate) {
    return "Both start and end dates are required";
  }

  if (startDate > endDate) {
    return "Start date must be before end date";
  }

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return `Date range must be 30 days or less (current: ${diffDays} days)`;
  }

  return null;
}

function parseRangeDays(raw: string): InsightRangeDays {
  if (raw === "today" || raw === "yesterday" || raw === "this_month" || raw === "last_month" || raw === "custom") {
    return raw;
  }

  const parsed = Number(raw);
  if (parsed === 1 || parsed === 7 || parsed === 14 || parsed === 30) {
    return parsed;
  }

  return 7;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];
const METHOD_OPTIONS: SingleSelectDropdownOption[] = HTTP_METHODS.map((method) => ({
  value: method,
  label: method,
}));
const NO_BREAKDOWN_VALUE = "__none__";

export function ConsoleApp({ session }: ConsoleAppProps) {
  // ── New two-level endpoint selection ──
  const [selectedIdType, setSelectedIdType] = useState<IdType>("ig_user_id");
  const [selectedEndpointId, setSelectedEndpointId] = useState<EndpointId>("ig_user_id/insights");

  // Legacy endpoint key — derived from new selection for API route compat
  const endpoint: EndpointKey = useMemo(() => {
    if (selectedEndpointId === "ig_user_id/insights") return "account_insights";
    if (selectedEndpointId === "ig_user_id/media") return "account_media";
    if (selectedEndpointId === "ig_user_id/tags") return "tagged_media";
    return "account_media"; // fallback for non-legacy endpoints
  }, [selectedEndpointId]);

  const activeEndpoint = useMemo<EndpointDefinition | undefined>(
    () => getEndpointById(selectedEndpointId),
    [selectedEndpointId],
  );

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    session.accounts[0]?.id ? [session.accounts[0].id] : [],
  );
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_INSIGHT_METRICS);
  const [mediaFields, setMediaFields] = useState<string[]>(DEFAULT_ACCOUNT_MEDIA_FIELDS);
  const [mediaLimit, setMediaLimit] = useState(25);
  const [period, setPeriod] = useState<InsightPeriod>("day");
  const [rangeDays, setRangeDays] = useState<InsightRangeDays>(7);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
  const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<InsightTimeframe>("this_week");
  const [breakdown, setBreakdown] = useState<InsightBreakdown | "">("");
  const mediaFormat: "ALL" | "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL_ALBUM" = "ALL";

  const [availableNotionPages, setAvailableNotionPages] = useState(session.notionPages);
  const [availableNotionDatabases, setAvailableNotionDatabases] = useState(session.notionDatabases);

  const [notionPageIds, setNotionPageIds] = useState<string[]>(
    session.notionTargetPageIds.length > 0
      ? session.notionTargetPageIds
      : session.notionPages[0]
        ? [session.notionPages[0].id]
        : [],
  );
  const [notionTableByPage, setNotionTableByPage] = useState<Record<string, string>>({});
  const [saveToNotion, setSaveToNotion] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(session.autoSchedule);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const [queryTab, setQueryTab] = useState<"parameters" | "headers" | "body" | "authorization">(
    "parameters",
  );
  const [requestMethod, setRequestMethod] = useState<HttpMethod>("GET");
  const [bodyMode, setBodyMode] = useState<"json" | "form-data" | "x-www-form-urlencoded">("json");
  const [authMode, setAuthMode] = useState<"oauth" | "token" | "basic">("oauth");
  const [editableUrl, setEditableUrl] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [urlInputDirty, setUrlInputDirty] = useState(false);
  const [parameterDrafts, setParameterDrafts] = useState<Record<string, string>>({});
  const [newParamKey, setNewParamKey] = useState("");
  const [newParamValue, setNewParamValue] = useState("");
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  const [bearerToken, setBearerToken] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [insightReport, setInsightReport] = useState<InsightReport | null>(null);
  const [mediaReport, setMediaReport] = useState<MediaReport | null>(null);
  const [httpReport, setHttpReport] = useState<HttpRequestReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Media picker state for ig_media_id ──
  const [selectedMediaId, setSelectedMediaId] = useState<string>("");
  const [accountMediaList, setAccountMediaList] = useState<
    Array<{ id: string; media_type: string; media_product_type?: string; permalink?: string; caption?: string; timestamp?: string }>
  >([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // ── Media type filter ──
  const [selectedMediaType, setSelectedMediaType] = useState<string>("ALL");

  const isMediaIdType = selectedIdType === "ig_media_id";
  const isInsightEndpoint = activeEndpoint?.type === "insights" || endpoint === "account_insights";
  const isMediaEndpoint = activeEndpoint?.type === "fields" || endpoint === "account_media" || endpoint === "tagged_media";

  const metricKeySet = useMemo(() => new Set(METRIC_OPTIONS.map((item) => item.key)), []);
  const mediaFieldKeySet = useMemo(
    () => new Set(ACCOUNT_MEDIA_FIELD_OPTIONS.map((item) => item.key)),
    [],
  );
  const timeframeValueSet = useMemo(() => new Set(TIMEFRAME_OPTIONS.map((item) => item.value)), []);
  const breakdownValueSet = useMemo(() => new Set(Object.keys(BREAKDOWN_LABELS)), []);

  const activeAccountId = selectedAccountIds[0] ?? session.accounts[0]?.id ?? "";
  const hasOAuthConnection = session.facebookConnected && session.accounts.length > 0;
  const isOAuthMode = authMode === "oauth" && hasOAuthConnection;
  const isHttpRequestMode = !isOAuthMode;

  // Keep sessionStorage fallback aligned with server session for ngrok/cookie edge cases.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const serverSessionId = session.sessionId?.trim();
    if (!serverSessionId) {
      return;
    }

    const currentSessionId = sessionStorage.getItem("ana_session_id");
    if (currentSessionId !== serverSessionId) {
      sessionStorage.setItem("ana_session_id", serverSessionId);
    }
  }, [session.sessionId]);

  useEffect(() => {
    if (!hasOAuthConnection && authMode === "oauth") {
      setAuthMode("token");
    }
  }, [authMode, hasOAuthConnection]);

  useEffect(() => {
    if (isOAuthMode && requestMethod !== "GET") {
      setRequestMethod("GET");
    }
  }, [isOAuthMode, requestMethod]);

  const resolvedSelection = useMemo(
    () =>
      resolveInsightRequest({
        metrics,
        period,
        rangeDays,
        timeframe,
        breakdown: breakdown || undefined,
      }),
    [metrics, period, rangeDays, timeframe, breakdown],
  );

  const compatibilityWarning = useMemo(
    () =>
      resolvedSelection.warnings.find((item) =>
        item.toLowerCase().includes("can't be combined"),
      ) ?? null,
    [resolvedSelection.warnings],
  );

  const selectionWarning = useMemo(() => {
    return compatibilityWarning ?? resolvedSelection.warnings.filter(w => !w.toLowerCase().includes("period"))[0] ?? null;
  }, [compatibilityWarning, resolvedSelection.warnings]);


  const endpointDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => ENDPOINT_OPTIONS.map((option) => ({ value: option.key, label: option.label })),
    [],
  );

  // ── New two-level dropdown options ──
  const idTypeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () =>
      ID_TYPE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        description: opt.description,
      })),
    [],
  );

  const edgeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () =>
      getEdgeOptionsForIdType(selectedIdType).map((opt) => ({
        value: opt.value,
        label: opt.label,
        description: opt.description,
      })),
    [selectedIdType],
  );

  // Registry validation for the active endpoint
  const registryValidation = useMemo(() => {
    if (!activeEndpoint || activeEndpoint.type !== "insights") return null;
    return validateInsightSelection(
      activeEndpoint,
      metrics,
      period,
      timeframe,
      breakdown || undefined,
    );
  }, [activeEndpoint, metrics, period, timeframe, breakdown]);

  // Dynamic metric/field options from active endpoint (filtered by media type)
  const activeMetricOptions = useMemo(() => {
    if (!activeEndpoint?.metrics) return [];
    const filtered = getMetricsForMediaType(activeEndpoint.metrics, selectedMediaType);
    return filtered.map((m) => ({
      key: m.key,
      label: m.label,
      description: m.description,
      uiGroup: m.group,
    }));
  }, [activeEndpoint, selectedMediaType]);

  const activeFieldOptions = useMemo(() => {
    if (!activeEndpoint?.fields) return [];
    const filtered = getFieldsForMediaType(activeEndpoint.fields, selectedMediaType);
    return filtered.map((f) => ({
      key: f.key,
      label: f.label,
      description: f.description,
      uiGroup: f.group,
    }));
  }, [activeEndpoint, selectedMediaType]);

  // Validation warnings/errors from registry
  const registryWarnings = useMemo(() => {
    if (!registryValidation) return [];
    return [...registryValidation.errors, ...registryValidation.warnings];
  }, [registryValidation]);


  const accountDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () =>
      session.accounts.map((account) => ({
        value: account.id,
        label: account.username,
        description: account.id,
      })),
    [session.accounts],
  );

  const periodDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => [
      { value: "day", label: "Daily" },
      { value: "week", label: "Weekly" },
      { value: "month", label: "Monthly" },
    ],
    [],
  );

  const timeframeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => TIMEFRAME_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    [],
  );

  const dateRangeDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => DATE_RANGE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label })),
    [],
  );

  const breakdownDropdownOptions = useMemo<SingleSelectDropdownOption[]>(
    () => [
      { value: NO_BREAKDOWN_VALUE, label: "No breakdown" },
      ...resolvedSelection.allowedBreakdowns.map((item) => ({
        value: item,
        label: BREAKDOWN_LABELS[item],
      })),
    ],
    [resolvedSelection.allowedBreakdowns],
  );

  const integrationSession = useMemo(
    () => ({
      ...session,
      notionPages: availableNotionPages,
      notionDatabases: availableNotionDatabases,
    }),
    [availableNotionDatabases, availableNotionPages, session],
  );

  const exportTargetIds = useMemo(
    () =>
      uniqueOrdered(
        notionPageIds
          .map((pageId) => notionTableByPage[pageId]?.trim() || pageId)
          .filter((targetId) => targetId.trim().length > 0),
      ),
    [notionPageIds, notionTableByPage],
  );

  const requestParameterRows = useMemo<Array<RequestParameterRow>>(
    () => {
      if (isMediaEndpoint) {
        return [
          { key: "fields", value: mediaFields.join(","), required: true },
          { key: "limit", value: String(mediaLimit), required: true },
        ];
      }

      const range = unixRangeFromDays(resolvedSelection.rangeDays, customStartDate, customEndDate);
      const rows: RequestParameterRow[] = [
        { key: "metric", value: resolvedSelection.effectiveMetrics.join(","), required: true },
        { key: "metric_type", value: resolvedSelection.metricType, required: true },
        { key: "period", value: resolvedSelection.period, required: true },
      ];

      if (resolvedSelection.timeframe) {
        rows.push({ key: "timeframe", value: resolvedSelection.timeframe, required: false });
      }

      if (resolvedSelection.breakdown) {
        rows.push({ key: "breakdown", value: resolvedSelection.breakdown, required: false });
      }

      if (resolvedSelection.period === "day") {
        rows.push({ key: "since", value: String(range.sinceUnix), required: false });
        rows.push({ key: "until", value: String(range.untilUnix), required: false });
      }

      return rows;
    },
    [
      customEndDate,
      customStartDate,
      isMediaEndpoint,
      mediaFields,
      mediaLimit,
      resolvedSelection,
    ],
  );

  const apiUrlPreview = useMemo(() => {
    const accountId = activeAccountId || "<ig_account_id>";

    // ── ig_media_id endpoints ──
    if (isMediaIdType && activeEndpoint) {
      const mediaId = selectedMediaId || "<ig_media_id>";
      const edge = activeEndpoint.edge;
      if (edge === "insights" && activeEndpoint.metrics) {
        const effectiveMetrics = registryValidation?.effectiveMetrics ?? metrics;
        return buildGraphMediaIdApiUrl({
          mediaId,
          edge: "insights",
          metrics: effectiveMetrics,
          metricType: registryValidation?.metricType ?? "total_value",
          period: registryValidation?.resolvedPeriod ?? "lifetime",
        });
      }
      return buildGraphMediaIdApiUrl({
        mediaId,
        edge,
        fields: mediaFields,
      });
    }

    // ── ig_user_id media/tags endpoints ──
    if (isMediaEndpoint && !isMediaIdType) {
      const mediaEndpointType = endpoint === "tagged_media" ? "tagged_media" : "account_media";
      return buildGraphMediaApiUrl({
        accountId,
        fields: mediaFields,
        limit: mediaLimit,
        endpoint: mediaEndpointType,
      });
    }

    // ── ig_user_id/insights ──
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

  const mediaTableFields = useMemo(() => {
    const fields = mediaReport?.query.fields ?? mediaFields;
    const normalized = Array.from(new Set(["id", ...fields])).filter((item) => item.length > 0);
    return normalized.slice(0, 8);
  }, [mediaFields, mediaReport?.query.fields]);

  const mediaRows = useMemo(
    () =>
      (mediaReport?.accounts ?? []).flatMap((account) =>
        account.items.map((item, index) => ({
          key: `${account.accountId}-${String(item.id ?? index)}`,
          accountHandle: account.accountHandle,
          item,
        })),
      ),
    [mediaReport?.accounts],
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

  // When IdType changes, reset edge to first available and reset metrics/fields
  useEffect(() => {
    const edges = getEdgeOptionsForIdType(selectedIdType);
    if (edges.length > 0 && !edges.some((e) => e.value === selectedEndpointId)) {
      setSelectedEndpointId(edges[0].value as EndpointId);
    }
  }, [selectedIdType, selectedEndpointId]);

  // When endpoint changes, reset metrics & fields to defaults
  useEffect(() => {
    if (!activeEndpoint) return;
    if (activeEndpoint.type === "insights" && activeEndpoint.defaultMetrics) {
      setMetrics(activeEndpoint.defaultMetrics);
    }
    if (activeEndpoint.type === "fields" && activeEndpoint.defaultFields) {
      setMediaFields(activeEndpoint.defaultFields);
    }
    // Reset media type filter when endpoint changes
    setSelectedMediaType("ALL");
  }, [activeEndpoint]);

  // Fetch media list when ig_media_id is selected
  useEffect(() => {
    if (!isMediaIdType) {
      setAccountMediaList([]);
      setSelectedMediaId("");
      return;
    }

    const accountId = activeAccountId;
    if (!accountId || !session.facebookConnected) {
      return;
    }

    let cancelled = false;
    setLoadingMedia(true);

    fetchWithAuth("/api/media", {
      method: "POST",
      body: JSON.stringify({
        accountInputs: [],
        selectedAccountIds: [accountId],
        endpoint: "account_media",
        fields: ["id", "media_type", "media_product_type", "permalink", "caption", "timestamp"],
        limit: 50,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const items =
          data?.accounts?.[0]?.items ??
          [];
        setAccountMediaList(
          items.map((item: Record<string, unknown>) => ({
            id: String(item.id ?? ""),
            media_type: String(item.media_type ?? "UNKNOWN"),
            media_product_type: item.media_product_type ? String(item.media_product_type) : undefined,
            permalink: item.permalink ? String(item.permalink) : undefined,
            caption: item.caption ? String(item.caption).slice(0, 80) : undefined,
            timestamp: item.timestamp ? String(item.timestamp) : undefined,
          })),
        );
        if (items.length > 0 && !selectedMediaId) {
          setSelectedMediaId(String(items[0].id ?? ""));
        }
      })
      .catch(() => {
        if (!cancelled) setAccountMediaList([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMedia(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isMediaIdType, activeAccountId, session.facebookConnected]);

  const mediaPickerOptions = useMemo<SingleSelectDropdownOption[]>(() => {
    if (accountMediaList.length === 0) return [];
    return accountMediaList.map((item) => {
      const typeLabel = item.media_type === "VIDEO" ? "🎬" : item.media_type === "IMAGE" ? "🖼️" : item.media_type === "CAROUSEL_ALBUM" ? "📸" : "📄";
      const dateLabel = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "";
      return {
        value: item.id,
        label: `${typeLabel} ${item.id}`,
        description: item.caption ? `${dateLabel} • ${item.caption}` : dateLabel,
      };
    });
  }, [accountMediaList]);

  // Auto-detect media_product_type from selected media
  useEffect(() => {
    if (!selectedMediaId || accountMediaList.length === 0) return;
    const media = accountMediaList.find((m) => m.id === selectedMediaId);
    if (media?.media_product_type) {
      setSelectedMediaType(media.media_product_type);
    }
  }, [selectedMediaId, accountMediaList]);

  // Auto-sync period to first allowed value when registry validation changes
  useEffect(() => {
    if (!registryValidation) return;
    const { allowedPeriods } = registryValidation;
    if (allowedPeriods.length > 0 && !allowedPeriods.includes(period)) {
      setPeriod(allowedPeriods[0] as InsightPeriod);
    }
  }, [registryValidation, period]);

  useEffect(() => {
    if (breakdown && !resolvedSelection.allowedBreakdowns.includes(breakdown)) {
      setBreakdown("");
    }
  }, [breakdown, resolvedSelection.allowedBreakdowns]);

  useEffect(() => {
    if (rangeDays !== "custom") {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
      setCustomDateError(null);
    }
  }, [rangeDays]);

  useEffect(() => {
    if (isHttpRequestMode) {
      if (!editableUrl.trim()) {
        setEditableUrl(apiUrlPreview);
      }
      return;
    }

    if (urlInputDirty) {
      return;
    }

    setEditableUrl(apiUrlPreview);
  }, [apiUrlPreview, editableUrl, isHttpRequestMode, urlInputDirty]);

  useEffect(() => {
    if (availableNotionPages.length === 0) {
      setNotionPageIds([]);
      return;
    }

    setNotionPageIds((previous) => {
      const availableIds = new Set(availableNotionPages.map((page) => page.id));
      const valid = previous.filter((item) => availableIds.has(item));
      if (valid.length > 0) {
        return valid;
      }

      return [availableNotionPages[0].id];
    });
  }, [availableNotionPages]);

  useEffect(() => {
    setNotionTableByPage((previous) => {
      const selected = new Set(notionPageIds);
      const nextEntries = Object.entries(previous).filter(
        ([pageId, databaseId]) => selected.has(pageId) && databaseId.trim().length > 0,
      );

      if (nextEntries.length === Object.keys(previous).length) {
        return previous;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [notionPageIds]);

  // Set initial value to "Create Default Table" for all selected pages
  useEffect(() => {
    const initialTableByPage: Record<string, string> = {};
    for (const pageId of notionPageIds) {
      initialTableByPage[pageId] = `__create_default_${pageId}__`;
    }
    setNotionTableByPage(initialTableByPage);
  }, [notionPageIds]);

  // Extract field names from output report
  const getOutputFields = (): string[] => {
    if (mediaReport?.query.fields) {
      // For media endpoints, use the actual fields returned
      return mediaReport.query.fields;
    }

    if (insightReport) {
      const metricsFromQuery = insightReport.query.metrics;
      const metricsFromResults = insightReport.accounts.flatMap((account) =>
        account.metricResults.map((metricResult) => metricResult.metric),
      );
      const metrics = Array.from(new Set([...metricsFromQuery, ...metricsFromResults]));

      return ["generatedAt", "endTime", "metric", "period", "totalValue", ...metrics];
    }

    return [];
  };

  const resetRequiredParameter = (key: string) => {
    if (isMediaEndpoint) {
      if (key === "fields") {
        setMediaFields(DEFAULT_ACCOUNT_MEDIA_FIELDS);
      }

      if (key === "limit") {
        setMediaLimit(25);
      }

      return;
    }

    switch (key) {
      case "metric":
        setMetrics(DEFAULT_INSIGHT_METRICS);
        break;
      case "metric_type":
        setStatus("metric_type is generated automatically from metrics and cannot be removed.");
        break;
      case "period":
        setPeriod("day");
        break;
      default:
        break;
    }
  };

  const applyParameter = (rawKey: string, rawValue: string) => {
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim();

    if (isMediaEndpoint) {
      if (!MEDIA_ALLOWED_PARAM_KEYS.has(key)) {
        setStatus(`Unsupported parameter "${key}" was removed.`);
        return;
      }

      if (key === "fields") {
        const nextFields = parseCsvValues(value, mediaFieldKeySet);
        setMediaFields(nextFields.length > 0 ? nextFields : DEFAULT_ACCOUNT_MEDIA_FIELDS);
        return;
      }

      if (key === "limit") {
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
      setStatus(`Unsupported parameter "${key}" was removed.`);
      return;
    }

    if (key === "metric") {
      const nextMetrics = parseCsvValues(value, metricKeySet);
      setMetrics(nextMetrics.length > 0 ? nextMetrics : DEFAULT_INSIGHT_METRICS);
      return;
    }

    if (key === "metric_type") {
      if (value !== "total_value" && value !== "time_series") {
        setStatus("metric_type was reset to default.");
      }
      return;
    }

    if (key === "period") {
      if (value === "day" || value === "week" || value === "month") {
        setPeriod(value);
      } else {
        setPeriod("day");
      }
      return;
    }

    if (key === "timeframe") {
      if (!value || !timeframeValueSet.has(value as InsightTimeframe)) {
        setTimeframe("this_week");
        return;
      }

      setTimeframe(value as InsightTimeframe);
      return;
    }

    if (key === "breakdown") {
      if (!value || !breakdownValueSet.has(value)) {
        setBreakdown("");
        return;
      }

      setBreakdown(value as InsightBreakdown);
      return;
    }

    if (key === "since") {
      const parsedDate = parseUnixDate(value);
      if (!parsedDate) {
        setCustomStartDate(undefined);
        setCustomDateError(null);
        return;
      }

      setRangeDays("custom");
      setCustomStartDate(parsedDate);
      if (customEndDate) {
        setCustomDateError(validateCustomDateRange(parsedDate, customEndDate));
      }
      return;
    }

    if (key === "until") {
      const parsedDate = parseUnixDate(value);
      if (!parsedDate) {
        setCustomEndDate(undefined);
        setCustomDateError(null);
        return;
      }

      setRangeDays("custom");
      setCustomEndDate(parsedDate);
      if (customStartDate) {
        setCustomDateError(validateCustomDateRange(customStartDate, parsedDate));
      }
    }
  };

  const removeParameter = (key: string, required: boolean) => {
    if (required) {
      resetRequiredParameter(key);
      return;
    }

    if (isMediaEndpoint) {
      if (key === "fields") {
        setMediaFields(DEFAULT_ACCOUNT_MEDIA_FIELDS);
      }

      return;
    }

    if (key === "timeframe") {
      setTimeframe("this_week");
      return;
    }

    if (key === "breakdown") {
      setBreakdown("");
      return;
    }

    if (key === "since" || key === "until") {
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
    setNewParamKey("");
    setNewParamValue("");
  };

  const removeCustomHeader = (key: string) => {
    const normalizedKey = key.trim().toLowerCase();
    setCustomHeaders((previous) =>
      previous.filter((item) => item.key.trim().toLowerCase() !== normalizedKey),
    );
  };

  const addCustomHeader = () => {
    const key = newHeaderKey.trim();
    const value = newHeaderValue.trim();

    if (!key || !value) {
      return;
    }

    setCustomHeaders((previous) => {
      const next = previous.filter(
        (item) => item.key.trim().toLowerCase() !== key.toLowerCase(),
      );
      next.push({ key, value });
      return next;
    });

    setNewHeaderKey("");
    setNewHeaderValue("");
  };

  const buildHttpHeaders = (): Record<string, string> => {
    const headerMap: Record<string, string> = {};

    for (const header of customHeaders) {
      const key = header.key.trim();
      const value = header.value.trim();
      if (!key || !value) {
        continue;
      }

      headerMap[key] = value;
    }

    if (authMode === "token") {
      const token = bearerToken.trim().replace(/^Bearer\s+/i, "");
      if (token) {
        headerMap.Authorization = `Bearer ${token}`;
      }
    }

    if (requestMethod !== "GET" && requestMethod !== "DELETE" && requestBody.trim()) {
      const hasContentType = Object.keys(headerMap).some(
        (key) => key.toLowerCase() === "content-type",
      );

      if (!hasContentType) {
        headerMap["Content-Type"] = "application/json";
      }
    }

    return headerMap;
  };

  const syncFromUrlInputInstagram = () => {
    if (isHttpRequestMode) {
      const singleUrl = sanitizeSingleUrlInput(editableUrl);
      if (!singleUrl) {
        setError("Please enter a URL before running the request.");
        return;
      }

      try {
        const parsed = new URL(singleUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("Only http:// and https:// URLs are supported.");
        }

        setEditableUrl(parsed.toString());
        setUrlInputDirty(false);
        setError(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Invalid URL.");
      }

      return;
    }

    const fallbackUrl = apiUrlPreview || `${GRAPH_BASE_URL}<ig_account_id>/insights`;
    const normalizedUrl = normalizeGraphUrl(editableUrl, fallbackUrl);
    const pathParts = normalizedUrl.pathname.split("/").filter(Boolean);
    const versionIndex = pathParts.findIndex((part) => /^v\d+\.\d+$/i.test(part));
    const scopedPath = versionIndex >= 0 ? pathParts.slice(versionIndex + 1) : pathParts;
    const [accountIdFromPath, endpointPath] = scopedPath;

    if (endpointPath === "insights") {
      setSelectedIdType("ig_user_id");
      setSelectedEndpointId("ig_user_id/insights");
    } else if (endpointPath === "media") {
      setSelectedIdType("ig_user_id");
      setSelectedEndpointId("ig_user_id/media");
    } else if (endpointPath === "tags") {
      setSelectedIdType("ig_user_id");
      setSelectedEndpointId("ig_user_id/tags");
    }

    if (accountIdFromPath) {
      const matchedAccount = session.accounts.find((item) => item.id === accountIdFromPath);
      if (matchedAccount) {
        setSelectedAccountIds([matchedAccount.id]);
      }
    }

    const params = normalizedUrl.searchParams;

    if (endpointPath === "media" || endpointPath === "tags") {
      const fieldsParam = getFirstQueryValue(params, "fields") ?? "";
      const parsedFields = parseCsvValues(fieldsParam, mediaFieldKeySet);
      setMediaFields(parsedFields.length > 0 ? parsedFields : DEFAULT_ACCOUNT_MEDIA_FIELDS);

      const limitParam = getFirstQueryValue(params, "limit");
      const parsedLimit = Number(limitParam);
      setMediaLimit(
        Number.isFinite(parsedLimit)
          ? Math.min(100, Math.max(1, Math.round(parsedLimit)))
          : 25,
      );
    }

    if (endpointPath === "insights") {
      const metricParam = getFirstQueryValue(params, "metric") ?? "";
      const parsedMetrics = parseCsvValues(metricParam, metricKeySet);
      setMetrics(parsedMetrics.length > 0 ? parsedMetrics : DEFAULT_INSIGHT_METRICS);

      const periodParam = getFirstQueryValue(params, "period");
      if (periodParam === "day" || periodParam === "week" || periodParam === "month") {
        setPeriod(periodParam);
      } else {
        setPeriod("day");
      }

      const timeframeParam = getFirstQueryValue(params, "timeframe");
      if (timeframeParam && timeframeValueSet.has(timeframeParam as InsightTimeframe)) {
        setTimeframe(timeframeParam as InsightTimeframe);
      }

      const breakdownParam = getFirstQueryValue(params, "breakdown");
      setBreakdown(
        breakdownParam && breakdownValueSet.has(breakdownParam)
          ? (breakdownParam as InsightBreakdown)
          : "",
      );

      const parsedSinceDate = parseUnixDate(getFirstQueryValue(params, "since"));
      const parsedUntilDate = parseUnixDate(getFirstQueryValue(params, "until"));

      if (parsedSinceDate || parsedUntilDate) {
        setRangeDays("custom");
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
    setError(null);
    setStatus("URL synced to parameters. Unsupported keys were ignored automatically.");
  };

  const handleLogout = () => {
    setLoggingOut(true);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("ana_session_id");
      window.location.href = "/";
    }
  };

  const handleNotionTableChange = (pageId: string, databaseId: string) => {
    setNotionTableByPage((previous) => {
      if (!databaseId.trim()) {
        if (!(pageId in previous)) {
          return previous;
        }

        const next = { ...previous };
        delete next[pageId];
        return next;
      }

      if (previous[pageId] === databaseId) {
        return previous;
      }

      return {
        ...previous,
        [pageId]: databaseId,
      };
    });
  };

  const handleRefreshPages = (
    pages: Array<{
      id: string;
      title: string;
      databases?: Array<{ id: string; title: string; parentPageId?: string | null }>;
    }>,
  ) => {
    setAvailableNotionPages(pages);
    setAvailableNotionDatabases(
      pages
        .flatMap((page) =>
          (page.databases ?? []).map((database) => ({
            id: database.id,
            title: database.title,
            parentPageId: database.parentPageId ?? page.id,
          })),
        )
        .reduce<Array<{ id: string; title: string; parentPageId: string }>>((acc, database) => {
          if (!database.id.trim()) {
            return acc;
          }

          if (acc.some((item) => item.id === database.id)) {
            return acc;
          }

          acc.push(database);
          return acc;
        }, []),
    );
    setStatus("Notion pages refreshed successfully");
  };

  const handleDatabaseCreated = (database: { id: string; title: string; parentPageId: string }) => {
    setAvailableNotionDatabases((previous) => [...previous, database]);
    setNotionTableByPage((previous) => ({
      ...previous,
      [database.parentPageId]: database.id,
    }));
    setStatus(`Notion table "${database.title}" created successfully`);
  };

  const saveScheduleSettings = async () => {
    setScheduleSaving(true);
    setError(null);

    try {
      const response = await fetchWithAuth("/api/schedule", {
        method: "POST",
        body: JSON.stringify({
          autoSchedule,
          notionTargetPageIds: notionPageIds,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to update schedule settings.");
      }

      setStatus("Auto schedule settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to update schedule settings.");
    } finally {
      setScheduleSaving(false);
    }
  };

  const runOauth = async () => {
    if (isInsightEndpoint && rangeDays === "custom") {
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
      throw new Error("No Instagram account available for this session.");
    }

    const response = await fetchWithAuth(isInsightEndpoint ? "/api/insights" : "/api/media", {
      method: "POST",
      body: JSON.stringify(
        isInsightEndpoint
          ? {
            accountInputs: [],
            selectedAccountIds: selectedIds,
            metrics,
            period,
            rangeDays,
            customStartDate: customStartDate ? format(customStartDate, "yyyy-MM-dd") : undefined,
            customEndDate: customEndDate ? format(customEndDate, "yyyy-MM-dd") : undefined,
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
          },
      ),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload?.error?.message ??
        (isInsightEndpoint ? "Failed to fetch insight data." : "Failed to fetch media data."),
      );
    }

    setHttpReport(null);

    if (isInsightEndpoint) {
      const nextReport = payload as InsightReport;
      setInsightReport(nextReport);
      setMediaReport(null);

      if (nextReport.query.warnings.length > 0) {
        setStatus(`Insight data fetched with warnings: ${nextReport.query.warnings[0]}`);
      } else {
        setStatus("Insight data fetched successfully.");
      }
      return;
    }

    const nextReport = payload as MediaReport;
    setMediaReport(nextReport);
    setInsightReport(null);
    setStatus("Account media data fetched successfully.");
  };

  const runHttpRequest = async () => {
    const singleUrl = sanitizeSingleUrlInput(editableUrl);
    if (!singleUrl) {
      throw new Error("Please enter a URL before running the request.");
    }

    const targetUrl = new URL(singleUrl);
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      throw new Error("Only http:// and https:// URLs are supported.");
    }

    const outgoingHeaders = buildHttpHeaders();
    const includeBody = requestMethod !== "GET";

    const response = await fetchWithAuth("/api/http/request", {
      method: "POST",
      body: JSON.stringify({
        url: targetUrl.toString(),
        method: requestMethod,
        headers: outgoingHeaders,
        body: includeBody ? requestBody : undefined,
      }),
    });

    const payload = (await response.json()) as HttpRequestReport | { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(payload && "error" in payload ? payload.error?.message ?? "HTTP request failed." : "HTTP request failed.");
    }

    const nextReport = payload as HttpRequestReport;
    setHttpReport(nextReport);
    setInsightReport(null);
    setMediaReport(null);
    setStatus(`HTTP request completed (${nextReport.response.status} ${nextReport.response.statusText}).`);
  };

  const runAnalysis = async () => {
    setRunning(true);
    setError(null);
    setStatus(null);

    try {
      if (isOAuthMode) {
        await runOauth();
      } else {
        await runHttpRequest();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error.");
    } finally {
      setRunning(false);
    }
  };

  const saveResult = async () => {
    if (!insightReport && !mediaReport) {
      setError("No data to save. Please run analysis first.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const updatedTableByPage = { ...notionTableByPage };
      const outputFields = getOutputFields();

      if (saveToNotion) {
        // Check if any selected tables are "Create Default Table" and create them if needed.
        for (const [pageId, tableValue] of Object.entries(notionTableByPage)) {
          if (tableValue.startsWith("__create_default_")) {
            const page = session.notionPages.find((p) => p.id === pageId);
            if (!page) continue;

            try {
              const defaultTableName = `${page.title} - Default`;
              const createResponse = await fetchWithAuth("/api/notion/databases", {
                method: "POST",
                body: JSON.stringify({
                  parentPageId: pageId,
                  databaseTitle: defaultTableName,
                  defaultFields: outputFields.length > 0 ? outputFields : DEFAULT_ACCOUNT_MEDIA_FIELDS,
                }),
              });

              if (!createResponse.ok) {
                const errorData = await createResponse.json().catch(() => ({}));
                const errorMessage = typeof errorData.error === "string"
                  ? errorData.error
                  : typeof errorData.error === "object"
                    ? JSON.stringify(errorData.error)
                    : "Failed to create default table";
                throw new Error(errorMessage);
              }

              const database = await createResponse.json();
              updatedTableByPage[pageId] = database.id;

              setNotionTableByPage((prev) => ({
                ...prev,
                [pageId]: database.id,
              }));

              setAvailableNotionDatabases((prev) => [
                ...prev,
                { id: database.id, title: database.title, parentPageId: pageId },
              ]);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
              console.error(`Failed to create default table for page ${pageId}:`, errorMessage);
              setError(errorMessage);
              setSaving(false);
              return;
            }
          }
        }
      }

      const response = await fetchWithAuth("/api/save", {
        method: "POST",
        body: JSON.stringify({
          sourceAccount:
            insightReport?.accounts[0]?.accountId
              ? `instagram:${insightReport.accounts[0].accountId}`
              : mediaReport?.accounts[0]?.accountId
                ? `instagram:${mediaReport.accounts[0].accountId}`
                : "instagram:unknown",
          report: insightReport ?? undefined,
          mediaReport: mediaReport ?? undefined,
          saveToNotion,
          notionPageIds,
          notionDatabaseByPageId: updatedTableByPage,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Failed to save data.");
      }

      // TODO: Re-enable when free limit is active
      // setStatus(`Data saved. Remaining free saves: ${payload.remainingFreeSaves}.`);
      const notionStatus =
        typeof payload?.notionMessage === "string" ? payload.notionMessage.trim() : "";

      if (saveToNotion) {
        if (notionStatus.length > 0) {
          setStatus(notionStatus);
        } else if (payload?.savedToNotion) {
          setStatus("Data saved to Notion successfully.");
        } else {
          setStatus("Data saved locally. No data was written to Notion.");
        }
      } else {
        setStatus("Data saved successfully.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error.");
    } finally {
      setSaving(false);
    }
  };

  const exportN8n = async () => {
    if (!insightReport) {
      setError("Export n8n only supports Account Insight data.");
      return;
    }

    if (exportTargetIds.length === 0) {
      setError("Please select at least one Notion page before exporting n8n workflow.");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await fetchWithAuth("/api/n8n/export", {
        method: "POST",
        body: JSON.stringify({
          pageIds: exportTargetIds,
          graphUrl: insightReport.query.urlPreview,
          metrics: insightReport.query.metrics,
          period: insightReport.query.period,
          rangeDays: insightReport.query.rangeDays,
          metricType: insightReport.query.metricType,
          timeframe: insightReport.query.timeframe,
          breakdown: insightReport.query.breakdown,
          autoSchedule,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error?.message ?? "Failed to export n8n workflow.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `ana-social-workflow-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      setStatus("Exported n8n workflow JSON.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error.");
    } finally {
      setExporting(false);
    }
  };

  const formatMediaCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "-";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  };

  return (
    <SidebarProvider defaultOpen>
      <ConsoleSidebar
        notionWorkspaceName={session.notionWorkspaceName}
        remainingFreeSaves={session.remainingFreeSaves}
        loggingOut={loggingOut}
        onNewRequest={() => {
          setInsightReport(null);
          setMediaReport(null);
          setHttpReport(null);
          setStatus("Ready to create a new request.");
          setError(null);
        }}
        onOpenTutorial={() => setTutorialOpen(true)}
        onLogout={handleLogout}
      />

      <SidebarInset className="min-h-svh">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Instagram Request Builder</p>
            <p className="truncate text-xs text-muted-foreground">Modular console with reusable integrations</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setTutorialOpen(true)}>
            <Info className="h-4 w-4" />
            Tutorial
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid gap-6">
            <InstagramBuilderCard
              selectedIdType={selectedIdType}
              setSelectedIdType={setSelectedIdType}
              selectedEndpointId={selectedEndpointId}
              setSelectedEndpointId={setSelectedEndpointId}
              activeEndpoint={activeEndpoint}
              isMediaIdType={isMediaIdType}
              idTypeDropdownOptions={idTypeDropdownOptions}
              edgeDropdownOptions={edgeDropdownOptions}
              loadingMedia={loadingMedia}
              selectedMediaId={selectedMediaId}
              setSelectedMediaId={setSelectedMediaId}
              mediaPickerOptions={mediaPickerOptions}
              accountMediaList={accountMediaList}
              selectedMediaType={selectedMediaType}
              setSelectedMediaType={setSelectedMediaType}
              isInsightEndpoint={isInsightEndpoint}
              isMediaEndpoint={isMediaEndpoint}
              metrics={metrics}
              setMetrics={setMetrics}
              activeMetricOptions={activeMetricOptions}
              period={period}
              setPeriod={setPeriod}
              timeframe={timeframe}
              setTimeframe={setTimeframe}
              breakdown={breakdown}
              setBreakdown={setBreakdown}
              rangeDays={rangeDays}
              setRangeDays={setRangeDays}
              registryValidation={registryValidation}
              registryWarnings={registryWarnings}
              selectionWarning={selectionWarning}
              customStartDate={customStartDate}
              setCustomStartDate={setCustomStartDate}
              customEndDate={customEndDate}
              setCustomEndDate={setCustomEndDate}
              customDateError={customDateError}
              setCustomDateError={setCustomDateError}
              startDatePopoverOpen={startDatePopoverOpen}
              setStartDatePopoverOpen={setStartDatePopoverOpen}
              endDatePopoverOpen={endDatePopoverOpen}
              setEndDatePopoverOpen={setEndDatePopoverOpen}
              mediaFields={mediaFields}
              setMediaFields={setMediaFields}
              mediaLimit={mediaLimit}
              setMediaLimit={setMediaLimit}
              activeFieldOptions={activeFieldOptions}
              periodDropdownOptions={periodDropdownOptions}
              timeframeDropdownOptions={timeframeDropdownOptions}
              breakdownDropdownOptions={breakdownDropdownOptions}
              dateRangeDropdownOptions={dateRangeDropdownOptions}
              NO_BREAKDOWN_VALUE={NO_BREAKDOWN_VALUE}
              parseRangeDays={parseRangeDays}
              validateCustomDateRange={validateCustomDateRange}
            />

            <HttpRequestCard
              queryTab={queryTab}
              setQueryTab={setQueryTab}
              requestMethod={requestMethod}
              setRequestMethod={setRequestMethod}
              isOAuthMode={isOAuthMode}
              editableUrl={editableUrl}
              setEditableUrl={setEditableUrl}
              syncFromUrlInputInstagram={syncFromUrlInputInstagram}
              requestParameterRows={requestParameterRows}
              parameterDrafts={parameterDrafts}
              setParameterDrafts={setParameterDrafts}
              newParamKey={newParamKey}
              setNewParamKey={setNewParamKey}
              newParamValue={newParamValue}
              setNewParamValue={setNewParamValue}
              removeParameter={removeParameter}
              addParameter={addParameter}
              commitParameterDraft={commitParameterDraft}
              customHeaders={customHeaders}
              newHeaderKey={newHeaderKey}
              setNewHeaderKey={setNewHeaderKey}
              newHeaderValue={newHeaderValue}
              setNewHeaderValue={setNewHeaderValue}
              addCustomHeader={addCustomHeader}
              removeCustomHeader={removeCustomHeader}
              bodyMode={bodyMode}
              setBodyMode={setBodyMode}
              requestBody={requestBody}
              setRequestBody={setRequestBody}
              authMode={authMode}
              setAuthMode={setAuthMode}
              hasOAuthConnection={hasOAuthConnection}
              bearerToken={bearerToken}
              setBearerToken={setBearerToken}
              running={running}
              runAnalysis={runAnalysis}
              saving={saving}
              exporting={exporting}
              status={status}
              error={error}
              isInsightEndpoint={isInsightEndpoint}
              insightReport={insightReport}
              mediaReport={mediaReport}
              httpReport={httpReport}
              integrationSession={integrationSession}
              selectedNotionPageIds={notionPageIds}
              setNotionPageIds={setNotionPageIds}
              notionTableByPage={notionTableByPage}
              handleNotionTableChange={handleNotionTableChange}
              autoSchedule={autoSchedule}
              setAutoSchedule={setAutoSchedule}
              saveScheduleSettings={saveScheduleSettings}
              scheduleSaving={scheduleSaving}
              handleRefreshPages={handleRefreshPages}
              handleDatabaseCreated={handleDatabaseCreated}
              saveToNotion={saveToNotion}
              setSaveToNotion={setSaveToNotion}
              saveResult={saveResult}
              exportN8n={exportN8n}
            />

            <OutputCard
              isHttpMode={isHttpRequestMode}
              isInsightEndpoint={isInsightEndpoint}
              isMediaEndpoint={isMediaEndpoint}
              httpReport={httpReport}
              insightReport={insightReport}
              mediaReport={mediaReport}
              mediaTableFields={mediaTableFields}
              mediaRows={mediaRows}
              formatMediaCellValue={formatMediaCellValue}
            />
          </div>
        </main>
      </SidebarInset>

      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </SidebarProvider>
  );
}