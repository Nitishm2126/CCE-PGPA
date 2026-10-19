"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function VerifyEmailPage() {
  const router = useRouter();
  const {
    firebaseUser,
    isEmailVerified,
    isProvisioned,
    user,
    sendVerificationEmail,
    reloadFirebaseUser,
    login,
    logout,
    isLoading: authLoading,
  } = useAuth();

  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkStatusFeedback, setCheckStatusFeedback] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // Fallback sign-in inputs if no user is currently signed in
  const [emailInput, setEmailInput] = useState("cce.pgpa@gmail.com");
  const [passwordInput, setPasswordInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Manage 60-second cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendVerification = async () => {
    if (cooldown > 0) return;
    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCheckStatusFeedback(null);

    try {
      await sendVerificationEmail();
      setSuccessMessage(
        `Verification email sent to ${firebaseUser?.email || "your email address"}! Please check your inbox and spam folder, click the verification link, and then click "Check Verification Status" below.`
      );
      setCooldown(60); // 60s cooldown to prevent Firebase rate-limiting
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send verification email.";
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setErrorMessage(null);
    setCheckStatusFeedback(null);

    try {
      const verified = await reloadFirebaseUser();
      if (verified) {
        setCheckStatusFeedback("Verified! Your Firebase email address has been confirmed successfully.");
        setSuccessMessage(null);
      } else {
        setCheckStatusFeedback(
          "Checked: Email is still unverified. If you just clicked the email link, please allow a few seconds and try again."
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to refresh user status.";
      setErrorMessage(msg);
    } finally {
      setIsChecking(false);
    }
  };

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      await login(emailInput.trim(), passwordInput);
      setSuccessMessage("Signed in successfully to Firebase. You can now verify this account.");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Checking Firebase authentication state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Email Verification Portal
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            CCE-PGPA &bull; Firebase Authentication Security
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none space-y-6">
          {/* Case 1: Firebase user is currently signed in */}
          {firebaseUser ? (
            <div className="space-y-6">
              {/* Account details & Verification Status Badge */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Firebase Account
                  </span>
                  {isEmailVerified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Email Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Email Not Verified
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white break-all">
                    {firebaseUser.email}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    UID: {firebaseUser.uid}
                  </div>
                </div>

                {/* Directory status note */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Institutional Directory:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {user
                      ? `Provisioned (${user.role.toUpperCase()})`
                      : isProvisioned
                      ? "Provisioned"
                      : "Pending Provisioning"}
                  </span>
                </div>
              </div>

              {/* Success Notification */}
              {successMessage && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs sm:text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <div className="flex items-start gap-2.5">
                    <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>{successMessage}</p>
                  </div>
                </div>
              )}

              {/* Status Check Feedback */}
              {checkStatusFeedback && (
                <div
                  role="status"
                  className={`rounded-xl border p-4 text-xs sm:text-sm ${
                    isEmailVerified
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-blue-200 bg-blue-50/80 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
                  }`}
                >
                  <p>{checkStatusFeedback}</p>
                </div>
              )}

              {/* Error Notification */}
              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs sm:text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <div className="flex items-start gap-2.5">
                    <svg className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {!isEmailVerified ? (
                  <>
                    <button
                      type="button"
                      id="send-verification-email-btn"
                      onClick={handleSendVerification}
                      disabled={isSending || cooldown > 0}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
                    >
                      {isSending ? (
                        <>
                          <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Sending Verification Email...</span>
                        </>
                      ) : cooldown > 0 ? (
                        <span>Resend Available in {cooldown}s</span>
                      ) : (
                        <span>Send Verification Email</span>
                      )}
                    </button>

                    <button
                      type="button"
                      id="check-verification-status-btn"
                      onClick={handleCheckStatus}
                      disabled={isChecking}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm active:scale-[0.99] disabled:opacity-60 transition-all duration-150"
                    >
                      {isChecking ? (
                        <>
                          <svg className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Checking Status...</span>
                        </>
                      ) : (
                        <span>Check Verification Status</span>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    {user ? (
                      <Link
                        href={`/${user.role}`}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 active:scale-[0.99] transition-all duration-150"
                      >
                        Continue to {user.role.toUpperCase()} Dashboard
                      </Link>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 space-y-2">
                          <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            <span>Institutional Directory Provisioning Pending</span>
                          </div>
                          <p className="leading-relaxed">
                            Your Firebase account <strong>{firebaseUser.email}</strong> is verified. However, this email is not yet registered in the CCE PostgreSQL institutional directory.
                          </p>
                          <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 text-[11px] space-y-1">
                            <p className="font-semibold text-amber-950 dark:text-amber-200">Next Action Required:</p>
                            <p>
                              If you are an authorized Faculty Mentor or Student, please contact the System Administrator (<strong className="font-mono">cce.pgpa@gmail.com</strong>) or Department Head with your email address and UID (<span className="font-mono">{firebaseUser.uid}</span>) to provision your mentor profile and cohort allocations.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          id="check-provisioning-status-btn"
                          onClick={handleCheckStatus}
                          disabled={isChecking}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50/80 hover:bg-blue-100/80 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isChecking ? (
                            <>
                              <svg className="h-3.5 w-3.5 animate-spin text-blue-700" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>Re-checking Directory Status...</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Check Institutional Provisioning Status</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    &larr; Sign Out
                  </button>
                  <Link
                    href="/login"
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Go to Login &rarr;
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Case 2: No active Firebase session found */
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-800/40 text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No Active Firebase Session
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Sign in with your Firebase account credentials to verify your email address.
                </p>
              </div>

              {loginError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  {loginError}
                </div>
              )}

              <form onSubmit={handleInlineLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="inline-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Email Address
                  </label>
                  <input
                    id="inline-email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inline-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <input
                    id="inline-password"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter account password"
                    className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md active:scale-[0.99] disabled:opacity-60 transition-all duration-150"
                >
                  {isLoggingIn ? "Signing In..." : "Sign In to Verify Email"}
                </button>
              </form>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Return to Main Portal Login &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Institutional Security Notice */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center dark:border-slate-800/80 dark:bg-slate-800/30">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <strong className="text-slate-700 dark:text-slate-300">Preservation Notice:</strong> Email verification is performed entirely via Firebase Web SDK (<code className="font-mono text-[10px]">sendEmailVerification</code>). PostgreSQL database records and cohort data remain completely untouched.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
