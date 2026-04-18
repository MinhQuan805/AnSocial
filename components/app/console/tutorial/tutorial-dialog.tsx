'use client';

import { useEffect, useState } from 'react';
import type { ExtendedRecordMap } from 'notion-types';
import { NotionRenderer } from 'react-notion-x';
import { toast } from 'react-toastify';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PUBLIC_TUTORIALS, type PublicTutorial } from '@/lib/config/public-tutorials';
import { fetchPublicNotionPage } from '@/lib/notion/load-public-page';

const NOT_CONFIGURED_MESSAGE =
  'This tutorial has not been configured with a public Notion page URL yet.';
const EMPTY_TUTORIAL_LIST_MESSAGE = 'No tutorials have been configured yet.';

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

export function TutorialDialog({ open, onOpenChange }: TutorialDialogProps) {
  const [activeTutorial, setActiveTutorial] = useState<string>(PUBLIC_TUTORIALS[0]?.slug ?? '');
  const [recordMap, setRecordMap] = useState<ExtendedRecordMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>(NOT_CONFIGURED_MESSAGE);

  const activeTutorialConfig = PUBLIC_TUTORIALS.find((item) => item.slug === activeTutorial);

  function resolveNotionTarget(tutorial: PublicTutorial): string {
    const configuredTarget = tutorial.notionTarget.trim();
    return configuredTarget.length > 0 ? configuredTarget : tutorial.slug.trim();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!activeTutorialConfig) {
      setRecordMap(null);
      setMessage(EMPTY_TUTORIAL_LIST_MESSAGE);
      return;
    }

    const notionTarget = resolveNotionTarget(activeTutorialConfig);
    if (!notionTarget) {
      setRecordMap(null);
      setMessage(NOT_CONFIGURED_MESSAGE);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    const load = async () => {
      try {
        const page = await fetchPublicNotionPage(notionTarget, controller.signal);

        if (!cancelled) {
          setRecordMap(page.recordMap);
          setMessage('');
        }
      } catch {
        if (!cancelled) {
          setRecordMap(null);
          setMessage(
            'Unable to load this tutorial from Notion. Make sure the page exists and is public.'
          );
          toast.error('Unable to load tutorial from Notion.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTutorialConfig, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Product Tutorials</DialogTitle>
          <DialogDescription>
            Tutorials are loaded directly from public Notion pages.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {PUBLIC_TUTORIALS.map((item) => (
            <Button
              key={item.slug}
              type="button"
              size="sm"
              variant={item.slug === activeTutorial ? 'default' : 'outline'}
              onClick={() => setActiveTutorial(item.slug)}
            >
              {item.title}
            </Button>
          ))}
        </div>

        <div className="mt-2 overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-sm">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading Notion tutorial...</p>
          ) : recordMap ? (
            <NotionRenderer recordMap={recordMap} fullPage={false} darkMode={false} />
          ) : (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
