'use client';

import { useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { SessionView } from '@/components/app/console/types';
import { ConsoleSidebar } from '@/components/app/console/sidebar/console-sidebar';
import { TutorialDialog } from '@/components/app/console/tutorial/tutorial-dialog';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { IntegrationCatalogPage } from '@/components/app/console/integrations/integration-catalog-page';

interface IntegrationsAppProps {
  session: SessionView;
}

export function IntegrationsApp({ session }: IntegrationsAppProps) {
  const router = useRouter();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const goToDashboard = () => {
    router.push('/console');
  };

  const handleLogout = () => {
    setLoggingOut(true);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ana_session_id');
      window.location.href = '/';
    }
  };

  return (
    <SidebarProvider defaultOpen>
      <ConsoleSidebar
        notionWorkspaceName={session.notionWorkspaceName}
        remainingFreeSaves={session.remainingFreeSaves}
        loggingOut={loggingOut}
        onNewRequest={goToDashboard}
        onOpenTutorial={() => setTutorialOpen(true)}
        onLogout={handleLogout}
      />

      <SidebarInset className="min-h-svh">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Notion Marketing Integrations</p>
            <p className="truncate text-xs text-muted-foreground">
              Dedicated integration page with tutorials and provider connect actions.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={goToDashboard}>
              <ArrowLeft className="size-4" />
              Dashboard
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTutorialOpen(true)}>
              <Info className="size-4" />
              Tutorial
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <IntegrationCatalogPage />
        </main>
      </SidebarInset>

      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </SidebarProvider>
  );
}
