import { GithubLogo, Shield } from "@phosphor-icons/react/dist/ssr";

import HeroSection from "@/components/hero-section";
import { MainShell } from "@/components/main-shell";

export default function Home() {
  return (
    <div className="vault-page-surface flex flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-7 px-5 py-8 md:px-8 md:py-12 lg:gap-8 lg:px-10 lg:py-14">
        <HeroSection />
        <MainShell />
      </main>

      <footer className="border-border border-t py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-5 text-center md:px-8 lg:px-10">
          <div className="flex items-center gap-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              <Shield className="size-3" weight="fill" />
              Zero-knowledge by design
            </span>
            <span>·</span>
            <span>Protocol v1</span>
            <span>·</span>
            <a
              className="flex items-center gap-1 transition-colors hover:text-foreground"
              href="https://github.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              <GithubLogo className="size-3" weight="bold" />
              Source
            </a>
          </div>
          <p className="max-w-md text-muted-foreground/60 text-xs leading-relaxed">
            All cryptographic operations execute client-side using Web Crypto
            API. The server stores only opaque encrypted envelopes and never
            receives passphrases.
          </p>
        </div>
      </footer>
    </div>
  );
}
