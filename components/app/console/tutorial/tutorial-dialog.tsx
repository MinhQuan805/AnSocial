"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type TutorialSlug = "instagram" | "facebook" | "tiktok" | "youtube";

const TUTORIAL_OPTIONS: Array<{ slug: TutorialSlug; label: string }> = [
  { slug: "instagram", label: "Instagram" },
  { slug: "facebook", label: "Facebook" },
  { slug: "tiktok", label: "TikTok" },
  { slug: "youtube", label: "YouTube" },
];

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

export function TutorialDialog({ open, onOpenChange }: TutorialDialogProps) {
  const [activeTutorial, setActiveTutorial] = useState<TutorialSlug>("instagram");
  const [content, setContent] = useState<string>("Loading tutorial...");

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/tutorials/${activeTutorial}.md`);
        const markdown = await response.text();

        if (!cancelled) {
          setContent(markdown);
        }
      } catch {
        if (!cancelled) {
          setContent("# Tutorial unavailable\n\nUnable to load this tutorial file.");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTutorial, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Product Tutorials</DialogTitle>
          <DialogDescription>
            Tutorials are loaded from markdown files in public/tutorials.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {TUTORIAL_OPTIONS.map((item) => (
            <Button
              key={item.slug}
              type="button"
              size="sm"
              variant={item.slug === activeTutorial ? "default" : "outline"}
              onClick={() => setActiveTutorial(item.slug)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="mt-2 overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-sm">
          <article className="space-y-3 leading-relaxed text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
