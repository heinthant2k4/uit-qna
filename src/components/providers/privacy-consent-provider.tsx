'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Download, Info, X } from 'react-feather';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

/**
 * Privacy + cookie consent (product + UX):
 * - We avoid scary/technical language; this is an anonymous student space.
 * - We only require agreement when the user tries to *act* (ask/answer/vote), not when reading.
 * - "Cookies" here mostly means essential auth storage (Supabase session) + preferences.
 *
 * Install prompt:
 * - PWA install is optional and should feel calm and non-pushy.
 * - We only show an install button if the browser provides a `beforeinstallprompt` event.
 */

const PRIVACY_ACCEPT_KEY = 'uit_privacy_accepted_v1';
const COOKIE_BANNER_DISMISS_KEY = 'uit_cookie_banner_dismissed_v1';

type PendingAction = () => unknown | Promise<unknown>;

type PrivacyConsentContextValue = {
  isAccepted: boolean;
  openPrivacy: () => void;
  /** If not accepted, shows modal; runs action after acceptance. */
  requirePrivacyConsent: (action: PendingAction) => Promise<void>;
};

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(null);

export function usePrivacyConsent(): PrivacyConsentContextValue {
  const value = useContext(PrivacyConsentContext);
  if (!value) {
    throw new Error('usePrivacyConsent must be used within PrivacyConsentProvider');
  }
  return value;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export function PrivacyConsentProvider({ children }: { children: ReactNode }) {
  const [isAccepted, setIsAccepted] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingActionRef = useRef<PendingAction | null>(null);

  // Cookie banner + install prompt
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const installEventRef = useRef<InstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setIsAccepted(readBool(PRIVACY_ACCEPT_KEY));
    setBannerDismissed(readBool(COOKIE_BANNER_DISMISS_KEY));

    const handler = (e: Event) => {
      // Chrome/Edge provide this event for PWA install; Safari does not.
      e.preventDefault();
      installEventRef.current = e as InstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const openPrivacy = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const accept = useCallback(async () => {
    setError(null);
    setIsAccepted(true);
    writeBool(PRIVACY_ACCEPT_KEY, true);
    setOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) await action();
  }, []);

  const requirePrivacyConsent = useCallback(
    async (action: PendingAction) => {
      if (readBool(PRIVACY_ACCEPT_KEY)) {
        await action();
        return;
      }
      pendingActionRef.current = action;
      openPrivacy();
    },
    [openPrivacy],
  );

  const value = useMemo<PrivacyConsentContextValue>(
    () => ({ isAccepted, openPrivacy, requirePrivacyConsent }),
    [isAccepted, openPrivacy, requirePrivacyConsent],
  );

  const install = useCallback(async () => {
    const ev = installEventRef.current;
    if (!ev) return;
    try {
      await ev.prompt();
      await ev.userChoice;
    } finally {
      installEventRef.current = null;
      setCanInstall(false);
    }
  }, []);

  return (
    <PrivacyConsentContext.Provider value={value}>
      {children}

      {/* Cookie + install banner (non-blocking) */}
      {!bannerDismissed ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-5">
          <div className="mx-auto w-full max-w-[680px] rounded-2xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))/0.96] p-3 shadow-lg backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption font-medium text-[rgb(var(--fg))]">Cookies & anonymous sessions</p>
                <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">
                  We use essential storage (cookies/localStorage) to keep your anonymous session and app preferences.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]"
                aria-label="Dismiss"
                onClick={() => {
                  setBannerDismissed(true);
                  writeBool(COOKIE_BANNER_DISMISS_KEY, true);
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openPrivacy}>
                <Info size={16} />
                Privacy
              </Button>
              {canInstall ? (
                <Button type="button" variant="cta" size="sm" className="gap-1.5" onClick={install}>
                  <Download size={16} />
                  Install app
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Privacy policy modal (required for identity-required actions) */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            className={cn('fixed left-1/2 top-1/2 z-50 w-[min(92vw,600px)] -translate-x-1/2 -translate-y-1/2 outline-none')}
          >
            <Card className="border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--line))] p-4 md:p-5">
                <div className="min-w-0">
                  <Dialog.Title className="text-title-sm text-[rgb(var(--fg))]">Privacy policy</Dialog.Title>
                  <Dialog.Description className="mt-1 text-caption text-[rgb(var(--muted))]">
                    Before you post, vote, or interact, please review and agree.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]"
                    aria-label="Close"
                    onClick={() => {
                      // If a gated action is waiting, closing means "cancel".
                      pendingActionRef.current = null;
                    }}
                  >
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="max-h-[70vh] space-y-4 overflow-auto p-4 md:p-5">
                <section className="space-y-2">
                  <h3 className="text-body-sm font-semibold text-[rgb(var(--fg))]">What this app stores</h3>
                  <ul className="list-disc space-y-1 pl-5 text-caption text-[rgb(var(--muted))]">
                    <li>Questions, answers, and replies you submit.</li>
                    <li>Essential session storage to keep your anonymous identity consistent on this device.</li>
                    <li>Optional recovery code hash (server-side) so you can restore your anonymous identity later.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="text-body-sm font-semibold text-[rgb(var(--fg))]">What it does not require</h3>
                  <ul className="list-disc space-y-1 pl-5 text-caption text-[rgb(var(--muted))]">
                    <li>No email, phone number, or real name to participate.</li>
                    <li>No traditional “login” screen—your identity stays anonymous.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="text-body-sm font-semibold text-[rgb(var(--fg))]">Cookies / local storage</h3>
                  <p className="text-caption text-[rgb(var(--muted))]">
                    We use essential cookies/localStorage to persist your anonymous session and preferences (like theme). If
                    you clear storage, you may lose your anonymous identity—unless you saved a recovery code.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-body-sm font-semibold text-[rgb(var(--fg))]">Your control</h3>
                  <ul className="list-disc space-y-1 pl-5 text-caption text-[rgb(var(--muted))]">
                    <li>You can browse without creating an identity.</li>
                    <li>You can choose not to post/vote if you don’t want a device-bound anonymous session.</li>
                    <li>You can restore a past session with a recovery code.</li>
                  </ul>
                </section>

                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-caption text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-200">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[rgb(var(--line))] p-4 md:p-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    pendingActionRef.current = null;
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" variant="cta" onClick={accept}>
                  I agree — continue
                </Button>
              </div>
            </Card>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </PrivacyConsentContext.Provider>
  );
}

