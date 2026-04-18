import { BookOpenText, LayoutDashboard, Link2, PlusSquare } from 'lucide-react';

import type {
  ConsoleSidebarNavGroup,
  ConsoleSidebarUser,
} from '@/components/app/console/sidebar/types';

function buildInitials(value: string): string {
  const words = value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return 'NA';
  }

  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'NA';
}

export function buildConsoleSidebarNavGroups(): ConsoleSidebarNavGroup[] {
  return [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          href: '/console',
          icon: LayoutDashboard,
        },
        {
          title: 'Integrations',
          href: '/console/integrations',
          icon: Link2,
        },
      ],
    },
    {
      title: 'Workspace',
      items: [
        {
          title: 'New Request',
          action: 'new-request',
          icon: PlusSquare,
        },
        {
          title: 'Tutorial',
          action: 'open-tutorial',
          icon: BookOpenText,
        },
      ],
    },
  ];
}

export function buildConsoleSidebarUser(notionWorkspaceName: string | null): ConsoleSidebarUser {
  const workspaceName = notionWorkspaceName?.trim() || 'Notion Workspace';

  return {
    name: workspaceName,
    email: 'console@ana-social.app',
    initials: buildInitials(workspaceName),
  };
}
