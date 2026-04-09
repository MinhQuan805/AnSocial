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
            Kết nối Notion workspace để vào khu vực phân tích. Token luôn được xử lý ở server và
            không lộ ra trình duyệt.
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
            Pop-up phải được bật tạm thời khi kết nối OAuth. Sau khi kết nối xong có thể tắt lại.
          </Alert>
          {error ? (
            <p className="text-center text-sm text-red-600">
              Kết nối thất bại. Vui lòng thử lại. ({error})
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
