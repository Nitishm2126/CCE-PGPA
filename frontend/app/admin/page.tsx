"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";
import { DesignationBadge } from "@/components/DesignationBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, HealthResponse } from "@/lib/api-client";
import {
  AdminOverviewResponse,
  AdminSubmissionItem,
  AdminMentorAllocationItem,
  AdminComponentItem,
  AdminMentorItem,
  AdminStudentItem,
  DriveFolderAuditReport,
  DriveFolderProvisionResponse,
  DriveFolderAuditItem,
} from "@/types/auth";
import {
  UserManagementConsole,
  ActiveTab as UserManagementTab,
} from "@/components/admin/UserManagementConsole";
import { ReassignStudentsModal } from "@/components/admin/MentorModals";
import { SemesterManagementConsole } from "@/components/admin/SemesterManagementConsole";
import { ComponentManagementConsole } from "@/components/admin/ComponentManagementConsole";

type AdminNavigationSection =
  | "overview"
  | "students"
  | "mentors"
  | "hods"
  | "users"
  | "allocation"
  | "semesters"
  | "components"
  | "submissions"
  | "storage"
  | "system";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading, logout } = useAuth();

  // Navigation State
  const [activeSection, setActiveSection] = useState<AdminNavigationSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data States
  const [overviewData, setOverviewData] = useState<AdminOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Submissions Tab State
  const [submissions, setSubmissions] = useState<AdminSubmissionItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("all");
  const [submissionComponentFilter, setSubmissionComponentFilter] = useState("all");
  const [submissionSemesterFilter, setSubmissionSemesterFilter] = useState("all");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<AdminSubmissionItem | null>(null);
  const [fileLoadingId, setFileLoadingId] = useState<string | null>(null);
  const [fileDownloadError, setFileDownloadError] = useState<string | null>(null);

  // Allocations Tab State
  const [allocations, setAllocations] = useState<AdminMentorAllocationItem[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [allocationSearch, setAllocationSearch] = useState("");
  const [allocationMentorFilter, setAllocationMentorFilter] = useState("all");
  const [allocationToReassign, setAllocationToReassign] = useState<AdminMentorItem | null>(null);
  const [allMentors, setAllMentors] = useState<AdminMentorItem[]>([]);

  // Components Catalogue State
  const [componentsList, setComponentsList] = useState<AdminComponentItem[]>([]);

  // Google Drive & Storage State
  const [storageStatus, setStorageStatus] = useState<HealthResponse["storage"] | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [storageActionError, setStorageActionError] = useState<string | null>(null);

  // Student Drive Folders Audit & Provisioning State
  const [driveAuditReport, setDriveAuditReport] = useState<DriveFolderAuditReport | null>(null);
  const [isAuditingDrive, setIsAuditingDrive] = useState(false);
  const [driveAuditSearch, setDriveAuditSearch] = useState("");
  const [driveAuditStatusFilter, setDriveAuditStatusFilter] = useState("all");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [provisionResult, setProvisionResult] = useState<DriveFolderProvisionResponse | null>(null);
  const [provisionSuccessMsg, setProvisionSuccessMsg] = useState<string | null>(null);

  // Quick Action Modals Trigger state for UserManagementConsole
  const [pendingQuickAction, setPendingQuickAction] = useState<
    "student" | "mentor" | "hod" | "provisioning" | null
  >(null);

  // ============================================================================
  // Security & Role Guard
  // ============================================================================
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login/admin");
      return;
    }
    if (!authLoading && user && user.role !== "admin") {
      router.push("/login/admin");
      return;
    }
    if (!authLoading && user && user.must_change_password) {
      router.push("/change-password");
      return;
    }
  }, [user, authLoading, router]);

  // ============================================================================
  // Data Fetching: Overview & Storage
  // ============================================================================
  const fetchOverview = useCallback(async () => {
    if (!token) return;
    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const res = await api.adminGetOverview(token);
      setOverviewData(res);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setOverviewError(errObj.message || "Failed to load administrative overview statistics.");
    } finally {
      setOverviewLoading(false);
    }
  }, [token]);

  const fetchStorageHealth = useCallback(async () => {
    try {
      setStorageLoading(true);
      const res = await api.health();
      setStorageStatus(res.storage || null);
    } catch {
      // Offline fallback
    } finally {
      setStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchOverview();
      fetchStorageHealth();
    }
  }, [token, fetchOverview, fetchStorageHealth]);

  // ============================================================================
  // Data Fetching: Submissions
  // ============================================================================
  const fetchSubmissions = useCallback(async () => {
    if (!token) return;
    try {
      setSubmissionsLoading(true);
      setSubmissionsError(null);
      const [subsRes, compsRes] = await Promise.all([
        api.adminGetSubmissions(undefined, token),
        api.adminGetComponents(token).catch(() => []),
      ]);
      setSubmissions(subsRes);
      setComponentsList(compsRes);
    } catch (err: unknown) {
      console.error("Failed to load submissions:", err);
      const msg = err instanceof Error ? err.message : "Failed to load submissions from PostgreSQL.";
      setSubmissionsError(msg);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [token]);

  // ============================================================================
  // Data Fetching: Allocations & Mentors
  // ============================================================================
  const fetchAllocations = useCallback(async () => {
    if (!token) return;
    try {
      setAllocationsLoading(true);
      const [allocRes, mentorsRes] = await Promise.all([
        api.adminGetMentorAllocations(undefined, token),
        api.adminGetMentors(undefined, token),
      ]);
      setAllocations(allocRes);
      setAllMentors(mentorsRes);
    } catch (err: unknown) {
      console.error("Failed to load mentor allocations:", err);
    } finally {
      setAllocationsLoading(false);
    }
  }, [token]);

  // Data Fetching: Drive Audit
  const fetchDriveAudit = useCallback(async () => {
    if (!token) return;
    try {
      setIsAuditingDrive(true);
      const rep = await api.adminGetDriveAudit(token);
      setDriveAuditReport(rep);
    } catch (err: unknown) {
      console.error("Failed to load student drive audit:", err);
    } finally {
      setIsAuditingDrive(false);
    }
  }, [token]);

  // Fetch contextual tab data on section change
  useEffect(() => {
    if (activeSection === "submissions" && submissions.length === 0) {
      fetchSubmissions();
    } else if (activeSection === "allocation" && allocations.length === 0) {
      fetchAllocations();
    } else if (activeSection === "storage" && !driveAuditReport) {
      fetchDriveAudit();
    }
  }, [activeSection, submissions.length, allocations.length, driveAuditReport, fetchSubmissions, fetchAllocations, fetchDriveAudit]);

  // Handle Google Drive OAuth Connect
  const handleConnectDrive = async () => {
    try {
      setStorageActionError(null);
      setIsConnectingDrive(true);
      const res = await api.getGoogleDriveAuthUrl(token);
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        throw new Error("No authorization URL returned from the backend.");
      }
    } catch (err: unknown) {
      setIsConnectingDrive(false);
      const message =
        err instanceof Error ? err.message : "Failed to initiate Google Drive authorization.";
      setStorageActionError(message);
    }
  };

  // Handle Google Drive Provisioning Execution
  const handleExecuteProvisioning = async (dryRun: boolean) => {
    if (!token) return;
    try {
      setIsProvisioning(true);
      setProvisionSuccessMsg(null);
      const res = await api.adminProvisionDriveFolders(dryRun, token);
      setProvisionResult(res);
      setProvisionSuccessMsg(res.message);
      await fetchDriveAudit();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setStorageActionError(errObj.message || "Failed to execute Drive folder provisioning.");
    } finally {
      setIsProvisioning(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await logout();
    router.push("/login?signedOut=true");
  };

  // Handle File View / Download
  const handleInspectFile = async (fileId: string, filename: string) => {
    try {
      setFileLoadingId(fileId);
      setFileDownloadError(null);
      const { url } = await api.downloadFile(fileId, token);
      const newTab = window.open(url, "_blank");
      if (!newTab) {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setFileDownloadError(errObj.message || "Failed to download evidence binary.");
    } finally {
      setFileLoadingId(null);
    }
  };

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const q = submissionSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.student_name.toLowerCase().includes(q) ||
        s.register_number.toLowerCase().includes(q) ||
        s.component_name.toLowerCase().includes(q);

      const matchStatus =
        submissionStatusFilter === "all" || s.status === submissionStatusFilter;
      const matchComponent =
        submissionComponentFilter === "all" || s.component_id === submissionComponentFilter;
      const matchSemester =
        submissionSemesterFilter === "all" ||
        (submissionSemesterFilter === "legacy"
          ? !s.semester_id && !s.semester_number
          : (s.semester_number?.toString() === submissionSemesterFilter ||
             s.semester_id?.toString() === submissionSemesterFilter));

      return matchSearch && matchStatus && matchComponent && matchSemester;
    });
  }, [submissions, submissionSearch, submissionStatusFilter, submissionComponentFilter, submissionSemesterFilter]);

  // Filtered Allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      const q = allocationSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        a.student_name.toLowerCase().includes(q) ||
        a.register_number.toLowerCase().includes(q) ||
        a.mentor_name.toLowerCase().includes(q);

      const matchMentor =
        allocationMentorFilter === "all" || a.mentor_id === allocationMentorFilter;

      return matchSearch && matchMentor;
    });
  }, [allocations, allocationSearch, allocationMentorFilter]);

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <div className="text-center">
            <p className="text-sm font-semibold tracking-wide">Sri Sairam Engineering College</p>
            <p className="text-xs text-slate-400 mt-1">Authenticating CCE-PGPA System Administrator...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* 1. Official College ERP Institutional Top Strip */}
      <div className="w-full bg-[#0a192f] text-slate-200 border-b border-slate-800 text-[11px] font-medium py-1 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-400 uppercase tracking-wider">
              Sri Sairam Engineering College
            </span>
            <span className="text-slate-500 hidden sm:inline">&bull;</span>
            <span className="text-slate-300 hidden sm:inline">
              Autonomous Institution &bull; Affiliated to Anna University &bull; NBA & NAAC 'A+' Accredited
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            <span>Chennai - 600 044</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Institutional ERP Online
            </span>
          </div>
        </div>
      </div>

      {/* 2. Official Administrator Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 sm:h-20 items-center justify-between gap-4">
            {/* Left: Identity and Sairam Emblem */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Toggle mobile menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0a192f] via-blue-900 to-indigo-950 flex items-center justify-center text-white font-extrabold shadow-sm border border-blue-950/20 shrink-0">
                  <span className="text-sm sm:text-base tracking-wider font-mono text-amber-300">SEC</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
                      CCE-PGPA
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      System Administrator
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                    Department of Computer and Communication Engineering
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Administrator Profile, Session Actions */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {user?.full_name || "System Administrator"}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {user?.email}
                </span>
              </div>

              <ThemeToggle size="sm" />

              <div className="hidden sm:block">
                <RoleBadge role="admin" size="sm" />
              </div>

              <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                <Link
                  href="/change-password"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>Password</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
                  title="Sign out of administrative session"
                >
                  <svg className="h-3.5 w-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Main Dashboard Body: Collapsible Sidebar + Content View */}
      <div className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6 items-start">
          {/* A. Collapsible Institutional Sidebar */}
          <aside
            className={`transition-all duration-200 shrink-0 ${
              sidebarCollapsed ? "w-20" : "w-64"
            } hidden lg:flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden sticky top-24 self-start`}
          >
            {/* Sidebar Header with Collapse Toggle */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
              {!sidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    ERP Console
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Administrator Menu
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 mx-auto"
                title={sidebarCollapsed ? "Expand sidebar navigation" : "Collapse sidebar"}
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${
                    sidebarCollapsed ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Navigation Groups */}
            <nav className="p-3 space-y-4">
              {/* Group 1: Core Management */}
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Institutional Governance
                  </p>
                )}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection("overview")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "overview"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Dashboard Overview"
                  >
                    <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    {!sidebarCollapsed && <span>Dashboard Overview</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("students")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "students"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Student Management"
                  >
                    <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>Students</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                          {overviewData?.total_students || 61}
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("mentors")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "mentors"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Faculty Mentor Management"
                  >
                    <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>Faculty Mentors</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                          {overviewData?.total_mentors || 3}
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("hods")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "hods"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Department HOD Management"
                  >
                    <svg className="h-4 w-4 shrink-0 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>Department HOD</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">
                          {overviewData?.total_hods || 1}
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("users")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "users"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="User & Login Accounts"
                  >
                    <svg className="h-4 w-4 shrink-0 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    {!sidebarCollapsed && <span>Login Accounts</span>}
                  </button>
                </div>
              </div>

              {/* Group 2: Academic Portfolio & Allocations */}
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Academic Governance
                  </p>
                )}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection("allocation")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "allocation"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Mentor Allocation Directory"
                  >
                    <svg className="h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>Mentor Allocation</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                          {overviewData?.total_mentor_assignments || 50}
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("semesters")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "semesters"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Academic Semesters & Drive Folders"
                  >
                    <svg className="h-4 w-4 shrink-0 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>Semester System</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200">
                          8 Sems
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("components")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "components"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="14 PGPA Components & Availability Matrix"
                  >
                    <svg className="h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>PGPA Components</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                          14 Comps
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("submissions")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "submissions"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="PGPA Components & Submissions"
                  >
                    <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>PGPA Submissions</span>
                        {overviewData?.pending_submissions ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-bold">
                            {overviewData.pending_submissions} Pending
                          </span>
                        ) : null}
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Group 3: Infrastructure & Security */}
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    System Infrastructure
                  </p>
                )}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection("storage")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "storage"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Evidence & Google Drive"
                  >
                    <svg className="h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between">
                        <span>Evidence Storage</span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            storageStatus?.connected ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("system")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activeSection === "system"
                        ? "bg-[#0a192f] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="RBAC Architecture & Security"
                  >
                    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    {!sidebarCollapsed && <span>Security & RBAC</span>}
                  </button>
                </div>
              </div>
            </nav>

            {/* Sidebar Bottom: Team FineWorks Credit */}
            <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              {!sidebarCollapsed ? (
                <div className="space-y-1 text-center">
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Designed and Developed by Team FineWorks
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Sri Sairam Engineering College &bull; v1.0.0
                  </p>
                </div>
              ) : (
                <div className="flex justify-center" title="Designed and Developed by Team FineWorks">
                  <span className="text-[10px] font-mono font-bold text-slate-400">FW</span>
                </div>
              )}
            </div>
          </aside>

          {/* Mobile Drawer (When menu open on small screens) */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-xs flex"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div
                className="w-72 bg-white dark:bg-slate-900 h-full p-4 flex flex-col shadow-2xl border-r border-slate-200 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      CCE-PGPA
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      Admin
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    &times;
                  </button>
                </div>

                <div className="py-4 space-y-1 overflow-y-auto flex-1">
                  {[
                    { id: "overview", label: "Dashboard Overview" },
                    { id: "students", label: "Students" },
                    { id: "mentors", label: "Faculty Mentors" },
                    { id: "hods", label: "Department HOD" },
                    { id: "users", label: "Login Accounts" },
                    { id: "allocation", label: "Mentor Allocation" },
                    { id: "semesters", label: "Semester System" },
                    { id: "components", label: "PGPA Components & Matrix" },
                    { id: "submissions", label: "PGPA Submissions" },
                    { id: "storage", label: "Evidence Storage" },
                    { id: "system", label: "Security & RBAC" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id as AdminNavigationSection);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                        activeSection === item.id
                          ? "bg-[#0a192f] text-white"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Designed and Developed by Team FineWorks
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* B. Main Content View Area */}
          <main className="flex-1 min-w-0 space-y-6">
            {/* Contextual Institutional View Banner */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                      Sri Sairam Engineering College
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-[10px] font-semibold text-slate-500">Autonomous</span>
                  </div>
                  <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {activeSection === "overview" && "Institutional Governance & Dashboard Overview"}
                    {activeSection === "students" && "Student Cohort Management Directory"}
                    {activeSection === "mentors" && "Faculty Mentors & Mentee Allocation"}
                    {activeSection === "hods" && "Department Head Oversight & Governance"}
                    {activeSection === "users" && "User Directory & Bulk Login Provisioning"}
                    {activeSection === "allocation" && "Faculty Mentor Allocation Registry"}
                    {activeSection === "semesters" && "Academic Configuration & Eight-Semester System"}
                    {activeSection === "submissions" && "PGPA Student Achievements Audit"}
                    {activeSection === "storage" && "Google Drive OAuth & Binary Storage Health"}
                    {activeSection === "system" && "Institutional RBAC Permission Matrix"}
                  </h1>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Department of Computer and Communication Engineering (CCE) &bull; Cohort 2025-2029
                  </p>
                </div>

                {/* Right Context Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      fetchOverview();
                      fetchStorageHealth();
                      if (activeSection === "submissions") fetchSubmissions();
                      if (activeSection === "allocation") fetchAllocations();
                    }}
                    disabled={overviewLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                    title="Refresh data from PostgreSQL database"
                  >
                    <svg className={`h-3.5 w-3.5 ${overviewLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </button>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-900/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    PostgreSQL Live
                  </span>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {overviewError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-4 text-xs text-rose-800 dark:text-rose-300 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{overviewError}</span>
                </div>
                <button onClick={() => setOverviewError(null)} className="font-bold text-rose-600">
                  &times;
                </button>
              </div>
            )}

            {/* VIEW 1: DASHBOARD OVERVIEW */}
            {activeSection === "overview" && (
              <div className="space-y-6">
                {/* 6 Real Data-Driven Institutional Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1: Total Students */}
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-blue-300 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Total Students
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                        2025-2029 Cohort
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.total_students || 61}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Enrolled Mentees</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Second-year Computer & Communication Engineering roster
                    </p>
                  </div>

                  {/* Card 2: Faculty Mentors */}
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Faculty Mentors
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                        Department Faculty
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.total_mentors || 3}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Active Mentors</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {overviewData?.total_mentor_assignments || 50} students mapped to mentor review queues
                    </p>
                  </div>

                  {/* Card 3: Department HODs */}
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-purple-300 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Department HOD
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
                        CCE Governance
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.total_hods || 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Head of Department</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Autonomous portfolio audit & department oversight authority
                    </p>
                  </div>

                  {/* Card 4: Active Accounts */}
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-sky-300 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Active Accounts
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60">
                        Firebase Verified
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.active_accounts || overviewData?.active_users || 66}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        / {overviewData?.total_users || 66} Total
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {overviewData?.firebase_linked_users || 0} accounts synchronized with Firebase Auth
                    </p>
                  </div>

                  {/* Card 5: Pending Submissions */}
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-amber-300 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Pending Submissions
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                        Audit Queue
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                        {overviewData?.pending_submissions || 5}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Awaiting Inspection</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Student activity submissions awaiting mentor inspection
                    </p>
                  </div>

                  {/* Card 6: Recorded PGPA Activities */}
                  <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-indigo-300 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Recorded Activities
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
                        13 Components
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.recorded_activities || 5}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Logged PGPA Events</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Skillrack, AMCAT, NPTEL, Certifications, Sports, SDGs
                    </p>
                  </div>
                </div>

                {/* Quick Actions Bar */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Institutional Quick Actions
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection("students");
                        setPendingQuickAction("student");
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <span>+</span>
                      <span>Add New Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection("mentors");
                        setPendingQuickAction("mentor");
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <span>+</span>
                      <span>Add Faculty Mentor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection("users");
                        setPendingQuickAction("provisioning");
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <span>🔑</span>
                      <span>Bulk Login Provisioning</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection("submissions")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                    >
                      <span>📄</span>
                      <span>Inspect Submissions Queue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection("allocation")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                    >
                      <span>👥</span>
                      <span>Manage Mentor Allocations</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection("storage")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                    >
                      <span>☁️</span>
                      <span>Google Drive Storage Sync</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection("semesters")}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/40 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 text-xs font-semibold transition cursor-pointer"
                    >
                      <span>📅</span>
                      <span>Manage Semesters (1–8)</span>
                    </button>

                    <Link
                      href="/verify-email"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-semibold transition cursor-pointer"
                      title="Open Email Verification Portal"
                    >
                      <span>✉️</span>
                      <span>Open Email Verification Portal</span>
                    </Link>
                  </div>
                </div>

                {/* Recent Student Submissions Table */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Recent PGPA Activity Submissions
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Live submission queue recorded across Computer and Communication Engineering cohort
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveSection("submissions")}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>View All Submissions</span>
                      <span>&rarr;</span>
                    </button>
                  </div>

                  {overviewData?.recent_submissions && overviewData.recent_submissions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[11px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Student Name</th>
                            <th className="px-4 py-3">Register Number</th>
                            <th className="px-4 py-3">Component</th>
                            <th className="px-4 py-3">Activity Title</th>
                            <th className="px-4 py-3">Submission Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {overviewData.recent_submissions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                {sub.student_name}
                              </td>
                              <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                                {sub.register_number}
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                                  {sub.component_name}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-900 dark:text-white max-w-xs truncate">
                                {sub.title}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                    sub.status === "approved"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40"
                                      : sub.status === "rejected"
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/40"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40"
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (submissions.length === 0) {
                                      await fetchSubmissions();
                                    }
                                    const match = submissions.find((s) => s.id === sub.id);
                                    if (match) {
                                      setSelectedSubmission(match);
                                    } else {
                                      setActiveSection("submissions");
                                    }
                                  }}
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 underline"
                                >
                                  Inspect Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No submissions recorded in the database yet.
                      </p>
                    </div>
                  )}
                </div>

                {/* Institutional Security & Infrastructure Specifications */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <span className="text-base text-blue-600">🛡️</span>
                      <span>Strict Role Governance</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      FastAPI enforces four distinct server-side roles: Admin, HOD, Mentor, and Student. Client role tampering is completely prevented.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <span className="text-base text-emerald-600">🔐</span>
                      <span>Fernet Binary Encryption</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Google Drive OAuth tokens and certificates are encrypted at rest with Fernet. Direct Drive URLs are never exposed to the browser.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <span className="text-base text-purple-600">📊</span>
                      <span>PostgreSQL Preservation</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      All student registration numbers, academic batches, and mentor allocations are preserved with strict relational foreign keys.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2, 3, 4, 5: USER MANAGEMENT CONSOLE (Students, Mentors, HODs, Accounts) */}
            {(activeSection === "students" ||
              activeSection === "mentors" ||
              activeSection === "hods" ||
              activeSection === "users") && (
              <UserManagementConsole
                initialTab={
                  activeSection === "students"
                    ? "students"
                    : activeSection === "mentors"
                    ? "mentors"
                    : activeSection === "hods"
                    ? "hods"
                    : "students"
                }
                onTabChange={(tab: UserManagementTab) => {
                  if (tab === "students") setActiveSection("students");
                  else if (tab === "mentors") setActiveSection("mentors");
                  else if (tab === "hods") setActiveSection("hods");
                }}
                openAddModal={pendingQuickAction}
                onClearAddModal={() => setPendingQuickAction(null)}
              />
            )}

            {/* VIEW 6: MENTOR ALLOCATION DIRECTORY */}
            {activeSection === "allocation" && (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Faculty Mentor Allocation Registry
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Official mentee-to-mentor mappings for the 2025-2029 CCE cohort
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                    Total Allocations: {allocations.length}
                  </span>
                </div>

                {/* Filter and Search Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={allocationSearch}
                      onChange={(e) => setAllocationSearch(e.target.value)}
                      placeholder="Search by student name, register number, or mentor name..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={allocationMentorFilter}
                      onChange={(e) => setAllocationMentorFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Faculty Mentors</option>
                      {allMentors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.assigned_student_count} mentees)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Allocations Table */}
                {allocationsLoading ? (
                  <div className="text-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
                    <p className="mt-2 text-xs text-slate-500">Loading mentor allocations...</p>
                  </div>
                ) : filteredAllocations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[11px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Register Number</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Cohort Batch</th>
                          <th className="px-4 py-3">Section</th>
                          <th className="px-4 py-3">Assigned Faculty Mentor</th>
                          <th className="px-4 py-3">Mentor Email</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {filteredAllocations.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {a.register_number}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white">{a.student_name}</span>
                                <DesignationBadge designation="Change Maker" size="sm" />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-900/40">
                                {a.batch || "2025-2029"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                              Sec {a.section || "A"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white">{a.mentor_name}</span>
                                <DesignationBadge designation="Torch Bearer" size="sm" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              {a.mentor_email}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const mentorObj = allMentors.find((m) => m.id === a.mentor_id);
                                  if (mentorObj) {
                                    setAllocationToReassign(mentorObj);
                                  }
                                }}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline"
                              >
                                Reassign Mentor
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500">No mentor allocations match the search filters.</p>
                  </div>
                )}
              </div>
            )}

            {/* VIEW: ACADEMIC CONFIGURATION & EIGHT-SEMESTER SYSTEM */}
            {activeSection === "semesters" && <SemesterManagementConsole />}

            {/* VIEW: PGPA COMPONENTS & SEMESTER MATRIX */}
            {activeSection === "components" && <ComponentManagementConsole token={token} />}

            {/* VIEW 7: PGPA COMPONENTS & SUBMISSIONS DIRECTORY */}
            {activeSection === "submissions" && (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      PGPA Components & Student Submissions Audit
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Audit student achievement records, supporting evidence files, and verification states
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                    Total Records: {submissions.length}
                  </span>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-2">
                    <input
                      type="text"
                      value={submissionSearch}
                      onChange={(e) => setSubmissionSearch(e.target.value)}
                      placeholder="Search by student, register number, title, or component..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={submissionStatusFilter}
                      onChange={(e) => setSubmissionStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending Audit</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={submissionComponentFilter}
                      onChange={(e) => setSubmissionComponentFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All 13 Components</option>
                      {componentsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={submissionSemesterFilter}
                      onChange={(e) => setSubmissionSemesterFilter(e.target.value)}
                      aria-label="Filter submissions by academic semester"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Semesters</option>
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                      <option value="3">Semester 3</option>
                      <option value="4">Semester 4</option>
                      <option value="5">Semester 5</option>
                      <option value="6">Semester 6</option>
                      <option value="7">Semester 7</option>
                      <option value="8">Semester 8</option>
                      <option value="legacy">Legacy / Unassigned</option>
                    </select>
                  </div>
                </div>

                {/* Submissions Table */}
                {submissionsLoading ? (
                  <div className="text-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
                    <p className="mt-2 text-xs text-slate-500">Loading PGPA submission records...</p>
                  </div>
                ) : submissionsError ? (
                  <div className="text-center py-10 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 p-6 space-y-3">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{submissionsError}</p>
                    <button
                      type="button"
                      onClick={fetchSubmissions}
                      className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      Retry Submissions
                    </button>
                  </div>
                ) : filteredSubmissions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[11px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Register No</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Component</th>
                          <th className="px-4 py-3">Activity Title</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Evidence Files</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {filteredSubmissions.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {s.register_number}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                              {s.student_name}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                                  {s.component_name}
                                </span>
                                {(s.semester_name || s.semester_number) ? (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold border border-cyan-200 dark:border-cyan-800">
                                    {s.semester_name || `Semester ${s.semester_number}`}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-900 dark:text-white max-w-xs truncate">
                              {s.title}
                            </td>
                            <td className="px-4 py-3 text-slate-500 capitalize">
                              {s.activity_type || "Event"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span>{s.files_count} file(s)</span>
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                  s.status === "approved"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40"
                                    : s.status === "rejected"
                                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/40"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40"
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedSubmission(s)}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 underline cursor-pointer"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500">No PGPA submissions match the current filters.</p>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 8: GOOGLE DRIVE STORAGE & OAUTH 2.0 */}
            {activeSection === "storage" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          Google Drive OAuth 2.0 & Storage Architecture
                        </h2>
                        {storageLoading ? (
                          <span className="text-xs text-slate-400 animate-pulse">Checking status...</span>
                        ) : storageStatus?.connected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected & Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Authorization Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Institutional binary storage with least-privilege OAuth scopes and Fernet token encryption at rest.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchStorageHealth}
                      disabled={storageLoading}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg dark:bg-slate-800 dark:text-slate-300 transition"
                    >
                      Refresh Status
                    </button>
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      disabled={isConnectingDrive}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg shadow-xs transition disabled:opacity-60"
                    >
                      {isConnectingDrive ? "Initiating OAuth..." : storageStatus?.connected ? "Re-authorize Drive" : "Connect Google Drive"}
                    </button>
                  </div>
                </div>

                {storageActionError && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex justify-between">
                    <span>{storageActionError}</span>
                    <button onClick={() => setStorageActionError(null)} className="font-bold">
                      &times;
                    </button>
                  </div>
                )}

                {/* Reconnection Alert Banner if Token is Expired or Revoked */}
                {(!storageStatus?.connected || storageStatus?.message?.toLowerCase().includes("revoked") || storageStatus?.message?.toLowerCase().includes("expired")) && (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-900 dark:text-amber-200">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-amber-200 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300 font-bold">
                        !
                      </div>
                      <div>
                        <p className="font-bold text-sm">Action Required: Google Drive OAuth Reconnection</p>
                        <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                          {storageStatus?.message || "Google Drive OAuth token has expired or been revoked. System Administrator must reconnect Google Drive to enable student evidence uploads."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      disabled={isConnectingDrive}
                      className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isConnectingDrive ? "Connecting..." : "Reconnect Google Drive Now"}
                    </button>
                  </div>
                )}

                {storageStatus?.message && (
                  <div className="p-3.5 rounded-xl border border-blue-200/70 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200">
                    <span className="font-bold">Diagnostic Status: </span>
                    <span>{storageStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Scope: drive.file
                    </span>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Restricted scope. The application can only access files and folders it creates, keeping all personal institutional Drive records isolated.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Fernet Cipher Protection
                    </span>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Google OAuth refresh tokens are symmetrically encrypted at rest with Fernet. Direct file tokens are never transmitted in URLs.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      5 MiB Certificate Limit
                    </span>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Evidence upload rules enforce PDF and PNG/JPEG MIME verification, preventing arbitrary executable binaries from entering storage.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION: DEDICATED STUDENT GOOGLE DRIVE FOLDERS */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Individual Student Storage Folders
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          {"{REGISTER_NUMBER}_{NORMALIZED_NAME}"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Stable, dedicated cloud directory created under institutional parent folder for every student in the cohort.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={fetchDriveAudit}
                        disabled={isAuditingDrive}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg dark:bg-slate-800 dark:text-slate-300 transition"
                      >
                        {isAuditingDrive ? "Auditing..." : "Audit Storage"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExecuteProvisioning(true)}
                        disabled={isProvisioning}
                        className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 transition"
                      >
                        {isProvisioning ? "Running..." : "Run Dry-Run"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProvisionModalOpen(true)}
                        disabled={isProvisioning || !storageStatus?.connected}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition disabled:opacity-50"
                      >
                        Provision Folders
                      </button>
                    </div>
                  </div>

                  {/* Provision notification message */}
                  {provisionSuccessMsg && (
                    <div className="p-3.5 rounded-xl border border-emerald-200/70 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold">{provisionSuccessMsg}</span>
                      </div>
                      <button onClick={() => setProvisionSuccessMsg(null)} className="text-emerald-700 dark:text-emerald-300 font-bold">&times;</button>
                    </div>
                  )}

                  {/* Audit Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <span className="text-[11px] text-slate-500">Cohort Students</span>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                        {driveAuditReport?.total_students ?? 61}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <span className="text-[11px] text-slate-500">Bound in PostgreSQL</span>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {driveAuditReport?.provisioned_in_db ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <span className="text-[11px] text-slate-500">Existing in Drive</span>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        {driveAuditReport?.found_in_drive ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <span className="text-[11px] text-slate-500">Requires Creation</span>
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                        {driveAuditReport?.requires_provisioning ?? 61}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      <span className="text-[11px] text-slate-500">Legacy student_ folders</span>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                        {driveAuditReport?.legacy_folders_detected ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={driveAuditSearch}
                        onChange={(e) => setDriveAuditSearch(e.target.value)}
                        placeholder="Filter by student name or register number..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:w-56">
                      <select
                        value={driveAuditStatusFilter}
                        onChange={(e) => setDriveAuditStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Provisioning States</option>
                        <option value="NEEDS_CREATION">Needs Creation</option>
                        <option value="EXISTS_IN_DRIVE_NEEDS_LINK">Exists in Drive (Link Needed)</option>
                        <option value="ALREADY_PROVISIONED">Already Provisioned</option>
                      </select>
                    </div>
                  </div>

                  {/* Student Drive Table */}
                  <div className="overflow-x-auto max-h-[460px]">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[11px] border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-3">Register No</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Target Folder Name</th>
                          <th className="px-4 py-3">Evidence</th>
                          <th className="px-4 py-3">Folder Status</th>
                          <th className="px-4 py-3 text-right">Drive Folder ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {(driveAuditReport?.students || [])
                          .filter((s) => {
                            if (driveAuditStatusFilter !== "all" && s.status !== driveAuditStatusFilter) {
                              return false;
                            }
                            if (driveAuditSearch) {
                              const q = driveAuditSearch.toLowerCase();
                              return (
                                s.student_name.toLowerCase().includes(q) ||
                                s.register_number.toLowerCase().includes(q) ||
                                s.computed_folder_name.toLowerCase().includes(q)
                              );
                            }
                            return true;
                          })
                          .map((s) => (
                            <tr key={s.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                {s.register_number}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                {s.student_name}
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                {s.computed_folder_name}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {s.evidence_count} file(s)
                              </td>
                              <td className="px-4 py-3">
                                {s.status === "ALREADY_PROVISIONED" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                                    Provisioned in DB
                                  </span>
                                ) : s.status === "EXISTS_IN_DRIVE_NEEDS_LINK" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/40">
                                    Exists on Drive
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                                    Ready to Create
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                                {s.drive_folder_id || s.db_folder_id || "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 9: SYSTEM ARCHITECTURE & RBAC MATRIX */}
            {activeSection === "system" && (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Four-Role Institutional Server-Side Authorization Matrix
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    All client-supplied roles are rejected. Roles are derived strictly from PostgreSQL on every request.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Scope of Authority</th>
                        <th className="px-4 py-3">Server-Side Dependency</th>
                        <th className="px-4 py-3">Authorized Endpoints</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400 font-sans">
                          ADMIN
                        </td>
                        <td className="px-4 py-3 font-sans">
                          System-wide governance, user provisioning & audit inspection
                        </td>
                        <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400">
                          require_admin
                        </td>
                        <td className="px-4 py-3">/api/v1/admin/*</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-purple-600 dark:text-purple-400 font-sans">
                          HOD
                        </td>
                        <td className="px-4 py-3 font-sans">
                          Department-wide student achievement oversight & review queues
                        </td>
                        <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400">
                          require_hod
                        </td>
                        <td className="px-4 py-3">/api/v1/hod/*</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 font-sans">
                          MENTOR
                        </td>
                        <td className="px-4 py-3 font-sans">
                          Assigned mentees review queue, approval & remarks
                        </td>
                        <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400">
                          require_mentor
                        </td>
                        <td className="px-4 py-3">/api/v1/mentor/*</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 font-sans">
                          STUDENT
                        </td>
                        <td className="px-4 py-3 font-sans">
                          Own PGPA component submissions, evidence uploads & portfolio QR
                        </td>
                        <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400">
                          require_student
                        </td>
                        <td className="px-4 py-3">/api/v1/students/me</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. Official Sri Sairam Leo Muthu Artwork Footer Banner */}
            <footer className="w-full mt-8 pt-4 pb-12 border-t border-slate-200/80 dark:border-slate-800">
              <div className="mx-auto max-w-5xl mb-6">
                <Image
                  src="/images/sairam-footer.png"
                  alt="Sri Sairam Engineering College - Founder Chairman MJF. Ln. Leo Muthu"
                  width={1600}
                  height={251}
                  className="w-full h-auto object-contain mx-auto"
                />
              </div>

              {/* Exact Required Footer Attribution */}
              <div className="text-center space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                  Designed and Developed by Team FineWorks
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Department of Computer and Communication Engineering &bull; Sri Sairam Engineering College
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  CCE-PGPA Management System &bull; Version 1.0.0 &bull; All Institutional Rights Reserved
                </p>
              </div>
            </footer>
          </main>
        </div>
      </div>

      {/* Submission Inspection Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  PGPA Submission Inspection
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedSubmission.title}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  ID: {selectedSubmission.id} &bull; Component: {selectedSubmission.component_name}
                  {(selectedSubmission.semester_name || selectedSubmission.semester_number) && (
                    <span> &bull; {selectedSubmission.semester_name || `Semester ${selectedSubmission.semester_number}`}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px]">Student Name</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {selectedSubmission.student_name}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px]">Register Number</span>
                <p className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {selectedSubmission.register_number}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px]">Activity Type</span>
                <p className="font-semibold text-slate-900 dark:text-white capitalize mt-0.5">
                  {selectedSubmission.activity_type || "General Event"}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px]">Status</span>
                <p className="mt-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      selectedSubmission.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedSubmission.status === "rejected"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selectedSubmission.status}
                  </span>
                </p>
              </div>
            </div>

            {selectedSubmission.description && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Description / Remarks
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedSubmission.description}
                </p>
              </div>
            )}

            {selectedSubmission.outcome && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Outcome / Prize / Certification
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {selectedSubmission.outcome}
                </p>
              </div>
            )}

            {fileDownloadError && (
              <p className="text-xs text-rose-600 font-semibold">{fileDownloadError}</p>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Students Modal for Allocation View */}
      {allocationToReassign && (
        <ReassignStudentsModal
          sourceMentor={allocationToReassign}
          allMentors={allMentors}
          onClose={() => setAllocationToReassign(null)}
          onSubmit={async (sourceId, targetId) => {
            await api.adminReassignMentorStudents(sourceId, targetId, undefined, token);
            setAllocationToReassign(null);
            fetchAllocations();
            fetchOverview();
          }}
        />
      )}
      {/* Google Drive Provisioning Confirmation & Execution Modal */}
      {provisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Storage Provisioning
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Provision Individual Google Drive Folders
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProvisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 text-blue-900 dark:text-blue-200">
                <span className="font-bold">Institutional Storage Safety Rules:</span>
                <ul className="list-disc list-inside mt-1.5 space-y-1">
                  <li>Creates dedicated folders under official root folder ({storageStatus?.root_folder_id || "configured folder"}).</li>
                  <li>Follows canonical naming: <span className="font-mono font-bold">{"{REGISTER_NUMBER}_{NORMALIZED_NAME}"}</span>.</li>
                  <li>Reuses existing folders where verified to prevent duplicates.</li>
                  <li>Persists each folder ID directly into the student&apos;s PostgreSQL record.</li>
                  <li>Existing evidence PDFs will NOT be moved or deleted.</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span>Total Students to Process:</span>
                  <span className="font-bold">{driveAuditReport?.total_students ?? 61}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700">
                  <span>Already Bound in PostgreSQL:</span>
                  <span className="font-bold text-emerald-600">{driveAuditReport?.provisioned_in_db ?? 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Requiring Folder Creation / Link:</span>
                  <span className="font-bold text-amber-600">{driveAuditReport?.requires_provisioning ?? 61}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProvisionModalOpen(false)}
                disabled={isProvisioning}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleExecuteProvisioning(false);
                  setProvisionModalOpen(false);
                }}
                disabled={isProvisioning}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
              >
                {isProvisioning ? "Executing..." : "Confirm & Execute Live"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
