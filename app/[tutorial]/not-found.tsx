import Link from 'next/link';
import { PUBLIC_TUTORIALS } from '@/lib/config/public-tutorials';

const EXAMPLE_TUTORIALS = PUBLIC_TUTORIALS.slice(0, 5);

export default function TutorialNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Tutorial page not found</h1>
      <p className="text-sm text-muted-foreground">
        This route does not contain a valid public Notion page ID.
      </p>

      <p className="text-sm text-muted-foreground">
        Add or edit tutorials in <code>lib/config/public-tutorials.ts</code>.
      </p>

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <p className="mb-2 text-sm font-medium">Configured examples:</p>
        <ul className="space-y-1 text-sm">
          {EXAMPLE_TUTORIALS.map((tutorial) => (
            <li key={tutorial.slug}>
              <Link href={`/${tutorial.slug}`} className="text-primary hover:underline">
                /{tutorial.slug}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <Link href="/console" className="text-sm font-medium text-primary hover:underline">
          Back to console
        </Link>
      </div>
    </main>
  );
}
