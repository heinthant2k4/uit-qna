'use client';

import { useState } from 'react';

import { createRecoveryCode, recoverAccountWithCode } from '../actions/qna';
import { AppShell } from '../../components/app-shell';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export function RecoverAccountView() {
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
    <AppShell nav="home" title="Recovery Code" subtitle="Restore anonymous account access">
      <div className="mx-auto w-full max-w-[680px] space-y-4">
        <Card className="h-full">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Generate Recovery Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Save this code offline. It can restore your account if browser cookies are lost.
            </p>
            <Button
              type="button"
              disabled={isGenerating}
              onClick={async () => {
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
                  setMessage('Recovery code created. Copy it now and save it outside this device.');
                } finally {
                  setIsGenerating(false);
                }
              }}
            >
              {isGenerating ? 'Generating...' : 'Generate Code'}
            </Button>

            {generatedCode ? (
              <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Your recovery code</p>
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
                        setMessage('Recovery code copied.');
                      } catch {
                        setError('Could not copy automatically. Please copy the code manually.');
                      } finally {
                        setIsCopying(false);
                      }
                    }}
                  >
                    {isCopying ? 'Copying...' : copied ? 'Copied' : 'Copy code'}
                  </Button>
                </div>
                <p className="break-all font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">{generatedCode}</p>
                <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300"
                    checked={savedConfirmed}
                    onChange={(event) => setSavedConfirmed(event.currentTarget.checked)}
                  />
                  I saved this code in a secure place.
                </label>
                {!savedConfirmed ? (
                  <p className="text-xs text-amber-700">
                    If you lose this code, your anonymous account cannot be recovered.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Recover With Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Use this from a fresh anonymous session. Current session must not have existing posts, votes, or reports.
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
              disabled={isRecovering}
              onClick={async () => {
                setError(null);
                setMessage(null);
                setIsRecovering(true);
                try {
                  const result = await recoverAccountWithCode(recoveryCode);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMessage('Account recovered successfully. Reload the app to refresh all data.');
                  setRecoveryCode('');
                } finally {
                  setIsRecovering(false);
                }
              }}
            >
              {isRecovering ? 'Recovering...' : 'Recover Account'}
            </Button>
          </CardContent>
        </Card>
      </div>
      {message ? <p className="mx-auto mt-4 w-full max-w-[820px] text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mx-auto mt-2 w-full max-w-[820px] text-sm text-rose-700">{error}</p> : null}
    </AppShell>
  );
}
