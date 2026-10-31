
import React from "react";
import { UserRole } from "@/types/auth";

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "md";
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = "md" }) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  const config = {
    student: {
      label: "Student",
      classes: "bg-sky-500/15 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40 border-sky-500/30",
      dot: "bg-sky-500 dark:bg-sky-400",
    },
    mentor: {
      label: "Faculty Mentor",
      classes: "bg-purple-500/15 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40 border-purple-500/30",
      dot: "bg-purple-500 dark:bg-purple-400",
    },
    hod: {
      label: "Head of Department",
      classes: "bg-amber-500/15 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 border-amber-500/30",
      dot: "bg-amber-500 dark:bg-amber-400",
    },
    admin: {
      label: "System Administrator",
      classes: "bg-slate-500/15 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700 border-slate-500/30",
      dot: "bg-slate-600 dark:bg-slate-400",
    },
  }[role];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${sizeClasses} ${config.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
