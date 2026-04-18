'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ExtendedRecordMap } from 'notion-types';
import { NotionRenderer, type NotionComponents } from 'react-notion-x';

const PRISM_LANGUAGES = [
  'markup-templating',
  'markup',
  'bash',
  'c',
  'cpp',
  'csharp',
  'docker',
  'go',
  'graphql',
  'java',
  'js-templates',
  'json',
  'less',
  'makefile',
  'markdown',
  'objectivec',
  'python',
  'rust',
  'scss',
  'solidity',
  'sql',
  'swift',
  'typescript',
  'yaml',
];

const Code = dynamic(() =>
  import('react-notion-x/third-party/code').then(async (module) => {
    await Promise.allSettled(
      PRISM_LANGUAGES.map((language) => import(`prismjs/components/prism-${language}.js`))
    );

    return module.Code;
  })
);

const Collection = dynamic(() =>
  import('react-notion-x/third-party/collection').then((module) => module.Collection)
);

const Equation = dynamic(() =>
  import('react-notion-x/third-party/equation').then((module) => module.Equation)
);

const Pdf = dynamic(() => import('react-notion-x/third-party/pdf').then((module) => module.Pdf), {
  ssr: false,
});

const Modal = dynamic(
  () =>
    import('react-notion-x/third-party/modal').then((module) => {
      module.Modal.setAppElement('.notion-viewport');
      return module.Modal;
    }),
  {
    ssr: false,
  }
);

const notionComponents: Partial<NotionComponents> = {
  nextLink: Link,
  Code,
  Collection,
  Equation,
  Pdf,
  Modal,
};

interface PublicNotionPageProps {
  recordMap: ExtendedRecordMap;
  rootPageId?: string;
}

export function PublicNotionPage({ recordMap, rootPageId }: PublicNotionPageProps) {
  return (
    <div className="notion-viewport">
      <NotionRenderer
        bodyClassName="notion-public-page"
        recordMap={recordMap}
        fullPage={true}
        darkMode={false}
        rootPageId={rootPageId}
        previewImages={Boolean(recordMap.preview_images)}
        showCollectionViewDropdown={false}
        showTableOfContents={true}
        minTableOfContentsItems={3}
        components={notionComponents}
      />
    </div>
  );
}
