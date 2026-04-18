import { Key, Shield, Vault } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";

export default function HeroSection() {
  return (
    <section className="vault-glass relative overflow-hidden rounded-3xl border border-border/80 p-6 shadow-xl md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,oklch(0.65_0.12_210/0.12),transparent_40%),radial-gradient(circle_at_8%_88%,oklch(0.82_0.09_85/0.1),transparent_46%)]" />
      <div className="vault-grid-bg pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Vault className="size-5 text-primary" weight="duotone" />
          </div>
          <Badge
            className="rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.14em]"
            variant="secondary"
          >
            ShareEnv Protocol v1
          </Badge>
          <Badge className="rounded-full" variant="outline">
            Browser-side cryptography
          </Badge>
        </div>

        <div className="space-y-5">
          <h1 className="max-w-3xl font-semibold text-3xl leading-[1.08] tracking-tight md:text-5xl">
            Share secrets without
            <br />
            <span className="text-primary">sharing trust.</span>
          </h1>

          <p className="max-w-2xl text-base text-muted-foreground leading-7 md:text-lg">
            Generate a local encrypted envelope for your environment variables.
            Send the link and passphrase separately, then decrypt entirely in
            browser on the receiving side.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <p className="font-medium text-sm">1. Seal locally</p>
            <p className="mt-2 text-muted-foreground text-xs leading-5">
              Encrypt values with AES-256-GCM before they touch the network.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <p className="font-medium text-sm">2. Split channels</p>
            <p className="mt-2 text-muted-foreground text-xs leading-5">
              Share the envelope link and passphrase through different routes.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
            <p className="font-medium text-sm">3. Open locally</p>
            <p className="mt-2 text-muted-foreground text-xs leading-5">
              Recipient decrypts client-side with tamper checks built in.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="gap-1.5" variant="default">
            <Shield className="size-3" weight="fill" />
            AES-256-GCM
          </Badge>
          <Badge className="gap-1.5" variant="default">
            <Key className="size-3" weight="fill" />
            Auto strong passphrase
          </Badge>
          <Badge variant="default">Argon2id / PBKDF2</Badge>
          <Badge variant="default">HMAC-SHA-256</Badge>
          <Badge variant="secondary">Client-side only</Badge>
        </div>
      </div>
    </section>
  );
}
