"use client";

import {
  Copy,
  Eye,
  EyeSlash,
  Key,
  LockOpen,
  ShieldWarning,
  Warning,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { retrieveEnvelopeAction } from "@/actions/retrieve-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { openEnvironmentEnvelope } from "@/lib/crypto/primitives";
import type { SecretEnvelope } from "@/lib/crypto/types";

type DecryptState =
  | "decrypting"
  | "done"
  | "error"
  | "fetching"
  | "idle"
  | "passphrase";

const MIN_PASSPHRASE_LENGTH = 12;
const SHARE_PATH_PATTERN = /\/s\/([^/?#]+)/i;

const toQuotedDotEnvValue = (value: string): string => {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t")
    .replaceAll('"', '\\"');

  return `"${escaped}"`;
};

const normalizeEnvelopeIdentifier = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return "";
  }

  try {
    const url = new URL(trimmedValue);
    const pathMatch = url.pathname.match(SHARE_PATH_PATTERN);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]);
    }

    const queryId = url.searchParams.get("id");
    if (queryId) {
      return queryId;
    }
  } catch {
    const localPathMatch = trimmedValue.match(SHARE_PATH_PATTERN);
    if (localPathMatch?.[1]) {
      return decodeURIComponent(localPathMatch[1]);
    }
  }

  return trimmedValue;
};

interface DecryptFormProps {
  initialId?: string;
}

interface DecryptedResultViewProps {
  decryptedVars: Record<string, string>;
  isOneTimeEnvelope: boolean | null;
  onReset: () => void;
}

function DecryptedResultView({
  decryptedVars,
  isOneTimeEnvelope,
  onReset,
}: DecryptedResultViewProps) {
  const entries = Object.entries(decryptedVars);
  const dotEnvString = entries
    .map(([key, value]) => `${key}=${toQuotedDotEnvValue(value)}`)
    .join("\n");

  return (
    <Card className="vault-glass relative animate-vault-fade-in overflow-hidden border-primary/25">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-primary/12 to-transparent" />
      <CardContent className="space-y-6 p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/15">
            <LockOpen className="size-5 text-primary" weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Envelope Opened</h3>
            <p className="text-muted-foreground text-xs">
              {String(entries.length)} variable{entries.length === 1 ? "" : "s"}{" "}
              decrypted
            </p>
          </div>
        </div>

        <Alert className="border-primary/30 bg-primary/5 text-left">
          <LockOpen className="size-4 text-primary" weight="fill" />
          <AlertTitle>Decryption completed locally</AlertTitle>
          <AlertDescription>
            These values never left your browser in plaintext.
          </AlertDescription>
        </Alert>

        {isOneTimeEnvelope ? (
          <Alert className="border-primary/30 bg-primary/5 text-left">
            <Warning className="size-4 text-primary" weight="fill" />
            <AlertTitle>This link was one-time</AlertTitle>
            <AlertDescription>
              It was consumed when retrieved and cannot be opened again.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader className="bg-muted/40 text-muted-foreground">
              <TableRow>
                <TableHead className="px-3 py-2 font-medium text-xs">
                  Key
                </TableHead>
                <TableHead className="px-3 py-2 font-medium text-xs">
                  Value
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([key, value]) => (
                <TableRow className="border-border border-t" key={key}>
                  <TableCell className="px-3 py-2 font-mono text-primary text-xs">
                    {key}
                  </TableCell>
                  <TableCell className="px-3 py-2 font-mono text-xs">
                    {value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Output (.env)
          </p>
          <pre className="wrap-break-word max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs leading-5">
            {dotEnvString.length > 0
              ? dotEnvString
              : "# No variables were found in this envelope."}
          </pre>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2 pt-1">
          <CopyButton label="Copy as .env" value={dotEnvString} />
          <CopyButton
            label="Copy JSON"
            value={JSON.stringify(decryptedVars, null, 2)}
          />
          <Button
            className="ml-auto gap-1.5"
            onClick={onReset}
            size="sm"
            variant="ghost"
          >
            Decrypt Another
          </Button>
        </div>

        <p className="text-center text-muted-foreground text-xs leading-5">
          These values were decrypted in your browser. They were never visible
          to the server.
        </p>
      </CardContent>
    </Card>
  );
}

interface PassphraseViewProps {
  decryptedVars: Record<string, string> | null;
  errorMessage: string | null;
  isOneTimeEnvelope: boolean | null;
  onDecrypt: () => void;
  onPassphraseChange: (value: string) => void;
  onTogglePassphrase: () => void;
  passphrase: string;
  showPassphrase: boolean;
  state: DecryptState;
}

function PassphraseView({
  decryptedVars,
  errorMessage,
  isOneTimeEnvelope,
  onDecrypt,
  onPassphraseChange,
  onTogglePassphrase,
  passphrase,
  showPassphrase,
  state,
}: PassphraseViewProps) {
  const decryptedEntries = decryptedVars ? Object.entries(decryptedVars) : [];
  const dotEnvString = decryptedEntries
    .map(([key, value]) => `${key}=${toQuotedDotEnvValue(value)}`)
    .join("\n");

  return (
    <Card className="vault-glass relative animate-vault-fade-in overflow-hidden border-primary/20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-primary/10 to-transparent" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="size-5 text-primary" weight="duotone" />
          Enter Passphrase
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 p-5 pt-0 md:p-6 md:pt-0">
        <p className="text-muted-foreground text-sm">
          {decryptedVars
            ? "Decryption succeeded. Your real .env content is shown below."
            : "The encrypted envelope was retrieved. Enter the passphrase to decrypt it locally."}
        </p>

        {isOneTimeEnvelope ? (
          <Alert className="border-primary/30 bg-primary/5">
            <Warning className="size-4 text-primary" weight="fill" />
            <AlertTitle>This link can be opened only once</AlertTitle>
            <AlertDescription>
              Retrieval already consumed the link. Save your decrypted output
              now.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label className="font-medium text-sm" htmlFor="decrypt-passphrase">
            Passphrase
          </Label>
          <div className="relative">
            <Input
              autoFocus
              className="pr-10 font-mono text-xs"
              id="decrypt-passphrase"
              minLength={MIN_PASSPHRASE_LENGTH}
              onChange={(e) => onPassphraseChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && passphrase.trim().length > 0) {
                  onDecrypt();
                }
              }}
              placeholder="Enter your passphrase"
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
            />
            <button
              aria-label={
                showPassphrase ? "Hide passphrase" : "Show passphrase"
              }
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={onTogglePassphrase}
              type="button"
            >
              {showPassphrase ? (
                <EyeSlash className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <Alert
            className="border-destructive/35 bg-destructive/10"
            variant="destructive"
          >
            <ShieldWarning className="size-4" weight="fill" />
            <AlertTitle>Unable to decrypt</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          className="w-full gap-2"
          disabled={passphrase.trim().length === 0 || state === "decrypting"}
          onClick={onDecrypt}
          size="lg"
          type="button"
        >
          {state === "decrypting" ? (
            <>
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Decrypting…
            </>
          ) : (
            <>
              <LockOpen className="size-4" weight="bold" />
              Decrypt
            </>
          )}
        </Button>

        <p className="text-center text-muted-foreground text-xs leading-5">
          Use the exact passphrase used during encryption (minimum 12
          characters).
        </p>

        <Alert className="border-border/70 bg-muted/30">
          <Key className="size-4" weight="duotone" />
          <AlertTitle className="text-sm">Local-only decryption</AlertTitle>
          <AlertDescription className="text-xs">
            The passphrase is never transmitted to the server.
          </AlertDescription>
        </Alert>

        {decryptedVars ? (
          <div className="space-y-2">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Output (.env)
            </p>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 font-mono text-[11px] leading-5">
              {dotEnvString.length > 0
                ? dotEnvString
                : "# No variables were found in this envelope."}
            </pre>
          </div>
        ) : null}

        {decryptedVars ? (
          <div className="flex flex-wrap gap-2">
            <CopyButton label="Copy as .env" value={dotEnvString} />
            <CopyButton
              label="Copy JSON"
              value={JSON.stringify(decryptedVars, null, 2)}
            />
          </div>
        ) : null}

        <p className="text-center text-muted-foreground text-xs leading-5">
          Decryption happens entirely in your browser.
        </p>
      </CardContent>
    </Card>
  );
}

interface EnvelopeLookupViewProps {
  envelopeId: string;
  errorMessage: string | null;
  onEnvelopeIdChange: (value: string) => void;
  onFetch: () => void;
  state: DecryptState;
}

function EnvelopeLookupView({
  envelopeId,
  errorMessage,
  onEnvelopeIdChange,
  onFetch,
  state,
}: EnvelopeLookupViewProps) {
  return (
    <Card className="vault-glass relative animate-vault-fade-in overflow-hidden border-primary/20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-primary/10 to-transparent" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockOpen className="size-5 text-primary" weight="duotone" />
          Retrieve &amp; Decrypt
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Fetch an encrypted envelope and open it with your passphrase.
        </p>
      </CardHeader>

      <CardContent className="space-y-6 p-5 pt-0 md:p-6 md:pt-0">
        <div className="space-y-2">
          <Label className="font-medium text-sm" htmlFor="envelope-id-input">
            Envelope ID
          </Label>
          <Input
            className="font-mono text-xs"
            id="envelope-id-input"
            onChange={(e) => onEnvelopeIdChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && envelopeId.trim().length > 0) {
                onFetch();
              }
            }}
            placeholder="Paste the envelope ID or share link"
            value={envelopeId}
          />
        </div>

        {errorMessage ? (
          <Alert
            className="border-destructive/35 bg-destructive/10"
            variant="destructive"
          >
            <Warning className="size-4" weight="fill" />
            <AlertTitle>Envelope lookup failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          className="w-full gap-2"
          disabled={envelopeId.trim().length === 0 || state === "fetching"}
          onClick={() => onFetch()}
          size="lg"
          type="button"
        >
          {state === "fetching" ? (
            <>
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Retrieving…
            </>
          ) : (
            <>
              <Copy className="size-4" weight="bold" />
              Retrieve Envelope
            </>
          )}
        </Button>

        <Alert className="border-border/70 bg-muted/30">
          <Copy className="size-4" weight="duotone" />
          <AlertTitle className="text-sm">Smart input supported</AlertTitle>
          <AlertDescription className="text-xs">
            Paste either a raw envelope ID or a full share link.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-center gap-4">
          <Badge variant="outline">One-time link</Badge>
          <Badge variant="outline">AES-256-GCM</Badge>
          <Badge variant="outline">Zero-Knowledge</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DecryptForm({ initialId }: DecryptFormProps) {
  const didAutoFetchFromInitialId = useRef(false);
  const [envelopeId, setEnvelopeId] = useState(initialId ?? "");
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [state, setState] = useState<DecryptState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOneTimeEnvelope, setIsOneTimeEnvelope] = useState<boolean | null>(
    null
  );
  const [rawEnvelope, setRawEnvelope] = useState<SecretEnvelope | null>(null);
  const [decryptedVars, setDecryptedVars] = useState<Record<
    string,
    string
  > | null>(null);

  /* Step 1: Fetch the opaque envelope from the server */
  const handleFetch = useCallback(
    async (inputId?: string) => {
      const trimmedId = normalizeEnvelopeIdentifier(inputId ?? envelopeId);
      if (trimmedId.length === 0) {
        return;
      }

      setEnvelopeId(trimmedId);

      setState("fetching");
      setErrorMessage(null);
      setDecryptedVars(null);
      setIsOneTimeEnvelope(null);

      try {
        const result = await retrieveEnvelopeAction(trimmedId);

        if (!(result.success && result.envelope)) {
          setErrorMessage(result.error ?? "Failed to retrieve envelope.");
          setState("error");
          return;
        }

        setRawEnvelope(result.envelope);
        setIsOneTimeEnvelope(result.oneTime);
        setState("passphrase");
      } catch {
        setErrorMessage("Failed to retrieve envelope.");
        setState("error");
      }
    },
    [envelopeId]
  );

  useEffect(() => {
    if (didAutoFetchFromInitialId.current) {
      return;
    }

    if (!initialId || initialId.trim().length === 0) {
      return;
    }

    didAutoFetchFromInitialId.current = true;
    handleFetch(initialId).catch(() => {
      // Errors are handled inside handleFetch.
    });
  }, [initialId, handleFetch]);

  /* Step 2: Decrypt the envelope client-side */
  const handleDecrypt = useCallback(async () => {
    if (!rawEnvelope || passphrase.trim().length === 0) {
      return;
    }

    const passphraseInput = passphrase.trim();

    setState("decrypting");
    setErrorMessage(null);
    setDecryptedVars(null);

    try {
      const variables = await openEnvironmentEnvelope(
        rawEnvelope,
        passphraseInput
      );
      setDecryptedVars(variables);
      setState("passphrase");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Decryption failed.";

      const isMacFailure = message
        .toLowerCase()
        .includes("mac verification failed");
      const isPassphraseIssue =
        isMacFailure || message.toLowerCase().includes("decrypt");

      setErrorMessage(
        isPassphraseIssue
          ? "Incorrect passphrase or the envelope has been tampered with."
          : message
      );
      setState("passphrase");
    }
  }, [rawEnvelope, passphrase]);

  const handleReset = useCallback(() => {
    setEnvelopeId("");
    setPassphrase("");
    setRawEnvelope(null);
    setDecryptedVars(null);
    setIsOneTimeEnvelope(null);
    setErrorMessage(null);
    setState("idle");
  }, []);

  if (state === "done" && decryptedVars) {
    return (
      <DecryptedResultView
        decryptedVars={decryptedVars}
        isOneTimeEnvelope={isOneTimeEnvelope}
        onReset={handleReset}
      />
    );
  }

  if (state === "passphrase" || state === "decrypting") {
    return (
      <PassphraseView
        decryptedVars={decryptedVars}
        errorMessage={errorMessage}
        isOneTimeEnvelope={isOneTimeEnvelope}
        onDecrypt={handleDecrypt}
        onPassphraseChange={setPassphrase}
        onTogglePassphrase={() => setShowPassphrase((p) => !p)}
        passphrase={passphrase}
        showPassphrase={showPassphrase}
        state={state}
      />
    );
  }

  return (
    <EnvelopeLookupView
      envelopeId={envelopeId}
      errorMessage={errorMessage}
      onEnvelopeIdChange={setEnvelopeId}
      onFetch={handleFetch}
      state={state}
    />
  );
}

export { DecryptForm };
