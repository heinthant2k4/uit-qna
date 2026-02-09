'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Key, Shield, X } from 'react-feather';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { createRecoveryCode, profileReady, recoverAccountWithCode } from '../../app/actions/qna';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { usePrivacyConsent } from './privacy-consent-provider';

/**
 * Identity-gating philosophy (UX + privacy):
 * - We avoid "login/signup" language to reduce anxiety and preserve anonymity framing.
 * - We only create an anonymous session when the user *chooses* to interact (ask/answer/vote).
 * - Reading remains available without identity (supported by RLS policies + grants).
 *
 * Supabase anonymous auth notes:
 * - `signInAnonymously()` creates a real authenticated session, but without PII (no email/phone).
 * - The session is still an "identity" (a user id) used for ownership, rate limiting, and moderation.
 * - Session persistence is handled by the Supabase client (cookies/local storage), so it survives reloads.
 *
 * Recovery code mechanism:
 * - Supabase anonymous auth can't restore identity if storage is cleared.
 * - We generate a one-time recovery code, store only a hash server-side, and show the code once.
 * - If the user loses their session, they can create a fresh anonymous session and "claim" the code to
 *   transfer their prior identity back (server-side RPC).
 */

type RequireIdentityOptions = {
  /**
   * For copy personalization: "vote", "ask", "answer", etc.
   * Avoid "login" language entirely.
   */
  reason?: 'vote' | 'ask' | 'answer' | 'edit' | 'report' | 'other';
  /**
   * When true, the modal cannot be dismissed (used for first-run entry gating).
   * The user must either continue anonymously or restore a previous session.
   */
  mandatory?: boolean;
};

type PendingAction = () => unknown | Promise<unknown>;

type IdentityGateContextValue = {
  /** Runs `action` immediately if a session exists; otherwise opens the modal and runs after success. */
  requireIdentity: (action: PendingAction, options?: RequireIdentityOptions) => Promise<void>;
  /** Opens the modal without a pending action (useful for Profile page). */
  openGate: (options?: RequireIdentityOptions) => void;
};

const IdentityGateContext = createContext<IdentityGateContextValue | null>(null);

export function useIdentityGate(): IdentityGateContextValue {
  const value = useContext(IdentityGateContext);
  if (!value) {
    throw new Error('useIdentityGate must be used within IdentityGateProvider');
  }
  return value;
}

type GateStep = 'explain' | 'creating' | 'showCode' | 'restore' | 'restoring' | 'success' | 'failure';

export function IdentityGateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { requirePrivacyConsent } = usePrivacyConsent();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<GateStep>('explain');
  const [reason, setReason] = useState<RequireIdentityOptions['reason']>('other');
  const [mandatory, setMandatory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingActionRef = useRef<PendingAction | null>(null);

  // Recovery code UI state (shown once)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Restore UI state
  const [restoreInput, setRestoreInput] = useState('');

  const closeAndReset = useCallback(() => {
    setOpen(false);
    setStep('explain');
    setReason('other');
    setMandatory(false);
    setError(null);
    pendingActionRef.current = null;
    setRecoveryCode(null);
    setCopied(false);
    setRestoreInput('');
  }, []);

  const waitForProfileReady = useCallback(async () => {
    // Profile row is created asynchronously via DB trigger; session can exist before row is visible.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const status = await profileReady();
      if (status.ok) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('Setting up your anonymous profile is taking longer than expected. Please try again.');
  }, []);

  const ensureAnonymousSession = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      // Session exists but profile row may not be ready yet (common right after first sign-in).
      await waitForProfileReady();
      return;
    }

    // We intentionally do not "auto-create" identity on page load; it happens only after explicit consent.
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      throw new Error('We couldn’t create your anonymous session. Please try again.');
    }

    // Refresh server components so server actions see latest auth cookies.
    router.refresh();

    await waitForProfileReady();
  }, [router, waitForProfileReady]);

  const generateAndShowRecoveryCode = useCallback(async (): Promise<string | null> => {
    // We generate a recovery code immediately after identity creation.
    // This supports the psychological safety promise: "you can restore this later."
    const result = await createRecoveryCode();
    if (result.ok === false) {
      // Non-blocking: user can still proceed without a recovery code.
      setRecoveryCode(null);
      return null;
    }
    setRecoveryCode(result.data.code);
    setCopied(false);
    return result.data.code;
  }, []);

  const runPendingAction = useCallback(async () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (!action) return;
    await action();
  }, []);

  const openGate = useCallback((options?: RequireIdentityOptions) => {
    setReason(options?.reason ?? 'other');
    setMandatory(options?.mandatory ?? false);
    setError(null);
    setStep('explain');
    setOpen(true);
  }, []);

  const requireIdentity = useCallback(
    async (action: PendingAction, options?: RequireIdentityOptions) => {
      await requirePrivacyConsent(async () => {
        const supabase = getBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Even with an existing session, the DB profile row may still be initializing.
          await waitForProfileReady();
          await action();
          return;
        }

        pendingActionRef.current = action;
        openGate(options);
      });
    },
    [openGate, requirePrivacyConsent, waitForProfileReady],
  );

  const value = useMemo<IdentityGateContextValue>(
    () => ({ requireIdentity, openGate }),
    [requireIdentity, openGate],
  );

  const actionLabel =
    reason === 'ask'
      ? 'post questions'
      : reason === 'answer'
        ? 'write answers'
        : reason === 'vote'
          ? 'upvote'
          : reason === 'edit'
            ? 'edit your posts'
            : reason === 'report'
              ? 'report content'
              : 'continue';

  return (
    <IdentityGateContext.Provider value={value}>
      {children}

      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next && mandatory) return;
          next ? setOpen(true) : closeAndReset();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 outline-none',
            )}
            onEscapeKeyDown={(event) => {
              if (mandatory) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (mandatory) event.preventDefault();
            }}
          >
            {/* Glassmorphic shell: reinforces “safe, anonymous space” without feeling like a login gate. */}
            <div className="rounded-card bg-gradient-to-br from-white/30 to-white/5 p-[1px] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] dark:from-white/15 dark:to-white/0">
              <Card className="border-white/20 bg-white/10 backdrop-blur-xl shadow-none dark:border-white/10 dark:bg-slate-950/40">
              <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--line))] p-4 md:p-5">
                <div className="min-w-0">
                  <Dialog.Title className="text-title-sm text-[rgb(var(--fg))]">
                    Keep it anonymous, but consistent
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-caption text-[rgb(var(--muted))]">
                    To {actionLabel}, we’ll create an anonymous session on this device.
                  </Dialog.Description>
                </div>
                {mandatory ? null : (
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                )}
              </div>

              <div className="p-4 md:p-5">
                {step === 'explain' ? (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                          <Shield size={18} />
                        </div>
                        <div>
                          <p className="text-body-sm font-medium text-[rgb(var(--fg))]">No name. No email. No profile.</p>
                          <p className="mt-1 text-caption text-[rgb(var(--muted))]">
                            Your posts are tied only to an anonymous session so you can edit your own content and keep
                            votes fair.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                          <Key size={18} />
                        </div>
                        <div>
                          <p className="text-body-sm font-medium text-[rgb(var(--fg))]">You can restore it later.</p>
                          <p className="mt-1 text-caption text-[rgb(var(--muted))]">
                            We’ll show you a recovery code once. Save it somewhere safe in case you clear browser storage.
                          </p>
                        </div>
                      </div>
                    </div>

                    {error ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-caption text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-200">
                        {error}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="cta"
                        onClick={async () => {
                          setError(null);
                          setStep('creating');
                          try {
                            await ensureAnonymousSession();
                            const code = await generateAndShowRecoveryCode();
                            setStep(code ? 'showCode' : 'success');
                            if (!code) {
                              await runPendingAction();
                              closeAndReset();
                            }
                          } catch (e) {
                            setStep('explain');
                            setError(e instanceof Error ? e.message : 'Something went wrong.');
                          }
                        }}
                      >
                        Continue anonymously
                      </Button>

                      <div className="flex items-center justify-between">
                        <Button type="button" variant="ghost" onClick={() => setStep('restore')}>
                          Restore a previous session
                        </Button>
                        {mandatory ? null : (
                          <Button type="button" variant="outline" onClick={closeAndReset}>
                            Not now
                          </Button>
                        )}
                      </div>

                      <p className="text-[11px] text-[rgb(var(--muted))]">
                        By continuing, you create an anonymous session on this device (not a traditional account).
                      </p>
                    </div>
                  </div>
                ) : null}

                {step === 'creating' ? (
                  <div className="space-y-3">
                    <p className="text-body-sm text-[rgb(var(--fg))]">Creating your anonymous session…</p>
                    <p className="text-caption text-[rgb(var(--muted))]">
                      This takes a moment. Your identity stays anonymous.
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500/70" />
                    </div>
                  </div>
                ) : null}

                {step === 'showCode' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4">
                      <p className="text-caption text-[rgb(var(--muted))]">Your recovery code (shown once)</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <code className="text-body-sm font-semibold tracking-wider text-[rgb(var(--fg))]">
                          {recoveryCode ?? '—'}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!recoveryCode}
                          onClick={async () => {
                            if (!recoveryCode) return;
                            await navigator.clipboard.writeText(recoveryCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 900);
                          }}
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">
                        Save it in Notes, a password manager, or somewhere private.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Button type="button" variant="ghost" asChild>
                        <Link href="/recover" onClick={() => setOpen(false)}>
                          Recovery page
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="cta"
                        onClick={async () => {
                          await runPendingAction();
                          closeAndReset();
                        }}
                      >
                        I saved it — continue
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === 'restore' ? (
                  <div className="space-y-4">
                    <p className="text-body-sm text-[rgb(var(--fg))]">
                      Paste your recovery code to restore your previous anonymous identity.
                    </p>
                    <p className="text-caption text-[rgb(var(--muted))]">
                      We’ll create a fresh anonymous session first (if needed), then securely claim your previous one.
                    </p>

                    {error ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-caption text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-200">
                        {error}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <label className="text-caption font-medium text-[rgb(var(--fg-secondary))]">Recovery code</label>
                      <Input
                        value={restoreInput}
                        onChange={(e) => setRestoreInput(e.currentTarget.value)}
                        placeholder="AAAAA-BBBBB-CCCCC-DDDDD"
                        autoCapitalize="characters"
                      />
                      <p className="text-[11px] text-[rgb(var(--muted))]">
                        Don’t have a code? You can still continue anonymously (new identity).
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Button type="button" variant="ghost" onClick={() => setStep('explain')}>
                        Back
                      </Button>
                      <div className="flex items-center gap-2">
                          <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            setError(null);
                            setStep('creating');
                            try {
                              await ensureAnonymousSession();
                              const code = await generateAndShowRecoveryCode();
                              setStep(code ? 'showCode' : 'success');
                              if (!code) {
                                await runPendingAction();
                                closeAndReset();
                              }
                            } catch (e) {
                              setStep('restore');
                              setError(e instanceof Error ? e.message : 'Something went wrong.');
                            }
                          }}
                        >
                          Continue new
                        </Button>
                        <Button
                          type="button"
                          variant="cta"
                          disabled={!restoreInput.trim()}
                          onClick={async () => {
                            setError(null);
                            setStep('restoring');
                            try {
                              await ensureAnonymousSession();
                              const result = await recoverAccountWithCode(restoreInput);
                              if (result.ok === false) {
                                setStep('restore');
                                setError(result.error);
                                return;
                              }

                              // After a successful claim, refresh SSR caches and proceed.
                              router.refresh();
                              setStep('success');
                              await runPendingAction();
                              closeAndReset();
                            } catch (e) {
                              setStep('restore');
                              setError(e instanceof Error ? e.message : 'Something went wrong.');
                            }
                          }}
                        >
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 'restoring' ? (
                  <div className="space-y-3">
                    <p className="text-body-sm text-[rgb(var(--fg))]">Restoring your anonymous session…</p>
                    <p className="text-caption text-[rgb(var(--muted))]">
                      If the code is valid, your previous identity will return.
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500/70" />
                    </div>
                  </div>
                ) : null}

                {step === 'failure' ? (
                  <div className="space-y-4">
                    <p className="text-body-sm text-[rgb(var(--fg))]">We couldn’t continue.</p>
                    <p className="text-caption text-[rgb(var(--muted))]">
                      {error ?? 'Please try again. If the problem continues, reload the app.'}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setStep('explain')}>
                        Back
                      </Button>
                      <Button type="button" variant="cta" onClick={closeAndReset}>
                        Close
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              </Card>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </IdentityGateContext.Provider>
  );
}
