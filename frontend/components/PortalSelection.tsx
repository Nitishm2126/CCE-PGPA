"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS, ALL_ROLES } from "@/lib/role-config";

// Dedicated styling tokens for the three institutional portal cards
const PORTAL_CARD_THEMES: Record<
  string,
  {
    bg: string;
    border: string;
    hoverBorder: string;
    focusRing: string;
    iconBg: string;
    iconText: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    titleHover: string;
    ctaBorder: string;
    ctaText: string;
    ctaHover: string;
  }
> = {
  student: {
    // Student Portal: subtle light-blue background and blue accent
    bg: "bg-blue-50/50 hover:bg-blue-50/80",
    border: "border-blue-200/80",
    hoverBorder: "hover:border-blue-400/80",
    focusRing: "focus-visible:ring-blue-500",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
    badgeBg: "bg-blue-100/70",
    badgeBorder: "border-blue-200",
    badgeText: "text-blue-800",
    titleHover: "group-hover:text-blue-700",
    ctaBorder: "border-blue-200/60",
    ctaText: "text-blue-700",
    ctaHover: "group-hover:text-blue-900",
  },
  mentor: {
    // Faculty Mentor Portal: subtle light-purple background and purple accent
    bg: "bg-purple-50/50 hover:bg-purple-50/80",
    border: "border-purple-200/80",
    hoverBorder: "hover:border-purple-400/80",
    focusRing: "focus-visible:ring-purple-500",
    iconBg: "bg-purple-100",
    iconText: "text-purple-700",
    badgeBg: "bg-purple-100/70",
    badgeBorder: "border-purple-200",
    badgeText: "text-purple-800",
    titleHover: "group-hover:text-purple-700",
    ctaBorder: "border-purple-200/60",
    ctaText: "text-purple-700",
    ctaHover: "group-hover:text-purple-900",
  },
  hod: {
    // Department Head (HOD) Portal: subtle light-orange background and orange accent
    bg: "bg-orange-50/50 hover:bg-orange-50/80",
    border: "border-orange-200/80",
    hoverBorder: "hover:border-orange-400/80",
    focusRing: "focus-visible:ring-orange-500",
    iconBg: "bg-orange-100",
    iconText: "text-orange-700",
    badgeBg: "bg-orange-100/70",
    badgeBorder: "border-orange-200",
    badgeText: "text-orange-800",
    titleHover: "group-hover:text-orange-700",
    ctaBorder: "border-orange-200/60",
    ctaText: "text-orange-700",
    ctaHover: "group-hover:text-orange-900",
  },
  admin: {
    // System Administrator fallback
    bg: "bg-amber-50/50 hover:bg-amber-50/80",
    border: "border-amber-200/80",
    hoverBorder: "hover:border-amber-400/80",
    focusRing: "focus-visible:ring-amber-500",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    badgeBg: "bg-amber-100/70",
    badgeBorder: "border-amber-200",
    badgeText: "text-amber-800",
    titleHover: "group-hover:text-amber-700",
    ctaBorder: "border-amber-200/60",
    ctaText: "text-amber-700",
    ctaHover: "group-hover:text-amber-900",
  },
};

export function PortalSelection() {
  const { user, logout, isLoading } = useAuth();

  // Determine authorized roles for current session
  // If not authenticated, display all 4 portals to allow signing in
  // If authenticated, display only the portals the user is authorized to access
  const authorizedRoles: UserRole[] = React.useMemo(() => {
    if (!user || isLoading) {
      // Unauthenticated visitors: strictly non-administrator academic portals
      return ["student", "mentor", "hod"];
    }
    if (user.role === "hod") {
      // HOD possesses dual capabilities: Department Head and Faculty Mentor
      return ["hod", "mentor"];
    }
    if (user.role === "mentor") {
      return ["mentor"];
    }
    if (user.role === "student") {
      return ["student"];
    }
    if (user.role === "admin") {
      return ["admin"];
    }
    return [user.role];
  }, [user, isLoading]);

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

      {/* 3. Discreet Active Session Status Bar (if already signed in) */}
      {user && !isLoading && (
        <section aria-label="Current Session" className="w-full max-w-5xl mx-auto px-4 mb-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 py-2.5 px-4 text-xs text-sky-900 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Active Session: <strong>{user.full_name}</strong> (
                {user.role === "hod" ? "Department HOD & Mentor" : ROLE_CONFIGS[user.role]?.shortTitle})
              </span>
            </div>
            <div className="flex items-center gap-3">
              {user.role === "hod" ? (
                <>
                  <Link
                    href="/hod"
                    className="font-semibold text-purple-700 hover:text-purple-900 hover:underline inline-flex items-center gap-1"
                  >
                    Open HOD Dashboard &rarr;
                  </Link>
                  <span className="text-sky-300">&bull;</span>
                  <Link
                    href="/mentor"
                    className="font-semibold text-indigo-700 hover:text-indigo-900 hover:underline inline-flex items-center gap-1"
                  >
                    Open Mentor Dashboard (11 Mentees) &rarr;
                  </Link>
                </>
              ) : (
                <Link
                  href={`/${user.role}`}
                  className="font-semibold text-sky-700 hover:text-sky-900 hover:underline inline-flex items-center gap-1"
                >
                  Go to {ROLE_CONFIGS[user.role]?.shortTitle} Dashboard &rarr;
                </Link>
              )}
              <span className="text-sky-300">&bull;</span>
              <button
                type="button"
                onClick={() => logout()}
                className="font-medium text-slate-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4. Portal Selection Cards */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-8 flex-1 flex flex-col justify-center">
        <div className="text-center mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {user && !isLoading
              ? "Select an Authorized Portal to Enter"
              : "Select an Institutional Portal to Sign In"}
          </span>
        </div>

        <div
          className={`grid gap-5 sm:gap-6 ${
            authorizedRoles.length === 1
              ? "grid-cols-1 max-w-md mx-auto w-full"
              : authorizedRoles.length === 2
              ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto w-full"
              : "grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto w-full"
          }`}
        >
          {authorizedRoles.map((roleKey) => {
            const cfg = ROLE_CONFIGS[roleKey];
            const theme = PORTAL_CARD_THEMES[roleKey] || PORTAL_CARD_THEMES.student;
            const isTargetSessionRole = user && (user.role === roleKey || (user.role === "hod" && roleKey === "mentor"));
            // When already authenticated, clicking the card navigates directly to the dashboard
            const cardHref = user ? cfg.dashboardPath : cfg.path;
            const ctaLabel = user
              ? `Open ${cfg.shortTitle} Dashboard`
              : cfg.ctaText;

            return (
              <Link
                key={roleKey}
                href={cardHref}
                id={`portal-card-${roleKey}`}
                className={`group relative flex flex-col justify-between rounded-xl border ${theme.border} ${theme.bg} p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${theme.focusRing} ${theme.hoverBorder}`}
              >
                <div>
                  {/* Top Row: Icon & Tag */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconText} transition-colors`}
                    >
                      {roleKey === "student" && (
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
                            d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-5.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                          />
                        </svg>
                      )}
                      {roleKey === "mentor" && (
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                      {roleKey === "hod" && (
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
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      )}
                      {roleKey === "admin" && (
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
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      )}
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${theme.badgeBorder} ${theme.badgeBg} ${theme.badgeText}`}
                    >
                      {user && user.role === "hod" && roleKey === "mentor"
                        ? "11 Assigned Mentees"
                        : cfg.badgeText}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3
                    className={`text-base sm:text-lg font-bold text-slate-900 ${theme.titleHover} transition-colors`}
                  >
                    {cfg.portalName}
                  </h3>
                  <p className="mt-2 text-xs sm:text-[13px] text-slate-600 leading-relaxed line-clamp-3">
                    {user && user.role === "hod" && roleKey === "mentor"
                      ? "Review achievements, verify certificate evidence, and record verification audit remarks for your 11 assigned mentees."
                      : cfg.description}
                  </p>
                </div>

                {/* Bottom Action CTA */}
                <div
                  className={`mt-6 pt-4 border-t ${theme.ctaBorder} flex items-center justify-between text-xs font-semibold ${theme.ctaText} ${theme.ctaHover} min-h-[44px]`}
                >
                  <span>{ctaLabel}</span>
                  <span
                    className="transform group-hover:translate-x-1 transition-transform"
                    aria-hidden="true"
                  >
                    &rarr;
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Institutional Notice */}
        <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-center max-w-2xl mx-auto w-full">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">Authorized Cohort Access Only:</strong> Student and faculty accounts are provisioned via verified departmental rosters. Public self-registration is disabled.
          </p>
        </div>
      </main>

      {/* 5. Official Sairam SDG Banner Strip */}
      <section aria-label="Sustainable Development Goals" className="w-full mt-4 px-4">
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

      {/* 6. Official Sairam Leo Muthu Artwork Footer Banner */}
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
