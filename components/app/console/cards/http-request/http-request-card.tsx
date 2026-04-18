'use client';

import type { DragEvent } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Download,
  LoaderCircle,
  Play,
  Plus,
  X,
} from 'lucide-react';

import {
  SingleSelectDropdownField,
  type SingleSelectDropdownOption,
} from '@/components/app/console/forms/single-select-dropdown-field';
import { IntegrationPanel } from '@/components/app/console/forms/integration-panel';
import type {
  RequestParameterRow,
  SessionView,
  InsightReport,
  MediaReport,
  HttpRequestReport,
} from '@/components/app/console/types';
import type { AutoScheduleSettings } from '@/lib/core/domain';
import { getMappingExpressionData, insertTextAtSelection } from '@/lib/utils/json-mapping';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const METHOD_OPTIONS: SingleSelectDropdownOption[] = HTTP_METHODS.map((method) => ({
  value: method,
  label: method,
}));

interface HttpRequestCardProps {
  queryTab: 'parameters' | 'headers' | 'body' | 'authorization';
  setQueryTab: (value: 'parameters' | 'headers' | 'body' | 'authorization') => void;
  requestMethod: HttpMethod;
  setRequestMethod: (value: HttpMethod) => void;
  isOAuthMode: boolean;
  editableUrl: string;
  setEditableUrl: (value: string) => void;
  syncFromUrlInput: () => void;
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
  customHeaders: Array<{ key: string; value: string }>;
  newHeaderKey: string;
  setNewHeaderKey: (value: string) => void;
  newHeaderValue: string;
  setNewHeaderValue: (value: string) => void;
  addCustomHeader: () => void;
  removeCustomHeader: (key: string) => void;
  bodyMode: 'json' | 'form-data' | 'x-www-form-urlencoded';
  setBodyMode: (value: 'json' | 'form-data' | 'x-www-form-urlencoded') => void;
  requestBody: string;
  setRequestBody: (value: string) => void;
  authMode: 'oauth' | 'token' | 'basic';
  setAuthMode: (value: 'oauth' | 'token' | 'basic') => void;
  hasOAuthConnection: boolean;
  bearerToken: string;
  setBearerToken: (value: string) => void;
  basicUsername: string;
  setBasicUsername: (value: string) => void;
  basicPassword: string;
  setBasicPassword: (value: string) => void;
  running: boolean;
  runAnalysis: () => void;
  saving: boolean;
  exporting: boolean;
  status: string | null;
  error: string | null;
  isInsightEndpoint: boolean;
  insightReport: InsightReport | null;
  mediaReport: MediaReport | null;
  httpReport: HttpRequestReport | null;
  integrationSession: SessionView;
  selectedNotionPageIds: string[];
  setNotionPageIds: (value: string[]) => void;
  notionTableByPage: Record<string, string>;
  handleNotionTableChange: (pageId: string, tableId: string) => void;
  autoSchedule: AutoScheduleSettings;
  setAutoSchedule: (value: AutoScheduleSettings) => void;
  saveScheduleSettings: () => Promise<void>;
  scheduleSaving: boolean;
  handleRefreshPages: (
    pages: Array<{
      id: string;
      title: string;
      databases?: Array<{ id: string; title: string; parentPageId?: string | null }>;
    }>
  ) => void;
  handleDatabaseCreated: (database: { id: string; title: string; parentPageId: string }) => void;
  saveToNotion: boolean;
  setSaveToNotion: (value: boolean) => void;
  saveResult: () => void;
  exportN8n: () => void;
}

export function HttpRequestCard({
  queryTab,
  setQueryTab,
  requestMethod,
  setRequestMethod,
  isOAuthMode,
  editableUrl,
  setEditableUrl,
  syncFromUrlInput,
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
  customHeaders,
  newHeaderKey,
  setNewHeaderKey,
  newHeaderValue,
  setNewHeaderValue,
  addCustomHeader,
  removeCustomHeader,
  bodyMode,
  setBodyMode,
  requestBody,
  setRequestBody,
  authMode,
  setAuthMode,
  hasOAuthConnection,
  bearerToken,
  setBearerToken,
  basicUsername,
  setBasicUsername,
  basicPassword,
  setBasicPassword,
  running,
  runAnalysis,
  saving,
  exporting,
  status,
  error,
  isInsightEndpoint,
  insightReport,
  mediaReport,
  httpReport,
  integrationSession,
  selectedNotionPageIds,
  setNotionPageIds,
  notionTableByPage,
  handleNotionTableChange,
  autoSchedule,
  setAutoSchedule,
  saveScheduleSettings,
  scheduleSaving,
  handleRefreshPages,
  handleDatabaseCreated,
  saveToNotion,
  setSaveToNotion,
  saveResult,
  exportN8n,
}: HttpRequestCardProps) {
  const allowMappingDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const dropMappedExpression = (
    event: DragEvent<HTMLInputElement | HTMLTextAreaElement>,
    currentValue: string,
    onChangeValue: (value: string) => void
  ) => {
    event.preventDefault();
    const expression = getMappingExpressionData(event.dataTransfer);
    if (!expression) {
      return;
    }

    const nextValue = insertTextAtSelection(
      currentValue,
      expression,
      event.currentTarget.selectionStart,
      event.currentTarget.selectionEnd
    );

    onChangeValue(nextValue);
  };

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-lg">HTTP Request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[120px_1fr]">
          <SingleSelectDropdownField
            label="Method"
            value={requestMethod}
            options={METHOD_OPTIONS}
            onChange={(value) => setRequestMethod(value as HttpMethod)}
            disabled={isOAuthMode}
          />

          <div className="space-y-2">
            <Label>URL</Label>
            <Input
              value={editableUrl}
              onChange={(event) => {
                setEditableUrl(event.target.value);
              }}
              onBlur={syncFromUrlInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  syncFromUrlInput();
                }
              }}
              className="h-11"
            />
          </div>
        </div>

        <Tabs
          value={queryTab}
          onValueChange={(value) =>
            setQueryTab(value as 'parameters' | 'headers' | 'body' | 'authorization')
          }
          className="overflow-hidden rounded-lg border border-border/70"
        >
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-none bg-muted/40 p-0">
            <TabsTrigger value="parameters" className="rounded-none py-2.5 text-sm">
              Parameters
            </TabsTrigger>
            <TabsTrigger value="headers" className="rounded-none py-2.5 text-sm">
              Headers
            </TabsTrigger>
            <TabsTrigger value="body" className="rounded-none py-2.5 text-sm">
              Body
            </TabsTrigger>
            <TabsTrigger value="authorization" className="rounded-none py-2.5 text-sm">
              Authorization
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="mt-0 space-y-3 px-3 py-3">
            {requestParameterRows.map((item) => (
              <div key={item.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={item.key} readOnly className="h-10" />
                <Input
                  value={parameterDrafts[item.key] ?? item.value}
                  onChange={(event) =>
                    setParameterDrafts({
                      ...parameterDrafts,
                      [item.key]: event.target.value,
                    })
                  }
                  onDragOver={allowMappingDrop}
                  onDrop={(event) =>
                    dropMappedExpression(
                      event,
                      parameterDrafts[item.key] ?? item.value,
                      (nextValue) =>
                        setParameterDrafts({
                          ...parameterDrafts,
                          [item.key]: nextValue,
                        })
                    )
                  }
                  onBlur={() => commitParameterDraft(item.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitParameterDraft(item.key);
                    }
                  }}
                  className="h-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => removeParameter(item.key, item.required)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={newParamKey}
                onChange={(event) => setNewParamKey(event.target.value)}
                placeholder="Parameter"
                className="h-10"
              />
              <Input
                value={newParamValue}
                onChange={(event) => setNewParamValue(event.target.value)}
                placeholder="Value"
                className="h-10"
                onDragOver={allowMappingDrop}
                onDrop={(event) => dropMappedExpression(event, newParamValue, setNewParamValue)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addParameter();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-1.5 px-3"
                onClick={() => {
                  setNewParamKey('');
                  setNewParamValue('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-1.5 px-3"
              onClick={addParameter}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </TabsContent>

          <TabsContent value="headers" className="mt-0 space-y-3 px-3 py-4">
            {customHeaders.map((header) => (
              <div key={header.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={header.key} readOnly className="h-10" />
                <Input value={header.value} readOnly className="h-10" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => removeCustomHeader(header.key)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={newHeaderKey}
                onChange={(event) => setNewHeaderKey(event.target.value)}
                placeholder="Key"
                className="h-10"
              />
              <Input
                value={newHeaderValue}
                onChange={(event) => setNewHeaderValue(event.target.value)}
                placeholder="Value"
                className="h-10"
                onDragOver={allowMappingDrop}
                onDrop={(event) => dropMappedExpression(event, newHeaderValue, setNewHeaderValue)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomHeader();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-1.5 px-3"
                onClick={() => {
                  setNewHeaderKey('');
                  setNewHeaderValue('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-1.5 px-3"
              onClick={addCustomHeader}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </TabsContent>

          <TabsContent value="body" className="mt-0 space-y-3 px-3 py-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                variant={bodyMode === 'json' ? 'default' : 'outline'}
                onClick={() => setBodyMode('json')}
              >
                JSON
              </Button>
              <Button
                type="button"
                size="lg"
                variant={bodyMode === 'form-data' ? 'default' : 'outline'}
                onClick={() => setBodyMode('form-data')}
              >
                form-data
              </Button>
              <Button
                type="button"
                size="lg"
                variant={bodyMode === 'x-www-form-urlencoded' ? 'default' : 'outline'}
                onClick={() => setBodyMode('x-www-form-urlencoded')}
              >
                x-www-form-urlencoded
              </Button>
            </div>
            {requestMethod === 'GET' ? (
              <Textarea
                readOnly
                placeholder="GET request does not include a request body."
                className="min-h-20 resize-none text-sm"
              />
            ) : isOAuthMode ? (
              <Textarea
                readOnly
                placeholder="OAuth mode uses managed payloads. Switch to token/basic mode to edit body freely."
                className="min-h-20 resize-none text-sm"
              />
            ) : (
              <Textarea
                value={requestBody}
                onChange={(event) => setRequestBody(event.target.value)}
                onDragOver={allowMappingDrop}
                onDrop={(event) => dropMappedExpression(event, requestBody, setRequestBody)}
                placeholder={bodyMode === 'json' ? '{\n  "key": "value"\n}' : 'key=value'}
                className="min-h-32 text-sm"
              />
            )}
          </TabsContent>

          <TabsContent value="authorization" className="mt-0 space-y-3 px-3 py-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                variant={authMode === 'oauth' ? 'default' : 'outline'}
                onClick={() => setAuthMode('oauth')}
              >
                OAuth
              </Button>
              <Button
                type="button"
                size="lg"
                variant={authMode === 'token' ? 'default' : 'outline'}
                onClick={() => setAuthMode('token')}
              >
                Token
              </Button>
              <Button
                type="button"
                size="lg"
                variant={authMode === 'basic' ? 'default' : 'outline'}
                onClick={() => setAuthMode('basic')}
              >
                Basic
              </Button>
            </div>

            {authMode === 'oauth' ? (
              <div className="space-y-3">
                <Alert className="border-border bg-muted/30 text-foreground">
                  <AlertTitle>
                    {hasOAuthConnection ? 'OAuth session ready' : 'OAuth session not connected'}
                  </AlertTitle>
                </Alert>
              </div>
            ) : null}

            {authMode === 'token' ? (
              <Alert className="border-border text-foreground">
                <p className="font-bold text-lg">Token Authentication</p>
                <Input
                  value={bearerToken}
                  placeholder="Enter access token (Bearer prefix is optional)"
                  onChange={(event) => setBearerToken(event.target.value)}
                  onDragOver={allowMappingDrop}
                  onDrop={(event) => dropMappedExpression(event, bearerToken, setBearerToken)}
                  className="h-10 mt-2"
                />
              </Alert>
            ) : null}

            {authMode === 'basic' ? (
              <Alert className="border-border text-foreground">
                <p className="font-bold text-lg">Basic Authentication</p>
                <AlertDescription className="space-y-2">
                  <Input
                    value={basicUsername}
                    placeholder="Username"
                    onChange={(event) => setBasicUsername(event.target.value)}
                    onDragOver={allowMappingDrop}
                    onDrop={(event) => dropMappedExpression(event, basicUsername, setBasicUsername)}
                    className="h-10 mt-2"
                  />
                  <Input
                    value={basicPassword}
                    type="password"
                    placeholder="Password"
                    onChange={(event) => setBasicPassword(event.target.value)}
                    onDragOver={allowMappingDrop}
                    onDrop={(event) => dropMappedExpression(event, basicPassword, setBasicPassword)}
                    className="h-10"
                  />
                </AlertDescription>
              </Alert>
            ) : null}
          </TabsContent>
        </Tabs>

        {isOAuthMode && (
          <>
            <IntegrationPanel
              session={integrationSession}
              selectedNotionPageIds={selectedNotionPageIds}
              onNotionPagesChange={setNotionPageIds}
              notionTableByPage={notionTableByPage}
              onNotionTableChange={handleNotionTableChange}
              autoSchedule={autoSchedule}
              onAutoScheduleChange={setAutoSchedule}
              onSaveSchedule={saveScheduleSettings}
              scheduleSaving={scheduleSaving}
              onPagesRefreshed={handleRefreshPages}
              onDatabaseCreated={handleDatabaseCreated}
              mediaReport={mediaReport}
              insightReport={insightReport}
            />

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <input
                id="saveToNotion"
                type="checkbox"
                checked={saveToNotion}
                onChange={(event) => setSaveToNotion(event.target.checked)}
                disabled
              />
              <Label htmlFor="saveToNotion">Save to Notion simultaneously (disabled)</Label>
              <Badge>3 free saves (✓ active)</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={saveResult}
                disabled={saving || (!insightReport && !mediaReport)}
                className="gap-2"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Save Data
              </Button>
              <Button
                variant="outline"
                onClick={exportN8n}
                disabled={exporting || !insightReport || !isInsightEndpoint}
                className="gap-2"
              >
                {exporting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export n8n JSON
              </Button>
            </div>
          </>
        )}

        <Button
          onClick={runAnalysis}
          disabled={running}
          className="h-12 w-full gap-2 text-base font-medium"
        >
          {running ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Play className="h-5 w-5" />
          )}
          Run
        </Button>

        {status ? (
          <Alert className="border-emerald-300/80 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
