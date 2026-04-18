'use client';

import { format } from 'date-fns';
import { Calendar as CalendarIcon, CircleAlert, ExternalLink, LoaderCircle } from 'lucide-react';

import {
  BREAKDOWN_LABELS,
  DEFAULT_INSIGHT_METRICS,
  METRIC_OPTIONS,
  TIMEFRAME_OPTIONS,
} from '@/components/app/console/constants';
import {
  MultiSelectDropdownField,
  type SelectOption,
} from '@/components/app/console/forms/multi-select-dropdown-field';
import {
  SingleSelectDropdownField,
  type SingleSelectDropdownOption,
} from '@/components/app/console/forms/single-select-dropdown-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type {
  InsightBreakdown,
  InsightPeriod,
  InsightTimeframe,
  InsightRangeDays,
} from '@/lib/core/domain';
import {
  ACCOUNT_MEDIA_FIELD_OPTIONS,
  DEFAULT_ACCOUNT_MEDIA_FIELDS,
} from '@/lib/insights/media-fields';
import type { EndpointDefinition, EndpointId, IdType } from '@/lib/insights/endpoint-registry';
import { cn } from '@/lib/utils/cn';

interface InstagramBuilderCardProps {
  selectedIdType: IdType;
  setSelectedIdType: (value: IdType) => void;
  selectedEndpointId: EndpointId;
  setSelectedEndpointId: (value: EndpointId) => void;
  activeEndpoint: EndpointDefinition | undefined;
  isMediaIdType: boolean;
  idTypeDropdownOptions: SingleSelectDropdownOption[];
  edgeDropdownOptions: SingleSelectDropdownOption[];
  loadingMedia: boolean;
  selectedMediaId: string;
  setSelectedMediaId: (value: string) => void;
  mediaPickerOptions: SingleSelectDropdownOption[];
  accountMediaList: Array<{
    id: string;
    caption?: string;
    permalink?: string;
    timestamp?: string;
    media_type?: string;
  }>;
  selectedMediaType: string;
  setSelectedMediaType: (value: string) => void;
  isInsightEndpoint: boolean;
  isMediaEndpoint: boolean;
  metrics: string[];
  setMetrics: (value: string[]) => void;
  activeMetricOptions: SelectOption[];
  period: InsightPeriod;
  setPeriod: (value: InsightPeriod) => void;
  timeframe: InsightTimeframe;
  setTimeframe: (value: InsightTimeframe) => void;
  breakdown: InsightBreakdown | '';
  setBreakdown: (value: InsightBreakdown | '') => void;
  rangeDays: InsightRangeDays;
  setRangeDays: (value: InsightRangeDays) => void;
  registryValidation: {
    group?: string;
    allowedPeriods?: string[];
    allowedTimeframes?: string[];
  } | null;
  registryWarnings: string[];
  selectionWarning: string | null;
  customStartDate: Date | undefined;
  setCustomStartDate: (value: Date | undefined) => void;
  customEndDate: Date | undefined;
  setCustomEndDate: (value: Date | undefined) => void;
  customDateError: string | null;
  setCustomDateError: (value: string | null) => void;
  startDatePopoverOpen: boolean;
  setStartDatePopoverOpen: (value: boolean) => void;
  endDatePopoverOpen: boolean;
  setEndDatePopoverOpen: (value: boolean) => void;
  mediaFields: string[];
  setMediaFields: (value: string[]) => void;
  mediaLimit: number;
  setMediaLimit: (value: number) => void;
  activeFieldOptions: SelectOption[];
  periodDropdownOptions: SingleSelectDropdownOption[];
  timeframeDropdownOptions: SingleSelectDropdownOption[];
  breakdownDropdownOptions: SingleSelectDropdownOption[];
  dateRangeDropdownOptions: SingleSelectDropdownOption[];
  NO_BREAKDOWN_VALUE: string;
  parseRangeDays: (value: string) => InsightRangeDays;
  validateCustomDateRange: (start: Date | undefined, end: Date | undefined) => string | null;
}

export function InstagramBuilderCard({
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
}: InstagramBuilderCardProps) {
  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-xl">Instagram Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Two-part endpoint selection ── */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">API Path</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <SingleSelectDropdownField
              id="idType"
              label="Resource (ID)"
              labelClassName="text-xs text-muted-foreground"
              value={selectedIdType}
              options={idTypeDropdownOptions}
              onChange={(value) => setSelectedIdType(value as IdType)}
            />
            <SingleSelectDropdownField
              id="edge"
              label="Catalog (Edge)"
              labelClassName="text-xs text-muted-foreground"
              value={selectedEndpointId}
              options={edgeDropdownOptions}
              onChange={(value) => setSelectedEndpointId(value as EndpointId)}
            />
          </div>
          {activeEndpoint ? (
            <div className="flex items-center gap-2">
              <Badge className="font-mono text-xs border-border">{activeEndpoint.method}</Badge>
              <code className="truncate rounded bg-muted/60 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                {activeEndpoint.path}
              </code>
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {activeEndpoint.description}
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Media picker for ig_media_id ── */}
        {isMediaIdType ? (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Media</Label>
            {loadingMedia ? (
              <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 p-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading media from account...
              </div>
            ) : mediaPickerOptions.length > 0 ? (
              <div className="space-y-2">
                <SingleSelectDropdownField
                  id="mediaPicker"
                  label="Choose a media item"
                  labelClassName="text-xs text-muted-foreground"
                  value={selectedMediaId}
                  options={mediaPickerOptions}
                  onChange={(value) => setSelectedMediaId(value)}
                  searchable
                  searchPlaceholder="Search by caption, ID..."
                  contentClassName="min-w-[380px]"
                />
                {selectedMediaId &&
                  (() => {
                    const media = accountMediaList.find((m) => m.id === selectedMediaId);
                    return media?.permalink ? (
                      <a
                        href={media.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {media.permalink}
                      </a>
                    ) : null;
                  })()}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No media found. Make sure you have connected an Instagram account.
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="mediaIdInput" className="text-xs text-muted-foreground">
                Or enter Media ID / Permalink
              </Label>
              <Input
                id="mediaIdInput"
                type="text"
                value={selectedMediaId}
                placeholder="e.g. 17895695668004550 or https://www.instagram.com/p/..."
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  // If it's an Instagram permalink, try to match a media from the list
                  const matched = accountMediaList.find((m) => m.permalink === raw);
                  if (matched) {
                    setSelectedMediaId(matched.id);
                  } else {
                    setSelectedMediaId(raw);
                  }
                }}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>
        ) : null}

        {/* ── Media type filter ── */}
        {isMediaIdType ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Media Product Type</Label>
            <p className="text-xs text-muted-foreground">
              Filter available metrics/fields by media type. Select "All" to see all options.
            </p>
            <SingleSelectDropdownField
              id="mediaTypeFilter"
              label=""
              value={selectedMediaType}
              options={[
                { value: 'ALL', label: 'All types' },
                { value: 'FEED', label: 'Feed (Posts)' },
                { value: 'REELS', label: 'Reels' },
                { value: 'STORY', label: 'Story' },
              ]}
              onChange={(value) => setSelectedMediaType(value)}
            />
          </div>
        ) : null}

        {isInsightEndpoint ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MultiSelectDropdownField
                label="Metrics"
                options={activeMetricOptions.length > 0 ? activeMetricOptions : METRIC_OPTIONS}
                value={metrics}
                onChange={(selected) =>
                  setMetrics(
                    selected.length > 0
                      ? selected
                      : (activeEndpoint?.defaultMetrics ?? DEFAULT_INSIGHT_METRICS)
                  )
                }
                placeholder="Search metrics..."
              />

              <SingleSelectDropdownField
                id="period"
                label="Period"
                value={period}
                options={
                  registryValidation
                    ? (registryValidation.allowedPeriods?.map((p) => ({
                        value: p,
                        label:
                          p === 'day'
                            ? 'Daily'
                            : p === 'week'
                              ? 'Weekly'
                              : p === 'month'
                                ? 'Monthly'
                                : p === 'lifetime'
                                  ? 'Lifetime'
                                  : p,
                      })) ?? [])
                    : periodDropdownOptions
                }
                onChange={(value) => setPeriod(value as InsightPeriod)}
              />
            </div>

            {registryValidation?.group === 'DEMOGRAPHIC' || breakdown ? (
              <SingleSelectDropdownField
                id="timeframe"
                label="Timeframe"
                value={timeframe}
                options={
                  registryValidation?.allowedTimeframes &&
                  registryValidation.allowedTimeframes.length > 0
                    ? registryValidation.allowedTimeframes.map((t) => ({
                        value: t,
                        label: TIMEFRAME_OPTIONS.find((o) => o.value === t)?.label ?? t,
                      }))
                    : timeframeDropdownOptions
                }
                onChange={(value) => setTimeframe(value as InsightTimeframe)}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <SingleSelectDropdownField
                  id="breakdown"
                  label="Breakdown"
                  value={breakdown || NO_BREAKDOWN_VALUE}
                  options={breakdownDropdownOptions}
                  onChange={(value) =>
                    setBreakdown(value === NO_BREAKDOWN_VALUE ? '' : (value as InsightBreakdown))
                  }
                />
                <div className="space-y-2">
                  <SingleSelectDropdownField
                    id="rangeDays"
                    label="Date Range"
                    value={String(rangeDays)}
                    options={dateRangeDropdownOptions}
                    onChange={(value) => setRangeDays(parseRangeDays(value))}
                  />

                  {rangeDays === 'custom' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Start Date</Label>
                        <Popover open={startDatePopoverOpen} onOpenChange={setStartDatePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'h-10 w-full justify-start text-left font-normal',
                                !customStartDate && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customStartDate ? format(customStartDate, 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customStartDate}
                              onSelect={(date) => {
                                setCustomStartDate(date);
                                setStartDatePopoverOpen(false);
                                if (date && customEndDate) {
                                  setCustomDateError(validateCustomDateRange(date, customEndDate));
                                }
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">End Date</Label>
                        <Popover open={endDatePopoverOpen} onOpenChange={setEndDatePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'h-10 w-full justify-start text-left font-normal',
                                !customEndDate && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customEndDate ? format(customEndDate, 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customEndDate}
                              onSelect={(date) => {
                                setCustomEndDate(date);
                                setEndDatePopoverOpen(false);
                                if (customStartDate && date) {
                                  setCustomDateError(
                                    validateCustomDateRange(customStartDate, date)
                                  );
                                }
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ) : isMediaEndpoint ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <MultiSelectDropdownField
              label="Fields to retrieve"
              options={
                activeFieldOptions.length > 0 ? activeFieldOptions : ACCOUNT_MEDIA_FIELD_OPTIONS
              }
              value={mediaFields}
              onChange={(selected) =>
                setMediaFields(
                  selected.length > 0
                    ? selected
                    : (activeEndpoint?.defaultFields ?? DEFAULT_ACCOUNT_MEDIA_FIELDS)
                )
              }
              placeholder="Search fields..."
            />

            {activeEndpoint?.supportsLimit !== false ? (
              <div className="space-y-2">
                <Label htmlFor="mediaLimit">Limit</Label>
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
                  className="h-11"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {selectionWarning ? (
          <Alert className="border-amber-300/80 bg-amber-50 text-amber-900">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>Metric compatibility</AlertTitle>
            <AlertDescription>{selectionWarning}</AlertDescription>
          </Alert>
        ) : null}

        {registryWarnings.length > 0 ? (
          <div className="space-y-2">
            {registryWarnings.map((warning, index) => (
              <Alert
                key={`registry-warn-${index}`}
                className="border-amber-300/80 bg-amber-50 text-amber-900"
              >
                <CircleAlert className="h-4 w-4" />
                <AlertTitle>Validation</AlertTitle>
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        {rangeDays === 'custom' && customDateError ? (
          <Alert variant="destructive">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>Invalid date range</AlertTitle>
            <AlertDescription>{customDateError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
