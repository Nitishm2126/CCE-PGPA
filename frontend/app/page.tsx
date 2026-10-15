import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.100),theme(colors.slate.50))] dark:bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.950),theme(colors.slate.950))] opacity-70" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Institutional Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/80 dark:border-indigo-900/60 dark:bg-slate-900/80 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm backdrop-blur-sm mb-6">
            <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Sri Sairam Engineering College &bull; Department of CCE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
            CCE Achieve <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              PGPA Management System
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            A unified, audit-grade evaluation platform for Point-Grade-Performance-Audit (PGPA). Streamlining student achievement submissions, faculty mentor reviews, and departmental accreditation governance.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 active:scale-95 transition-all duration-150"
            >
              Sign In to Portal &rarr;
            </Link>
            <Link
              href="#pillars"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 px-6 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-sm transition-all duration-150"
            >
              Architecture & Governance
            </Link>
          </div>
        </div>
      </section>

      {/* Role Portal Cards */}
      <section className="py-12 bg-white dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Dedicated Role Portals
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Strict server-side role governance ensures each user accesses only authorized functionality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Student Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/80 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-4">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Portal</h3>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Submit academic and extracurricular achievements across standard PGPA components. Upload certificate evidence directly to the secure Drive streaming proxy.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"
                >
                  Student Login &rarr;
                </Link>
              </div>
            </div>

            {/* Mentor Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/80 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-4">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Faculty Mentor Portal</h3>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Inspect assigned student submissions, inspect certificate evidence through the proxied viewer, approve or reject activities with audit remarks, and monitor mentee progress.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1"
                >
                  Faculty Login &rarr;
                </Link>
              </div>
            </div>

            {/* HOD Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/80 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-4">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Department Head (HOD)</h3>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Department-wide cohort directory, mentor-student allocation management, QR badge instant verification, and comprehensive institutional audit trail inspection.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 inline-flex items-center gap-1"
                >
                  HOD Login &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architectural Pillars Section */}
      <section id="pillars" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Enterprise System Design
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Three Architecture Pillars
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Built in accordance with the CCE Achieve Technical Requirements Document (TRD.md)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <div className="h-2 w-8 rounded-full bg-blue-600 mb-4" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                1. PostgreSQL Authority
              </h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                PostgreSQL is the single source of truth for cohort rosters, student academic profiles, PGPA components, and role assignments. Client assertions are never trusted for authorization.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <div className="h-2 w-8 rounded-full bg-indigo-600 mb-4" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                2. Proxied Drive Storage
              </h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Zero binary files are stored in PostgreSQL. Certificate files reside in Google Drive and are accessed only via authenticated backend streaming proxies without exposing private storage URLs.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <div className="h-2 w-8 rounded-full bg-violet-600 mb-4" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                3. Closed Cohort Identity
              </h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Identity is managed through controlled cohort onboarding with Firebase Authentication. Public self-registration is disabled; unrecognized accounts cannot access departmental services.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
