
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
      classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    mentor: {
      label: "Faculty Mentor",
      classes: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
      dot: "bg-indigo-500",
    },
    admin: {
      label: "System Administrator",
      classes: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      dot: "bg-amber-500",
    },
    hod: {
      label: "Head of Department",
      classes: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
      dot: "bg-purple-500",
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
