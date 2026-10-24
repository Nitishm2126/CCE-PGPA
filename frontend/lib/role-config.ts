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
      "Submit academic activities across PGPA components, upload certificate evidence, and track verification status.",
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
      "Inspect assigned mentee submissions, review certificate evidence via secure proxy, and record verification audit remarks.",
    path: "/login/mentor",
    dashboardPath: "/mentor",
    ctaText: "Enter Faculty Portal",
    accentBorder: "border-indigo-500",
    accentRing: "ring-indigo-500/20",
    accentBg: "bg-indigo-50/60",
    accentText: "text-indigo-700",
    activeBorder: "border-indigo-600",
    activeBg: "bg-indigo-50/80",
    activeIconBg: "bg-indigo-100",
    activeIconText: "text-indigo-700",
    hoverBorder: "hover:border-indigo-500/80 hover:shadow-indigo-500/10",
  },
  hod: {
    role: "hod",
    shortTitle: "Department HOD",
    portalName: "Department Head (HOD)",
    portalTitle: "Department Head Login",
    badgeText: "Department Administration",
    placeholder: "e.g. hod.cce@sairam.edu.in",
    description:
      "Department-wide cohort directory, mentor-student allocation management, QR badge verification, and academic audit.",
    path: "/login/hod",
    dashboardPath: "/hod",
    ctaText: "Enter HOD Portal",
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
  admin: {
    role: "admin",
    shortTitle: "System Admin",
    portalName: "System Administrator",
    portalTitle: "System Administrator Login",
    badgeText: "Governance Console",
    placeholder: "e.g. cce.pgpa@gmail.com",
    description:
      "Technical console, PostgreSQL directory authority, RBAC policy enforcement, and system audit oversight.",
    path: "/login/admin",
    dashboardPath: "/admin",
    ctaText: "Enter Admin Portal",
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
};
