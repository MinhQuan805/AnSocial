import { IntegrationsApp } from '@/components/app/console/integrations/integrations-app';
import { loadConsoleSession } from '@/app/console/_lib/load-console-session';

export default async function ConsoleIntegrationsPage() {
  const session = await loadConsoleSession();

  return <IntegrationsApp session={session} />;
}
