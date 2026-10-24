"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { RoleBadge } from "@/components/RoleBadge";
import { ROLE_CONFIGS, ALL_ROLES } from "@/lib/role-config";

interface RoleLoginFormProps {
  role: UserRole;
}

export function RoleLoginForm({ role }: RoleLoginFormProps) {
  const router = useRouter();
  const { user, login, logout, isLoading: authLoading, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      // Note: We don't auto-redirect without user interaction to allow logging into another account
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
      const authenticatedUser = await login(trimmedEmail, password);

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
  const displayError = localError || authError;

  return (
    <div className="w-full min-h-screen flex flex-col bg-white text-slate-900">
      {/* 1. Official Sairam Logos Header Banner */}
      <header className="w-full border-b border-slate-100 bg-white pt-4 pb-3 sm:pt-6 sm:pb-4 px-4">
        <div className="mx-auto max-w-5xl">
          <Image
            src="/images/sairam-logos.png"
            alt="Sri Sairam Engineering College - Autonomous Institution - Affiliated to Anna University"
            width={1600}
            height={130}
            priority
            className="w-full h-auto object-contain mx-auto"
          />
        </div>
      </header>

      {/* 2. Institutional Title Hierarchy */}
      <section className="text-center pt-6 pb-4 sm:pt-8 sm:pb-6 px-4">
        <div className="mx-auto max-w-4xl space-y-2">
          <h2 className="text-sm sm:text-lg md:text-xl font-bold uppercase tracking-wide text-[#0284c7]">
            Department of Computer and Communication Engineering
          </h2>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000]">
            CCE PGPA
          </h1>
          <p className="text-xs sm:text-sm md:text-base font-medium text-slate-600">
            Performance Grade Point Average Management Application
          </p>
        </div>
      </section>

      {/* 3. Main Form Container */}
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 pb-10 flex-1 flex flex-col items-center">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="w-full flex items-center justify-between mb-4 text-xs">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Portal Selection</span>
          </Link>

          {/* Quick role switcher dropdown/links - Administrator portal is strictly restricted to footer credit entry */}
          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <span>Switch:</span>
            {(role === "admin"
              ? (["student", "mentor", "hod"] as UserRole[])
              : (["student", "mentor", "hod"] as UserRole[]).filter((r) => r !== role)
            ).map((r) => (
              <Link
                key={r}
                href={ROLE_CONFIGS[r].path}
                className="text-slate-600 hover:text-blue-600 hover:underline"
              >
                {ROLE_CONFIGS[r].shortTitle}
              </Link>
            ))}
          </div>
        </div>

        {/* Existing Session Alert (if user is currently authenticated) */}
        {user && !authLoading && (
          <div
            role="status"
            className={`w-full mb-5 rounded-xl border p-3.5 text-xs shadow-xs flex flex-wrap items-center justify-between gap-3 ${
              user.role === role || (user.role === "hod" && role === "mentor")
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                : "border-sky-200 bg-sky-50/80 text-sky-950"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  user.role === role || (user.role === "hod" && role === "mentor")
                    ? "bg-emerald-600"
                    : "bg-sky-600"
                }`}
              />
              <span>
                Active Session: <strong>{user.full_name}</strong> (
                {ROLE_CONFIGS[user.role].shortTitle})
                {user.role === "hod" && role === "mentor" && (
                  <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Dual Mentor Access
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {user.role === role ? (
                <Link
                  href={`/${user.role}`}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3 py-1 text-xs"
                >
                  Open Dashboard &rarr;
                </Link>
              ) : user.role === "hod" && role === "mentor" ? (
                <>
                  <Link
                    href="/mentor"
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3 py-1 text-xs"
                  >
                    Open Mentor Dashboard &rarr;
                  </Link>
                  <Link
                    href="/hod"
                    className="font-semibold text-purple-700 hover:underline text-xs"
                  >
                    Go to HOD Dashboard &rarr;
                  </Link>
                </>
              ) : (
                <Link
                  href={`/${user.role}`}
                  className="font-semibold text-sky-700 hover:underline"
                >
                  Go to {ROLE_CONFIGS[user.role].shortTitle} &rarr;
                </Link>
              )}
              <span className="text-slate-300">&bull;</span>
              <button
                type="button"
                onClick={() => logout()}
                className="font-medium text-slate-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Login Form Card */}
        <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
          {/* Card Header */}
          <div className="pb-5 border-b border-slate-100 mb-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                {currentConfig.portalTitle}
              </h3>
              <RoleBadge role={role} size="sm" />
            </div>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              {currentConfig.description}
            </p>
          </div>

          {/* Security Alert: Role Mismatch */}
          {roleMismatch && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-amber-300 bg-amber-50/95 p-4 text-xs text-amber-950 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0"
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
                  <p className="font-bold text-amber-900 text-sm">
                    Access Denied: Role Mismatch
                  </p>
                  <p className="text-amber-800 leading-relaxed">{displayError}</p>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <Link
                      href={ROLE_CONFIGS[roleMismatch.actualRole].path}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors shadow-xs"
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
                      className="inline-flex items-center px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-900 text-xs font-medium hover:bg-amber-100 transition-colors cursor-pointer"
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
              className="mb-6 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0"
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
                  <p className="font-semibold text-rose-900">Authentication Error</p>
                  <p className="mt-0.5 text-rose-700 leading-relaxed">{displayError}</p>
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
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
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
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:opacity-60 transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Account Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
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
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:opacity-60 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
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
                        strokeWidth={2}
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
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Prominent Blue Login Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="login-submit-button"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-4 shadow-xs text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin text-white"
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
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-center">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700">Authorized Access Only:</strong> Cohort accounts are provisioned via verified departmental rosters. Public self-registration is disabled.
            </p>
          </div>


        </div>
      </main>

      {/* 4. Official Sairam SDG Banner Strip */}
      <section aria-label="Sustainable Development Goals" className="w-full mt-6 px-4">
        <div className="mx-auto max-w-5xl">
          <Image
            src="/images/sairam-sdg.png"
            alt="United Nations Sustainable Development Goals - Sri Sairam Engineering College"
            width={1600}
            height={125}
            className="w-full h-auto object-contain mx-auto"
          />
        </div>
      </section>

      {/* 5. Official Sairam Leo Muthu Artwork Footer Banner */}
      <footer className="w-full mt-4 sm:mt-6 px-4">
        <div className="mx-auto max-w-5xl">
          <Image
            src="/images/sairam-footer.png"
            alt="Sri Sairam Engineering College - Founder Chairman MJF. Ln. Leo Muthu"
            width={1600}
            height={251}
            className="w-full h-auto object-contain mx-auto"
          />
        </div>

        {/* Attribution & Legal Notice */}
        <div className="text-center pt-4 pb-8 space-y-1">
          <p className="text-xs font-semibold text-slate-700 tracking-wide">
            Designed and Developed by Team FineWorks
          </p>
          <p className="text-xs text-slate-500">
            Department of Computer and Communication Engineering &bull; Sri Sairam Engineering College
          </p>
          <p className="text-[11px] text-slate-400">
            <Link
              href="/login/admin"
              className="hover:underline hover:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded transition-colors"
              title="System Administrator Portal Login"
              aria-label="System Administrator Portal Login"
            >
              CCE-PGPA Management System
            </Link>{" "}
            &bull; Version 1.0.0 &bull; All Institutional Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  );
}
