"use client";

import {
  BookOpenText,
  Camera,
  ExternalLink,
  LoaderCircle,
  LogOut,
  Plus,
  Workflow,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

interface ConsoleSidebarProps {
  notionWorkspaceName: string | null;
  remainingFreeSaves: number;
  loggingOut: boolean;
  onNewRequest: () => void;
  onOpenTutorial: () => void;
  onLogout: () => void;
}

export function ConsoleSidebar({
  notionWorkspaceName,
  remainingFreeSaves,
  loggingOut,
  onNewRequest,
  onOpenTutorial,
  onLogout,
}: ConsoleSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/55 px-3 py-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 text-white">
            <Camera className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Note API Connector</p>
            <p className="truncate text-xs text-muted-foreground">Instagram workspace</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onNewRequest} tooltip="Create a new request" isActive>
                  <Plus />
                  <span>New request</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Open provider debug endpoint">
                  <a href="/api/providers" target="_blank" rel="noreferrer">
                    <ExternalLink />
                    <span>Integrations</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onOpenTutorial} tooltip="Open markdown tutorial">
                  <BookOpenText />
                  <span>Tutorial</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm">
          <p className="truncate font-medium">{notionWorkspaceName ?? "Notion workspace"}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Workflow className="size-3.5" />
            {remainingFreeSaves} free saves left
          </p>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} disabled={loggingOut} tooltip="Reset current session">
              {loggingOut ? <LoaderCircle className="animate-spin" /> : <LogOut />}
              <span>Reset session</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
