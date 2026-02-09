'use client';

import { useState } from 'react';

import { createRecoveryCode, recoverAccountWithCode } from '../actions/qna';
import { AppShell } from '../../components/app-shell';
import { useIdentityGate } from '../../components/providers/identity-gate-provider';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export function RecoverAccountView() {
  const { requireIdentity } = useIdentityGate();
  const [recoveryCode, setRecoveryCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <AppShell nav="home" title="Recover session" subtitle="Regain access to your anonymous identity">
      <div className="mx-auto w-full max-w-[680px] space-y-4">
        <Card className="fade-in h-full">
          <CardHeader className="pb-0">
            <CardTitle>Generate recovery code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-5">
            <p className="text-body-sm text-[rgb(var(--muted))]">
              Save this code somewhere safe — it can restore your identity if cookies are cleared
            </p>
            <Button
              type="button"
              variant="cta"
              disabled={isGenerating}
              onClick={async () => {
                await requireIdentity(
                  async () => {
                    setError(null);
                    setMessage(null);
                    setIsGenerating(true);
                    try {
                      const result = await createRecoveryCode();
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setGeneratedCode(result.data.code);
                      setCopied(false);
                      setSavedConfirmed(false);
                      setMessage('Recovery code created — copy and store it outside this device');
                    } finally {
                      setIsGenerating(false);
                    }
                  },
                  { reason: 'other' },
                );
              }}
            >
              {isGenerating ? 'Generating…' : 'Generate code'}
            </Button>

            {generatedCode ? (
              <div className="space-y-3 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-caption text-[rgb(var(--muted))]">Your recovery code</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isCopying}
                    onClick={async () => {
                      setError(null);
                      setMessage(null);
                      setIsCopying(true);
                      try {
                        await navigator.clipboard.writeText(generatedCode);
                        setCopied(true);
                        setMessage('Copied to clipboard');
                      } catch {
                        setError('Couldn\'t copy automatically — please select and copy manually');
                      } finally {
                        setIsCopying(false);
                      }
                    }}
                  >
                    {isCopying ? 'Copying…' : copied ? 'Copied' : 'Copy code'}
                  </Button>
                </div>
                <p className="break-all font-mono text-body-sm font-semibold text-[rgb(var(--fg))]">{generatedCode}</p>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg py-2 text-caption text-[rgb(var(--fg))]">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-[rgb(var(--line-strong))] accent-[rgb(var(--accent))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]/40 focus-visible:ring-offset-2"
                    checked={savedConfirmed}
                    onChange={(event) => setSavedConfirmed(event.currentTarget.checked)}
                  />
                  I saved this code in a secure place
                </label>
                {!savedConfirmed ? (
                  <p className="text-caption text-[rgb(var(--caution))]">
                    If you lose this code your anonymous identity cannot be recovered
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="fade-in h-full">
          <CardHeader className="pb-0">
            <CardTitle>Recover with code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-5">
            <p className="text-body-sm text-[rgb(var(--muted))]">
              Open this from a fresh session — your current session must have no posts, votes, or reports
            </p>
            <div className="space-y-2">
              <Label htmlFor="recovery-code-input">Recovery code</Label>
              <Input
                id="recovery-code-input"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.currentTarget.value)}
                placeholder="ABCDE-FGHIJ-KLMNO-PQRST"
              />
            </div>
            <Button
              type="button"
              variant="cta"
              disabled={isRecovering}
              onClick={async () => {
                await requireIdentity(
                  async () => {
                    setError(null);
                    setMessage(null);
                    setIsRecovering(true);
                    try {
                      const result = await recoverAccountWithCode(recoveryCode);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage('Session recovered — reload the app to refresh your data');
                      setRecoveryCode('');
                    } finally {
                      setIsRecovering(false);
                    }
                  },
                  { reason: 'other' },
                );
              }}
            >
              {isRecovering ? 'Recovering…' : 'Recover session'}
            </Button>
          </CardContent>
        </Card>
      </div>
      {message ? <p aria-live="polite" className="mx-auto mt-4 w-full max-w-[680px] text-body-sm text-[rgb(var(--positive))]">{message}</p> : null}
      {error ? <p role="alert" className="mx-auto mt-2 w-full max-w-[680px] text-body-sm text-[rgb(var(--negative))]">{error}</p> : null}
    </AppShell>
  );
}
