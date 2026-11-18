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
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

// Only Student, Mentor, and HOD portals are shown in public switch navigation
const PUBLIC_SWITCH_ROLES: UserRole[] = ["student", "mentor", "hod"];

interface RoleLoginFormProps {
  role: UserRole;
}

const ROLE_THEME_DETAILS = {
  student: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-[#5DD62C] dark:focus:ring-[#5DD62C]/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white dark:bg-[#5DD62C] dark:hover:bg-[#4ec224] dark:active:bg-[#44a81f] dark:text-[#0F0F0F] font-bold shadow-xs",
    dotColor: "bg-purple-600 dark:bg-[#5DD62C]",
  },
  mentor: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-[#5DD62C] dark:focus:ring-[#5DD62C]/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white dark:bg-[#5DD62C] dark:hover:bg-[#4ec224] dark:active:bg-[#44a81f] dark:text-[#0F0F0F] font-bold shadow-xs",
    dotColor: "bg-purple-600 dark:bg-[#5DD62C]",
  },
  hod: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-[#5DD62C] dark:focus:ring-[#5DD62C]/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white dark:bg-[#5DD62C] dark:hover:bg-[#4ec224] dark:active:bg-[#44a81f] dark:text-[#0F0F0F] font-bold shadow-xs",
    dotColor: "bg-purple-600 dark:bg-[#5DD62C]",
  },
  admin: {
    ringColor: "focus:border-purple-500 focus:ring-purple-500/20 dark:focus:border-[#5DD62C] dark:focus:ring-[#5DD62C]/20",
    buttonBg: "bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white dark:bg-[#5DD62C] dark:hover:bg-[#4ec224] dark:active:bg-[#44a81f] dark:text-[#0F0F0F] font-bold shadow-xs",
    dotColor: "bg-slate-800 dark:bg-[#5DD62C]",
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
    clearError();
    setRoleMismatch(null);

    // Password login is disabled on Cloudflare Free ($0/mo) due to 10ms CPU limit for Argon2id
    setLocalError(
      "Traditional password login is temporarily unavailable on Cloudflare Free tier ($0/mo) because Argon2id hash verification exceeds the 10ms CPU limit. All original passwords remain safely preserved in the database. Please use the Institutional Google Workspace Sign-In button above with your official college account."
    );
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
            className="inline-flex items-center gap-1.5 font-semibold text-purple-600 dark:text-[#5DD62C] hover:text-purple-800 dark:hover:text-[#4ec224] transition-colors"
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
                        ? "bg-slate-200 dark:bg-[#337418]/30 text-slate-900 dark:text-[#5DD62C] border border-transparent dark:border-[#5DD62C]/40 font-semibold cursor-default"
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
            CCE-PGPA <span className="text-purple-600 dark:text-[#5DD62C]">Management System</span>
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

          {/* 1. PRIMARY LOGIN: Institutional Google Workspace SSO */}
          <div className="space-y-3">
            <div className="rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 p-3 text-center">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 mb-1.5">
                Official $0/mo Authentication Method
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Institutional Google Workspace Sign-In
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {role === "student"
                  ? "Use your student account: @sairamtap.edu.in"
                  : role === "admin"
                  ? "Use your admin account: cce.pgpa@gmail.com"
                  : "Use your faculty account: @sairam.edu.in"}
              </p>
            </div>

            <GoogleSignInButton
              role={role}
              onError={(msg) => {
                setLocalError(msg);
                setRoleMismatch(null);
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Divider */}
          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            <span className="absolute bg-white dark:bg-slate-900 px-2.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Traditional Password Login
            </span>
          </div>

          {/* Password Authentication Notice on Cloudflare Free */}
          <div className="rounded-xl border border-amber-200/90 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="font-semibold flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Unavailable on Cloudflare Free ($0/mo)</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              Direct password login is disabled because memory-hard Argon2id hash verification exceeds the 10ms execution limit. Original password hashes remain safely preserved in D1. Please use <strong>Google Workspace Sign-In</strong> above.
            </p>
          </div>

          {/* Disabled Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 mt-3 opacity-60" noValidate>
            {/* Email / Identifier Field */}
            <div>
              <label
                htmlFor="login-email-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {role === "student" ? "College Email or Student ID (Register Number)" : "College Email"}
              </label>
              <input
                id="login-email-input"
                name="email"
                type="text"
                autoComplete={role === "student" ? "username" : "email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  role === "student"
                    ? "e.g. SEC25CO001 or sec25co001@sairamtap.edu.in"
                    : currentConfig.placeholder
                }
                disabled={true}
                className={`block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3.5 py-2 sm:py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 cursor-not-allowed`}
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
              </div>
              <div className="relative">
                <input
                  id="login-password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password login disabled on Free tier"
                  disabled={true}
                  className={`block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3.5 py-2 sm:py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 cursor-not-allowed`}
                />
              </div>
            </div>

            {/* Login Button */}
            <div className="pt-1">
              <button
                type="submit"
                id="login-submit-button"
                disabled={true}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 px-4 font-semibold text-xs bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed`}
              >
                Password Login Disabled (Use Google SSO Above)
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
