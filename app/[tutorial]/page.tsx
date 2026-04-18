import { notFound } from 'next/navigation';
import { NotionAPI } from 'notion-client';
import { parsePageId } from 'notion-utils';
import { PublicNotionPage } from '@/components/notion/public-notion-page';
import { getPublicTutorialBySlug } from '@/lib/config/public-tutorials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notion = new NotionAPI({
  apiBaseUrl: process.env.NOTION_API_BASE_URL,
});

type TutorialPageProps = {
  params: Promise<{ tutorial: string }>;
};

function resolveTutorialTarget(slug: string): {
  target: string;
} {
  const configuredTutorial = getPublicTutorialBySlug(slug);
  if (!configuredTutorial) {
    return {
      target: slug,
    };
  }

  const configuredTarget = configuredTutorial.notionTarget.trim();

  return {
    target: configuredTarget.length > 0 ? configuredTarget : configuredTutorial.slug,
  };
}

export default async function TutorialPage(props: TutorialPageProps) {
  const { tutorial } = await props.params;
  const slug = decodeURIComponent(tutorial).trim();

  if (!slug) {
    notFound();
  }

  const { target } = resolveTutorialTarget(slug);
  const pageId = parsePageId(target);

  if (!pageId) {
    notFound();
  }

  try {
    const recordMap = await notion.getPage(pageId);
    return <PublicNotionPage recordMap={recordMap} rootPageId={pageId} />;
  } catch {
    notFound();
  }
}
