import {
  consumeEnvelopeAction,
  deleteEnvelopeAction,
  storeEnvelopeAction,
} from "@/actions/envelope-actions";
import HeroSection from "@/components/hero-section";
import { Button } from "@/components/ui/button";
import {
  getEnvelopeStoreOverview,
  listRecentEnvelopeSummaries,
} from "@/lib/server/envelope-service";

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const resolveQueryParam = (
  value: string | string[] | undefined
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const status = resolveQueryParam(params.status);
  const message = resolveQueryParam(params.message);

  const [overview, summaries] = await Promise.all([
    getEnvelopeStoreOverview(),
    listRecentEnvelopeSummaries(20),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
        <HeroSection />

        {message ? (
          <section
            className={
              status === "ok"
                ? "rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
                : "rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
            }
          >
            <p className="font-medium">{decodeURIComponent(message)}</p>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="mb-2 text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Cache Components
            </p>
            <h2 className="font-semibold text-lg">RSC-Only Data Flow</h2>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              This dashboard is rendered via Server Components and cached
              service functions using `use cache`, `cacheTag`, and `cacheLife`.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="mb-2 text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Active Envelopes
            </p>
            <h2 className="font-semibold text-3xl">
              {overview.stats.activeRecords}
            </h2>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              Cached snapshot generated at{" "}
              {new Date(overview.generatedAt).toLocaleTimeString()}.
            </p>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="mb-2 text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Default TTL
            </p>
            <h2 className="font-semibold text-3xl">
              {Math.floor(overview.limits.defaultTtlSeconds / 60)}m
            </h2>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              Max allowed TTL is{" "}
              {Math.floor(overview.limits.maxTtlSeconds / 3600)}h.
            </p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <h2 className="font-semibold text-lg">Store Encrypted Envelope</h2>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              Paste a fully encrypted `SecretEnvelopeV1` JSON object (PBKDF2 or
              Argon2id profile). Server stores only opaque ciphertext and
              metadata.
            </p>

            <form action={storeEnvelopeAction} className="mt-4 space-y-4">
              <label className="block space-y-2">
                <span className="font-medium text-sm">Envelope JSON</span>
                <textarea
                  className="min-h-52 w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  name="envelopeJson"
                  placeholder='{"version":"shareenv.v1", ... }'
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="font-medium text-sm">
                    TTL seconds (optional)
                  </span>
                  <input
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    min={0}
                    name="ttlSeconds"
                    placeholder="900"
                    type="number"
                  />
                </label>

                <label className="flex items-center gap-2 pt-7">
                  <input
                    className="size-4 rounded border border-input"
                    defaultChecked
                    name="oneTime"
                    type="checkbox"
                  />
                  <span className="text-sm">One-time retrieval</span>
                </label>
              </div>

              <Button type="submit">Store Envelope</Button>
            </form>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <h2 className="font-semibold text-lg">Envelope Operations</h2>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              Consume or delete by id using server actions. Mutations invalidate
              cache tags for immediate RSC refresh.
            </p>

            <div className="mt-4 space-y-3">
              <form
                action={consumeEnvelopeAction}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  name="id"
                  placeholder="Envelope id to consume"
                  required
                />
                <Button type="submit" variant="secondary">
                  Consume
                </Button>
              </form>

              <form
                action={deleteEnvelopeAction}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  name="id"
                  placeholder="Envelope id to delete"
                  required
                />
                <Button type="submit" variant="destructive">
                  Delete
                </Button>
              </form>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <h2 className="font-semibold text-lg">Recent Envelope Summaries</h2>
          <p className="mt-2 text-muted-foreground text-sm leading-6">
            Cached summary view. Full envelope payloads are intentionally not
            rendered in the UI.
          </p>

          {summaries.length === 0 ? (
            <p className="mt-4 text-muted-foreground text-sm">
              No envelopes stored yet.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Expires</th>
                    <th className="px-3 py-2 font-medium">One-time</th>
                    <th className="px-3 py-2 font-medium">Reads</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((summary) => (
                    <tr className="border-border border-t" key={summary.id}>
                      <td className="px-3 py-2 font-mono text-xs">
                        {summary.id}
                      </td>
                      <td className="px-3 py-2">
                        {new Date(summary.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {summary.expiresAt
                          ? new Date(summary.expiresAt).toLocaleString()
                          : "never"}
                      </td>
                      <td className="px-3 py-2">
                        {summary.oneTime ? "yes" : "no"}
                      </td>
                      <td className="px-3 py-2">{summary.accessCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
