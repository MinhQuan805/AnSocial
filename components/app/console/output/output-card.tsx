"use client";

import { useMemo } from "react";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HttpRequestReport, InsightReport, MediaReport } from "@/components/app/console/types";
import {
  type JsonMappingField,
  extractJsonMappingFields,
  setMappingExpressionData,
} from "@/lib/utils/json-mapping";

interface OutputCardProps {
  isHttpMode: boolean;
  isInsightEndpoint: boolean;
  isMediaEndpoint: boolean;
  httpReport: HttpRequestReport | null;
  insightReport: InsightReport | null;
  mediaReport: MediaReport | null;
  mediaTableFields: string[];
  mediaRows: Array<{
    key: string;
    accountHandle: string;
    item: Record<string, unknown>;
  }>;
  formatMediaCellValue: (value: unknown) => string;
}

interface RawPayloadWithMappingProps {
  payloadText: string;
  mappingFields: JsonMappingField[];
}

function RawPayloadWithMapping({ payloadText, mappingFields }: RawPayloadWithMappingProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="max-h-[460px] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs font-semibold text-zinc-700">Drag fields to map values</p>
        <p className="mt-1 text-xs text-zinc-500">Drop into Parameters, Headers, Body, Token, or Basic auth inputs.</p>
        <div className="mt-3 grid gap-2">
          {mappingFields.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 bg-white px-2 py-2 text-xs text-zinc-500">
              No primitive JSON field found to map.
            </p>
          ) : (
            mappingFields.map((field) => (
              <button
                key={field.label}
                type="button"
                draggable
                onDragStart={(event) => {
                  setMappingExpressionData(event.dataTransfer, field.expression);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left text-xs transition hover:border-zinc-400 hover:bg-zinc-100 active:cursor-grabbing"
                title={field.expression}
              >
                <p className="truncate font-mono text-[11px] text-zinc-900">{field.label}</p>
                <p className="truncate text-[11px] text-zinc-500">{field.sample}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <pre className="max-h-[460px] overflow-auto rounded-md border border-zinc-200 bg-zinc-950 p-4 text-xs text-zinc-100 whitespace-pre-wrap break-all">
        {payloadText}
      </pre>
    </div>
  );
}

export function OutputCard({
  isHttpMode,
  isInsightEndpoint,
  isMediaEndpoint,
  httpReport,
  insightReport,
  mediaReport,
  mediaTableFields,
  mediaRows,
  formatMediaCellValue,
}: OutputCardProps) {
  const metricColumns = insightReport
    ? Array.from(
        new Set([
          ...insightReport.query.metrics,
          ...insightReport.accounts.flatMap((account) =>
            account.metricResults.map((metricResult) => metricResult.metric),
          ),
        ]),
      )
    : [];

  const toMetricLabel = (metricKey: string) =>
    metricKey
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
  };

  const formatHttpPayload = (payload: unknown) => {
    if (typeof payload === "string") {
      return payload;
    }

    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const httpMappingFields = useMemo(
    () => extractJsonMappingFields(httpReport?.response.data),
    [httpReport?.response.data],
  );

  const insightMappingFields = useMemo(() => extractJsonMappingFields(insightReport), [insightReport]);
  const mediaMappingFields = useMemo(() => extractJsonMappingFields(mediaReport), [mediaReport]);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-xl">
          {isHttpMode
            ? "HTTP Request Output"
            : isInsightEndpoint
              ? "Account Insight Output"
              : "Account Media Output"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isHttpMode && !httpReport ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
            No response yet. Configure request and press Run.
          </div>
        ) : isHttpMode && httpReport ? (
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="raw">Raw Response</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-3">
              <div className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{httpReport.request.method}</Badge>
                  <Badge>{httpReport.response.status}</Badge>
                  <span className="text-zinc-600">{httpReport.response.statusText}</span>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Request URL</p>
                  <p className="break-all font-mono text-xs text-zinc-900">{httpReport.request.url}</p>
                </div>
                {(httpReport.request.params?.length ?? 0) > 0 ? (
                  <div>
                    <p className="text-xs text-zinc-500">Query Parameters</p>
                    <p className="break-all font-mono text-xs text-zinc-900">
                      {httpReport.request.params?.map((item) => `${item.key}=${item.value}`).join("&")}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-zinc-500">Response Time</p>
                  <p className="text-xs text-zinc-900">{formatDateTime(httpReport.generatedAt)}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="raw">
              <RawPayloadWithMapping
                payloadText={formatHttpPayload(httpReport.response.data)}
                mappingFields={httpMappingFields}
              />
            </TabsContent>
          </Tabs>
        ) : isInsightEndpoint && !insightReport ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
            No data yet. Press Run to start.
          </div>
        ) : isMediaEndpoint && !mediaReport ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
            No media data yet. Press Run to start.
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
                <Alert className="mb-3 border-amber-300/80 bg-amber-50 text-amber-900">
                  <CircleAlert className="h-4 w-4" />
                  <AlertTitle>Invalid accounts</AlertTitle>
                  <AlertDescription>
                    Invalid accounts: {insightReport.invalidAccounts.join(", ")}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Period</TableHead>
                    {metricColumns.map((metricKey) => (
                      <TableHead key={metricKey}>{toMetricLabel(metricKey)}</TableHead>
                    ))}
                    <TableHead>Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insightReport.accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={metricColumns.length + 4} className="text-center text-zinc-500">
                        No insight rows available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    insightReport.accounts.map((account) => {
                      const metricValueMap = new Map(
                        account.metricResults.map((metricResult) => [
                          metricResult.metric,
                          Number.isFinite(metricResult.totalValue) ? metricResult.totalValue : 0,
                        ]),
                      );

                      const latestEndTime = account.metricResults
                        .flatMap((metricResult) => metricResult.points)
                        .map((point) => point.endTime)
                        .filter((value) => value.length > 0)
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

                      const period = account.metricResults[0]?.period ?? insightReport.query.period;
                      const totalValue = metricColumns.reduce(
                        (sum, metricKey) => sum + (metricValueMap.get(metricKey) ?? 0),
                        0,
                      );

                      return (
                        <TableRow key={account.accountId}>
                          <TableCell className="font-medium">@{account.accountHandle}</TableCell>
                          <TableCell>{formatDateTime(latestEndTime ?? insightReport.generatedAt)}</TableCell>
                          <TableCell>{period}</TableCell>
                          {metricColumns.map((metricKey) => {
                            const val = metricValueMap.get(metricKey) ?? 0;
                            return (
                              <TableCell key={`${account.accountId}-${metricKey}`} className="max-w-[300px] truncate" title={String(val)}>
                                {val}
                              </TableCell>
                            );
                          })}
                          <TableCell>{totalValue}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="insight" className="space-y-3">
              {insightReport.accounts.flatMap((account) => account.recommendations).length === 0 ? (
                <p className="text-sm text-zinc-500">No recommendations.</p>
              ) : (
                insightReport.accounts
                  .flatMap((account) => account.recommendations)
                  .map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                    >
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
              <RawPayloadWithMapping
                payloadText={JSON.stringify(insightReport, null, 2)}
                mappingFields={insightMappingFields}
              />
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
                <Alert className="mb-3 border-amber-300/80 bg-amber-50 text-amber-900">
                  <CircleAlert className="h-4 w-4" />
                  <AlertTitle>Invalid accounts</AlertTitle>
                  <AlertDescription>
                    Invalid Accounts: {mediaReport.invalidAccounts.join(", ")}
                  </AlertDescription>
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
                        No media records.
                      </TableCell>
                    </TableRow>
                  ) : (
                    mediaRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">@{row.accountHandle}</TableCell>
                        {mediaTableFields.map((field) => {
                          const val = formatMediaCellValue(row.item[field]);
                          return (
                            <TableCell key={`${row.key}-${field}`} className="max-w-[300px] truncate" title={String(val)}>
                              {val}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="raw">
              <RawPayloadWithMapping
                payloadText={JSON.stringify(mediaReport, null, 2)}
                mappingFields={mediaMappingFields}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
            No data yet. Press Run to start.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
