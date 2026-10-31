"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS } from "@/lib/role-config";
import { ThemeToggle } from "@/components/ThemeToggle";

// Dedicated Apple-inspired refined theme tokens for each institutional portal
interface PortalCardTheme {
  accentGradient: string;
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
    accentGradient: "from-sky-500 to-blue-600",
    cardBorder: "border-slate-200/90 dark:border-slate-800/90",
    hoverBorder: "hover:border-sky-400 dark:hover:border-sky-500",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(2,132,199,0.18)] dark:hover:shadow-[0_16px_32px_-8px_rgba(2,132,199,0.25)]",
    focusRing: "focus-visible:ring-sky-500",
    iconBg: "bg-sky-50 dark:bg-sky-950/60",
    iconText: "text-sky-600 dark:text-sky-400",
    iconHoverBg: "group-hover:bg-sky-600 dark:group-hover:bg-sky-500",
    iconHoverText: "group-hover:text-white dark:group-hover:text-white",
    badgeBg: "bg-sky-50/90 dark:bg-sky-950/60",
    badgeBorder: "border-sky-200/80 dark:border-sky-800/80",
    badgeText: "text-sky-800 dark:text-sky-300",
    tagBg: "bg-sky-50/60 dark:bg-sky-950/40",
    tagBorder: "border-sky-100 dark:border-sky-900/60",
    tagText: "text-sky-800 dark:text-sky-300",
    ctaBg: "bg-sky-50/80 dark:bg-sky-950/50",
    ctaText: "text-sky-700 dark:text-sky-300",
    ctaBorder: "border-sky-200/70 dark:border-sky-800/60",
    ctaHoverBg: "group-hover:bg-sky-600 dark:group-hover:bg-sky-500",
    ctaHoverText: "group-hover:text-white",
    ctaHoverBorder: "group-hover:border-sky-600 dark:group-hover:border-sky-500",
    titleHover: "group-hover:text-sky-600 dark:group-hover:text-sky-400",
  },
  mentor: {
    accentGradient: "from-purple-500 to-indigo-600",
    cardBorder: "border-slate-200/90 dark:border-slate-800/90",
    hoverBorder: "hover:border-purple-400 dark:hover:border-purple-500",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(124,58,237,0.18)] dark:hover:shadow-[0_16px_32px_-8px_rgba(124,58,237,0.25)]",
    focusRing: "focus-visible:ring-purple-500",
    iconBg: "bg-purple-50 dark:bg-purple-950/60",
    iconText: "text-purple-600 dark:text-purple-400",
    iconHoverBg: "group-hover:bg-purple-600 dark:group-hover:bg-purple-500",
    iconHoverText: "group-hover:text-white dark:group-hover:text-white",
    badgeBg: "bg-purple-50/90 dark:bg-purple-950/60",
    badgeBorder: "border-purple-200/80 dark:border-purple-800/80",
    badgeText: "text-purple-800 dark:text-purple-300",
    tagBg: "bg-purple-50/60 dark:bg-purple-950/40",
    tagBorder: "border-purple-100 dark:border-purple-900/60",
    tagText: "text-purple-800 dark:text-purple-300",
    ctaBg: "bg-purple-50/80 dark:bg-purple-950/50",
    ctaText: "text-purple-700 dark:text-purple-300",
    ctaBorder: "border-purple-200/70 dark:border-purple-800/60",
    ctaHoverBg: "group-hover:bg-purple-600 dark:group-hover:bg-purple-500",
    ctaHoverText: "group-hover:text-white",
    ctaHoverBorder: "group-hover:border-purple-600 dark:group-hover:border-purple-500",
    titleHover: "group-hover:text-purple-600 dark:group-hover:text-purple-400",
  },
  hod: {
    accentGradient: "from-amber-500 to-orange-600",
    cardBorder: "border-slate-200/90 dark:border-slate-800/90",
    hoverBorder: "hover:border-amber-400 dark:hover:border-amber-500",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(217,119,6,0.18)] dark:hover:shadow-[0_16px_32px_-8px_rgba(217,119,6,0.25)]",
    focusRing: "focus-visible:ring-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-950/60",
    iconText: "text-amber-600 dark:text-amber-400",
    iconHoverBg: "group-hover:bg-amber-500 dark:group-hover:bg-amber-500",
    iconHoverText: "group-hover:text-white dark:group-hover:text-white",
    badgeBg: "bg-amber-50/90 dark:bg-amber-950/60",
    badgeBorder: "border-amber-200/80 dark:border-amber-800/80",
    badgeText: "text-amber-800 dark:text-amber-300",
    tagBg: "bg-amber-50/60 dark:bg-amber-950/40",
    tagBorder: "border-amber-100 dark:border-amber-900/60",
    tagText: "text-amber-800 dark:text-amber-300",
    ctaBg: "bg-amber-50/80 dark:bg-amber-950/50",
    ctaText: "text-amber-700 dark:text-amber-300",
    ctaBorder: "border-amber-200/70 dark:border-amber-800/60",
    ctaHoverBg: "group-hover:bg-amber-500 dark:group-hover:bg-amber-500",
    ctaHoverText: "group-hover:text-white",
    ctaHoverBorder: "group-hover:border-amber-500 dark:group-hover:border-amber-500",
    titleHover: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
  },
  admin: {
    accentGradient: "from-slate-700 to-slate-900 dark:from-slate-400 dark:to-slate-200",
    cardBorder: "border-slate-200/90 dark:border-slate-800/90",
    hoverBorder: "hover:border-slate-500 dark:hover:border-slate-400",
    hoverShadow: "hover:shadow-[0_16px_32px_-8px_rgba(15,23,42,0.18)] dark:hover:shadow-[0_16px_32px_-8px_rgba(15,23,42,0.35)]",
    focusRing: "focus-visible:ring-slate-500",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    iconText: "text-slate-700 dark:text-slate-300",
    iconHoverBg: "group-hover:bg-slate-900 dark:group-hover:bg-slate-100",
    iconHoverText: "group-hover:text-white dark:group-hover:text-slate-900",
    badgeBg: "bg-slate-100/90 dark:bg-slate-800/90",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-800 dark:text-slate-200",
    tagBg: "bg-slate-100/60 dark:bg-slate-800/60",
    tagBorder: "border-slate-200 dark:border-slate-700",
    tagText: "text-slate-700 dark:text-slate-300",
    ctaBg: "bg-slate-100/80 dark:bg-slate-800/80",
    ctaText: "text-slate-800 dark:text-slate-200",
    ctaBorder: "border-slate-200 dark:border-slate-700",
    ctaHoverBg: "group-hover:bg-slate-900 dark:group-hover:bg-slate-100",
    ctaHoverText: "group-hover:text-white dark:group-hover:text-slate-900",
    ctaHoverBorder: "group-hover:border-slate-900 dark:group-hover:border-slate-100",
    titleHover: "group-hover:text-slate-900 dark:group-hover:text-white",
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
      "Submit academic activities, upload evidence and track PGPA progress.",
    tags: ["Point Submission", "Evidence Vault", "PGPA Progress"],
  },
  mentor: {
    audience: "Faculty Advisors & Verification Officers",
    description:
      "Review student submissions, verify evidence and provide feedback.",
    tags: ["Mentee Directory", "Evidence Audit", "Remarks Ledger"],
  },
  hod: {
    audience: "Head of Department & Academic Governance",
    description:
      "Monitor department-wide performance, mentor activity and PGPA progress.",
    tags: ["Cohort Analytics", "Mentor Allocation", "Executive Reports"],
  },
  admin: {
    audience: "System Administration & Infrastructure",
    description:
      "Manage student accounts, mentors, components and system configuration.",
    tags: ["System Directory", "RBAC Policies", "System Audit"],
  },
};

const STAGGER_CLASSES = ["stagger-1", "stagger-2", "stagger-3", "stagger-4"];

export function PortalSelection() {
  const { user, logout, isLoading } = useAuth();

  // Display the 3 public institutional portals (Student, Mentor, HOD)
  // Admin is accessed discreetly via the footer text and hidden from the public cards
  const publicPortals: UserRole[] = ["student", "mentor", "hod"];

  return (
    <div className="w-full min-h-[100dvh] flex flex-col justify-between bg-[#fbfbfc] dark:bg-[#0c1117] text-slate-900 dark:text-slate-100 overflow-x-hidden selection:bg-sky-100 selection:text-sky-900 dark:selection:bg-sky-900/40 dark:selection:text-sky-200">
      {/* =========================================================================
          1. REFINED APPLE-INSPIRED INSTITUTIONAL HEADER
          Dedicated Desktop & Mobile compositions with SEC emblem & Sairam branding
          ========================================================================= */}
      <header className="w-full shrink-0 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 transition-colors shadow-2xs">
        <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2.5 sm:gap-4">
            {/* Left: SEC Institutional Emblem & College Identification */}
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

            {/* Right: Department Identity & Sairam Institutions Brand */}
            <div className="flex items-center gap-2 sm:gap-3.5 lg:gap-4 shrink-0">
              {/* Desktop Department Identity Lockup */}
              <div className="hidden lg:flex flex-col items-end text-right border-r border-slate-200/90 dark:border-slate-800 pr-3.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Department of CCE
                </span>
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium">
                  Academic Performance Portal
                </span>
              </div>

              {/* Theme Toggle Button */}
              <ThemeToggle size="sm" />

              {/* Sairam Institutions Official Logo */}
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

      {/* =========================================================================
          2. MAIN SECTION: HERO + ACTIVE SESSION BAR + PORTAL SELECTION CARDS
          Engineered for balanced viewport fit on Desktop (1280, 1366, 1440, 1920)
          and thumb-optimized vertical stack on Mobile (360, 390, 430)
          ========================================================================= */}
      <main className="w-full flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-5 sm:py-6 md:py-7 min-h-0">
        {/* Department Title & Institutional Heading */}
        <section className="text-center w-full max-w-3xl mx-auto space-y-2 sm:space-y-2.5 shrink-0 animate-apple-fade">
          {/* Department Identity Element */}
          <div
            id="department-identity-container"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs max-w-full"
          >
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-sky-600 dark:bg-sky-400 shrink-0" aria-hidden="true" />
            <span
              id="department-identity-name"
              className="font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 text-center leading-snug break-words whitespace-normal md:whitespace-nowrap"
              style={{ fontSize: "clamp(10px, 1.8vw, 11.5px)" }}
            >
              DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING
            </span>
          </div>

          {/* Institutional Portal Name & Tagline */}
          <div className="space-y-0.5">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">
              CCE PGPA
            </h1>
            <p className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.22em] text-[#0f2942] dark:text-slate-300">
              PGPA MANAGEMENT SYSTEM
            </p>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 italic">
            &ldquo;Academic Performance. Structured. Simplified.&rdquo;
          </p>
        </section>

        {/* Discreet Active Session Status Bar (if already signed in) */}
        {user && !isLoading && (
          <div aria-label="Current Session" className="w-full max-w-2xl mx-auto mt-4 shrink-0 animate-apple-fade">
            <div className="rounded-xl border border-sky-200/90 dark:border-sky-800/80 bg-sky-50/80 dark:bg-sky-950/60 py-2 px-3.5 sm:px-4 text-xs text-sky-950 dark:text-sky-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
                <span className="font-medium text-[11px] sm:text-xs">
                  Active Session: <strong className="font-semibold text-slate-900 dark:text-white">{user.full_name}</strong>{" "}
                  <span className="text-sky-800 dark:text-sky-300">
                    ({user.role === "hod" ? "Department HOD & Mentor" : ROLE_CONFIGS[user.role]?.shortTitle})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {user.role === "hod" ? (
                  <>
                    <Link
                      href="/hod"
                      className="font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 hover:underline inline-flex items-center gap-1"
                    >
                      HOD Dashboard &rarr;
                    </Link>
                    <span className="text-sky-300 dark:text-sky-700" aria-hidden="true">&bull;</span>
                    <Link
                      href="/mentor"
                      className="font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 hover:underline inline-flex items-center gap-1"
                    >
                      Mentor Dashboard &rarr;
                    </Link>
                  </>
                ) : (
                  <Link
                    href={ROLE_CONFIGS[user.role]?.dashboardPath || `/${user.role}`}
                    className="font-semibold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-100 hover:underline inline-flex items-center gap-1"
                  >
                    Open Dashboard &rarr;
                  </Link>
                )}
                <span className="text-sky-300 dark:text-sky-700" aria-hidden="true">&bull;</span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Portal Selection Divider */}
        <div className="w-full max-w-4xl mx-auto flex items-center justify-center gap-3 my-4 sm:my-5 shrink-0">
          <span className="h-px flex-1 max-w-[60px] sm:max-w-[100px] bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 text-center">
            {user && !isLoading
              ? "Select Authorized Portal to Enter"
              : "Select Institutional Portal to Sign In"}
          </span>
          <span className="h-px flex-1 max-w-[60px] sm:max-w-[100px] bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
        </div>

        {/* Portal Selection Cards */}
        <div className="grid gap-4 sm:gap-4 md:gap-5 lg:gap-5 w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {publicPortals.map((roleKey, idx) => {
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

            const staggerClass = STAGGER_CLASSES[idx % STAGGER_CLASSES.length];

            return (
              <Link
                key={roleKey}
                href={cardHref}
                id={`portal-card-${roleKey}`}
                className={`apple-pressable group relative flex flex-col justify-between rounded-2xl border ${theme.cardBorder} ${theme.hoverBorder} ${theme.hoverShadow} bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${theme.focusRing} w-full min-h-[220px] overflow-hidden animate-apple-slide-up ${staggerClass}`}
              >
                {/* Top Subtle Color Accent Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${theme.accentGradient}`}
                  aria-hidden="true"
                />

                <div className="flex-1 flex flex-col pt-1">
                  {/* Card Header: Role Icon & Official Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.iconBg} ${theme.iconText} ${theme.iconHoverBg} ${theme.iconHoverText} transition-colors duration-200 shadow-2xs`}
                    >
                      {roleKey === "student" && (
                        <svg
                          className="h-5 w-5"
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
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      )}
                      {roleKey === "hod" && (
                        <svg
                          className="h-5 w-5"
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
                          className="h-5 w-5"
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
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 text-center ${theme.badgeBorder} ${theme.badgeBg} ${theme.badgeText}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Title & Audience Identification */}
                  <div>
                    <h2
                      className={`text-[16px] sm:text-[17px] font-bold text-slate-900 dark:text-slate-100 ${theme.titleHover} transition-colors leading-snug`}
                    >
                      {cfg.portalName}
                    </h2>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                      {meta.audience}
                    </p>
                  </div>

                  {/* Concise Institutional Description */}
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-h-[36px]">
                    {descriptionText}
                  </p>

                  {/* Key Capabilities Chips */}
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Portal Capabilities">
                    {meta.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[9.5px] font-medium px-2 py-0.5 rounded-md border ${theme.tagBorder} ${theme.tagBg} ${theme.tagText}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action CTA Button */}
                <div
                  className={`mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between min-h-[40px] px-3.5 py-2 rounded-xl ${theme.ctaBg} ${theme.ctaText} ${theme.ctaBorder} ${theme.ctaHoverBg} ${theme.ctaHoverText} ${theme.ctaHoverBorder} border transition-all duration-200 text-xs font-semibold`}
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

            {/* FINEWORKS Tasteful Development Wordmark */}
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

          {/* Lower Footer: Legal, Department Notice & Discreet Admin Entry */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-center sm:text-left text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-1.5 gap-y-0.5">
              <Link
                href="/login/admin"
                className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 rounded"
                title="CCE PGPA Management System"
              >
                CCE PGPA Management System
              </Link>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
              <span>Department of Computer and Communication Engineering</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
              <span className="block sm:inline">Sri Sairam Engineering College (Autonomous)</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Version 1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
