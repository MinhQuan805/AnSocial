import { ConsoleApp } from "@/components/app/console-app";
import { loadConsoleSession } from "@/app/console/_lib/load-console-session";

export default async function ConsolePage() {
  const session = await loadConsoleSession();

  return <ConsoleApp session={session} />;
}