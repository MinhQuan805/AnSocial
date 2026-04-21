'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { toast } from 'react-toastify';

import { HttpRequestCard } from '@/components/app/console/cards/http-request/http-request-card';
import { InstagramBuilderSection } from '@/components/app/console/integrations/instagram/instagram-builder-section';
import { useInstagramIntegration } from '@/components/app/console/integrations/instagram/use-instagram-integration';
import { OutputCard } from '@/components/app/console/output/output-card';
import { ConsoleSidebar } from '@/components/app/console/sidebar/console-sidebar';
import { TutorialDialog } from '@/components/app/console/tutorial/tutorial-dialog';
import type { HttpRequestReport, SessionView } from '@/components/app/console/types';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DEFAULT_ACCOUNT_MEDIA_FIELDS } from '@/lib/insights/media-fields';
import { fetchWithAuth } from '@/lib/utils/use-auth-headers';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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

function sanitizeSingleUrlInput(raw: string): string {
  const compact = raw.replace(/\r?\n/g, ' ').trim();
  const [firstToken] = compact.split(/\s+/);
  return firstToken ?? '';
}

function encodeBasicAuthValue(value: string): string {
  if (typeof window === 'undefined' || typeof window.btoa !== 'function') {
    return '';
  }

  const utf8 = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );

  return window.btoa(utf8);
}

export function ConsoleApp({ session }: ConsoleAppProps) {
  const [availableNotionPages, setAvailableNotionPages] = useState(session.notionPages);
  const [availableNotionDatabases, setAvailableNotionDatabases] = useState(session.notionDatabases);
  const [notionPageIds, setNotionPageIds] = useState<string[]>(
    session.notionTargetPageIds.length > 0
      ? session.notionTargetPageIds
      : session.notionPages[0]
        ? [session.notionPages[0].id]
        : []
  );
  const [notionTableByPage, setNotionTableByPage] = useState<Record<string, string>>({});
  const [saveToNotion, setSaveToNotion] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(session.autoSchedule);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const [queryTab, setQueryTab] = useState<'parameters' | 'headers' | 'body' | 'authorization'>(
    'parameters'
  );
  const [requestMethod, setRequestMethod] = useState<HttpMethod>('GET');
  const [bodyMode, setBodyMode] = useState<'json' | 'form-data' | 'x-www-form-urlencoded'>('json');
  const [authMode, setAuthMode] = useState<'oauth' | 'token' | 'basic'>('oauth');
  const [editableUrl, setEditableUrl] = useState('');
  const [requestBody, setRequestBody] = useState('');
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');

  const [loggingOut, setLoggingOut] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [httpReport, setHttpReport] = useState<HttpRequestReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastStatusToastRef = useRef<string | null>(null);
  const lastErrorToastRef = useRef<string | null>(null);

  const instagram = useInstagramIntegration({
    session,
    authMode,
    editableUrl,
    setEditableUrl,
  });

  const integrationSession = useMemo(
    () => ({
      ...session,
      notionPages: availableNotionPages,
      notionDatabases: availableNotionDatabases,
    }),
    [availableNotionDatabases, availableNotionPages, session]
  );

  const exportTargetIds = useMemo(
    () =>
      uniqueOrdered(
        notionPageIds
          .map((pageId) => notionTableByPage[pageId]?.trim() || pageId)
          .filter((targetId) => targetId.trim().length > 0)
      ),
    [notionPageIds, notionTableByPage]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const serverSessionId = session.sessionId?.trim();
    if (!serverSessionId) {
      return;
    }

    const currentSessionId = sessionStorage.getItem('ana_session_id');
    if (currentSessionId !== serverSessionId) {
      sessionStorage.setItem('ana_session_id', serverSessionId);
    }
  }, [session.sessionId]);

  useEffect(() => {
    if (!status) {
      lastStatusToastRef.current = null;
      return;
    }

    if (lastStatusToastRef.current === status) {
      return;
    }

    lastStatusToastRef.current = status;
    toast.success(status);
  }, [status]);

  useEffect(() => {
    if (!error) {
      lastErrorToastRef.current = null;
      return;
    }

    if (lastErrorToastRef.current === error) {
      return;
    }

    lastErrorToastRef.current = error;
    toast.error(error);
  }, [error]);

  useEffect(() => {
    if (!instagram.hasOAuthConnection && authMode === 'oauth') {
      setAuthMode('token');
    }
  }, [authMode, instagram.hasOAuthConnection]);

  useEffect(() => {
    if (instagram.isInstagramOAuthLinked && requestMethod !== 'GET') {
      setRequestMethod('GET');
    }
  }, [instagram.isInstagramOAuthLinked, requestMethod]);

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
        ([pageId, databaseId]) => selected.has(pageId) && databaseId.trim().length > 0
      );

      if (nextEntries.length === Object.keys(previous).length) {
        return previous;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [notionPageIds]);

  useEffect(() => {
    const initialTableByPage: Record<string, string> = {};
    for (const pageId of notionPageIds) {
      initialTableByPage[pageId] = `__create_default_${pageId}__`;
    }
    setNotionTableByPage(initialTableByPage);
  }, [notionPageIds]);

  const handleLogout = () => {
    setLoggingOut(true);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ana_session_id');
      window.location.href = '/';
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
    }>
  ) => {
    setAvailableNotionPages(pages);
    setAvailableNotionDatabases(
      pages
        .flatMap((page) =>
          (page.databases ?? []).map((database) => ({
            id: database.id,
            title: database.title,
            parentPageId: database.parentPageId ?? page.id,
          }))
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
        }, [])
    );
    setStatus('Notion pages refreshed successfully');
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
      const response = await fetchWithAuth('/api/schedule', {
        method: 'POST',
        body: JSON.stringify({
          autoSchedule,
          notionTargetPageIds: notionPageIds,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'Failed to update schedule settings.');
      }

      setStatus('Auto schedule settings saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to update schedule settings.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const removeCustomHeader = (key: string) => {
    const normalizedKey = key.trim().toLowerCase();
    setCustomHeaders((previous) =>
      previous.filter((item) => item.key.trim().toLowerCase() !== normalizedKey)
    );
  };

  const addCustomHeader = () => {
    const key = newHeaderKey.trim();
    const value = newHeaderValue.trim();

    if (!key || !value) {
      return;
    }

    setCustomHeaders((previous) => {
      const next = previous.filter((item) => item.key.trim().toLowerCase() !== key.toLowerCase());
      next.push({ key, value });
      return next;
    });

    setNewHeaderKey('');
    setNewHeaderValue('');
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

    if (authMode === 'token') {
      const token = bearerToken.trim().replace(/^Bearer\s+/i, '');
      if (token) {
        headerMap.Authorization = `Bearer ${token}`;
      }
    }

    if (authMode === 'basic') {
      const username = basicUsername.trim();
      const password = basicPassword;

      if (username || password) {
        const encoded = encodeBasicAuthValue(`${username}:${password}`);
        if (encoded) {
          headerMap.Authorization = `Basic ${encoded}`;
        }
      }
    }

    if (requestMethod !== 'GET' && requestBody.trim()) {
      const hasContentType = Object.keys(headerMap).some(
        (key) => key.toLowerCase() === 'content-type'
      );

      if (!hasContentType) {
        if (bodyMode === 'x-www-form-urlencoded') {
          headerMap['Content-Type'] = 'application/x-www-form-urlencoded';
        } else if (bodyMode === 'json') {
          headerMap['Content-Type'] = 'application/json';
        }
      }
    }

    return headerMap;
  };

  const syncFromUrlInput = () => {
    const result = instagram.syncFromUrlInputInstagram();
    if (result.error) {
      setError(result.error);
      return;
    }

    setError(null);
    if (result.status) {
      setStatus(result.status);
    }
  };

  const runHttpRequest = async () => {
    const singleUrl = sanitizeSingleUrlInput(editableUrl);
    if (!singleUrl) {
      return;
    }

    const targetUrl = new URL(singleUrl);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new Error('Only http:// and https:// URLs are supported.');
    }

    const queryParameters = instagram.requestParameterRows
      .map((row) => ({
        key: row.key.trim(),
        value: (instagram.parameterDrafts[row.key] ?? row.value).trim(),
      }))
      .filter((row) => row.key.length > 0);

    if (queryParameters.length > 0) {
      targetUrl.search = '';
      for (const parameter of queryParameters) {
        targetUrl.searchParams.set(parameter.key, parameter.value);
      }
    }

    const outgoingHeaders = buildHttpHeaders();
    const includeBody = requestMethod !== 'GET';

    const response = await fetchWithAuth('/api/http/request', {
      method: 'POST',
      body: JSON.stringify({
        url: targetUrl.toString(),
        method: requestMethod,
        headers: outgoingHeaders,
        params: queryParameters,
        body: includeBody && requestBody.trim().length > 0 ? requestBody : undefined,
      }),
    });

    const payload = (await response.json()) as HttpRequestReport | { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(
        payload && 'error' in payload
          ? (payload.error?.message ?? 'HTTP request failed.')
          : 'HTTP request failed.'
      );
    }

    const nextReport = payload as HttpRequestReport;

    if (nextReport.response.status < 200 || nextReport.response.status >= 300) {
      setHttpReport(null);
      throw new Error(
        `HTTP request failed (${nextReport.response.status} ${nextReport.response.statusText}).`
      );
    }

    setHttpReport(nextReport);
    instagram.clearReports();
  };

  const runAnalysis = async () => {
    setRunning(true);
    setError(null);
    setStatus(null);

    try {
      if (instagram.isInstagramOAuthLinked) {
        const oauthStatus = await instagram.runOauth();
        setHttpReport(null);
        setStatus(oauthStatus);
      } else {
        await runHttpRequest();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unknown error.');
    } finally {
      setRunning(false);
    }
  };

  const saveResult = async () => {
    if (!instagram.insightReport && !instagram.mediaReport) {
      setError('No data to save. Please run analysis first.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const updatedTableByPage = { ...notionTableByPage };
      const outputFields = instagram.getOutputFields();

      if (saveToNotion) {
        for (const [pageId, tableValue] of Object.entries(notionTableByPage)) {
          if (tableValue.startsWith('__create_default_')) {
            const page = session.notionPages.find((item) => item.id === pageId);
            if (!page) {
              continue;
            }

            try {
              const defaultTableName = `${page.title} - Default`;
              const createResponse = await fetchWithAuth('/api/notion/databases', {
                method: 'POST',
                body: JSON.stringify({
                  parentPageId: pageId,
                  databaseTitle: defaultTableName,
                  defaultFields:
                    outputFields.length > 0 ? outputFields : DEFAULT_ACCOUNT_MEDIA_FIELDS,
                }),
              });

              if (!createResponse.ok) {
                const errorData = await createResponse.json().catch(() => ({}));
                const errorMessage =
                  typeof errorData.error === 'string'
                    ? errorData.error
                    : typeof errorData.error === 'object'
                      ? JSON.stringify(errorData.error)
                      : 'Failed to create default table';
                throw new Error(errorMessage);
              }

              const database = await createResponse.json();
              updatedTableByPage[pageId] = database.id;

              setNotionTableByPage((previous) => ({
                ...previous,
                [pageId]: database.id,
              }));

              setAvailableNotionDatabases((previous) => [
                ...previous,
                { id: database.id, title: database.title, parentPageId: pageId },
              ]);
            } catch (createError) {
              const errorMessage =
                createError instanceof Error ? createError.message : JSON.stringify(createError);
              setError(errorMessage);
              setSaving(false);
              return;
            }
          }
        }
      }

      const response = await fetchWithAuth('/api/save', {
        method: 'POST',
        body: JSON.stringify({
          sourceAccount: instagram.buildSourceAccount(),
          report: instagram.insightReport ?? undefined,
          mediaReport: instagram.mediaReport ?? undefined,
          saveToNotion,
          notionPageIds,
          notionDatabaseByPageId: updatedTableByPage,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'Failed to save data.');
      }

      const notionStatus =
        typeof payload?.notionMessage === 'string' ? payload.notionMessage.trim() : '';

      if (saveToNotion) {
        if (notionStatus.length > 0) {
          setStatus(notionStatus);
        } else if (payload?.savedToNotion) {
          setStatus('Data saved to Notion successfully.');
        } else {
          setStatus('Data saved locally. No data was written to Notion.');
        }
      } else {
        setStatus('Data saved successfully.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unknown error.');
    } finally {
      setSaving(false);
    }
  };

  const exportN8n = async () => {
    if (!instagram.insightReport) {
      setError('Export n8n only supports Account Insight data.');
      return;
    }

    if (exportTargetIds.length === 0) {
      setError('Please select at least one Notion page before exporting n8n workflow.');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/n8n/export', {
        method: 'POST',
        body: JSON.stringify({
          pageIds: exportTargetIds,
          graphUrl: instagram.insightReport.query.urlPreview,
          metrics: instagram.insightReport.query.metrics,
          period: instagram.insightReport.query.period,
          rangeDays: instagram.insightReport.query.rangeDays,
          metricType: instagram.insightReport.query.metricType,
          timeframe: instagram.insightReport.query.timeframe,
          breakdown: instagram.insightReport.query.breakdown,
          autoSchedule,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error?.message ?? 'Failed to export n8n workflow.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `ana-social-workflow-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unknown error.');
    } finally {
      setExporting(false);
    }
  };

  const shouldShowOutputCard = instagram.isInstagramOAuthLinked || Boolean(httpReport);

  return (
    <SidebarProvider defaultOpen>
      <ConsoleSidebar
        notionWorkspaceName={session.notionWorkspaceName}
        remainingFreeSaves={session.remainingFreeSaves}
        loggingOut={loggingOut}
        onNewRequest={() => {
          instagram.clearReports();
          setHttpReport(null);
          setStatus('Ready to create a new request.');
          setError(null);
        }}
        onOpenTutorial={() => setTutorialOpen(true)}
        onLogout={handleLogout}
      />

      <SidebarInset className="min-h-svh">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Integration Console</p>
            <p className="truncate text-xs text-muted-foreground">
              Shared shell for multi-platform builders and HTTP workflows
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setTutorialOpen(true)}
          >
            <Info className="h-4 w-4" />
            Tutorial
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid gap-6">
            <InstagramBuilderSection
              hasOAuthConnection={instagram.hasOAuthConnection}
              isInstagramOAuthLinked={instagram.isInstagramOAuthLinked}
              builderCardProps={instagram.builderCardProps}
            />

            <HttpRequestCard
              queryTab={queryTab}
              setQueryTab={setQueryTab}
              requestMethod={requestMethod}
              setRequestMethod={setRequestMethod}
              isOAuthMode={instagram.isInstagramOAuthLinked}
              editableUrl={editableUrl}
              setEditableUrl={instagram.setEditableUrlFromInput}
              syncFromUrlInput={syncFromUrlInput}
              requestParameterRows={instagram.requestParameterRows}
              parameterDrafts={instagram.parameterDrafts}
              setParameterDrafts={instagram.setParameterDrafts}
              newParamKey={instagram.newParamKey}
              setNewParamKey={instagram.setNewParamKey}
              newParamValue={instagram.newParamValue}
              setNewParamValue={instagram.setNewParamValue}
              removeParameter={instagram.removeParameter}
              addParameter={instagram.addParameter}
              commitParameterDraft={instagram.commitParameterDraft}
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
              hasOAuthConnection={instagram.hasOAuthConnection}
              bearerToken={bearerToken}
              setBearerToken={setBearerToken}
              basicUsername={basicUsername}
              setBasicUsername={setBasicUsername}
              basicPassword={basicPassword}
              setBasicPassword={setBasicPassword}
              running={running}
              runAnalysis={runAnalysis}
              saving={saving}
              exporting={exporting}
              status={status}
              error={error}
              isInsightEndpoint={instagram.isInsightEndpoint}
              insightReport={instagram.insightReport}
              mediaReport={instagram.mediaReport}
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

            {shouldShowOutputCard ? (
              <OutputCard
                isHttpMode={!instagram.isInstagramOAuthLinked}
                isInsightEndpoint={instagram.isInsightEndpoint}
                isMediaEndpoint={instagram.isMediaEndpoint}
                httpReport={httpReport}
                insightReport={instagram.insightReport}
                mediaReport={instagram.mediaReport}
                mediaTableFields={instagram.mediaTableFields}
                mediaRows={instagram.mediaRows}
                formatMediaCellValue={instagram.formatMediaCellValue}
                onSave={saveResult}
                isSaving={saving}
              />
            ) : null}
          </div>
        </main>
      </SidebarInset>

      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </SidebarProvider>
  );
}
