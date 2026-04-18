'use client';

import { useMemo } from 'react';
import { Command } from 'lucide-react';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  buildConsoleSidebarNavGroups,
  buildConsoleSidebarUser,
} from '@/components/app/console/sidebar/data/sidebar-data';
import { ConsoleNavGroup } from '@/components/app/console/sidebar/nav-group';
import { ConsoleNavUser } from '@/components/app/console/sidebar/nav-user';
import type { ConsoleSidebarAction } from '@/components/app/console/sidebar/types';

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
  const pathname = usePathname();

  const navGroups = useMemo(() => buildConsoleSidebarNavGroups(), []);
  const user = useMemo(() => buildConsoleSidebarUser(notionWorkspaceName), [notionWorkspaceName]);

  const handleAction = (action: ConsoleSidebarAction) => {
    if (action === 'new-request') {
      onNewRequest();
      return;
    }

    onOpenTutorial();
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Note API Connector</span>
                <span className="truncate text-xs text-muted-foreground">Next + shadcn/ui</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <ConsoleNavGroup
            key={group.title}
            group={group}
            pathname={pathname}
            onAction={handleAction}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <ConsoleNavUser
          user={user}
          remainingFreeSaves={remainingFreeSaves}
          loggingOut={loggingOut}
          onLogout={onLogout}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
