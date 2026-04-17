"use client";

import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type {
  ConsoleSidebarActionItem,
  ConsoleSidebarAction,
  ConsoleSidebarNavGroup,
  ConsoleSidebarLinkItem,
  ConsoleSidebarNavItem,
} from "@/components/app/console/sidebar/types";

interface ConsoleNavGroupProps {
  group: ConsoleSidebarNavGroup;
  pathname: string;
  onAction: (action: ConsoleSidebarAction) => void;
}

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/console") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isLinkItem(item: ConsoleSidebarNavItem): item is ConsoleSidebarLinkItem {
  return typeof item.href === "string";
}

function isActionItem(item: ConsoleSidebarNavItem): item is ConsoleSidebarActionItem {
  return typeof item.action === "string";
}

export function ConsoleNavGroup({ group, pathname, onAction }: ConsoleNavGroupProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) => (
          <SidebarMenuItem key={`${group.title}-${item.title}`}>
            {isLinkItem(item) ? (
              <SidebarMenuButton asChild isActive={isRouteActive(pathname, item.href)} tooltip={item.title}>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                  {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                </Link>
              </SidebarMenuButton>
            ) : isActionItem(item) ? (
              <SidebarMenuButton onClick={() => onAction(item.action)} tooltip={item.title}>
                <item.icon />
                <span>{item.title}</span>
                {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
              </SidebarMenuButton>
            ) : null}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
