export default function HeroSection() {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm md:p-10">
      <div>
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.2em]">
          ShareEnv Architecture
        </p>

        <h1 className="mt-3 max-w-4xl font-semibold text-3xl leading-tight tracking-tight md:text-5xl">
          Secure Environment Sharing for Real Cryptography Engineering
        </h1>

        <p className="mt-5 max-w-3xl text-base text-muted-foreground leading-7 md:text-lg">
          ShareEnv focuses on strong client-side encryption, zero-knowledge
          server behavior, and strict integrity guarantees using MAC
          verification. This repo is set up as an engineering-grade foundation
          for the product and eventual npm package extraction.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="font-medium text-muted-foreground text-xs uppercase">
              KDF
            </p>
            <p className="mt-1 font-semibold text-sm">PBKDF2-SHA-256</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="font-medium text-muted-foreground text-xs uppercase">
              Cipher
            </p>
            <p className="mt-1 font-semibold text-sm">AES-256-GCM</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="font-medium text-muted-foreground text-xs uppercase">
              Integrity
            </p>
            <p className="mt-1 font-semibold text-sm">HMAC-SHA-256</p>
          </div>
        </div>
      </div>
    </section>
  );
}
