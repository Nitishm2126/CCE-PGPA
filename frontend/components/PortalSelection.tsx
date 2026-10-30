"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS } from "@/lib/role-config";

// Dedicated refined styling tokens for the institutional portal cards
const PORTAL_CARD_THEMES: Record<
  string,
  {
    bg: string;
    border: string;
    accentTop: string;
    hoverBorder: string;
    focusRing: string;
    iconBg: string;
    iconText: string;
    iconHoverBg: string;
    iconHoverText: string;
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
    // Student Portal: Professional Institutional Blue
    bg: "bg-white hover:bg-sky-50/20",
    border: "border-slate-200/90",
    accentTop: "border-t-[3px] border-t-sky-500",
    hoverBorder: "hover:border-sky-300 hover:shadow-md",
    focusRing: "focus-visible:ring-sky-500",
    iconBg: "bg-sky-50",
    iconText: "text-sky-600",
    iconHoverBg: "group-hover:bg-sky-600",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-sky-50/90",
    badgeBorder: "border-sky-200/80",
    badgeText: "text-sky-800",
    titleHover: "group-hover:text-sky-700",
    ctaBorder: "border-slate-100 group-hover:border-sky-100",
    ctaText: "text-sky-700",
    ctaHover: "group-hover:text-sky-900",
  },
  mentor: {
    // Faculty Mentor Portal: Professional Purple / Indigo
    bg: "bg-white hover:bg-purple-50/20",
    border: "border-slate-200/90",
    accentTop: "border-t-[3px] border-t-purple-600",
    hoverBorder: "hover:border-purple-300 hover:shadow-md",
    focusRing: "focus-visible:ring-purple-500",
    iconBg: "bg-purple-50",
    iconText: "text-purple-600",
    iconHoverBg: "group-hover:bg-purple-600",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-purple-50/90",
    badgeBorder: "border-purple-200/80",
    badgeText: "text-purple-800",
    titleHover: "group-hover:text-purple-700",
    ctaBorder: "border-slate-100 group-hover:border-purple-100",
    ctaText: "text-purple-700",
    ctaHover: "group-hover:text-purple-900",
  },
  hod: {
    // Department Head (HOD) Portal: Professional Amber / Orange
    bg: "bg-white hover:bg-amber-50/20",
    border: "border-slate-200/90",
    accentTop: "border-t-[3px] border-t-amber-500",
    hoverBorder: "hover:border-amber-300 hover:shadow-md",
    focusRing: "focus-visible:ring-amber-500",
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
    iconHoverBg: "group-hover:bg-amber-600",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-amber-50/90",
    badgeBorder: "border-amber-200/80",
    badgeText: "text-amber-800",
    titleHover: "group-hover:text-amber-700",
    ctaBorder: "border-slate-100 group-hover:border-amber-100",
    ctaText: "text-amber-700",
    ctaHover: "group-hover:text-amber-900",
  },
  admin: {
    // System Administrator fallback
    bg: "bg-white hover:bg-slate-50",
    border: "border-slate-200/90",
    accentTop: "border-t-[3px] border-t-slate-600",
    hoverBorder: "hover:border-slate-400 hover:shadow-md",
    focusRing: "focus-visible:ring-slate-500",
    iconBg: "bg-slate-100",
    iconText: "text-slate-700",
    iconHoverBg: "group-hover:bg-slate-800",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-slate-100",
    badgeBorder: "border-slate-200",
    badgeText: "text-slate-800",
    titleHover: "group-hover:text-slate-900",
    ctaBorder: "border-slate-100 group-hover:border-slate-200",
    ctaText: "text-slate-700",
    ctaHover: "group-hover:text-slate-900",
  },
};

export function PortalSelection() {
  const { user, logout, isLoading } = useAuth();

  // Determine authorized roles for current session
  // If not authenticated, display all 3 academic portals to allow signing in
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
    <div className="w-full min-h-[100svh] flex flex-col justify-between bg-white text-slate-900 overflow-x-hidden">
      {/* 1. Official Sairam Logos Header Banner */}
      <header className="w-full shrink-0 border-b border-slate-200/80 bg-white py-2 sm:py-2.5 px-3 sm:px-6">
        <div className="mx-auto max-w-5xl flex items-center justify-center">
          <Image
            src="/images/sairam-logos.png"
            alt="Sri Sairam Engineering College - Autonomous Institution - Affiliated to Anna University"
            width={1600}
            height={130}
            priority
            className="w-auto h-8 sm:h-9 md:h-10 lg:h-11 max-w-full object-contain mx-auto"
          />
        </div>
      </header>

      {/* 2. Main Content: Title, Session Bar, Portal Cards */}
      <main className="w-full flex-1 flex flex-col justify-start md:justify-center items-center px-4 sm:px-6 max-w-5xl mx-auto py-3 md:py-4">
        {/* Department Title & Institutional Heading */}
        <section className="text-center space-y-1 sm:space-y-1.5 shrink-0 max-w-2xl mx-auto">
          <h2 className="text-xs sm:text-[13px] md:text-sm lg:text-[14.5px] font-bold uppercase tracking-wider text-sky-700">
            Department of Computer and Communication Engineering
          </h2>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-extrabold tracking-tight text-[#800000] leading-tight">
            CCE PGPA
          </h1>
          <p className="text-xs sm:text-[13px] md:text-sm font-medium text-slate-600">
            Performance Grade Point Average Management Application
          </p>
        </section>

        {/* Discreet Active Session Status Bar (if already signed in) */}
        {user && !isLoading && (
          <div aria-label="Current Session" className="w-full max-w-3xl mx-auto mt-2.5 sm:mt-3">
            <div className="rounded-lg border border-sky-200 bg-sky-50/70 py-1.5 px-3.5 text-xs text-sky-900 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Active Session: <strong>{user.full_name}</strong> (
                  {user.role === "hod" ? "Department HOD & Mentor" : ROLE_CONFIGS[user.role]?.shortTitle})
                </span>
              </div>
              <div className="flex items-center gap-2.5">
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
                      Open Mentor Dashboard &rarr;
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
          </div>
        )}

        {/* Portal Selection Instruction with Subtle Rules */}
        <div className="w-full max-w-4xl mx-auto flex items-center justify-center gap-3 mt-3 sm:mt-3.5 md:mt-4 lg:mt-5 mb-3 sm:mb-3.5 md:mb-4 shrink-0">
          <span className="h-px flex-1 max-w-[60px] sm:max-w-[80px] bg-slate-200" aria-hidden="true" />
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">
            {user && !isLoading
              ? "Select an Authorized Portal to Enter"
              : "Select an Institutional Portal to Sign In"}
          </span>
          <span className="h-px flex-1 max-w-[60px] sm:max-w-[80px] bg-slate-200" aria-hidden="true" />
        </div>

        {/* Portal Selection Cards */}
        <div
          className={`grid gap-3.5 sm:gap-4 md:gap-4 lg:gap-5 w-full ${
            authorizedRoles.length === 1
              ? "grid-cols-1 max-w-sm mx-auto"
              : authorizedRoles.length === 2
              ? "grid-cols-1 sm:grid-cols-2 max-w-xl mx-auto"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto"
          }`}
        >
        {authorizedRoles.map((roleKey, idx) => {
          const cfg = ROLE_CONFIGS[roleKey];
          const theme = PORTAL_CARD_THEMES[roleKey] || PORTAL_CARD_THEMES.student;
          const cardHref = user ? cfg.dashboardPath : cfg.path;
          const ctaLabel = user
            ? `Open ${cfg.shortTitle} Dashboard`
            : cfg.ctaText;

          // In 2-column mode on tablet with 3 cards, center the 3rd card gracefully
          const spanClass =
            authorizedRoles.length === 3 && idx === 2
              ? "sm:col-span-2 sm:max-w-md sm:mx-auto md:col-span-1 md:max-w-none md:mx-0"
              : "";

          return (
            <Link
              key={roleKey}
              href={cardHref}
              id={`portal-card-${roleKey}`}
              className={`group relative flex flex-col justify-between rounded-xl border ${theme.border} ${theme.accentTop} ${theme.bg} p-4 sm:p-4.5 md:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${theme.focusRing} ${theme.hoverBorder} w-full h-full ${spanClass}`}
            >
              <div className="flex-1 flex flex-col">
                {/* Top Row: Icon & Tag */}
                <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
                  <div
                    className={`flex h-9 w-9 sm:h-9.5 sm:w-9.5 shrink-0 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconText} ${theme.iconHoverBg} ${theme.iconHoverText} transition-colors duration-200`}
                  >
                    {roleKey === "student" && (
                      <svg
                        className="h-4.5 w-4.5 sm:h-5 sm:w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-5.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                        />
                      </svg>
                    )}
                    {roleKey === "mentor" && (
                      <svg
                        className="h-4.5 w-4.5 sm:h-5 sm:w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                    {roleKey === "hod" && (
                      <svg
                        className="h-4.5 w-4.5 sm:h-5 sm:w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    )}
                    {roleKey === "admin" && (
                      <svg
                        className="h-4.5 w-4.5 sm:h-5 sm:w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                  </div>

                  <span
                    className={`text-[10px] sm:text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 text-center ${theme.badgeBorder} ${theme.badgeBg} ${theme.badgeText}`}
                  >
                    {user && user.role === "hod" && roleKey === "mentor"
                      ? "11 Assigned Mentees"
                      : cfg.badgeText}
                  </span>
                </div>

                {/* Title & Description */}
                <h3
                  className={`text-[15px] sm:text-base md:text-[16.5px] font-bold text-slate-900 ${theme.titleHover} transition-colors leading-snug`}
                >
                  {cfg.portalName}
                </h3>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-[12.5px] text-slate-600 leading-relaxed">
                  {user && user.role === "hod" && roleKey === "mentor"
                    ? "Review achievements, verify certificate evidence, and record verification audit remarks for your 11 assigned mentees."
                    : cfg.description}
                </p>
              </div>

              {/* Bottom Action CTA */}
              <div
                className={`mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t ${theme.ctaBorder} flex items-center justify-between text-xs sm:text-[12.5px] font-semibold ${theme.ctaText} ${theme.ctaHover} min-h-[34px] sm:min-h-[36px]`}
              >
                <span className="truncate mr-1 font-medium group-hover:font-semibold transition-all">{ctaLabel}</span>
                <span
                  className="transform group-hover:translate-x-1 transition-transform shrink-0"
                  aria-hidden="true"
                >
                  &rarr;
                </span>
              </div>
            </Link>
          );
        })}
        </div>
      </main>

      {/* 3. Official Sairam SDG Banner, Founder Artwork, and Institutional Footer */}
      <footer className="w-full shrink-0 mt-auto border-t border-slate-200/80 bg-slate-50/60 py-2.5 sm:py-3 md:py-3 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl flex flex-col items-center space-y-2 sm:space-y-2.5 md:space-y-2.5">
          {/* Official Sairam SDG Banner Strip */}
          <div className="w-full flex justify-center">
            <Image
              src="/images/sairam-sdg.png"
              alt="United Nations Sustainable Development Goals - Sri Sairam Engineering College"
              width={1600}
              height={125}
              className="w-auto h-7 sm:h-8 md:h-9 lg:h-10 max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl object-contain mx-auto"
            />
          </div>

          {/* Official Sairam Leo Muthu Artwork Footer Banner */}
          <div className="w-full flex justify-center">
            <Image
              src="/images/sairam-footer.png"
              alt="Sri Sairam Engineering College - Founder Chairman MJF. Ln. Leo Muthu"
              width={1600}
              height={251}
              className="w-auto h-11 sm:h-12 md:h-13 lg:h-15 max-w-[92vw] sm:max-w-md md:max-w-lg lg:max-w-xl object-contain mx-auto"
            />
          </div>

          {/* Attribution & Legal Notice */}
          <div className="text-center space-y-0.5 sm:space-y-1">
            <p className="text-xs sm:text-[13px] md:text-sm font-semibold text-slate-800 tracking-wide">
              Designed and Developed by Team FineWorks
            </p>
            <p className="text-[11px] sm:text-xs text-slate-600">
              Department of Computer and Communication Engineering &bull; Sri Sairam Engineering College
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
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
        </div>
      </footer>
    </div>
  );
}
