export type PublicTutorial = {
  slug: string;
  title: string;
  notionTarget: string;
};

// Add new public tutorials here. Each slug becomes a route at /<slug>.
// notionTarget can be a Notion share URL or a page ID. If empty, slug is used.
export const PUBLIC_TUTORIALS: PublicTutorial[] = [
  {
    slug: '1-Daily-Weekly-To-Do-Lists-15172ef69052804a9e8fd382316d2e1f',
    title: '1. Daily / Weekly To-Do Lists',
    notionTarget: '1-Daily-Weekly-To-Do-Lists-15172ef69052804a9e8fd382316d2e1f',
  },
  {
    slug: 'instagram',
    title: 'Instagram Tutorial',
    notionTarget: '',
  },
  {
    slug: 'facebook',
    title: 'Facebook Tutorial',
    notionTarget: '',
  },
  {
    slug: 'tiktok',
    title: 'TikTok Tutorial',
    notionTarget: '',
  },
  {
    slug: 'youtube',
    title: 'YouTube Tutorial',
    notionTarget: '',
  },
];

const publicTutorialBySlug = new Map(PUBLIC_TUTORIALS.map((tutorial) => [tutorial.slug, tutorial]));

export function getPublicTutorialBySlug(slug: string): PublicTutorial | undefined {
  return publicTutorialBySlug.get(slug);
}
