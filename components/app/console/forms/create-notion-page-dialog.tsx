"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "react-toastify";

interface CreateNotionPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPageCreated: (page: { id: string; title: string }) => void;
}

export function CreateNotionPageDialog({
  open,
  onOpenChange,
  onPageCreated,
}: CreateNotionPageDialogProps) {
  const [pageName, setPageName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePage = async () => {
    if (!pageName.trim()) {
      setError("Page name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/notion/pages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageTitle: pageName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create page");
      }

      const page = await response.json();
      onPageCreated(page);
      toast.success(`Notion page \"${page.title}\" created successfully.`);
      setPageName("");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create page";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSubmitting) {
      e.preventDefault();
      handleCreatePage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Notion Page</DialogTitle>
          <DialogDescription>
            Create a new page in your Notion workspace
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="page-name">Page Name</Label>
            <Input
              id="page-name"
              placeholder="e.g., My Page"
              value={pageName}
              onChange={(e) => {
                setPageName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreatePage} disabled={isSubmitting || !pageName.trim()}>
            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating..." : "Create Page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
