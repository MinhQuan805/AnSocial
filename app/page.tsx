import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { NotionGate } from "@/components/app/notion-gate";
import { services } from "@/lib/services/factory";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(services.sessionService.cookieName)?.value;

  if (sessionId) {
    const integration = await services.supabaseRepo.getIntegration(sessionId);
    if (integration?.notionAccessToken) {
      redirect("/console");
    }
  }

  return (
    <div className="flex flex-1 bg-[linear-gradient(140deg,#f8fafc_0%,#f4f4f5_45%,#f1f5f9_100%)]">
      <NotionGate error={params.error ?? null} />
    </div>
  );
}
