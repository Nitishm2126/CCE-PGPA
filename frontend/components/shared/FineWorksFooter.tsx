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
      className={`w-full shrink-0 border-t border-slate-200/80 dark:border-[#292929] bg-white/50 dark:bg-[#0A0A0A] py-4 sm:py-5 px-4 sm:px-6 lg:px-8 transition-colors ${className}`}
    >
      <div className="mx-auto max-w-7xl flex flex-col items-center justify-center text-center space-y-1.5">
        {/* Creative Brand Attribution */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-[#F5F5F5]">
            Designed and Developed by
          </span>
          <a
            href="https://fineworks-hub.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold tracking-tight text-xs hover:underline inline-flex items-center"
            title="FineWorks"
          >
            <span className="text-black dark:text-black">Fine</span><span className="text-[#FFB347] dark:text-[#5DD62C]">Works</span>
          </a>
        </div>

        {/* Department & Institution Identity */}
        <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">
          Department of Computer and Communication Engineering (CCE) &bull; Sri Sairam Engineering College
        </p>

        {/* Legal & Version Info */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-slate-400 dark:text-[#737373] pt-0.5">
          {enableAdminLoginEntry ? (
            <Link
              href="/login/admin"
              className="text-slate-400 dark:text-[#737373] hover:text-slate-600 dark:hover:text-[#F5F5F5] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded cursor-pointer"
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

