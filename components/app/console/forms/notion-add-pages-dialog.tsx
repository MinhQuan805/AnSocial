"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Search, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type NotionPageOption = {
  id: string;
  title: string;
};

interface NotionAddPagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePages: NotionPageOption[];
  currentPageIds: string[];
  onAddPages: (pageIds: string[]) => void;
  onFetchAllPages?: () => Promise<NotionPageOption[]>;
  fetchingAllPages?: boolean;
}

export function NotionAddPagesDialog({
  open,
  onOpenChange,
  availablePages,
  currentPageIds,
  onAddPages,
  onFetchAllPages,
  fetchingAllPages = false,
}: NotionAddPagesDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayPages, setDisplayPages] = useState<NotionPageOption[]>(availablePages);

  // Load all pages when dialog opens
  const handleOpenDialog = async (newOpen: boolean) => {
    if (newOpen && onFetchAllPages) {
      try {
        const allPages = await onFetchAllPages();
        setDisplayPages(allPages);
      } catch {
        setDisplayPages(availablePages);
      }
    }
    if (newOpen === false) {
      setSelectedPageIds([]);
      setSearchQuery("");
    }
    onOpenChange(newOpen);
  };

  // Get pages that haven't been added yet
  const unaddedPages = useMemo(
    () => displayPages.filter((page) => !currentPageIds.includes(page.id)),
    [displayPages, currentPageIds]
  );

  // Filter pages based on search query
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) {
      return unaddedPages;
    }

    const query = searchQuery.toLowerCase();
    return unaddedPages.filter(
      (page) =>
        page.title.toLowerCase().includes(query) ||
        page.id.toLowerCase().includes(query)
    );
  }, [unaddedPages, searchQuery]);

  const handleToggle = (id: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddPages = async () => {
    if (selectedPageIds.length === 0) return;

    setIsSubmitting(true);
    try {
      // Add selected pages to the current selection
      onAddPages([...currentPageIds, ...selectedPageIds]);
      // Reset state
      setSelectedPageIds([]);
      setSearchQuery("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen === false) {
      // Reset state when closing
      setSelectedPageIds([]);
      setSearchQuery("");
    }
    handleOpenDialog(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add More Notion Pages</DialogTitle>
          <DialogDescription>
            Select additional Notion pages to add to your configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              disabled={fetchingAllPages}
              autoFocus
            />
          </div>

          {/* Pages list */}
          <div className="max-h-[400px] space-y-2 overflow-auto rounded-md border border-zinc-200 bg-white p-3">
            {fetchingAllPages ? (
              <div className="flex items-center justify-center py-8">
                <LoaderCircle className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
                {unaddedPages.length === 0
                  ? "All pages have been added"
                  : "No pages match your search"}
              </div>
            ) : (
              filteredPages.map((page) => (
                <label
                  key={page.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedPageIds.includes(page.id)}
                    onChange={() => handleToggle(page.id)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900">
                      {page.title}
                    </div>
                    <div className="text-xs font-mono text-zinc-500">
                      {page.id}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>

          {selectedPageIds.length > 0 && (
            <div className="text-xs text-zinc-600">
              {selectedPageIds.length} page{selectedPageIds.length !== 1 ? "s" : ""} selected
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddPages}
            disabled={selectedPageIds.length === 0 || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add {selectedPageIds.length > 0 ? `(${selectedPageIds.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
