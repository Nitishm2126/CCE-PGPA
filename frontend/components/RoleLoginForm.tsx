"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { RoleBadge } from "@/components/RoleBadge";
import { ROLE_CONFIGS, ALL_ROLES } from "@/lib/role-config";
import { ThemeToggle } from "@/components/ThemeToggle";

interface RoleLoginFormProps {
  role: UserRole;
}

const ROLE_THEME_DETAILS = {
  student: {
    accentGradient: "from-sky-500 to-blue-600",
    ringColor: "focus:border-sky-500 focus:ring-sky-500/20",
    buttonBg: "bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sky-600/20",
    iconBg: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
    dotColor: "bg-sky-600 dark:bg-sky-400",
  },
  mentor: {
    accentGradient: "from-purple-500 to-indigo-600",
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-600/20",
    iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
    dotColor: "bg-purple-600 dark:bg-purple-400",
  },
  hod: {
    accentGradient: "from-amber-500 to-orange-600",
    ringColor: "focus:border-amber-500 focus:ring-amber-500/20",
    buttonBg: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-600/20",
    iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
    dotColor: "bg-amber-600 dark:bg-amber-400",
  },
  admin: {
    accentGradient: "from-slate-700 to-slate-900 dark:from-slate-400 dark:to-slate-200",
    ringColor: "focus:border-slate-600 focus:ring-slate-500/20",
    buttonBg: "bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white dark:bg-slate-100 dark:hover:bg-white dark:active:bg-slate-200 dark:text-slate-900 shadow-slate-900/20",
    iconBg: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    dotColor: "bg-slate-800 dark:bg-slate-200",
  },
};

export function RoleLoginForm({ role }: RoleLoginFormProps) {
  const router = useRouter();
  const { user, login, logout, isLoading: authLoading, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<{
    actualRole: UserRole;
    attemptedRole: UserRole;
  } | null>(null);

  // If already authenticated and the user role matches this portal, offer direct dashboard access
  useEffect(() => {
    if (user && !authLoading && user.role === role) {
      // User is already logged into this exact role portal
    }
  }, [user, role, authLoading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    clearError();
    setLocalError(null);
    setRoleMismatch(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setLocalError(
        role === "student"
          ? "Please enter your register number or college email."
          : "Please enter your official college email address."
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
          (authenticatedUser.role === "hod" && role === "mentor");

        if (!isAuthorizedForRole) {
          setRoleMismatch({
            actualRole: authenticatedUser.role,
            attemptedRole: role,
          });
          setLocalError(
            `Unauthorized Role: You authenticated with valid credentials, but your account is registered in PostgreSQL as "${ROLE_CONFIGS[authenticatedUser.role].shortTitle}". You cannot access the ${ROLE_CONFIGS[role].shortTitle} portal.`
          );
          return;
        }

        // Check mandatory first-login password change requirement
        if (authenticatedUser.must_change_password) {
          router.push("/change-password");
          return;
        }

        // Role matches: proceed to authorized dashboard
        router.push(`/${role}`);
      } else {
        // Firebase authenticated, but pending PostgreSQL directory provisioning
        router.push("/verify-email");
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

  return (
    <div className="w-full min-h-[100dvh] flex flex-col justify-between bg-[#fbfbfc] dark:bg-[#0c1117] text-slate-900 dark:text-slate-100 overflow-x-hidden selection:bg-sky-100 selection:text-sky-900 dark:selection:bg-sky-900/40 dark:selection:text-sky-200">
      {/* 1. Official Institutional Header */}
      <header className="w-full shrink-0 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 transition-colors shadow-2xs">
        <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2.5 sm:gap-4">
            {/* Left: SEC Crest & College Identification */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link
                href="/"
                className="flex items-center gap-2.5 sm:gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl p-1 min-h-[44px]"
                title="Sri Sairam Engineering College - CCE PGPA Portal"
              >
                <div className="relative h-9 w-9 sm:h-10 sm:w-10 shrink-0 flex items-center justify-center">
                  <Image
                    src="/images/sec logo.png"
                    alt="Sri Sairam Engineering College Crest"
                    width={40}
                    height={40}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-extrabold text-[12px] sm:text-[13.5px] md:text-[14px] tracking-tight text-[#0f2942] dark:text-slate-100 uppercase leading-tight truncate">
                    Sri Sairam Engineering College
                  </span>
                  <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                    <span className="truncate">Autonomous Institution</span>
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
                    <span className="hidden sm:inline truncate">Anna University Affiliated</span>
                    <span className="hidden md:inline text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
                    <span className="hidden md:inline text-sky-600 dark:text-sky-400 font-semibold truncate">NBA &amp; NAAC &apos;A+&apos;</span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Right: Sairam Logo, Theme Toggle, & Back Link */}
            <div className="flex items-center gap-2 sm:gap-3.5 lg:gap-4 shrink-0">
              <ThemeToggle size="sm" />

              <div className="relative h-7 sm:h-8 w-auto shrink-0 flex items-center">
                <Image
                  src="/images/logo1.png"
                  alt="Sri Sairam Institutions Logo"
                  width={64}
                  height={36}
                  priority
                  className="h-6.5 sm:h-7.5 w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Institutional Title Hierarchy */}
      <section className="text-center pt-5 pb-3 sm:pt-6 sm:pb-4 px-4 shrink-0 animate-apple-fade">
        <div className="mx-auto max-w-4xl space-y-2">
          {/* Department Identity Element */}
          <div
            id="department-identity-container"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs max-w-full"
          >
            <span className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${themeDetails.dotColor} shrink-0`} aria-hidden="true" />
            <span
              id="department-identity-name"
              className="font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 text-center leading-snug break-words whitespace-normal md:whitespace-nowrap"
              style={{ fontSize: "clamp(10px, 1.8vw, 11.5px)" }}
            >
              DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING
            </span>
          </div>

          <div className="space-y-0.5">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">
              CCE Achieve
            </h1>
            <p className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.22em] text-[#0f2942] dark:text-slate-300">
              PGPA MANAGEMENT SYSTEM
            </p>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 italic">
            &ldquo;Academic Performance. Structured. Simplified.&rdquo;
          </p>
        </div>
      </section>

      {/* 3. Main Form Container */}
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 pb-10 flex-1 flex flex-col items-center">
        {/* Navigation Breadcrumb / Role Switch Bar */}
        <div className="w-full flex flex-wrap items-center justify-between mb-4 gap-2 text-xs">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors shrink-0"
          >
            <span>&larr;</span>
            <span>Back to Portal Selection</span>
          </Link>

          {/* Quick role switcher links */}
          <div className="flex items-center gap-1 text-slate-400 shrink-0">
            <span className="hidden sm:inline text-slate-400 dark:text-slate-500 text-[11px]">Switch:</span>
            {ALL_ROLES.map((r) => {
              const isCurrent = r === role;
              return (
                <Link
                  key={r}
                  href={ROLE_CONFIGS[r].path}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] transition-colors whitespace-nowrap ${
                    isCurrent
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold cursor-default"
                      : "text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:underline"
                  }`}
                >
                  {ROLE_CONFIGS[r].shortTitle}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Existing Session Alert (if user is currently authenticated) */}
        {user && !authLoading && (
          <div
            role="status"
            className={`w-full mb-5 rounded-2xl border p-3.5 text-xs shadow-xs flex flex-wrap items-center justify-between gap-3 animate-apple-fade ${
              user.role === role || (user.role === "hod" && role === "mentor")
                ? "border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200"
                : "border-sky-200 dark:border-sky-800/80 bg-sky-50/80 dark:bg-sky-950/50 text-sky-950 dark:text-sky-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  user.role === role || (user.role === "hod" && role === "mentor")
                    ? "bg-emerald-600 dark:bg-emerald-400"
                    : "bg-sky-600 dark:bg-sky-400"
                }`}
              />
              <span>
                Active Session: <strong>{user.full_name}</strong> (
                {ROLE_CONFIGS[user.role]?.shortTitle})
                {user.role === "hod" && role === "mentor" && (
                  <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                    Dual Mentor Access
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {user.role === role ? (
                <Link
                  href={`/${user.role}`}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1 text-xs transition"
                >
                  Open Dashboard &rarr;
                </Link>
              ) : user.role === "hod" && role === "mentor" ? (
                <>
                  <Link
                    href="/mentor"
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1 text-xs transition"
                  >
                    Open Mentor Dashboard &rarr;
                  </Link>
                  <Link
                    href="/hod"
                    className="font-semibold text-purple-600 dark:text-purple-400 hover:underline text-xs"
                  >
                    Go to HOD Dashboard &rarr;
                  </Link>
                </>
              ) : (
                <Link
                  href={`/${user.role}`}
                  className="font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  Go to {ROLE_CONFIGS[user.role]?.shortTitle} &rarr;
                </Link>
              )}
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <button
                type="button"
                onClick={() => logout()}
                className="font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Login Form Card */}
        <div className="w-full relative rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] overflow-hidden animate-apple-slide-up">
          {/* Top Subtle Color Accent Bar */}
          <div
            className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${themeDetails.accentGradient}`}
            aria-hidden="true"
          />

          {/* Card Header */}
          <div className="pb-5 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${themeDetails.iconBg}`}>
                  {role === "student" && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  )}
                  {role === "mentor" && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  )}
                  {role === "hod" && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2L2 7h20L12 2z" />
                    </svg>
                  )}
                  {role === "admin" && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                    {currentConfig.portalTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Authorized institutional access
                  </p>
                </div>
              </div>
              <RoleBadge role={role} size="sm" />
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {currentConfig.description}
            </p>
          </div>

          {/* Security Alert: Role Mismatch */}
          {roleMismatch && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/95 dark:bg-amber-950/60 p-4 text-xs text-amber-950 dark:text-amber-200 shadow-xs animate-apple-fade"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1 space-y-2">
                  <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    Access Denied: Role Mismatch
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{displayError}</p>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <Link
                      href={ROLE_CONFIGS[roleMismatch.actualRole].path}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors shadow-xs"
                    >
                      <span>
                        Open {ROLE_CONFIGS[roleMismatch.actualRole].shortTitle} Portal &rarr;
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setRoleMismatch(null);
                        setLocalError(null);
                      }}
                      className="inline-flex items-center px-3 py-1.5 rounded-xl border border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 text-xs font-medium hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Standard Authentication Error Alert */}
          {!roleMismatch && displayError && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/50 p-4 text-xs text-rose-800 dark:text-rose-200 shadow-xs animate-apple-fade"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-rose-900 dark:text-rose-200">Authentication Error</p>
                  <p className="mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">{displayError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
            {/* Email / Identifier Field */}
            <div>
              <label
                htmlFor="login-email-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                {role === "student" ? "Register Number or College Email" : "Official College Email"}
              </label>
              <div className="mt-1.5">
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
                      ? "e.g. SEC25CO001 or sec25co001@sairamtap.edu.in"
                      : currentConfig.placeholder
                  }
                  disabled={isSubmitting}
                  className={`block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60 transition duration-150 ${themeDetails.ringColor}`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Account Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="mt-1.5 relative">
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
                  className={`block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 pr-11 text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60 transition duration-150 ${themeDetails.ringColor}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center gap-2 pt-0.5">
              <input
                id="remember-me-checkbox"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <label htmlFor="remember-me-checkbox" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                Remember this device for seamless access
              </label>
            </div>

            {/* Role-Specific Login Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="login-submit-button"
                disabled={isSubmitting}
                className={`apple-pressable w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold text-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${themeDetails.buttonBg}`}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin text-current"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Login as {currentConfig.shortTitle}</span>
                )}
              </button>
            </div>
          </form>

          {/* Institutional Closed Cohort Notice */}
          <div className="mt-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <strong className="text-slate-700 dark:text-slate-300">Authorized Access Only:</strong> Cohort accounts are provisioned via verified departmental rosters. Public self-registration is disabled.
            </p>
          </div>
        </div>
      </main>

      {/* 4. Refined Institutional Footer */}
      <footer className="w-full shrink-0 mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 py-3 sm:py-4 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col space-y-2.5 sm:space-y-3">
          {/* Upper Footer: Founder Chairman Identity & FINEWORKS Development Branding */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/70 dark:border-slate-800/70 pb-2.5 sm:pb-3">
            {/* Founder Chairman Medallion */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="relative h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                <Image
                  src="/images/founder logo.png"
                  alt="Founder Chairman MJF. Ln. Leo Muthu"
                  width={38}
                  height={38}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-[12.5px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  MJF. Ln. Leo Muthu
                </span>
                <span className="text-[9.5px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                  Founder Chairman &bull; Sri Sairam Group of Institutions
                </span>
              </div>
            </div>

            {/* FINEWORKS Development Wordmark */}
            <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Designed &amp; Developed by
              </span>
              <div className="inline-flex items-center gap-1.5 mt-0.5">
                <span className="text-xs sm:text-[12.5px] font-extrabold tracking-[0.22em] text-slate-900 dark:text-white">
                  FINE<span className="text-sky-600 dark:text-sky-400">WORKS</span>
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Lower Footer: Legal & Department Notice */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-center sm:text-left text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400">
            <div>
              <span>Department of Computer and Communication Engineering</span>
              <span className="hidden sm:inline mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
              <span className="block sm:inline">Sri Sairam Engineering College (Autonomous)</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/login/admin"
                className="hover:underline hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded transition-colors text-[10px] text-slate-400 dark:text-slate-500"
                title="System Administrator Portal Login"
                aria-label="System Administrator Portal Login"
              >
                CCE Achieve System
              </Link>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Version 1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
