import type { LucideIcon } from "lucide-react";

export type ConsoleSidebarAction = "new-request" | "open-tutorial";

type BaseItem = {
  title: string;
  icon: LucideIcon;
  badge?: string;
};

export type ConsoleSidebarLinkItem = BaseItem & {
  href: string;
  action?: never;
};

export type ConsoleSidebarActionItem = BaseItem & {
  action: ConsoleSidebarAction;
  href?: never;
};

export type ConsoleSidebarNavItem = ConsoleSidebarLinkItem | ConsoleSidebarActionItem;

export type ConsoleSidebarNavGroup = {
  title: string;
  items: ConsoleSidebarNavItem[];
};

export type ConsoleSidebarUser = {
  name: string;
  email: string;
  initials: string;
};
