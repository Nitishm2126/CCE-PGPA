"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ROLE_CONFIGS, ALL_ROLES } from "@/lib/role-config";

export function PortalSelection() {
  const { user, logout, isLoading } = useAuth();

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
                Active Session: <strong>{user.full_name}</strong> ({ROLE_CONFIGS[user.role].shortTitle})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/${user.role}`}
                className="font-semibold text-sky-700 hover:text-sky-900 hover:underline inline-flex items-center gap-1"
              >
                Go to {ROLE_CONFIGS[user.role].shortTitle} Dashboard &rarr;
              </Link>
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

      {/* 4. Four Portal Selection Cards */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-8 flex-1 flex flex-col justify-center">
        <div className="text-center mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Select an Institutional Portal to Sign In
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {ALL_ROLES.map((roleKey) => {
            const cfg = ROLE_CONFIGS[roleKey];

            return (
              <Link
                key={roleKey}
                href={cfg.path}
                id={`portal-card-${roleKey}`}
                className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${cfg.hoverBorder}`}
              >
                <div>
                  {/* Top Row: Icon & Tag */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${cfg.activeIconBg} ${cfg.activeIconText} group-hover:scale-105 transition-transform duration-200`}
                    >
                      {roleKey === "student" && (
                        <svg
                          className="h-6 w-6"
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
                          className="h-6 w-6"
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
                          className="h-6 w-6"
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
                          className="h-6 w-6"
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
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.accentBorder} ${cfg.accentBg} ${cfg.accentText}`}
                    >
                      {cfg.badgeText}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {cfg.portalName}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {cfg.description}
                  </p>
                </div>

                {/* Bottom Action CTA */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                  <span>{cfg.ctaText}</span>
                  <span className="transform group-hover:translate-x-1 transition-transform">
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

        {/* Email Verification Link */}
        <div className="mt-3 text-center">
          <Link
            href="/verify-email"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Checking Firebase email verification? Open Verification Portal &rarr;
          </Link>
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
            CCE-PGPA Management System &bull; Version 1.0.0 &bull; All Institutional Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  );
}
