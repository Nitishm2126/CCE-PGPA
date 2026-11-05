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
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#181818] dark:text-[#F5F5F5] dark:border-[#292929]",
    },
    mentor: {
      label: "Mentor",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-[#181818] dark:text-[#F5F5F5] dark:border-[#292929]",
    },
    hod: {
      label: "HOD",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-[#181818] dark:text-[#5DD62C] dark:border-[#292929]",
    },
    admin: {
      label: "Admin",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#181818] dark:text-[#F5F5F5] dark:border-[#292929]",
    },
  };

  const roleMeta = role ? roleLabelMap[role] : null;

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg sm:text-xl",
  };

  const content = (
    <div className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
      {/* Clean CCE Wordmark */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`font-extrabold tracking-tight text-slate-900 dark:text-[#F5F5F5] ${textSizes[size]}`}>
          CCE
        </span>
      </div>

      {/* Role Pill - Compact on mobile */}
      {roleMeta && (
        <span
          className={`hidden xs:inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border shrink-0 ${roleMeta.badgeClass}`}
        >
          {roleMeta.label}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-w-0">
      {href ? (
        <Link href={href} className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
          {content}
        </Link>
      ) : (
        content
      )}
      {showDepartment && (
        <span className="hidden sm:inline-block text-[11px] text-slate-500 dark:text-[#A3A3A3] font-medium tracking-normal mt-0.5 truncate">
          Department of Computer and Communication Engineering (CCE)
        </span>
      )}
    </div>
  );
};

export const AppBrand = FineWorksBrand;

