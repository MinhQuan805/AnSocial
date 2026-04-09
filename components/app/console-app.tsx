"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  Download,
  ExternalLink,
  Info,
  LoaderCircle,
  Lock,
  Play,
  Plus,
  Plug,
  X,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { InsightBreakdown, InsightTimeframe } from "@/lib/core/domain";
import {
  ACCOUNT_MEDIA_FIELD_OPTIONS,
  DEFAULT_ACCOUNT_MEDIA_FIELDS,
} from "@/lib/insights/media-fields";
import { INSIGHT_METRIC_OPTIONS, resolveInsightRequest } from "@/lib/insights/metric-rules";
import { buildGraphApiUrl, buildGraphMediaApiUrl } from "@/lib/utils/api-url";

type SessionView = {
  notionWorkspaceName: string | null;
  notionTargetPageId: string | null;
  facebookConnected: boolean;
  remainingFreeSaves: number;
  accounts: Array<{ id: string; username: string }>;
};

type InsightReport = {
  query: {
    requestedMetrics: string[];
    period: "day" | "lifetime";
    rangeDays: 7 | 30;
    metrics: string[];
    metricType: "total_value" | "time_series";
    timeframe?: "this_week" | "this_month";
    breakdown?: InsightBreakdown;
    warnings: string[];
    mediaFormat: "ALL" | "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL_ALBUM";
    urlPreview: string;
  };
  invalidAccounts: string[];
  generatedAt: string;
  accounts: Array<{
    accountId: string;
    accountHandle: string;
    engagementRate: number;
    reach: Array<{ endTime: string; value: number }>;
    impressions: Array<{ endTime: string; value: number }>;
    accountsEngaged: Array<{ endTime: string; value: number }>;
    profileViews: Array<{ endTime: string; value: number }>;
    metricResults: Array<{
      metric: string;
      period: string;
      totalValue: number;
      points: Array<{ endTime: string; value: number }>;
      breakdowns: Array<{
        metric: string;
        dimensionKeys: string[];
        dimensionValues: string[];
        value: number;
        endTime?: string;
      }>;
    }>;
    recommendations: Array<{ title: string; summary: string; confidence: string }>;
  }>;
};

type MediaReport = {
  query: {
    endpoint: "account_media" | "tagged_media";
    fields: string[];
    limit: number;
    urlPreview: string;
  };
  invalidAccounts: string[];
  accounts: Array<{
    accountId: string;
    accountHandle: string;
    items: Array<Record<string, unknown>>;
  }>;
  generatedAt: string;
};

interface ConsoleAppProps {
  session: SessionView;
}

type EndpointKey = "account_insights" | "account_media" | "tagged_media";

const ENDPOINT_OPTIONS: Array<{ key: EndpointKey; label: string; path: string }> = [
  { key: "account_insights", label: "Account Insights", path: "/{ig_account_id}/insights" },
  { key: "account_media", label: "Account Media", path: "/{ig_account_id}/media" },
  { key: "tagged_media", label: "Tagged Media", path: "/{ig_account_id}/tags" },
];

const METRIC_GROUPS = Object.entries(
  INSIGHT_METRIC_OPTIONS.reduce<Record<string, typeof INSIGHT_METRIC_OPTIONS>>((acc, item) => {
    const groupItems = acc[item.uiGroup] ?? [];
    acc[item.uiGroup] = [...groupItems, item];
    return acc;
  }, {}),
).map(([title, options]) => ({ title, options }));

const METRIC_OPTIONS = INSIGHT_METRIC_OPTIONS;

const MEDIA_FIELD_GROUPS = Object.entries(
  ACCOUNT_MEDIA_FIELD_OPTIONS.reduce<Record<string, typeof ACCOUNT_MEDIA_FIELD_OPTIONS>>(
    (acc, item) => {
      const groupItems = acc[item.uiGroup] ?? [];
      acc[item.uiGroup] = [...groupItems, item];
      return acc;
    },
    {},
  ),
).map(([title, options]) => ({ title, options }));

const BREAKDOWN_LABELS: Record<InsightBreakdown, string> = {
  contact_button_type: "Contact Button Type",
  follow_type: "Follow Type",
  follower_type: "Follower Type",
  media_product_type: "Media Product Type",
  age: "Age",
  city: "City",
  country: "Country",
  gender: "Gender",
};

const TIMEFRAME_OPTIONS: Array<{ label: string; value: InsightTimeframe }> = [
  { label: "This week (7 days)", value: "this_week" },
  { label: "This month (30 days)", value: "this_month" },
];

const DATE_RANGE_OPTIONS: Array<{ label: string; value: 7 | 30 }> = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

export function ConsoleApp({ session }: ConsoleAppProps) {
  const [endpoint, setEndpoint] = useState<EndpointKey>("account_insights");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    session.accounts[0]?.id ? [session.accounts[0].id] : [],
  );
  const [accountInputText, setAccountInputText] = useState("");
  const [metrics, setMetrics] = useState<string[]>(["reach", "accounts_engaged"]);
  const [mediaFields, setMediaFields] = useState<string[]>(DEFAULT_ACCOUNT_MEDIA_FIELDS);
  const [mediaLimit, setMediaLimit] = useState(25);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [timeframe, setTimeframe] = useState<InsightTimeframe>("this_week");
  const [breakdown, setBreakdown] = useState<InsightBreakdown | "">("");
  const mediaFormat: "ALL" | "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL_ALBUM" = "ALL";
  const [metricsMenuOpen, setMetricsMenuOpen] = useState(false);
  const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false);
  const [notionPageId, setNotionPageId] = useState(session.notionTargetPageId ?? "");
  const [saveToNotion, setSaveToNotion] = useState(true);

  const [insightReport, setInsightReport] = useState<InsightReport | null>(null);
  const [mediaReport, setMediaReport] = useState<MediaReport | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metricsMenuRef = useRef<HTMLDivElement | null>(null);
  const metricsMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const metricsButtonRef = useRef<HTMLButtonElement | null>(null);
  const fieldsMenuRef = useRef<HTMLDivElement | null>(null);
  const fieldsMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const fieldsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [metricsMenuPosition, setMetricsMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const [fieldsMenuPosition, setFieldsMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const isInsightEndpoint = endpoint === "account_insights";
  const isMediaEndpoint = endpoint === "account_media" || endpoint === "tagged_media";

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedMetricsTrigger = metricsMenuRef.current?.contains(target);
      const clickedMetricsPanel = metricsMenuPanelRef.current?.contains(target);
      const clickedFieldsTrigger = fieldsMenuRef.current?.contains(target);
      const clickedFieldsPanel = fieldsMenuPanelRef.current?.contains(target);

      if (!clickedMetricsTrigger && !clickedMetricsPanel) {
        setMetricsMenuOpen(false);
      }

      if (!clickedFieldsTrigger && !clickedFieldsPanel) {
        setFieldsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!metricsMenuOpen) return;

    const updatePosition = () => {
      const rect = metricsButtonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMetricsMenuPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [metricsMenuOpen]);

  useEffect(() => {
    if (!fieldsMenuOpen) return;

    const updatePosition = () => {
      const rect = fieldsButtonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setFieldsMenuPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [fieldsMenuOpen]);

  const accountInputs = useMemo(
    () => accountInputText.split("\n").map((item) => item.trim()).filter(Boolean),
    [accountInputText],
  );

  const activeAccountId = selectedAccountIds[0] ?? "";

  const selectedMetricOptions = useMemo(
    () => METRIC_OPTIONS.filter((item) => metrics.includes(item.key)),
    [metrics],
  );

  const selectedMediaFieldOptions = useMemo(
    () => ACCOUNT_MEDIA_FIELD_OPTIONS.filter((item) => mediaFields.includes(item.key)),
    [mediaFields],
  );

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

  const selectionWarning = compatibilityWarning ?? resolvedSelection.warnings[0] ?? null;

  useEffect(() => {
    if (breakdown && !resolvedSelection.allowedBreakdowns.includes(breakdown)) {
      setBreakdown("");
    }
  }, [breakdown, resolvedSelection.allowedBreakdowns]);

  const selectedEndpointPath = useMemo(
    () => ENDPOINT_OPTIONS.find((item) => item.key === endpoint)?.path ?? "",
    [endpoint],
  );

  const requestParameterRows = useMemo(
    () => {
      if (isMediaEndpoint) {
        return [
          { key: "fields", value: mediaFields.join(",") },
          { key: "limit", value: String(mediaLimit) },
        ];
      }

      const rows = [
        { key: "metric", value: resolvedSelection.effectiveMetrics.join(",") },
        { key: "metric_type", value: resolvedSelection.metricType },
        { key: "period", value: resolvedSelection.period },
      ];

      if (resolvedSelection.timeframe) {
        rows.push({ key: "timeframe", value: resolvedSelection.timeframe });
      }

      if (resolvedSelection.breakdown) {
        rows.push({ key: "breakdown", value: resolvedSelection.breakdown });
      }

      return rows;
    },
    [isMediaEndpoint, mediaFields, mediaLimit, resolvedSelection],
  );

  const [apiUrlPreview, setApiUrlPreview] = useState("");

  useEffect(() => {
    const accountId = activeAccountId || session.accounts[0]?.id || accountInputs[0] || "<ig_account_id>";

    if (isMediaEndpoint) {
      setApiUrlPreview(
        buildGraphMediaApiUrl({
          accountId,
          fields: mediaFields,
          limit: mediaLimit,
          endpoint,
        }),
      );
      return;
    }

    setApiUrlPreview(
      buildGraphApiUrl({
        accountId,
        metrics: resolvedSelection.effectiveMetrics,
        period: resolvedSelection.period,
        rangeDays: resolvedSelection.rangeDays,
        timeframe: resolvedSelection.timeframe,
        breakdown: resolvedSelection.breakdown,
      }),
    );
  }, [
    activeAccountId,
    accountInputs,
    endpoint,
    isMediaEndpoint,
    mediaFields,
    mediaLimit,
    resolvedSelection.breakdown,
    resolvedSelection.effectiveMetrics,
    resolvedSelection.period,
    resolvedSelection.rangeDays,
    resolvedSelection.timeframe,
    session.accounts,
  ]);

  const toggleMetric = (metric: string) => {
    setMetrics((prev) => {
      if (prev.includes(metric)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((item) => item !== metric);
      }
      return [...prev, metric];
    });
  };

  const removeMetric = (metric: string) => {
    setMetrics((prev) => {
      if (!prev.includes(metric)) {
        return prev;
      }

      if (prev.length === 1) {
        return prev;
      }

      return prev.filter((item) => item !== metric);
    });
  };

  const toggleMediaField = (field: string) => {
    setMediaFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) {
          return prev;
        }

        return prev.filter((item) => item !== field);
      }

      return [...prev, field];
    });
  };

  const removeMediaField = (field: string) => {
    setMediaFields((prev) => {
      if (!prev.includes(field)) {
        return prev;
      }

      if (prev.length === 1) {
        return prev;
      }

      return prev.filter((item) => item !== field);
    });
  };

  const runAnalysis = async () => {
    setRunning(true);
    setError(null);
    setStatus(null);

    try {
      const selectedIds = activeAccountId ? [activeAccountId] : selectedAccountIds;
      const response = await fetch(isInsightEndpoint ? "/api/insights" : "/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isInsightEndpoint
            ? {
                accountInputs,
                selectedAccountIds: selectedIds,
                metrics,
                period,
                rangeDays,
                timeframe,
                breakdown: breakdown || undefined,
                mediaFormat,
              }
            : {
                accountInputs,
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
            (isInsightEndpoint ? "Không thể lấy dữ liệu insight." : "Không thể lấy dữ liệu media."),
        );
      }

      if (isInsightEndpoint) {
        const nextReport = payload as InsightReport;
        setInsightReport(nextReport);
        setMediaReport(null);

        if (nextReport.query.warnings.length > 0) {
          setStatus(`Đã lấy dữ liệu insight với cảnh báo: ${nextReport.query.warnings[0]}`);
        } else {
          setStatus("Đã lấy dữ liệu insight thành công.");
        }
      } else {
        const nextReport = payload as MediaReport;
        setMediaReport(nextReport);
        setInsightReport(null);
        setStatus("Đã lấy dữ liệu account media thành công.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định.");
    } finally {
      setRunning(false);
    }
  };

  const saveResult = async () => {
    if (!insightReport) {
      setError("Save chỉ hỗ trợ dữ liệu Account Insight.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccount: insightReport.accounts[0]?.accountHandle ?? "unknown",
          report: insightReport,
          saveToNotion,
          notionPageId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Không thể lưu dữ liệu.");
      }

      setStatus(
        `Đã lưu dữ liệu. Lượt lưu miễn phí còn lại: ${payload.remainingFreeSaves}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định.");
    } finally {
      setSaving(false);
    }
  };

  const exportN8n = async () => {
    if (!insightReport) {
      setError("Export n8n chỉ hỗ trợ dữ liệu Account Insight.");
      return;
    }

    if (!notionPageId.trim()) {
      setError("Vui lòng nhập Notion Page ID trước khi export n8n.");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/n8n/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: notionPageId.trim(),
          graphUrl: insightReport.query.urlPreview,
          metrics: insightReport.query.metrics,
          period: insightReport.query.period,
          rangeDays: insightReport.query.rangeDays,
          metricType: insightReport.query.metricType,
          timeframe: insightReport.query.timeframe,
          breakdown: insightReport.query.breakdown,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error?.message ?? "Không thể export n8n workflow.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `ana-social-workflow-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      setStatus("Đã export n8n workflow JSON.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định.");
    } finally {
      setExporting(false);
    }
  };

  const activeUrlPreview =
    isInsightEndpoint
      ? insightReport?.query.urlPreview ?? apiUrlPreview
      : mediaReport?.query.urlPreview ?? apiUrlPreview;

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#f2f5ff_42%,_#eef2ff)] px-3 py-6 sm:px-6 lg:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card className="overflow-hidden rounded-2xl border-zinc-300/70 shadow-[0_14px_35px_-28px_rgba(24,39,75,0.45)]">
          <CardHeader className="border-b border-zinc-200/90 px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 text-white">
                  <Camera className="h-3.5 w-3.5" />
                </div>
                <div>
                  <CardTitle className="text-3xl">Instagram Request Builder</CardTitle>
                  <CardDescription className="mt-1 text-[1.05rem] text-zinc-600">
                    Build URL for the Instagram Graph API.
                  </CardDescription>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-zinc-500">
                <Info className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-4 pb-5 pt-4 sm:px-5 sm:pb-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endpoint" className="text-3xl text-zinc-800">
                  Endpoint
                </Label>
                <div className="relative">
                  <select
                    id="endpoint"
                    className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-lg text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value as EndpointKey)}
                  >
                    {ENDPOINT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-500">{selectedEndpointPath}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagramAccount" className="text-3xl text-zinc-800">
                  Instagram Account
                </Label>

                {session.facebookConnected ? (
                  <div className="relative">
                    <select
                      id="instagramAccount"
                      className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-20 text-lg text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                      value={activeAccountId}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSelectedAccountIds(nextValue ? [nextValue] : []);
                      }}
                    >
                      {session.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.username}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="absolute right-10 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition hover:bg-zinc-100"
                      onClick={() => setSelectedAccountIds([])}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  </div>
                ) : (
                  <a href="/api/auth/facebook/start" className="inline-flex">
                    <Button variant="outline" className="h-12 gap-2 px-4 text-base">
                      <Plug className="h-4 w-4" />
                      Connect Facebook Business
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {isInsightEndpoint ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-3xl text-zinc-800">Metrics</Label>
                    <div ref={metricsMenuRef} className="relative">
                      <button
                        ref={metricsButtonRef}
                        type="button"
                        className="flex min-h-[76px] w-full items-stretch rounded-lg border border-zinc-300 bg-white text-left"
                        onClick={() => setMetricsMenuOpen((prev) => !prev)}
                      >
                        <div className="flex flex-1 flex-wrap items-center gap-2 px-2 py-2">
                          {selectedMetricOptions.length === 0 ? (
                            <span className="px-1 text-base text-zinc-400">Select metrics</span>
                          ) : (
                            selectedMetricOptions.map((item) => (
                              <Badge
                                key={item.key}
                                className="border-blue-300 bg-blue-100 px-2.5 py-1 text-base text-blue-700"
                              >
                                <span>{item.label}</span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="ml-1 rounded text-blue-500 hover:text-blue-700"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    removeMetric(item.key);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      removeMetric(item.key);
                                    }
                                  }}
                                >
                                  x
                                </span>
                              </Badge>
                            ))
                          )}
                        </div>
                        <div className="flex w-[74px] items-center justify-center gap-2 border-l border-zinc-300 text-zinc-500">
                          <span
                            role="button"
                            tabIndex={0}
                            className="rounded p-1 transition hover:bg-zinc-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMetrics(["reach", "accounts_engaged"]);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setMetrics(["reach", "accounts_engaged"]);
                              }
                            }}
                          >
                            <X className="h-4 w-4" />
                          </span>
                          <ChevronDown className="h-5 w-5" />
                        </div>
                      </button>

                      {metricsMenuOpen && typeof document !== "undefined"
                        ? createPortal(
                            <div
                              ref={metricsMenuPanelRef}
                              className="fixed z-50 max-h-[340px] overflow-y-auto rounded-lg border border-zinc-300 bg-white py-1 shadow-[0_18px_40px_-28px_rgba(24,39,75,0.65)]"
                              style={{
                                top: metricsMenuPosition.top,
                                left: metricsMenuPosition.left,
                                width: metricsMenuPosition.width,
                              }}
                            >
                              {METRIC_GROUPS.map((group) => (
                                <div key={group.title}>
                                  <p className="px-3 py-1 text-base font-semibold text-zinc-400">{group.title}</p>
                                  {group.options.map((item) => {
                                    const selected = metrics.includes(item.key);

                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-zinc-100"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleMetric(item.key);
                                        }}
                                      >
                                        <div>
                                          <p className="text-base font-medium text-zinc-800">{item.label}</p>
                                          <p className="text-sm text-zinc-500">{item.description}</p>
                                        </div>
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          readOnly
                                          className="pointer-events-none mt-1 h-4 w-4"
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>,
                            document.body,
                          )
                        : null}
                    </div>

                    {selectionWarning ? (
                      <p className="flex items-start gap-2 text-sm text-amber-700">
                        <CircleAlert className="mt-0.5 h-4 w-4" />
                        <span>{selectionWarning}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="period" className="text-3xl text-zinc-800">
                        Period
                      </Label>
                      <div className="relative">
                        <select
                          id="period"
                          className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-16 text-lg text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                          value={period}
                          onChange={(event) => setPeriod(event.target.value as "day" | "week" | "month")}
                        >
                          <option value="day">Daily</option>
                          <option value="week">Weekly</option>
                          <option value="month">Monthly</option>
                        </select>
                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-400">x</span>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {resolvedSelection.group === "demographic" ? (
                        <>
                          <Label htmlFor="timeframe" className="text-3xl text-zinc-800">
                            Timeframe
                          </Label>
                          <div className="relative">
                            <select
                              id="timeframe"
                              className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-lg text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                              value={timeframe}
                              onChange={(event) =>
                                setTimeframe(event.target.value as InsightTimeframe)
                              }
                            >
                              {TIMEFRAME_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                          </div>
                        </>
                      ) : (
                        <>
                          <Label htmlFor="dateRange" className="text-3xl text-zinc-800">
                            Date Range
                          </Label>
                          <div className="relative">
                            <select
                              id="dateRange"
                              className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-lg text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                              value={rangeDays}
                              onChange={(event) => setRangeDays(Number(event.target.value) as 7 | 30)}
                            >
                              {DATE_RANGE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="breakdown" className="text-3xl text-zinc-800">
                    Breakdown
                  </Label>
                  <div className="relative">
                    <select
                      id="breakdown"
                      className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-lg text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                      value={breakdown}
                      onChange={(event) => setBreakdown(event.target.value as InsightBreakdown | "")}
                    >
                      <option value="">No breakdown</option>
                      {resolvedSelection.allowedBreakdowns.map((item) => (
                        <option key={item} value={item}>
                          {BREAKDOWN_LABELS[item]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-500">
                    Available breakdowns change automatically based on the selected metric group.
                  </p>
                </div>
              </>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-3xl text-zinc-800">Fields to retrieve</Label>
                  <div ref={fieldsMenuRef} className="relative">
                    <button
                      ref={fieldsButtonRef}
                      type="button"
                      className="flex min-h-[76px] w-full items-stretch rounded-lg border border-zinc-300 bg-white text-left"
                      onClick={() => setFieldsMenuOpen((prev) => !prev)}
                    >
                      <div className="flex flex-1 flex-wrap items-center gap-2 px-2 py-2">
                        {selectedMediaFieldOptions.length === 0 ? (
                          <span className="px-1 text-base text-zinc-400">Select media fields</span>
                        ) : (
                          selectedMediaFieldOptions.map((item) => (
                            <Badge
                              key={item.key}
                              className="border-sky-300 bg-sky-100 px-2.5 py-1 text-base text-sky-700"
                            >
                              <span>{item.label}</span>
                              <span
                                role="button"
                                tabIndex={0}
                                className="ml-1 rounded text-sky-500 hover:text-sky-700"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  removeMediaField(item.key);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    removeMediaField(item.key);
                                  }
                                }}
                              >
                                x
                              </span>
                            </Badge>
                          ))
                        )}
                      </div>
                      <div className="flex w-[74px] items-center justify-center gap-2 border-l border-zinc-300 text-zinc-500">
                        <span
                          role="button"
                          tabIndex={0}
                          className="rounded p-1 transition hover:bg-zinc-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMediaFields(DEFAULT_ACCOUNT_MEDIA_FIELDS);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              setMediaFields(DEFAULT_ACCOUNT_MEDIA_FIELDS);
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </span>
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </button>

                    {fieldsMenuOpen && typeof document !== "undefined"
                      ? createPortal(
                          <div
                            ref={fieldsMenuPanelRef}
                            className="fixed z-50 max-h-[340px] overflow-y-auto rounded-lg border border-zinc-300 bg-white py-1 shadow-[0_18px_40px_-28px_rgba(24,39,75,0.65)]"
                            style={{
                              top: fieldsMenuPosition.top,
                              left: fieldsMenuPosition.left,
                              width: fieldsMenuPosition.width,
                            }}
                          >
                            {MEDIA_FIELD_GROUPS.map((group) => (
                              <div key={group.title}>
                                <p className="px-3 py-1 text-base font-semibold text-zinc-400">{group.title}</p>
                                {group.options.map((item) => {
                                  const selected = mediaFields.includes(item.key);

                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-zinc-100"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleMediaField(item.key);
                                      }}
                                    >
                                      <div>
                                        <p className="text-base font-medium text-zinc-800">{item.label}</p>
                                        <p className="text-sm text-zinc-500">{item.description}</p>
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        readOnly
                                        className="pointer-events-none mt-1 h-4 w-4"
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>,
                          document.body,
                        )
                      : null}
                  </div>
                  <p className="text-sm text-zinc-500">
                    Media fields are independent from Insight metrics and map directly to /media or /tags.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mediaLimit" className="text-3xl text-zinc-800">
                    Limit
                  </Label>
                  <Input
                    id="mediaLimit"
                    type="number"
                    min={1}
                    max={100}
                    value={mediaLimit}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      if (!Number.isFinite(nextValue)) {
                        return;
                      }

                      setMediaLimit(Math.min(100, Math.max(1, nextValue)));
                    }}
                    className="h-12 text-lg"
                  />
                  <p className="text-sm text-zinc-500">
                    Max 100 records per account for each request.
                  </p>
                </div>
              </div>
            )}

            {session.accounts.length === 0 ? (
              <div className="space-y-2">
                <Label htmlFor="accountsManual" className="text-sm text-zinc-700">
                  Manual account list (one username or ID each line)
                </Label>
                <Textarea
                  id="accountsManual"
                  value={accountInputText}
                  onChange={(event) => setAccountInputText(event.target.value)}
                  placeholder={"@im_minhkwan\n17841478032910734"}
                  className="min-h-20 text-sm"
                />
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-[120px_1fr]">
              <div className="space-y-2">
                <Label className="text-3xl text-zinc-800">Method</Label>
                <div className="relative">
                  <select className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-9 text-lg text-zinc-800">
                    <option value="GET">GET</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-3xl text-zinc-800">URL</Label>
                <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-800">
                  {activeUrlPreview}
                </div>
              </div>
            </div>

            <Tabs defaultValue="parameters" className="overflow-hidden rounded-xl border border-zinc-300">
              <TabsList className="grid h-auto w-full grid-cols-4 rounded-none bg-zinc-50 p-0">
                <TabsTrigger
                  value="parameters"
                  className="rounded-none border-r border-zinc-200 px-4 py-3 text-base font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Parameters
                </TabsTrigger>
                <TabsTrigger
                  value="headers"
                  className="rounded-none border-r border-zinc-200 px-4 py-3 text-base font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Headers
                </TabsTrigger>
                <TabsTrigger
                  value="body"
                  className="rounded-none border-r border-zinc-200 px-4 py-3 text-base font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Body
                </TabsTrigger>
                <TabsTrigger
                  value="authorization"
                  className="rounded-none px-4 py-3 text-base font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Authorization
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parameters" className="mt-0 space-y-3 px-3 py-3">
                {requestParameterRows.map((item) => (
                  <div key={item.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input value={item.key} readOnly className="h-11 text-base" />
                    <Input value={item.value} readOnly className="h-11 text-base" />
                    <button
                      type="button"
                      className="justify-self-end rounded p-2 text-zinc-500 transition hover:bg-zinc-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}

                <Button type="button" variant="outline" className="h-10 gap-1.5 px-4 text-base">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </TabsContent>

              <TabsContent value="headers" className="mt-0 px-3 py-6 text-sm text-zinc-500">
                Authorization headers are managed automatically from your connected session.
              </TabsContent>

              <TabsContent value="body" className="mt-0 px-3 py-6 text-sm text-zinc-500">
                GET request does not include a request body.
              </TabsContent>

              <TabsContent value="authorization" className="mt-0 px-3 py-6 text-sm text-zinc-500">
                Facebook OAuth token is attached when your account is connected.
              </TabsContent>
            </Tabs>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notionPage" className="text-sm text-zinc-700">
                  Notion Page ID
                </Label>
                <Input
                  id="notionPage"
                  value={notionPageId}
                  onChange={(event) => setNotionPageId(event.target.value)}
                  placeholder="33c72ef6905280af9f96cb4080143936"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-zinc-700">Facebook Integration</Label>
                {session.facebookConnected ? (
                  <div className="flex h-11 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Facebook da ket noi
                  </div>
                ) : (
                  <a href="/api/auth/facebook/start" className="inline-flex">
                    <Button variant="outline" className="h-11 gap-2">
                      <Plug className="h-4 w-4" />
                      Connect Facebook Business
                    </Button>
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={saveResult}
                disabled={saving || !insightReport || !isInsightEndpoint}
                className="gap-2"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Save Data
              </Button>
              <Button
                variant="outline"
                onClick={exportN8n}
                disabled={exporting || !insightReport || !isInsightEndpoint}
                className="gap-2"
              >
                {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export n8n JSON
              </Button>
              <a href="/api/session" target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="ghost" className="gap-2 text-zinc-600">
                  <ExternalLink className="h-4 w-4" />
                  Debug Session
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-3 text-zinc-500">
              <div className="relative h-8 w-14 rounded-full bg-zinc-200 p-1">
                <div className="h-6 w-6 rounded-full bg-white shadow-sm" />
              </div>
              <span className="text-[1.05rem] font-medium">Auto Schedule</span>
              <span className="inline-flex items-center rounded border border-zinc-300 px-1.5 py-0.5 text-xs">
                <Lock className="h-3 w-3" />
              </span>
            </div>

            <Button
              onClick={runAnalysis}
              disabled={running}
              className="h-14 w-full rounded-full bg-blue-600 text-xl font-semibold hover:bg-blue-500"
            >
              {running ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Run
            </Button>

            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                id="saveToNotion"
                type="checkbox"
                checked={saveToNotion}
                onChange={(event) => setSaveToNotion(event.target.checked)}
              />
              <Label htmlFor="saveToNotion">Luu dong thoi vao Notion</Label>
              <Badge>Free con {session.remainingFreeSaves} luot</Badge>
            </div>

            {status ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700">{status}</Alert>
            ) : null}
            {error ? (
              <Alert className="border-red-200 bg-red-50 text-red-700">
                <div className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4" />
                  <span>{error}</span>
                </div>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {isInsightEndpoint ? "Account Insight Output" : "Account Media Output"}
            </CardTitle>
            <CardDescription>
              Data is rendered safely so missing fields from Instagram API do not break the UI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isInsightEndpoint && !insightReport ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                Chua co du lieu. Nhan Run de bat dau.
              </div>
            ) : isMediaEndpoint && !mediaReport ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                Chua co du lieu media. Nhan Run de bat dau.
              </div>
            ) : isInsightEndpoint && insightReport ? (
              <Tabs defaultValue="table">
                <TabsList>
                  <TabsTrigger value="table">Table</TabsTrigger>
                  <TabsTrigger value="insight">Recommendations</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>

                <TabsContent value="table">
                  {insightReport.invalidAccounts.length > 0 ? (
                    <Alert className="mb-3 border-amber-200 bg-amber-50 text-amber-800">
                      Tai khoan khong hop le: {insightReport.invalidAccounts.join(", ")}
                    </Alert>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Reach</TableHead>
                        <TableHead>Impressions</TableHead>
                        <TableHead>Engaged</TableHead>
                        <TableHead>Profile Views</TableHead>
                        <TableHead>Engagement Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insightReport.accounts.map((account) => {
                        const sum = (arr: Array<{ value: number }>) =>
                          arr.reduce((total, point) => total + point.value, 0);

                        return (
                          <TableRow key={account.accountId}>
                            <TableCell className="font-medium">@{account.accountHandle}</TableCell>
                            <TableCell>{sum(account.reach)}</TableCell>
                            <TableCell>{sum(account.impressions)}</TableCell>
                            <TableCell>{sum(account.accountsEngaged)}</TableCell>
                            <TableCell>{sum(account.profileViews)}</TableCell>
                            <TableCell>{(account.engagementRate * 100).toFixed(2)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="insight" className="space-y-3">
                  {insightReport.accounts.flatMap((account) => account.recommendations).length === 0 ? (
                    <p className="text-sm text-zinc-500">Khong co khuyen nghi.</p>
                  ) : (
                    insightReport.accounts.flatMap((account) => account.recommendations).map((item, index) => (
                      <div key={`${item.title}-${index}`} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                          <Badge className="capitalize">{item.confidence}</Badge>
                        </div>
                        <p className="text-sm text-zinc-600">{item.summary}</p>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="raw">
                  <pre className="max-h-[460px] overflow-auto rounded-md border border-zinc-200 bg-zinc-950 p-4 text-xs text-zinc-100">
                    {JSON.stringify(insightReport, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            ) : isMediaEndpoint && mediaReport ? (
              <Tabs defaultValue="table">
                <TabsList>
                  <TabsTrigger value="table">Table</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>

                <TabsContent value="table">
                  {mediaReport.invalidAccounts.length > 0 ? (
                    <Alert className="mb-3 border-amber-200 bg-amber-50 text-amber-800">
                      Tai khoan khong hop le: {mediaReport.invalidAccounts.join(", ")}
                    </Alert>
                  ) : null}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        {mediaTableFields.map((field) => (
                          <TableHead key={field}>{field}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mediaRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={mediaTableFields.length + 1} className="text-center text-zinc-500">
                            Khong co media records.
                          </TableCell>
                        </TableRow>
                      ) : (
                        mediaRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="font-medium">@{row.accountHandle}</TableCell>
                            {mediaTableFields.map((field) => (
                              <TableCell key={`${row.key}-${field}`}>{formatMediaCellValue(row.item[field])}</TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="raw">
                  <pre className="max-h-[460px] overflow-auto rounded-md border border-zinc-200 bg-zinc-950 p-4 text-xs text-zinc-100">
                    {JSON.stringify(mediaReport, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                Chua co du lieu. Nhan Run de bat dau.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
