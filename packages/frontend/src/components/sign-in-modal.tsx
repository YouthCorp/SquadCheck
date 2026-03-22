'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { signIn } from 'next-auth/react';
import { cn } from '@/lib/utils';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
}

export function SignInModal({ open, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState<'google' | 'email' | null>(null);

  if (!open || typeof document === 'undefined') return null;

  async function handleGoogle() {
    setLoading('google');
    await signIn('google', { callbackUrl: window.location.href });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading('email');
    await signIn('resend', { email, redirect: false });
    setEmailSent(true);
    setLoading(null);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Sign in to SquadCheck</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors bg-transparent border-0 cursor-pointer"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M13 1L1 13M1 1l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {emailSent ? (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">📬</div>
            <p className="text-sm font-medium text-foreground mb-1">Check your inbox</p>
            <p className="text-xs text-muted-foreground">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <>
            {/* Google button */}
            <button
              onClick={handleGoogle}
              disabled={loading !== null}
              className={cn(
                'w-full flex items-center justify-center gap-2.5 h-9 px-3 rounded-lg border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
              )}
            >
              {loading === 'google' ? (
                <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[0.6875rem] text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Email magic link */}
            <form onSubmit={handleEmail}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring mb-2.5"
              />
              <button
                type="submit"
                disabled={loading !== null || !email.trim()}
                className="w-full h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading === 'email' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : (
                  'Continue with Email'
                )}
              </button>
            </form>

            <p className="text-[0.6875rem] text-muted-foreground text-center mt-4 leading-relaxed">
              By signing in you agree to our{' '}
              <a href="/terms" className="underline hover:text-foreground">Terms</a>{' '}
              and{' '}
              <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
