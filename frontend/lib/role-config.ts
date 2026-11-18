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
    placeholder: "Enter your college email",
    description:
      "Submit academic activities, upload evidence and track PGPA progress.",
    path: "/login/student",
    dashboardPath: "/student",
    ctaText: "Enter Student Portal",
    accentBorder: "border-[#C9D3DC]",
    accentRing: "ring-[#FFB347]/30",
    accentBg: "bg-[#F2F5F7]",
    accentText: "text-[#1E2A33]",
    activeBorder: "border-[#1E2A33]",
    activeBg: "bg-[#F2F5F7]",
    activeIconBg: "bg-white",
    activeIconText: "text-[#1E2A33]",
    hoverBorder: "hover:border-[#FFB347] hover:shadow-2xs",
  },
  mentor: {
    role: "mentor",
    shortTitle: "Faculty Mentor",
    portalName: "Faculty Mentor Portal",
    portalTitle: "Faculty Mentor Login",
    badgeText: "Review & Verification",
    placeholder: "Enter your college email",
    description:
      "Review student submissions, verify evidence and provide feedback.",
    path: "/login/mentor",
    dashboardPath: "/mentor",
    ctaText: "Enter Faculty Portal",
    accentBorder: "border-[#C9D3DC]",
    accentRing: "ring-[#FFB347]/30",
    accentBg: "bg-[#F2F5F7]",
    accentText: "text-[#1E2A33]",
    activeBorder: "border-[#1E2A33]",
    activeBg: "bg-[#F2F5F7]",
    activeIconBg: "bg-white",
    activeIconText: "text-[#1E2A33]",
    hoverBorder: "hover:border-[#FFB347] hover:shadow-2xs",
  },
  hod: {
    role: "hod",
    shortTitle: "Department HOD",
    portalName: "Department HOD Portal",
    portalTitle: "Department Head Login",
    badgeText: "Department Administration",
    placeholder: "Enter your college email",
    description:
      "Monitor department-wide performance, mentor activity and PGPA progress.",
    path: "/login/hod",
    dashboardPath: "/hod",
    ctaText: "Enter HOD Portal",
    accentBorder: "border-[#C9D3DC]",
    accentRing: "ring-[#FFB347]/30",
    accentBg: "bg-[#F2F5F7]",
    accentText: "text-[#1E2A33]",
    activeBorder: "border-[#1E2A33]",
    activeBg: "bg-[#F2F5F7]",
    activeIconBg: "bg-white",
    activeIconText: "text-[#1E2A33]",
    hoverBorder: "hover:border-[#FFB347] hover:shadow-2xs",
  },
  admin: {
    role: "admin",
    shortTitle: "Admin",
    portalName: "Administrator Portal",
    portalTitle: "Administrator Console Login",
    badgeText: "System Administration",
    placeholder: "Enter your college email",
    description:
      "Manage student accounts, mentors, components and system configuration.",
    path: "/login/admin",
    dashboardPath: "/admin",
    ctaText: "Enter Admin Portal",
    accentBorder: "border-[#C9D3DC]",
    accentRing: "ring-[#FFB347]/30",
    accentBg: "bg-[#F2F5F7]",
    accentText: "text-[#1E2A33]",
    activeBorder: "border-[#1E2A33]",
    activeBg: "bg-[#F2F5F7]",
    activeIconBg: "bg-white",
    activeIconText: "text-[#1E2A33]",
    hoverBorder: "hover:border-[#FFB347] hover:shadow-2xs",
  },
};
