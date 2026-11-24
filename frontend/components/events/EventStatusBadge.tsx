"use client";

import React from "react";
import { EventStatus, EventMode } from "@/types/events";

interface EventStatusBadgeProps {
  status: EventStatus;
  size?: "sm" | "md";
}

export const EventStatusBadge: React.FC<EventStatusBadgeProps> = ({ status, size = "md" }) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  switch (status) {
    case "published":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ${sizeClasses}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Published
        </span>
      );
    case "closed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 ${sizeClasses}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Closed
        </span>
      );
    case "archived":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ${sizeClasses}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Archived
        </span>
      );
    case "draft":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ${sizeClasses}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Draft
        </span>
      );
  }
};

export const EventModeBadge: React.FC<{ mode: EventMode }> = ({ mode }) => {
  const modeColors: Record<EventMode, string> = {
    Offline: "border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
    Online: "border-purple-200 dark:border-purple-900/60 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
    Hybrid: "border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-lg border ${modeColors[mode] || modeColors.Offline}`}
    >
      {mode}
    </span>
  );
};
