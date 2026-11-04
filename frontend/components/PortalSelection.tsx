"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS } from "@/lib/role-config";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FineWorksBrand } from "@/components/shared/FineWorksBrand";
import { FineWorksFooter } from "@/components/shared/FineWorksFooter";
import { AppleLoadingScreen } from "@/components/shared/AppleLoadingScreen";

// Theme palettes for the 3 primary institutional cards
interface PortalCardTheme {
  cardBorder: string;
  hoverBorder: string;
  focusRing: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconText: string;
  buttonBg: string;
  buttonHoverBg: string;
}

const PORTAL_CARD_THEMES: Record<string, PortalCardTheme> = {
  student: {
    cardBorder: "border-slate-200/90 dark:border-slate-800",
    hoverBorder: "hover:border-purple-400 dark:hover:border-amber-500",
    focusRing: "focus-visible:ring-purple-500 dark:focus-visible:ring-amber-500",
    badgeBg: "bg-purple-50 dark:bg-amber-950/40 border-purple-200 dark:border-amber-800/60",
    badgeText: "text-purple-700 dark:text-amber-300",
    iconBg: "bg-purple-50 dark:bg-amber-950/50",
    iconText: "text-purple-600 dark:text-amber-400",
    buttonBg: "bg-purple-600 hover:bg-purple-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950",
    buttonHoverBg: "hover:bg-purple-700 dark:hover:bg-amber-600",
  },
  mentor: {
    cardBorder: "border-slate-200/90 dark:border-slate-800",
    hoverBorder: "hover:border-purple-400 dark:hover:border-amber-500",
    focusRing: "focus-visible:ring-purple-500 dark:focus-visible:ring-amber-500",
    badgeBg: "bg-purple-50/70 dark:bg-amber-950/30 border-purple-200 dark:border-amber-800/50",
    badgeText: "text-purple-700 dark:text-amber-300",
    iconBg: "bg-purple-50 dark:bg-amber-950/50",
    iconText: "text-purple-600 dark:text-amber-400",
    buttonBg: "bg-purple-600 hover:bg-purple-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950",
    buttonHoverBg: "hover:bg-purple-700 dark:hover:bg-amber-600",
  },
  hod: {
    cardBorder: "border-slate-200/90 dark:border-slate-800",
    hoverBorder: "hover:border-purple-400 dark:hover:border-amber-500",
    focusRing: "focus-visible:ring-purple-500 dark:focus-visible:ring-amber-500",
    badgeBg: "bg-purple-50 dark:bg-amber-950/40 border-purple-200 dark:border-amber-800/60",
    badgeText: "text-purple-700 dark:text-amber-300",
    iconBg: "bg-purple-50 dark:bg-amber-950/50",
    iconText: "text-purple-600 dark:text-amber-400",
    buttonBg: "bg-purple-600 hover:bg-purple-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950",
    buttonHoverBg: "hover:bg-purple-700 dark:hover:bg-amber-600",
  },
};

const PORTAL_CARD_METADATA: Record<string, { description: string }> = {
  student: {
    description: "Submit achievements, upload certificates, track semester progress and review evaluation remarks.",
  },
  mentor: {
    description: "Audit assigned student records, verify activity evidence, award verified points and mentor cohorts.",
  },
  hod: {
    description: "Department oversight, mentorship governance, performance matrix analytics and official reporting.",
  },
};

function PortalSelectionContent() {
  const router = useRouter();
  const { user, isLoading, isLoggingOut } = useAuth();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = React.useState(false);
  const justSignedOut = searchParams?.get("signedOut") === "true" && !dismissed;

  // CRITICAL: If authenticated, automatically redirect to role-specific dashboard
  React.useEffect(() => {
    if (!isLoading && !isLoggingOut && user) {
      const targetPath = ROLE_CONFIGS[user.role]?.dashboardPath || `/${user.role}`;
      router.replace(targetPath);
    }
  }, [user, isLoading, isLoggingOut, router]);

  // While resolving session or while redirecting authenticated user, display clean screen
  if (isLoading || (!isLoggingOut && user)) {
    return (
      <AppleLoadingScreen
        message="Accessing institutional portal..."
        submessage={user ? `Redirecting to ${ROLE_CONFIGS[user.role]?.shortTitle || "user"} dashboard...` : "Verifying session..."}
        fullScreen={true}
      />
    );
  }

  // Display the 3 public institutional portals (Student, Mentor, HOD)
  // Admin is accessed discreetly via the footer
  const publicPortals: UserRole[] = ["student", "mentor", "hod"];

  return (
    <div className="w-full min-h-[100dvh] flex flex-col justify-between bg-slate-50/50 dark:bg-[#0c1117] text-slate-900 dark:text-slate-100 overflow-x-hidden transition-colors">
      {/* 1. Clean Apple-Grade Header */}
      <header className="w-full shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-13 sm:h-14 items-center justify-between gap-4">
            {/* Left: FineWorks Branding & Department Identity */}
            <FineWorksBrand showDepartment size="md" />

            {/* Right: Theme Toggle */}
            <div className="flex items-center gap-3">
              <ThemeToggle size="sm" />
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Portal Selection Section */}
      <main className="w-full flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-4 sm:py-6 md:py-8 min-h-0">
        {/* Department Title & Institutional Intro */}
        <section className="text-center w-full max-w-3xl mx-auto space-y-2 shrink-0">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-600 dark:bg-amber-400" />
            <span>Department of Computer and Communication Engineering</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            CCE PGPA <span className="text-purple-600 dark:text-amber-400">Management System</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-normal">
            Select your institutional portal to manage student achievements, evaluations, and academic audits.
          </p>
        </section>

        {/* Signed Out Confirmation Notice */}
        {justSignedOut && !user && (
          <div
            id="signed-out-success-alert"
            role="status"
            className="w-full max-w-2xl mx-auto mt-4 sm:mt-5 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium">Signed out safely. Your session and credentials have been secured.</span>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 text-xs font-semibold p-1"
              aria-label="Dismiss message"
            >
              &times;
            </button>
          </div>
        )}

        {/* Portal Selection Cards */}
        <div className="grid gap-3.5 sm:gap-5 w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto mt-4 sm:mt-6">
          {publicPortals.map((roleKey) => {
            const cfg = ROLE_CONFIGS[roleKey];
            const theme = PORTAL_CARD_THEMES[roleKey] || PORTAL_CARD_THEMES.student;
            const meta = PORTAL_CARD_METADATA[roleKey] || PORTAL_CARD_METADATA.student;

            const isAuthorized = Boolean(
              user && (user.role === roleKey || (user.role === "hod" && roleKey === "mentor"))
            );
            const cardHref = isAuthorized ? cfg.dashboardPath : cfg.path;
            const ctaLabel = isAuthorized
              ? `Open ${cfg.shortTitle} Dashboard`
              : cfg.ctaText;

            // Dynamic badge text for HOD's mentor view
            const badgeLabel =
              user && user.role === "hod" && roleKey === "mentor"
                ? "11 Assigned Mentees"
                : cfg.badgeText;

            // Dynamic description text for HOD's mentor view
            const descriptionText =
              user && user.role === "hod" && roleKey === "mentor"
                ? "Review assigned students, verify evidence and provide remarks."
                : meta.description;

            return (
              <Link
                key={roleKey}
                href={cardHref}
                id={`portal-card-${roleKey}`}
                className={`group relative flex flex-col justify-between rounded-2xl border ${theme.cardBorder} ${theme.hoverBorder} bg-white dark:bg-slate-900 p-5 sm:p-5.5 shadow-xs hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${theme.focusRing} w-full min-h-[190px] active:scale-[0.99]`}
              >
                <div className="flex-1 flex flex-col">
                  {/* Card Header: Role Icon & Official Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.iconBg} ${theme.iconText} transition-colors`}
                    >
                      {roleKey === "student" && (
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                          <path d="M6 12v5c3 3 9 3 12 0v-5" />
                        </svg>
                      )}
                      {roleKey === "mentor" && (
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <polyline points="16 11 18 13 22 9" />
                        </svg>
                      )}
                      {roleKey === "hod" && (
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 21h18" />
                          <path d="M5 21V7l7-4 7 4v14" />
                          <path d="M9 10a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
                          <path d="M9 21v-5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5" />
                        </svg>
                      )}
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                    {cfg.portalTitle}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {descriptionText}
                  </p>
                </div>

                {/* Bottom CTA Button */}
                <div className="pt-4 mt-auto">
                  <div
                    className={`w-full py-2 px-3.5 rounded-xl font-semibold text-xs text-center flex items-center justify-center gap-2 transition-all ${theme.buttonBg} shadow-2xs group-hover:opacity-95`}
                  >
                    <span>{ctaLabel}</span>
                    <svg
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* 3. FineWorks Minimalist Footer with Centered Admin Login Entry */}
      <FineWorksFooter enableAdminLoginEntry={true} />
    </div>
  );
}

function PortalSelectionFallback() {
  return (
    <div className="w-full min-h-[100dvh] flex flex-col justify-between bg-slate-50 dark:bg-slate-950 p-6 animate-pulse">
      <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
      <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
    </div>
  );
}

export const PortalSelection: React.FC = () => {
  return (
    <Suspense fallback={<PortalSelectionFallback />}>
      <PortalSelectionContent />
    </Suspense>
  );
};
