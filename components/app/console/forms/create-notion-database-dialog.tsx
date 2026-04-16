"use client";

import { useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
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

interface CreateNotionDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPageId: string;
  parentPageTitle: string;
  onDatabaseCreated: (database: { id: string; title: string }) => void;
  defaultFields?: string[];
}

export function CreateNotionDatabaseDialog({
  open,
  onOpenChange,
  parentPageId,
  parentPageTitle,
  onDatabaseCreated,
  defaultFields,
}: CreateNotionDatabaseDialogProps) {
  const [databaseName, setDatabaseName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateDatabase = async () => {
    if (!databaseName.trim()) {
      setError("Database name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/notion/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentPageId,
          databaseTitle: databaseName.trim(),
          defaultFields,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create database");
      }

      const database = await response.json();
      onDatabaseCreated(database);
      setDatabaseName("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create database");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSubmitting) {
      e.preventDefault();
      handleCreateDatabase();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Notion Database</DialogTitle>
          <DialogDescription>
            Create a new database in "{parentPageTitle}" to store insight data
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="database-name">Database Name</Label>
            <Input
              id="database-name"
              placeholder="e.g., Marketing Insights"
              value={databaseName}
              onChange={(e) => {
                setDatabaseName(e.target.value);
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreateDatabase} disabled={isSubmitting || !databaseName.trim()}>
            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Create Database
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
