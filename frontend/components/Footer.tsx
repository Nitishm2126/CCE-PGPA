"use client";

import React from "react";
import { usePathname } from "next/navigation";

export const Footer: React.FC = () => {
  const pathname = usePathname();

  // On institutional portal homepage, login pages, student portal, and admin portal, the dedicated official institutional footer + Team FineWorks attribution are displayed
  if (
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/student") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <footer
      className={`mt-auto border-t border-slate-200/80 bg-slate-50/50 dark:border-[#2B3543] dark:bg-[#0F141B] ${
        pathname?.startsWith("/student") ? "hidden md:block" : ""
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Department of Computer and Communication Engineering (CCE)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sri Sairam Engineering College, Chennai &bull; CCE-PGPA Management System
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Designed and Developed by Team FineWorks
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">&bull;</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              PostgreSQL Verified
            </span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span>Version 1.0.0</span>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200/60 dark:border-slate-850 pt-4 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Confidential Academic Evaluation Platform &bull; Closed Cohort Access Only &bull; All activity logged for department audit
          </p>
        </div>
      </div>
    </footer>
  );
};
