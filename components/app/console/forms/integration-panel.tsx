"use client";

import { useMemo, useState } from "react";
import { Clock3, LoaderCircle, Plus, Download, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotionPageSelectField } from "@/components/app/console/forms/notion-page-select-field";
import {
  SingleSelectDropdownField,
  type SingleSelectDropdownOption,
} from "@/components/app/console/forms/single-select-dropdown-field";
import { CreateNotionDatabaseDialog } from "@/components/app/console/forms/create-notion-database-dialog";
import { CreateNotionPageDialog } from "@/components/app/console/forms/create-notion-page-dialog";
import type { SessionView, MediaReport, InsightReport } from "@/components/app/console/types";

const SCHEDULE_FREQUENCY_OPTIONS: SingleSelectDropdownOption[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

interface IntegrationPanelProps {
  session: SessionView;
  selectedNotionPageIds: string[];
  onNotionPagesChange: (pageIds: string[]) => void;
  notionTableByPage: Record<string, string>;
  onNotionTableChange: (pageId: string, databaseId: string) => void;
  autoSchedule: SessionView["autoSchedule"];
  onAutoScheduleChange: (next: SessionView["autoSchedule"]) => void;
  onSaveSchedule: () => void;
  scheduleSaving: boolean;
  onPagesRefreshed?: (pages: SessionView["notionPages"]) => void;
  onDatabaseCreated?: (database: { id: string; title: string; parentPageId: string }) => void;
  mediaReport?: MediaReport | null;
  insightReport?: InsightReport | null;
}

export function IntegrationPanel({
  session,
  selectedNotionPageIds,
  onNotionPagesChange,
  notionTableByPage,
  onNotionTableChange,
  autoSchedule,
  onAutoScheduleChange,
  onSaveSchedule,
  scheduleSaving,
  onPagesRefreshed,
  onDatabaseCreated,
  mediaReport,
  insightReport,
}: IntegrationPanelProps) {
  const notionAuthDisabled = true;
  const [retrievingPages, setRetrievingPages] = useState(false);
  const [createDatabaseOpen, setCreateDatabaseOpen] = useState(false);
  const [createPageOpen, setCreatePageOpen] = useState(false);
  const [selectedPageForDatabase, setSelectedPageForDatabase] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const selectedNotionPages = useMemo(
    () => session.notionPages.filter((page) => selectedNotionPageIds.includes(page.id)),
    [selectedNotionPageIds, session.notionPages],
  );

  const refreshPages = async () => {
    try {
      const response = await fetch("/api/notion/pages");
      if (!response.ok) throw new Error("Failed to refresh pages");

      const pages = await response.json();
      onPagesRefreshed?.(pages);
    } catch (error) {
      console.error("Failed to refresh Notion pages:", error);
    }
  };

  const handleRetrievePages = async () => {
    setRetrievingPages(true);
    try {
      await refreshPages();
    } catch (error) {
      console.error("Failed to retrieve Notion pages:", error);
    } finally {
      setRetrievingPages(false);
    }
  };

  const handleOpenCreateDatabase = (page: { id: string; title: string }) => {
    if (notionAuthDisabled) {
      return;
    }

    setSelectedPageForDatabase(page);
    setCreateDatabaseOpen(true);
  };

  const getOutputFields = (): string[] => {
    if (mediaReport?.query.fields) {
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

  const handleDatabaseCreated = (database: { id: string; title: string }) => {
    if (selectedPageForDatabase) {
      onDatabaseCreated?.({
        ...database,
        parentPageId: selectedPageForDatabase.id,
      });
    }
    setCreateDatabaseOpen(false);
    setSelectedPageForDatabase(null);
  }

  const handlePageCreated = (page: { id: string; title: string }) => {
    // After creating page, refresh the pages list to show the new page
    setCreatePageOpen(false);
    // Just refresh the pages list without OAuth popup
    refreshPages();
  }

  const handleSelectAnalysisPage = () => {
    const analysisPage = session.notionPages.find((p) => p.title === "Analysis");
    if (analysisPage && !selectedNotionPageIds.includes(analysisPage.id)) {
      onNotionPagesChange([...selectedNotionPageIds, analysisPage.id]);
    }
  }

  const tableOptionsByPage = useMemo(() => {
    const globalTableOptions = session.notionDatabases.map((database) => ({
      id: database.id,
      title: database.title,
      parentPageId: database.parentPageId ?? null,
    }));

    // Find the default "Analysis" page
    const defaultPage = session.notionPages.find((p) => p.title === "Analysis");
    const defaultPageTables = defaultPage
      ? globalTableOptions.filter((db) => db.parentPageId === defaultPage.id)
      : [];

    return selectedNotionPages.reduce<Record<string, SingleSelectDropdownOption[]>>((acc, page) => {
      const scoped = globalTableOptions.filter((database) => database.parentPageId === page.id);
      
      // Use scoped tables if available, otherwise use ONLY default page tables
      let effectiveTables: typeof globalTableOptions = [];
      let groupLabel = "";

      if (scoped.length > 0) {
        effectiveTables = scoped;
        groupLabel = "Tables in this page";
      } else if (defaultPageTables.length > 0) {
        effectiveTables = defaultPageTables;
        groupLabel = `Tables from default page (${defaultPage?.title})`;
      }
      
      // Create options from existing tables
      const options: SingleSelectDropdownOption[] = effectiveTables.map((database) => ({
        value: database.id,
        label: database.title,
        description: database.id,
        group: groupLabel,
      }));

      // Add "Create Default Table" option at the beginning
      const defaultTableOption: SingleSelectDropdownOption = {
        value: `__create_default_${page.id}__`,
        label: "Create Default Table",
        description: "Auto-create table with required fields",
        group: "Actions",
      };

      acc[page.id] = [defaultTableOption, ...options];
      return acc;
    }, {});
  }, [selectedNotionPages, session.notionDatabases, session.notionPages]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Notion Pages</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRetrievePages}
              disabled={retrievingPages || notionAuthDisabled}
              className="gap-1.5 h-7"
            >
              {retrievingPages ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Retrieve Pages
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCreatePageOpen(true)}
              disabled={notionAuthDisabled}
              className="gap-1.5 h-7"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Page
            </Button>
          </div>
        </div>
        <NotionPageSelectField
          label=""
          pages={session.notionPages}
          value={selectedNotionPageIds}
          onChange={onNotionPagesChange}
          placeholder="Search pages..."
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 lg:col-span-2">
        <div className="mb-3">
          <p className="text-sm font-medium text-zinc-900">Import Table Mapping</p>
          <p className="text-xs text-zinc-500">
            Choose a Notion table for each selected page before export/import workflow.
          </p>
          {notionAuthDisabled ? (
            <p className="mt-1 text-xs text-amber-600">
              Notion authentication is disabled in this build.
            </p>
          ) : null}
        </div>

        {selectedNotionPages.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white px-3 py-4 text-sm text-zinc-500">
            Select at least one Notion page to map target tables.
          </div>
        ) : (
          <div className="grid gap-3">
            {selectedNotionPages.map((page) => (
              <div key={page.id} className="rounded-md border border-zinc-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-zinc-600 mb-1">{page.title}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCreateDatabase(page)}
                    disabled={notionAuthDisabled}
                    className="gap-1.5 h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Table
                  </Button>
                </div>
                <SingleSelectDropdownField
                  label="Select or create table"
                  labelClassName="text-xs text-zinc-600"
                  value={notionTableByPage[page.id] || ""}
                  options={tableOptionsByPage[page.id] ?? []}
                  onChange={(nextValue) => {
                    onNotionTableChange(page.id, nextValue);
                  }}
                  triggerClassName="h-10"
                  placeholder="Select table"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">Auto Schedule</p>
            <p className="text-xs text-zinc-500">Persisted per user session and exported to n8n workflow.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={autoSchedule.enabled}
              onChange={(event) =>
                onAutoScheduleChange({
                  ...autoSchedule,
                  enabled: event.target.checked,
                })
              }
            />
            Enabled
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <SingleSelectDropdownField
              id="scheduleFrequency"
              label="Frequency"
              labelClassName="text-xs text-zinc-600"
              value={autoSchedule.frequency}
              options={SCHEDULE_FREQUENCY_OPTIONS}
              onChange={(nextValue) =>
                onAutoScheduleChange({
                  ...autoSchedule,
                  frequency: nextValue as SessionView["autoSchedule"]["frequency"],
                })
              }
              triggerClassName="h-10 bg-white"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="scheduleTime" className="text-xs text-zinc-600">
              Time (24h)
            </Label>
            <Input
              id="scheduleTime"
              type="time"
              value={autoSchedule.time}
              onChange={(event) =>
                onAutoScheduleChange({
                  ...autoSchedule,
                  time: event.target.value,
                })
              }
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="scheduleTimezone" className="text-xs text-zinc-600">
              Timezone
            </Label>
            <Input
              id="scheduleTimezone"
              value={autoSchedule.timezone}
              onChange={(event) =>
                onAutoScheduleChange({
                  ...autoSchedule,
                  timezone: event.target.value,
                })
              }
              placeholder="Asia/Ho_Chi_Minh"
              className="h-10"
            />
          </div>
        </div>

        <Button type="button" variant="outline" className="mt-3 gap-2" onClick={onSaveSchedule} disabled={scheduleSaving}>
          {scheduleSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
          Save schedule settings
        </Button>
      </div> */}

      {selectedPageForDatabase && (
        <CreateNotionDatabaseDialog
          open={createDatabaseOpen}
          onOpenChange={setCreateDatabaseOpen}
          parentPageId={selectedPageForDatabase.id}
          parentPageTitle={selectedPageForDatabase.title}
          onDatabaseCreated={handleDatabaseCreated}
          defaultFields={getOutputFields()}
        />
      )}

      <CreateNotionPageDialog
        open={createPageOpen}
        onOpenChange={setCreatePageOpen}
        onPageCreated={handlePageCreated}
      />
    </div>
  );
}
