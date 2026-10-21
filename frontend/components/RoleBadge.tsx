
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
      classes: "bg-emerald-500/15 text-emerald-700 dark:bg-[#13261c] dark:text-[#4ade80] dark:border-[#1e3f2f] border-emerald-500/30",
      dot: "bg-emerald-500 dark:bg-[#4ade80]",
    },
    mentor: {
      label: "Faculty Mentor",
      classes: "bg-blue-500/15 text-blue-700 dark:bg-[#162234] dark:text-[#7db0fb] dark:border-[#233754] border-blue-500/30",
      dot: "bg-blue-500 dark:bg-[#4c83e6]",
    },
    admin: {
      label: "System Administrator",
      classes: "bg-amber-500/15 text-amber-700 dark:bg-[#2a2012] dark:text-[#fcd34d] dark:border-[#48341a] border-amber-500/30",
      dot: "bg-amber-500 dark:bg-[#fcd34d]",
    },
    hod: {
      label: "Head of Department",
      classes: "bg-purple-500/15 text-purple-700 dark:bg-[#1f1a2e] dark:text-[#c084fc] dark:border-[#382b52] border-purple-500/30",
      dot: "bg-purple-500 dark:bg-[#c084fc]",
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
