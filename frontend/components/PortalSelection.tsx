"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS } from "@/lib/role-config";

// Dedicated refined theme tokens for each institutional portal
interface PortalCardTheme {
  accentBar: string;
  cardBorder: string;
  hoverBorder: string;
  hoverShadow: string;
  focusRing: string;
  iconBg: string;
  iconText: string;
  iconHoverBg: string;
  iconHoverText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  tagBg: string;
  tagBorder: string;
  tagText: string;
  ctaBg: string;
  ctaText: string;
  ctaBorder: string;
  ctaHoverBg: string;
  ctaHoverText: string;
  ctaHoverBorder: string;
  titleHover: string;
}

const PORTAL_CARD_THEMES: Record<string, PortalCardTheme> = {
  student: {
    // Student Portal: Professional Institutional Blue
    accentBar: "bg-sky-600",
    cardBorder: "border-slate-200/90",
    hoverBorder: "hover:border-sky-400",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(2,132,199,0.14)]",
    focusRing: "focus-visible:ring-sky-500",
    iconBg: "bg-sky-50",
    iconText: "text-sky-700",
    iconHoverBg: "group-hover:bg-sky-600",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-sky-50/90",
    badgeBorder: "border-sky-200/80",
    badgeText: "text-sky-800",
    tagBg: "bg-sky-50/60",
    tagBorder: "border-sky-100",
    tagText: "text-sky-800",
    ctaBg: "bg-sky-50/80",
    ctaText: "text-sky-800",
    ctaBorder: "border-sky-200/70",
    ctaHoverBg: "group-hover:bg-sky-600",
    ctaHoverText: "group-hover:text-white",
    ctaHoverBorder: "group-hover:border-sky-600",
    titleHover: "group-hover:text-sky-700",
  },
  mentor: {
    // Faculty Mentor Portal: Professional Academic Purple
    accentBar: "bg-purple-600",
    cardBorder: "border-slate-200/90",
    hoverBorder: "hover:border-purple-400",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(124,58,237,0.14)]",
    focusRing: "focus-visible:ring-purple-500",
    iconBg: "bg-purple-50",
    iconText: "text-purple-700",
    iconHoverBg: "group-hover:bg-purple-600",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-purple-50/90",
    badgeBorder: "border-purple-200/80",
    badgeText: "text-purple-800",
    tagBg: "bg-purple-50/60",
    tagBorder: "border-purple-100",
    tagText: "text-purple-800",
    ctaBg: "bg-purple-50/80",
    ctaText: "text-purple-800",
    ctaBorder: "border-purple-200/70",
    ctaHoverBg: "group-hover:bg-purple-600",
    ctaHoverText: "group-hover:text-white",
    ctaHoverBorder: "group-hover:border-purple-600",
    titleHover: "group-hover:text-purple-700",
  },
  hod: {
    // Department Head (HOD): Warm Institutional Amber/Orange
    accentBar: "bg-amber-500",
    cardBorder: "border-slate-200/90",
    hoverBorder: "hover:border-amber-400",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(217,119,6,0.14)]",
    focusRing: "focus-visible:ring-amber-500",
    iconBg: "bg-amber-50",
    iconText: "text-amber-700",
    iconHoverBg: "group-hover:bg-amber-500",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-amber-50/90",
    badgeBorder: "border-amber-200/80",
    badgeText: "text-amber-800",
    tagBg: "bg-amber-50/60",
    tagBorder: "border-amber-100",
    tagText: "text-amber-800",
    ctaBg: "bg-amber-50/80",
    ctaText: "text-amber-800",
    ctaBorder: "border-amber-200/70",
    ctaHoverBg: "group-hover:bg-amber-500",
    ctaHoverText: "group-hover:text-white",
    ctaHoverBorder: "group-hover:border-amber-500",
    titleHover: "group-hover:text-amber-700",
  },
  admin: {
    // Administrator fallback
    accentBar: "bg-slate-700",
    cardBorder: "border-slate-200/90",
    hoverBorder: "hover:border-slate-400",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(30,41,59,0.14)]",
    focusRing: "focus-visible:ring-slate-500",
    iconBg: "bg-slate-100",
    iconText: "text-slate-700",
    iconHoverBg: "group-hover:bg-slate-800",
    iconHoverText: "group-hover:text-white",
    badgeBg: "bg-slate-100",
    badgeBorder: "border-slate-200",
    badgeText: "text-slate-800",
    tagBg: "bg-slate-50",
    tagBorder: "border-slate-200",
    tagText: "text-slate-700",
    ctaBg: "bg-slate-100",
    ctaText: "text-slate-800",
    ctaBorder: "border-slate-200",
    ctaHoverBg: "group-hover:bg-slate-800",
    ctaHoverText: "group-hover:text-white",
    ctaHoverBorder: "group-hover:border-slate-800",
    titleHover: "group-hover:text-slate-900",
  },
};

// Enterprise role metadata: audience, feature tags, and descriptions
const PORTAL_CARD_METADATA: Record<
  string,
  {
    audience: string;
    description: string;
    tags: string[];
  }
> = {
  student: {
    audience: "Enrolled CCE Undergraduates (2025–2029)",
    description:
      "Submit semester activity points across PGPA components, upload verified certificate credentials, and monitor mentor verification milestones.",
    tags: ["Point Submission", "Evidence Vault", "Grade Audit"],
  },
  mentor: {
    audience: "Faculty Advisors & Verification Officers",
    description:
      "Inspect assigned mentee submissions, review certificate documentation via secure proxy, and record official verification remarks.",
    tags: ["Mentee Directory", "Evidence Audit", "Remarks Ledger"],
  },
  hod: {
    audience: "Head of Department & Academic Governance",
    description:
      "Department-wide cohort analytics, mentor-student allocation management, QR badge verification, and academic performance audit.",
    tags: ["Cohort Analytics", "Mentor Allocation", "QR Verification"],
  },
  admin: {
    audience: "System Administration & Infrastructure",
    description:
      "Technical console, PostgreSQL directory authority, RBAC policy enforcement, and system audit oversight.",
    tags: ["System Directory", "RBAC Enforcement", "Audit Oversight"],
  },
};

export function PortalSelection() {
  const { user, logout, isLoading } = useAuth();

  // Determine authorized roles for current session
  // If not authenticated, display all 3 academic portals to allow signing in
  // If authenticated, display only the portals the user is authorized to access
  const authorizedRoles: UserRole[] = React.useMemo(() => {
    if (!user || isLoading) {
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
    <div className="w-full min-h-[100svh] flex flex-col justify-between bg-[#fcfcfd] text-slate-900 overflow-x-hidden selection:bg-sky-100 selection:text-sky-900">
      {/* =========================================================================
          1. COMPACT INSTITUTIONAL HEADER
          Dedicated Desktop & Mobile compositions with SEC emblem & Sairam branding
          ========================================================================= */}
      <header className="w-full shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40 transition-colors shadow-2xs">
        <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 md:h-[68px] items-center justify-between gap-2.5 sm:gap-4">
            {/* Left: SEC Institutional Emblem & College Identification */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <Link
                href="/"
                className="flex items-center gap-2.5 sm:gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg p-0.5"
                title="Sri Sairam Engineering College - CCE PGPA Portal"
              >
                <div className="relative h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 shrink-0 flex items-center justify-center">
                  <Image
                    src="/images/sec logo.png"
                    alt="Sri Sairam Engineering College Crest"
                    width={48}
                    height={48}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-extrabold text-[12.5px] sm:text-[14px] md:text-[15px] tracking-tight text-[#0f2942] uppercase leading-tight truncate">
                    Sri Sairam Engineering College
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                    <span className="truncate">Autonomous Institution</span>
                    <span className="hidden sm:inline text-slate-300" aria-hidden="true">&bull;</span>
                    <span className="hidden sm:inline truncate">Anna University Affiliated</span>
                    <span className="hidden md:inline text-slate-300" aria-hidden="true">&bull;</span>
                    <span className="hidden md:inline text-sky-700 font-semibold truncate">NBA &amp; NAAC &apos;A+&apos;</span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Right: Department Identity & Sairam Institutions Brand */}
            <div className="flex items-center gap-2 sm:gap-4 lg:gap-5 shrink-0">
              {/* Desktop Department Identity Lockup */}
              <div className="hidden lg:flex flex-col items-end text-right border-r border-slate-200/90 pr-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  Department of CCE
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Academic Performance Portal
                </span>
              </div>

              {/* Sairam Institutions Official Logo */}
              <div className="relative h-8 sm:h-9 md:h-10 w-auto shrink-0 flex items-center">
                <Image
                  src="/images/logo1.png"
                  alt="Sri Sairam Institutions Logo"
                  width={68}
                  height={44}
                  priority
                  className="h-7 sm:h-8 md:h-9.5 w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN SECTION: HERO + ACTIVE SESSION BAR + PORTAL SELECTION CARDS
          Engineered for balanced viewport fit on Desktop (1280, 1366, 1440, 1920)
          and thumb-optimized vertical stack on Mobile (360, 390, 430)
          ========================================================================= */}
      <main className="w-full flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-5 sm:py-6 md:py-8 lg:py-10">
        {/* Department Title & Institutional Heading */}
        <section className="text-center w-full max-w-3xl mx-auto space-y-1.5 sm:space-y-2 shrink-0">
          {/* Department Identity Element */}
          <div
            id="department-identity-container"
            className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl sm:rounded-full bg-slate-100/90 border border-slate-200/90 shadow-2xs max-w-full"
          >
            <span className="h-2 w-2 rounded-full bg-sky-600 shrink-0" aria-hidden="true" />
            <span
              id="department-identity-name"
              className="font-bold tracking-wider uppercase text-slate-700 text-center leading-snug break-words whitespace-normal md:whitespace-nowrap"
              style={{ fontSize: "clamp(10.5px, 2.2vw, 12px)" }}
            >
              DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING
            </span>
          </div>

          {/* Institutional Portal Name & Tagline */}
          <div className="space-y-0.5">
            <h1 className="text-3xl sm:text-4xl md:text-[42px] font-black tracking-tight text-[#800000] leading-tight">
              CCE PGPA
            </h1>
            <p className="text-[11px] sm:text-xs md:text-[13px] font-bold uppercase tracking-[0.2em] text-[#0f2942]">
              PGPA Management System
            </p>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-600 italic">
            &ldquo;Academic Performance. Structured. Simplified.&rdquo;
          </p>
        </section>

        {/* Discreet Active Session Status Bar (if already signed in) */}
        {user && !isLoading && (
          <div aria-label="Current Session" className="w-full max-w-2xl mx-auto mt-3.5 sm:mt-4 shrink-0">
            <div className="rounded-xl border border-sky-200/90 bg-sky-50/80 py-2 px-3.5 sm:px-4 text-xs text-sky-950 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
                <span className="font-medium text-[11.5px] sm:text-xs">
                  Active Session: <strong className="font-semibold text-slate-900">{user.full_name}</strong>{" "}
                  <span className="text-sky-800">
                    ({user.role === "hod" ? "Department HOD & Mentor" : ROLE_CONFIGS[user.role]?.shortTitle})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-2.5 text-xs">
                {user.role === "hod" ? (
                  <>
                    <Link
                      href="/hod"
                      className="font-semibold text-purple-700 hover:text-purple-900 hover:underline inline-flex items-center gap-1"
                    >
                      HOD Dashboard &rarr;
                    </Link>
                    <span className="text-sky-300" aria-hidden="true">&bull;</span>
                    <Link
                      href="/mentor"
                      className="font-semibold text-indigo-700 hover:text-indigo-900 hover:underline inline-flex items-center gap-1"
                    >
                      Mentor Dashboard &rarr;
                    </Link>
                  </>
                ) : (
                  <Link
                    href={ROLE_CONFIGS[user.role]?.dashboardPath || `/${user.role}`}
                    className="font-semibold text-sky-700 hover:text-sky-900 hover:underline inline-flex items-center gap-1"
                  >
                    Open Dashboard &rarr;
                  </Link>
                )}
                <span className="text-sky-300" aria-hidden="true">&bull;</span>
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

        {/* Portal Selection Divider */}
        <div className="w-full max-w-4xl mx-auto flex items-center justify-center gap-3 my-3.5 sm:my-4 md:my-5 shrink-0">
          <span className="h-px flex-1 max-w-[50px] sm:max-w-[90px] bg-slate-200" aria-hidden="true" />
          <span className="text-[10px] sm:text-[11.5px] font-bold uppercase tracking-[0.16em] text-slate-400 text-center">
            {user && !isLoading
              ? "Select Authorized Portal to Enter"
              : "Select Institutional Portal to Sign In"}
          </span>
          <span className="h-px flex-1 max-w-[50px] sm:max-w-[90px] bg-slate-200" aria-hidden="true" />
        </div>

        {/* Portal Selection Cards */}
        <div
          className={`grid gap-4 sm:gap-4.5 md:gap-5 lg:gap-6 w-full ${
            authorizedRoles.length === 1
              ? "grid-cols-1 max-w-md mx-auto"
              : authorizedRoles.length === 2
              ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
              : "grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto"
          }`}
        >
          {authorizedRoles.map((roleKey) => {
            const cfg = ROLE_CONFIGS[roleKey];
            const theme = PORTAL_CARD_THEMES[roleKey] || PORTAL_CARD_THEMES.student;
            const meta = PORTAL_CARD_METADATA[roleKey] || PORTAL_CARD_METADATA.student;
            const cardHref = user ? cfg.dashboardPath : cfg.path;
            const ctaLabel = user
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
                ? "Review achievements, verify certificate evidence via secure proxy, and record verification audit remarks for your 11 assigned mentees."
                : meta.description;

            return (
              <Link
                key={roleKey}
                href={cardHref}
                id={`portal-card-${roleKey}`}
                className={`group relative flex flex-col justify-between rounded-xl border ${theme.cardBorder} ${theme.hoverBorder} ${theme.hoverShadow} bg-white p-4.5 sm:p-5 md:p-5 lg:p-5.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${theme.focusRing} w-full h-full overflow-hidden`}
              >
                {/* Top Subtle Color Accent Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[3.5px] ${theme.accentBar}`}
                  aria-hidden="true"
                />

                <div className="flex-1 flex flex-col pt-1">
                  {/* Card Header: Role Icon & Official Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div
                      className={`flex h-10 w-10 sm:h-10.5 sm:w-10.5 shrink-0 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconText} ${theme.iconHoverBg} ${theme.iconHoverText} transition-colors duration-200 shadow-2xs`}
                    >
                      {roleKey === "student" && (
                        <svg
                          className="h-5 w-5 sm:h-5.5 sm:w-5.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                          <path d="M6 12v5c3 3 9 3 12 0v-5" />
                        </svg>
                      )}
                      {roleKey === "mentor" && (
                        <svg
                          className="h-5 w-5 sm:h-5.5 sm:w-5.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                      )}
                      {roleKey === "hod" && (
                        <svg
                          className="h-5 w-5 sm:h-5.5 sm:w-5.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2L2 7h20L12 2z" />
                        </svg>
                      )}
                      {roleKey === "admin" && (
                        <svg
                          className="h-5 w-5 sm:h-5.5 sm:w-5.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      )}
                    </div>

                    <span
                      className={`text-[10px] sm:text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 text-center ${theme.badgeBorder} ${theme.badgeBg} ${theme.badgeText}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Title & Audience Identification */}
                  <div>
                    <h2
                      className={`text-[16px] sm:text-[17px] md:text-[17.5px] font-bold text-slate-900 ${theme.titleHover} transition-colors leading-snug`}
                    >
                      {cfg.portalName}
                    </h2>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-tight">
                      {meta.audience}
                    </p>
                  </div>

                  {/* Concise Institutional Description */}
                  <p className="mt-2 text-xs sm:text-[12.5px] text-slate-600 leading-relaxed">
                    {descriptionText}
                  </p>

                  {/* Key Capabilities Chips */}
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Portal Capabilities">
                    {meta.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border ${theme.tagBorder} ${theme.tagBg} ${theme.tagText}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action CTA Button */}
                <div
                  className={`mt-4 pt-3 border-t border-slate-100 flex items-center justify-between min-h-[42px] sm:min-h-[44px] px-3.5 py-2 rounded-lg ${theme.ctaBg} ${theme.ctaText} ${theme.ctaBorder} ${theme.ctaHoverBg} ${theme.ctaHoverText} ${theme.ctaHoverBorder} border transition-all duration-200 text-xs sm:text-[12.5px] font-semibold`}
                >
                  <span className="truncate pr-2 font-medium group-hover:font-semibold transition-all">
                    {ctaLabel}
                  </span>
                  <span
                    className="transform group-hover:translate-x-1 transition-transform shrink-0 text-sm font-bold"
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

      {/* =========================================================================
          3. REFINED INSTITUTIONAL FOOTER
          Founder Chairman subtle identity, FineWorks development wordmark,
          and institutional legal / governance fine print
          ========================================================================= */}
      <footer className="w-full shrink-0 mt-auto border-t border-slate-200/90 bg-slate-50/70 py-4 sm:py-5 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col space-y-3.5 sm:space-y-4">
          {/* Upper Footer: Founder Chairman Identity & FINEWORKS Development Branding */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 sm:gap-4 border-b border-slate-200/70 pb-3.5 sm:pb-4">
            {/* Founder Chairman Medallion */}
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 shrink-0">
                <Image
                  src="/images/founder logo.png"
                  alt="Founder Chairman MJF. Ln. Leo Muthu"
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-[13px] font-bold text-slate-800 leading-tight">
                  MJF. Ln. Leo Muthu
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  Founder Chairman &bull; Sri Sairam Group of Institutions
                </span>
              </div>
            </div>

            {/* FINEWORKS Tasteful Development Wordmark */}
            <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Designed &amp; Developed by
              </span>
              <div className="inline-flex items-center gap-1.5 mt-0.5">
                <span className="text-xs sm:text-[13px] font-extrabold tracking-[0.24em] text-slate-900">
                  FINE<span className="text-sky-600">WORKS</span>
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Lower Footer: Legal, Department Notice & Subtle Admin Login */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-[11px] text-slate-500">
            <div>
              <span>Department of Computer and Communication Engineering</span>
              <span className="hidden sm:inline mx-1.5 text-slate-300" aria-hidden="true">&bull;</span>
              <span className="block sm:inline">Sri Sairam Engineering College (Autonomous)</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/login/admin"
                className="hover:underline hover:text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded transition-colors text-[10.5px] text-slate-400"
                title="System Administrator Portal Login"
                aria-label="System Administrator Portal Login"
              >
                CCE-PGPA Management System
              </Link>
              <span className="text-slate-300" aria-hidden="true">&bull;</span>
              <span className="text-[10.5px] text-slate-400">Version 1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
