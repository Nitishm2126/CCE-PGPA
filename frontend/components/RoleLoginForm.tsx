"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS } from "@/lib/role-config";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FineWorksBrand } from "@/components/shared/FineWorksBrand";
import { FineWorksFooter } from "@/components/shared/FineWorksFooter";
import { AppleLoadingScreen } from "@/components/shared/AppleLoadingScreen";

// Only Student, Mentor, and HOD portals are shown in public switch navigation
const PUBLIC_SWITCH_ROLES: UserRole[] = ["student", "mentor", "hod"];

interface RoleLoginFormProps {
  role: UserRole;
}

const ROLE_THEME_DETAILS = {
  student: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 dark:text-white shadow-xs",
    dotColor: "bg-purple-600 dark:bg-indigo-500",
  },
  mentor: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 dark:text-white shadow-xs",
    dotColor: "bg-purple-600 dark:bg-indigo-500",
  },
  hod: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 dark:text-white shadow-xs",
    dotColor: "bg-purple-600 dark:bg-indigo-500",
  },
  admin: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20",
    buttonBg: "bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 dark:text-white shadow-xs",
    dotColor: "bg-slate-800 dark:bg-indigo-500",
  },
};

export function RoleLoginForm({ role }: RoleLoginFormProps) {
  const router = useRouter();
  const { user, login, logout, isLoading: authLoading, isLoggingOut, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSignedOut, setJustSignedOut] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<{
    actualRole: UserRole;
    attemptedRole: UserRole;
  } | null>(null);

  // CRITICAL: If authenticated, automatically redirect to role-specific dashboard
  useEffect(() => {
    if (!authLoading && !isLoggingOut && user) {
      const isAuthorizedForRole =
        user.role === role ||
        (user.role === "hod" && role === "mentor") ||
        (user.accessible_portals && user.accessible_portals.includes(role));

      if (isAuthorizedForRole) {
        router.replace(`/${role}`);
      } else {
        router.replace(ROLE_CONFIGS[user.role]?.dashboardPath || `/${user.role}`);
      }
    }
  }, [user, authLoading, isLoggingOut, role, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("signedOut") === "true") {
        setJustSignedOut(true);
      }
    }
  }, []);

  const handleSwitchAccount = async () => {
    await logout();
    setEmail("");
    setPassword("");
    setLocalError(null);
    setRoleMismatch(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    clearError();
    setLocalError(null);
    setRoleMismatch(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setLocalError(
        "Please enter your college email address."
      );
      return;
    }
    if (!password) {
      setLocalError("Please enter your account password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const authenticatedUser = await login(trimmedEmail, password, role);

      if (authenticatedUser) {
        // MANDATORY SECURITY RULE: Verify database role matches requested portal
        const isAuthorizedForRole =
          authenticatedUser.role === role ||
          (authenticatedUser.role === "hod" && role === "mentor") ||
          (authenticatedUser.accessible_portals && authenticatedUser.accessible_portals.includes(role));

        if (!isAuthorizedForRole) {
          // Revoke session so unauthorized role credentials are not persisted
          await logout();
          setRoleMismatch({
            actualRole: authenticatedUser.role,
            attemptedRole: role,
          });
          setLocalError(
            `Unauthorized Role: You authenticated with valid credentials, but your account is registered as "${ROLE_CONFIGS[authenticatedUser.role].shortTitle}". You cannot access the ${ROLE_CONFIGS[role].shortTitle} portal.`
          );
          return;
        }

        // Check mandatory first-login password change requirement
        if (authenticatedUser.must_change_password) {
          router.replace("/change-password");
          return;
        }

        // Role matches: proceed to authorized dashboard
        router.replace(`/${role}`);
      } else {
        // Firebase authenticated, but pending PostgreSQL directory provisioning
        router.replace("/verify-email");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentConfig = ROLE_CONFIGS[role];
  const themeDetails = ROLE_THEME_DETAILS[role] || ROLE_THEME_DETAILS.student;
  const displayError = localError || authError;

  if (authLoading || (!isLoggingOut && user)) {
    return (
      <AppleLoadingScreen
        message={`Accessing ${currentConfig?.portalTitle || "portal"}...`}
        submessage={user ? "Redirecting to your authorized dashboard..." : "Verifying credentials..."}
        fullScreen={true}
        variant="login"
      />
    );
  }

  return (
    <div className="w-full min-h-[100dvh] flex flex-col justify-between bg-slate-50/50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 overflow-x-hidden transition-colors">
      {/* 1. Header with FineWorks Brand & Theme Toggle */}
      <header className="w-full shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-13 sm:h-14 items-center justify-between gap-4">
            <FineWorksBrand role={role} showDepartment size="md" />
            <ThemeToggle size="sm" />
          </div>
        </div>
      </header>

      {/* 2. Main Login Card Container */}
      <main className="w-full max-w-md mx-auto px-4 sm:px-6 flex-1 flex flex-col justify-center items-center py-4 sm:py-6 min-h-0">
        {/* Navigation Breadcrumb / Role Switch Bar */}
        <div className="w-full flex items-center justify-between mb-2 sm:mb-2.5 text-xs shrink-0">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-purple-600 dark:text-indigo-400 hover:text-purple-800 dark:hover:text-indigo-300 transition-colors"
          >
            <span>&larr;</span>
            <span>All Portals</span>
          </Link>

          {/* Quick role switcher links */}
          {role !== "admin" && (
            <div className="flex items-center gap-1 text-slate-400 shrink-0">
              {PUBLIC_SWITCH_ROLES.map((r) => {
                const isCurrent = r === role;
                return (
                  <Link
                    key={r}
                    href={ROLE_CONFIGS[r].path}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                      isCurrent
                        ? "bg-slate-200 dark:bg-indigo-950/40 text-slate-900 dark:text-indigo-300 border border-transparent dark:border-indigo-800/40 font-semibold cursor-default"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {ROLE_CONFIGS[r].shortTitle}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Heading centered above the Login Card */}
        <div className="text-center mb-2.5 sm:mb-3.5 shrink-0">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            CCE-PGPA <span className="text-purple-600 dark:text-indigo-400">Management System</span>
          </h2>
        </div>

        {/* Signed Out Notification */}
        {justSignedOut && !user && (
          <div
            id="signed-out-success-alert"
            role="status"
            className="w-full mb-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 text-xs text-emerald-900 dark:text-emerald-200 shadow-2xs flex items-center justify-between gap-2 shrink-0"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-semibold">Signed out safely.</span>
            </div>
            <button
              type="button"
              onClick={() => setJustSignedOut(false)}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}


        {/* Login Card */}
        <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
          {/* Card Header */}
          <div className="pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-800">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {currentConfig.portalTitle}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Department of Computer and Communication Engineering (CCE)
            </p>
          </div>

          {/* Role Mismatch Warning */}
          {roleMismatch && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 p-2.5 text-xs text-amber-900 dark:text-amber-200"
            >
              <p className="font-semibold text-xs">Role Mismatch</p>
              <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                You authenticated as <strong>{ROLE_CONFIGS[roleMismatch.actualRole].shortTitle}</strong>. Please switch to your authorized portal.
              </p>
              <div className="mt-2.5 flex gap-2">
                <Link
                  href={ROLE_CONFIGS[roleMismatch.actualRole].dashboardPath}
                  className="inline-flex items-center px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition"
                >
                  Open {ROLE_CONFIGS[roleMismatch.actualRole].shortTitle} Dashboard &rarr;
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setRoleMismatch(null);
                    setLocalError(null);
                  }}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-medium hover:bg-amber-100 dark:hover:bg-slate-800 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Authentication Error Alert */}
          {!roleMismatch && displayError && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-2.5 text-xs text-rose-800 dark:text-rose-200"
            >
              <p className="font-semibold text-xs">Invalid Credentials</p>
              <p className="mt-0.5 text-rose-700 dark:text-rose-300 text-[11px] leading-tight">{displayError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5" noValidate>
            {/* Email / Identifier Field */}
            <div>
              <label
                htmlFor="login-email-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                College Email
              </label>
              <input
                id="login-email-input"
                name="email"
                type={role === "student" ? "text" : "email"}
                autoComplete={role === "student" ? "username" : "email"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  role === "student"
                    ? "e.g. sec25co001@sairamtap.edu.in"
                    : currentConfig.placeholder
                }
                disabled={isSubmitting}
                className={`block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 sm:py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60 transition duration-150 ${themeDetails.ringColor}`}
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-purple-600 dark:text-indigo-400 hover:text-purple-800 dark:hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  disabled={isSubmitting}
                  className={`block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 sm:py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60 transition duration-150 ${themeDetails.ringColor}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <div className="pt-1.5">
              <button
                type="submit"
                id="login-submit-button"
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 font-semibold text-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] ${themeDetails.buttonBg}`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In as {currentConfig.shortTitle}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* 3. FineWorks Minimalist Footer */}
      <FineWorksFooter />
    </div>
  );
}
