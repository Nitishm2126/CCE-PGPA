"use client";

import React from "react";
import Link from "next/link";

interface FineWorksFooterProps {
  className?: string;
  showAdminLink?: boolean;
}

export const FineWorksFooter: React.FC<FineWorksFooterProps> = ({
  className = "",
  showAdminLink = true,
}) => {
  return (
    <footer
      className={`w-full shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 py-6 px-4 sm:px-6 lg:px-8 transition-colors ${className}`}
    >
      <div className="mx-auto max-w-7xl flex flex-col items-center justify-center text-center space-y-2">
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
          <span>CCE-PGPA Management System</span>
          <span>&bull;</span>
          <span>Version 1.0.0</span>
          <span>&bull;</span>
          <span>All Rights Reserved</span>
          {showAdminLink && (
            <>
              <span>&bull;</span>
              <Link
                href="/login/admin"
                className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline-offset-2 hover:underline"
                title="System Administrator Login"
              >
                Admin
              </Link>
            </>
          )}
        </div>
      </div>
    </footer>
  );
};

