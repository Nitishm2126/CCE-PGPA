import React from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Password Recovery
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            CCE-PGPA Account Recovery Protocol
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900 dark:border-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200 space-y-2">
            <p className="font-semibold text-sm">Institutional Security Protocol</p>
            <p>
              In accordance with Sri Sairam Engineering College IT security guidelines, CCE-PGPA accounts are strictly linked to verified register numbers and official faculty rosters.
            </p>
          </div>

          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">How to reset your password:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Students:</strong> Contact your assigned Faculty Mentor or the CCE Department Office with your Register Number and institutional ID card.
              </li>
              <li>
                <strong>Faculty Mentors:</strong> Contact the Head of Department (HOD) for administrative credential distribution.
              </li>
              <li>
                <strong>Firebase Authentication:</strong> Once self-service email resets are enabled for your cohort, password reset emails will be dispatched directly to your official <code>@sairam.edu.in</code> address.
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              &larr; Back to Portal Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
