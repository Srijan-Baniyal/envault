import { ArrowLeft, Shield } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DecryptForm } from "@/components/decrypt-form";

interface RetrievePageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Retrieve Envelope — ShareEnv",
  description:
    "Decrypt a shared environment variable envelope using your passphrase. All decryption happens in your browser.",
};

export default function RetrievePage({ params }: RetrievePageProps) {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8 md:px-8 md:py-12">
        <div className="flex items-center gap-3">
          <Link
            className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg md:p-8">
          <div className="vault-grid-bg pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative space-y-1">
            <h1 className="font-semibold text-xl">Retrieve Shared Envelope</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Someone shared encrypted environment variables with you. Enter
              your passphrase to decrypt them locally.
            </p>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="vault-glass animate-vault-fade-in rounded-2xl border border-border p-5 text-center text-muted-foreground text-sm md:p-8">
              Loading shared envelope...
            </div>
          }
        >
          {params.then(({ id }) => (
            <DecryptForm initialId={id} />
          ))}
        </Suspense>

        <div className="flex items-center justify-center gap-1 text-muted-foreground/60 text-xs">
          <Shield className="size-3" weight="fill" />
          <span>Powered by ShareEnv Protocol v1</span>
        </div>
      </main>
    </div>
  );
}
