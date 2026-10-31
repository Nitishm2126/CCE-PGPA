import { UserRole } from "@/types/auth";

export interface RoleConfig {
  role: UserRole;
  shortTitle: string;
  portalName: string;
  portalTitle: string;
  badgeText: string;
  placeholder: string;
  description: string;
  path: string;
  dashboardPath: string;
  ctaText: string;
  accentBorder: string;
  accentRing: string;
  accentBg: string;
  accentText: string;
  activeBorder: string;
  activeBg: string;
  activeIconBg: string;
  activeIconText: string;
  hoverBorder: string;
}

export const ALL_ROLES: UserRole[] = ["student", "mentor", "hod", "admin"];

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  student: {
    role: "student",
    shortTitle: "Student",
    portalName: "Student Portal",
    portalTitle: "Student Portal Login",
    badgeText: "2025-2029 Students",
    placeholder: "e.g. sec25co001@sairamtap.edu.in",
    description:
      "Submit academic activities, upload evidence and track PGPA progress.",
    path: "/login/student",
    dashboardPath: "/student",
    ctaText: "Enter Student Portal",
    accentBorder: "border-sky-500",
    accentRing: "ring-sky-500/20",
    accentBg: "bg-sky-50/60",
    accentText: "text-sky-700",
    activeBorder: "border-sky-600",
    activeBg: "bg-sky-50/80",
    activeIconBg: "bg-sky-100",
    activeIconText: "text-sky-700",
    hoverBorder: "hover:border-sky-500/80 hover:shadow-sky-500/10",
  },
  mentor: {
    role: "mentor",
    shortTitle: "Faculty Mentor",
    portalName: "Faculty Mentor Portal",
    portalTitle: "Faculty Mentor Login",
    badgeText: "Review & Verification",
    placeholder: "e.g. mentor.cce@sairam.edu.in",
    description:
      "Review student submissions, verify evidence and provide feedback.",
    path: "/login/mentor",
    dashboardPath: "/mentor",
    ctaText: "Enter Faculty Portal",
    accentBorder: "border-purple-500",
    accentRing: "ring-purple-500/20",
    accentBg: "bg-purple-50/60",
    accentText: "text-purple-700",
    activeBorder: "border-purple-600",
    activeBg: "bg-purple-50/80",
    activeIconBg: "bg-purple-100",
    activeIconText: "text-purple-700",
    hoverBorder: "hover:border-purple-500/80 hover:shadow-purple-500/10",
  },
  hod: {
    role: "hod",
    shortTitle: "Department HOD",
    portalName: "Department HOD Portal",
    portalTitle: "Department Head Login",
    badgeText: "Department Administration",
    placeholder: "e.g. hod.cce@sairam.edu.in",
    description:
      "Monitor department-wide performance, mentor activity and PGPA progress.",
    path: "/login/hod",
    dashboardPath: "/hod",
    ctaText: "Enter HOD Portal",
    accentBorder: "border-amber-500",
    accentRing: "ring-amber-500/20",
    accentBg: "bg-amber-50/60",
    accentText: "text-amber-700",
    activeBorder: "border-amber-600",
    activeBg: "bg-amber-50/80",
    activeIconBg: "bg-amber-100",
    activeIconText: "text-amber-700",
    hoverBorder: "hover:border-amber-500/80 hover:shadow-amber-500/10",
  },
  admin: {
    role: "admin",
    shortTitle: "Admin",
    portalName: "Administrator Portal",
    portalTitle: "Administrator Console Login",
    badgeText: "System Administration",
    placeholder: "e.g. cce.pgpa@gmail.com",
    description:
      "Manage student accounts, mentors, components and system configuration.",
    path: "/login/admin",
    dashboardPath: "/admin",
    ctaText: "Enter Admin Portal",
    accentBorder: "border-slate-700",
    accentRing: "ring-slate-500/20",
    accentBg: "bg-slate-100/60",
    accentText: "text-slate-800",
    activeBorder: "border-slate-800",
    activeBg: "bg-slate-100/80",
    activeIconBg: "bg-slate-200",
    activeIconText: "text-slate-800",
    hoverBorder: "hover:border-slate-600 hover:shadow-slate-500/10",
  },
};
