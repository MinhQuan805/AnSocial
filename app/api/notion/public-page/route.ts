import { NextRequest, NextResponse } from "next/server";
import { NotionAPI } from "notion-client";
import { parsePageId } from "notion-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notion = new NotionAPI({
  apiBaseUrl: process.env.NOTION_API_BASE_URL || "https://api.notion.com",
  authToken: process.env.NOTION_API_KEY,
});

function resolvePageId(target: string): string | null {
  const value = target.trim();
  if (!value) {
    return null;
  }

  return parsePageId(value) ?? null;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("target") ?? "";
  const pageId = resolvePageId(target);

  if (!pageId) {
    return NextResponse.json(
      { error: "Invalid Notion page URL or page ID." },
      { status: 400 },
    );
  }

  try {
    const recordMap = await notion.getPage(pageId);

    return NextResponse.json(
      { pageId, recordMap },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to load this Notion page. Make sure the page exists and is set to public.",
      },
      { status: 502 },
    );
  }
}
