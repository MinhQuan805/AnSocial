import { ArrowRight, ShieldCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface NotionGateProps {
  error?: string | null;
}

export function NotionGate({ error }: NotionGateProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl border-zinc-200 bg-white/95">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full border border-zinc-200 bg-zinc-50 p-3">
              <ShieldCheck className="h-6 w-6 text-zinc-700" />
            </div>
          </div>
          <CardTitle className="text-center text-3xl font-semibold tracking-tight text-zinc-900">
            Note API Connector
          </CardTitle>
          <CardDescription className="mx-auto max-w-md text-center text-base leading-relaxed">
            Connect Notion workspace to access the analytics area. Tokens are always processed on the server and
            are never exposed to the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <a href="/api/auth/notion/start" className="block">
            <Button className="h-11 w-full text-base" variant="default">
              Connect to Notion
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
          <Alert>
            Pop-ups must be temporarily enabled during OAuth connection. They can be disabled afterwards.
          </Alert>
          {error ? (
            <p className="text-center text-sm text-red-600">
              Connection failed. Please try again. ({error})
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
