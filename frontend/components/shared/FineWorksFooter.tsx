"use client";

import React from "react";
import Link from "next/link";

interface FineWorksFooterProps {
  className?: string;
  enableAdminLoginEntry?: boolean;
}

export const FineWorksFooter: React.FC<FineWorksFooterProps> = ({
  className = "",
  enableAdminLoginEntry = false,
}) => {
  return (
    <footer
      className={`w-full shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 py-4 sm:py-5 px-4 sm:px-6 lg:px-8 transition-colors ${className}`}
    >
      <div className="mx-auto max-w-7xl flex flex-col items-center justify-center text-center space-y-1.5">
        {/* Creative Brand Attribution */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Designed and Developed by
          </span>
          <span className="font-extrabold tracking-tight text-xs text-slate-900 dark:text-white">
            Fine<span className="text-blue-600 dark:text-blue-400">Works</span>
          </span>
        </div>

        {/* Department & Institution Identity */}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Department of Computer and Communication Engineering (CCE) &bull; Sri Sairam Engineering College
        </p>

        {/* Legal & Version Info */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
          {enableAdminLoginEntry ? (
            <Link
              href="/login/admin"
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded cursor-pointer"
              title="CCE-PGPA Management System"
            >
              CCE-PGPA Management System
            </Link>
          ) : (
            <span>CCE-PGPA Management System</span>
          )}
          <span>&bull;</span>
          <span>Version 1.0.0</span>
          <span>&bull;</span>
          <span>All Rights Reserved</span>
        </div>
      </div>
    </footer>
  );
};

