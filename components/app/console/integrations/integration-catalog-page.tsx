'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, GraduationCap, LoaderCircle, Search as SearchIcon } from 'lucide-react';
import type { ExtendedRecordMap } from 'notion-types';
import { NotionRenderer } from 'react-notion-x';
import { toast } from 'react-toastify';

import {
  INTEGRATION_CATALOG,
  type IntegrationCatalogItem,
} from '@/components/app/console/integrations/integration-catalog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { fetchPublicNotionPage } from '@/lib/notion/load-public-page';

const DEFAULT_GUIDE_MESSAGE =
  'Select Tutorial or Connect on any card to open the matching Notion guide.';

const NOT_CONFIGURED_MESSAGE =
  'This guide has not been configured with a public Notion page URL yet.';

type ActiveGuide = {
  slug: string;
  title: string;
  target: string;
  mode: 'tutorial' | 'connect';
};

export function IntegrationCatalogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGuide, setActiveGuide] = useState<ActiveGuide | null>(null);
  const [guideRecordMap, setGuideRecordMap] = useState<ExtendedRecordMap | null>(null);
  const [guideMessage, setGuideMessage] = useState<string>(DEFAULT_GUIDE_MESSAGE);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const lastStatusToastRef = useRef<string | null>(null);
  const lastErrorToastRef = useRef<string | null>(null);

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return INTEGRATION_CATALOG;
    }

    return INTEGRATION_CATALOG.filter((item) =>
      [item.title, item.subtitle, item.description].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [searchQuery]);

  useEffect(() => {
    if (!activeGuide) {
      setGuideRecordMap(null);
      setGuideMessage(DEFAULT_GUIDE_MESSAGE);
      return;
    }

    const target = activeGuide.target.trim();
    if (!target) {
      setGuideRecordMap(null);
      setGuideMessage(NOT_CONFIGURED_MESSAGE);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoadingGuide(true);

    fetchPublicNotionPage(target, controller.signal)
      .then((page) => {
        if (!cancelled) {
          setGuideRecordMap(page.recordMap);
          setGuideMessage('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unable to load this Notion guide. Make sure the page is public.';
          setGuideRecordMap(null);
          setGuideMessage(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingGuide(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeGuide]);

  useEffect(() => {
    if (!connectStatus) {
      lastStatusToastRef.current = null;
      return;
    }

    if (lastStatusToastRef.current === connectStatus) {
      return;
    }

    lastStatusToastRef.current = connectStatus;
    toast.success(connectStatus);
  }, [connectStatus]);

  useEffect(() => {
    if (!connectError) {
      lastErrorToastRef.current = null;
      return;
    }

    if (lastErrorToastRef.current === connectError) {
      return;
    }

    lastErrorToastRef.current = connectError;
    toast.error(connectError);
  }, [connectError]);

  const openGuide = (item: IntegrationCatalogItem, mode: 'tutorial' | 'connect') => {
    setConnectError(null);
    if (mode === 'tutorial') {
      setConnectStatus(null);
    }

    setActiveGuide({
      slug: item.slug,
      title: `${item.title} ${mode === 'tutorial' ? 'Tutorial' : 'Connect Guide'}`,
      target: mode === 'tutorial' ? item.tutorialNotionUrl : item.connectNotionUrl,
      mode,
    });
  };

  const connectProvider = async (item: IntegrationCatalogItem) => {
    openGuide(item, 'connect');
    setConnectError(null);
    setConnectStatus(null);

    if (!item.providerType) {
      setConnectStatus(
        'This integration currently uses manual setup. Follow the Connect Guide below.'
      );
      return;
    }

    try {
      setConnectingSlug(item.slug);

      const response = await fetch(`/api/providers/${item.providerType}/connect`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? payload?.details ?? 'Connection request failed.');
      }

      if (typeof payload?.authorizeUrl === 'string' && payload.authorizeUrl.length > 0) {
        window.open(payload.authorizeUrl, `${item.slug}-oauth`, 'popup,width=560,height=760');
        setConnectStatus('OAuth popup opened. Complete authorization and return to this console.');
      } else {
        setConnectStatus('Connect request sent successfully.');
      }
    } catch (error) {
      setConnectError(
        error instanceof Error ? error.message : 'Unable to connect this integration.'
      );
    } finally {
      setConnectingSlug(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-3 text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Notion Marketing Integrations - Track & Analyze Your Data
        </h1>
        <p className="mx-auto max-w-4xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-lg">
          Keep all your marketing data in one place with Notion. Import social media insights, track
          campaign performance, and organize analytics from LinkedIn, TikTok, and more without
          coding.
        </p>
      </header>

      <section className="space-y-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search Notion integrations..."
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              No integration matches your search.
            </div>
          ) : (
            filteredCards.map((item) => {
              const Icon = item.icon;
              const connecting = connectingSlug === item.slug;
              const selected = activeGuide?.slug === item.slug;

              return (
                <Card
                  key={item.slug}
                  className={cn(
                    'h-full border-border/80 bg-card/90 shadow-sm transition-all',
                    'hover:-translate-y-0.5 hover:shadow-md',
                    selected && 'ring-2 ring-primary/20'
                  )}
                >
                  <CardHeader className="space-y-3 pb-2">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground">
                        <Icon className="size-5" />
                      </span>
                      <div className="space-y-1">
                        <CardTitle className="text-3xl leading-tight md:text-2xl">
                          {item.title}
                        </CardTitle>
                        <CardDescription>{item.subtitle}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col gap-4 pt-0">
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <p className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <GraduationCap className="size-3.5" />
                      Tutorial Available
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openGuide(item, 'tutorial')}
                      >
                        Tutorial
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={connecting}
                        onClick={() => {
                          void connectProvider(item);
                        }}
                      >
                        {connecting ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="size-3.5" />
                        )}
                        Connect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {connectStatus ? (
        <Alert className="border-emerald-300/80 bg-emerald-50 text-emerald-900">
          <AlertTitle>Connect status</AlertTitle>
          <AlertDescription>{connectStatus}</AlertDescription>
        </Alert>
      ) : null}

      {connectError ? (
        <Alert variant="destructive">
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>{connectError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-card/90 p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {activeGuide?.title ?? 'Notion Guide Preview'}
          </p>
          <Badge className="capitalize border-zinc-200 bg-zinc-100 text-zinc-700">
            {activeGuide?.mode ?? 'preview'}
          </Badge>
        </div>

        <div className="max-h-[52vh] overflow-auto rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
          {loadingGuide ? (
            <p className="text-sm text-muted-foreground">Loading Notion guide...</p>
          ) : guideRecordMap ? (
            <NotionRenderer recordMap={guideRecordMap} fullPage={false} darkMode={false} />
          ) : (
            <p className="text-sm text-muted-foreground">{guideMessage}</p>
          )}
        </div>
      </section>
    </div>
  );
}
