"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FineWorksBrand } from "@/components/shared/FineWorksBrand";
import { FineWorksFooter } from "@/components/shared/FineWorksFooter";
import { getFirebaseAuth, auth as fallbackAuth, isFirebaseConfigured } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    const trimmed = identifier.trim().toLowerCase();

    if (!trimmed) {
      setErrorMessage("Please enter your College Register Number or College Email.");
      return;
    }

    // Normalize identifier: if no "@", treat as student register number e.g. sec25co001 -> sec25co001@sairamtap.edu.in
    let targetEmail = trimmed;
    if (!targetEmail.includes("@")) {
      targetEmail = `${targetEmail}@sairamtap.edu.in`;
    }

    try {
      setIsSubmitting(true);
      const auth = getFirebaseAuth() || fallbackAuth;

      if (!auth || !isFirebaseConfigured()) {
        throw new Error(
          "Authentication service is currently initializing. Please refresh or try again in a moment."
        );
      }

      // Dispatch official Firebase password reset / first-time activation email
      try {
        await sendPasswordResetEmail(auth, targetEmail);
      } catch (fbErr: unknown) {
        const fbCode = (fbErr as { code?: string })?.code;
        if (fbCode === "auth/too-many-requests") {
          setErrorMessage("Too many reset attempts. Please wait a few minutes before trying again.");
          return;
        } else if (fbCode === "auth/invalid-email") {
          setErrorMessage("The provided identifier or email address format is invalid.");
          return;
        }
        // For security & anti-enumeration (auth/user-not-found, etc.), do not leak whether account exists
        console.warn("Password reset dispatch response:", fbCode || fbErr);
      }

      // Always show generic success to prevent account enumeration
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset link.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] flex flex-col justify-between bg-slate-50/50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 overflow-x-hidden transition-colors">
      {/* 1. Header with Brand & Theme Toggle */}
      <header className="w-full shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-13 sm:h-14 items-center justify-between gap-4">
            <FineWorksBrand showDepartment size="md" />
            <ThemeToggle size="sm" />
          </div>
        </div>
      </header>

      {/* 2. Main Recovery Card */}
      <main className="w-full max-w-md mx-auto px-4 sm:px-6 flex-1 flex flex-col justify-center items-center py-6 min-h-0">
        <div className="w-full flex items-center justify-between mb-3 text-xs shrink-0">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-purple-600 dark:text-[#5DD62C] hover:text-purple-800 dark:hover:text-[#4ec224] transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Portal Login</span>
          </Link>
        </div>

        <div className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-5 transition-colors">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 dark:bg-[#5DD62C]/10 text-purple-600 dark:text-[#5DD62C] border border-purple-500/20 dark:border-[#5DD62C]/20">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="mt-3 text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Password Recovery &amp; Setup
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              First-time activation or password reset for CCE-PGPA
            </p>
          </div>

          {submitted ? (
            /* Success State */
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="font-semibold text-sm">Setup Link Dispatched</p>
                </div>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed text-[11px]">
                  If an account exists matching that identifier, a secure password setup and reset link has been dispatched directly to the registered college email inbox.
                </p>
                <div className="mt-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/40 p-2.5 text-[11px] text-emerald-900 dark:text-emerald-200">
                  <p className="font-medium">Next Steps:</p>
                  <ol className="list-decimal pl-4 mt-1 space-y-1">
                    <li>Open your official College Google Workspace inbox.</li>
                    <li>Look for an email from <strong>CCE-PGPA</strong> with the subject <em>&ldquo;Reset your password&rdquo;</em>.</li>
                    <li>Click the link in the email to set your new password.</li>
                    <li>Return to the portal and log in with your new password.</li>
                  </ol>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white dark:bg-[#5DD62C] dark:hover:bg-[#4ec224] dark:text-[#0F0F0F] font-bold py-2.5 text-xs transition duration-150 shadow-xs"
                >
                  Return to Portal Login
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setIdentifier("");
                    setErrorMessage(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Send to a different ID or email
                </button>
              </div>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-800 dark:text-rose-200"
                >
                  <p className="font-semibold text-xs">Error</p>
                  <p className="mt-0.5 text-rose-700 dark:text-rose-300 text-[11px]">{errorMessage}</p>
                </div>
              )}

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[11px] text-indigo-900 dark:border-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200 space-y-1">
                <p className="font-semibold text-xs">First-Time Student Password Setup</p>
                <p className="leading-relaxed">
                  Enter your College Register Number (e.g. <code>SEC25CO001</code>) or official email. A secure password setup link will be dispatched directly to your college email address.
                </p>
              </div>

              <div>
                <label
                  htmlFor="recovery-identifier-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Register Number or College Email
                </label>
                <input
                  id="recovery-identifier-input"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. SEC25CO001 or sec25co001@sairamtap.edu.in"
                  disabled={isSubmitting}
                  className="block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-[#5DD62C] dark:focus:ring-[#5DD62C]/20 disabled:opacity-60 transition duration-150"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Password setup emails are dispatched strictly to official domains (<code>@sairamtap.edu.in</code> or <code>@sairam.edu.in</code>).
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white dark:bg-[#5DD62C] dark:hover:bg-[#4ec224] dark:active:bg-[#44a81f] dark:text-[#0F0F0F] font-bold py-2.5 text-xs transition duration-150 disabled:opacity-60 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Sending Setup Link...</span>
                    </>
                  ) : (
                    <span>Send Password Setup Link &rarr;</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* 3. Footer */}
      <FineWorksFooter />
    </div>
  );
}
