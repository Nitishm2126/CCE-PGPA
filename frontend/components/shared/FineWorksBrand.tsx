"use client";

import React from "react";
import Link from "next/link";

interface FineWorksBrandProps {
  role?: "student" | "mentor" | "hod" | "admin";
  showDepartment?: boolean;
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

export const FineWorksBrand: React.FC<FineWorksBrandProps> = ({
  role,
  showDepartment = false,
  size = "md",
  href = "/",
  className = "",
}) => {
  const roleLabelMap: Record<string, { label: string; badgeClass: string }> = {
    student: {
      label: "Student",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
    },
    mentor: {
      label: "Mentor",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
    },
    hod: {
      label: "HOD",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
    },
    admin: {
      label: "Admin",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
  };

  const roleMeta = role ? roleLabelMap[role] : null;

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg sm:text-xl",
  };

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Brand Wordmark */}
      <div className="flex items-center gap-1.5">
        <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${textSizes[size]}`}>
          Fine<span className="text-blue-600 dark:text-blue-400">Works</span>
        </span>
        <span className="text-slate-300 dark:text-slate-700 font-light select-none">/</span>
        <span className="font-semibold text-xs sm:text-sm tracking-tight text-slate-700 dark:text-slate-300">
          CCE PGPA
        </span>
      </div>

      {/* Role Pill */}
      {roleMeta && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${roleMeta.badgeClass}`}
        >
          {roleMeta.label}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {href ? (
        <Link href={href} className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
          {content}
        </Link>
      ) : (
        content
      )}
      {showDepartment && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tracking-normal mt-0.5">
          Department of Computer and Communication Engineering (CCE)
        </span>
      )}
    </div>
  );
};

