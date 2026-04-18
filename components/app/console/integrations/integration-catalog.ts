import type { LucideIcon } from 'lucide-react';
import {
  Camera,
  Globe,
  Megaphone,
  PanelsTopLeft,
  PlaySquare,
  Search,
  UserRoundCheck,
} from 'lucide-react';
import { INTEGRATION_NOTION_GUIDES, type IntegrationGuideSlug } from '@/lib/config/notion-guides';

export type IntegrationCatalogItem = {
  slug: IntegrationGuideSlug;
  title: string;
  subtitle: string;
  description: string;
  providerType?: string;
  tutorialNotionUrl: string;
  connectNotionUrl: string;
  icon: LucideIcon;
};

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    slug: 'facebook-ads',
    title: 'Facebook Ads',
    subtitle: 'Meta Ads performance',
    description:
      'Pull spend, impressions, clicks, and ROAS data into your Notion workspace for weekly reporting.',
    providerType: 'facebook',
    tutorialNotionUrl: INTEGRATION_NOTION_GUIDES['facebook-ads'].tutorial,
    connectNotionUrl: INTEGRATION_NOTION_GUIDES['facebook-ads'].connect,
    icon: Megaphone,
  },
  {
    slug: 'facebook-pages',
    title: 'Facebook Pages',
    subtitle: 'Page and post analytics',
    description:
      'Sync page insights and post-level metrics to monitor engagement, saves, and audience trends.',
    providerType: 'facebook',
    tutorialNotionUrl: INTEGRATION_NOTION_GUIDES['facebook-pages'].tutorial,
    connectNotionUrl: INTEGRATION_NOTION_GUIDES['facebook-pages'].connect,
    icon: PanelsTopLeft,
  },
  {
    slug: 'facebook-leads',
    title: 'Facebook Leads',
    subtitle: 'Lead form ingestion',
    description:
      'Import submitted lead form records, normalize fields, and centralize lead routing for your sales team.',
    providerType: 'facebook',
    tutorialNotionUrl: INTEGRATION_NOTION_GUIDES['facebook-leads'].tutorial,
    connectNotionUrl: INTEGRATION_NOTION_GUIDES['facebook-leads'].connect,
    icon: UserRoundCheck,
  },
  {
    slug: 'instagram',
    title: 'Instagram',
    subtitle: 'Reach and engagement insights',
    description:
      'Track profile-level and media-level performance with configurable metrics and date windows.',
    providerType: 'facebook',
    tutorialNotionUrl: INTEGRATION_NOTION_GUIDES.instagram.tutorial,
    connectNotionUrl: INTEGRATION_NOTION_GUIDES.instagram.connect,
    icon: Camera,
  },
  {
    slug: 'google-search-console',
    title: 'Google Search Console',
    subtitle: 'Organic search analytics',
    description:
      'Capture top queries, page CTR, and ranking shifts to power content optimization in Notion.',
    providerType: 'google',
    tutorialNotionUrl: INTEGRATION_NOTION_GUIDES['google-search-console'].tutorial,
    connectNotionUrl: INTEGRATION_NOTION_GUIDES['google-search-console'].connect,
    icon: Search,
  },
  {
    slug: 'youtube-public-data',
    title: 'YouTube Public Data',
    subtitle: 'Video and channel performance',
    description:
      'Monitor views, watch time, comments, and subscriber movements in one structured table.',
    providerType: 'youtube',
    tutorialNotionUrl: INTEGRATION_NOTION_GUIDES['youtube-public-data'].tutorial,
    connectNotionUrl: INTEGRATION_NOTION_GUIDES['youtube-public-data'].connect,
    icon: PlaySquare,
  },
  {
    slug: 'trustpilot',
    title: 'Trustpilot',
    subtitle: 'Review intelligence',
    description:
      'Bring review streams into Notion for sentiment tagging and weekly customer voice reporting.',
    tutorialNotionUrl: INTEGRATION_NOTION_GUIDES.trustpilot.tutorial,
    connectNotionUrl: INTEGRATION_NOTION_GUIDES.trustpilot.connect,
    icon: Globe,
  },
];
