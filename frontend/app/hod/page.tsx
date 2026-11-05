"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";
import { DesignationBadge } from "@/components/DesignationBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, getStoredToken } from "@/lib/api-client";
import { HODStudentItem, DepartmentOverviewResponse } from "@/types/auth";
import { AchievementResponse, PGPAComponentResponse } from "@/types/achievement";
import { MessageDrawerModal } from "@/components/messages/MessageDrawerModal";
import { MessagesHubView } from "@/components/messages/MessagesHubView";
import { HODExcelImportConsole } from "@/components/hod/HODExcelImportConsole";
import { HODPGPAGradesTab } from "@/components/hod/HODPGPAGradesTab";
import { ExportDataModal } from "@/components/export/ExportDataModal";
import { SettingsModal } from "@/components/shared/SettingsModal";
import { AppleLoadingScreen } from "@/components/shared/AppleLoadingScreen";
import { HODBottomNav } from "@/components/hod/HODBottomNav";
import { HODMobileActionsDrawer } from "@/components/hod/HODMobileActionsDrawer";
import { FineWorksBrand } from "@/components/shared/FineWorksBrand";
import { FineWorksFooter } from "@/components/shared/FineWorksFooter";


export default function HODDashboardPage() {
  const router = useRouter();
  const { user, token: authToken, isLoading: authLoading, isLoggingOut, logout } = useAuth();
  const token = authToken || (typeof window !== "undefined" ? getStoredToken() : null);

  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);

  // Independent Data States
  const [overview, setOverview] = useState<DepartmentOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [students, setStudents] = useState<HODStudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [components, setComponents] = useState<PGPAComponentResponse[]>([]);
  const [loadingComponents, setLoadingComponents] = useState<boolean>(false);
  const [componentsError, setComponentsError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<AchievementResponse[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(true);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"submissions" | "students" | "overview" | "messages" | "excel-import" | "pgpa-grades">("submissions");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("all");
  const [selectedMentorName, setSelectedMentorName] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Debounce search input for snappy typing and efficient filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Inspection modal & File viewing
  const [selectedSubmission, setSelectedSubmission] = useState<AchievementResponse | null>(null);
  const [isOpeningFile, setIsOpeningFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Messages & Remarks Drawer state
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [unreadCountsByAchievement, setUnreadCountsByAchievement] = useState<Record<string, number>>({});
  const [drawerAchievement, setDrawerAchievement] = useState<AchievementResponse | null>(null);
  const [drawerStudent, setDrawerStudent] = useState<{ id: string; name: string; register_number?: string } | null>(null);
  const [isMessageDrawerOpen, setIsMessageDrawerOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportStudentId, setExportStudentId] = useState<string>("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);


  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user && !isLoggingOut) {
      router.replace("/login/hod");
      return;
    }
    if (!authLoading && user && user.role !== "hod" && !user.accessible_portals?.includes("hod")) {
      router.replace("/login/hod");
      return;
    }
    if (!authLoading && user && user.must_change_password) {
      router.replace("/change-password");
      return;
    }
  }, [user, authLoading, isLoggingOut, router]);

  // Decoupled independent data loaders
  const loadOverview = useCallback(async (activeToken?: string | null) => {
    const t = activeToken || token;
    if (!t) {
      setLoadingOverview(false);
      return;
    }
    try {
      setLoadingOverview(true);
      setOverviewError(null);
      const res = await api.getHodOverview(t);
      setOverview(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load department metrics.";
      setOverviewError(msg);
    } finally {
      setLoadingOverview(false);
    }
  }, [token]);

  const loadStudents = useCallback(async (activeToken?: string | null) => {
    const t = activeToken || token;
    if (!t) {
      setLoadingStudents(false);
      return;
    }
    try {
      setLoadingStudents(true);
      setStudentsError(null);
      const res = await api.getHodStudents(t);
      setStudents(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load cohort student directory.";
      setStudentsError(msg);
    } finally {
      setLoadingStudents(false);
    }
  }, [token]);

  const loadComponents = useCallback(async (activeToken?: string | null) => {
    const t = activeToken || token;
    if (!t) return;
    try {
      setLoadingComponents(true);
      setComponentsError(null);
      const res = await api.getComponents({ token: t });
      setComponents(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load PGPA components catalogue.";
      setComponentsError(msg);
    } finally {
      setLoadingComponents(false);
    }
  }, [token]);

  const loadSubmissions = useCallback(async (activeToken?: string | null) => {
    const t = activeToken || token;
    if (!t) {
      setLoadingSubmissions(false);
      return;
    }
    try {
      setLoadingSubmissions(true);
      setSubmissionsError(null);
      const res = await api.getHodSubmissions(undefined, t);
      setSubmissions(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load department submissions.";
      setSubmissionsError(msg);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [token]);

  const loadUnreadCounts = useCallback(async (activeToken?: string | null) => {
    const t = activeToken || token;
    if (!t) return;
    try {
      const res = await api.getUnreadMessageCount(t);
      setUnreadMessagesCount(res.total_unread);
      setUnreadCountsByAchievement(res.by_achievement || {});
    } catch (err) {
      console.error("Failed to load unread messages count:", err);
    }
  }, [token]);

  // Load all sections in parallel with settled promise resolution
  const loadDepartmentData = useCallback(async (activeToken?: string | null) => {
    const t = activeToken || token;
    if (!t) return;
    await Promise.allSettled([
      loadOverview(t),
      loadStudents(t),
      loadComponents(t),
      loadSubmissions(t),
      loadUnreadCounts(t),
    ]);
  }, [token, loadOverview, loadStudents, loadComponents, loadSubmissions, loadUnreadCounts]);

  // Initial load via asynchronous fetch
  useEffect(() => {
    let ignore = false;
    if (authLoading) return;
    if (!user || user.role !== "hod") return;

    if (!token) {
      setLoadingOverview(false);
      setLoadingStudents(false);
      setLoadingSubmissions(false);
      return;
    }

    if (!ignore) {
      loadDepartmentData(token);
    }

    return () => {
      ignore = true;
    };
  }, [user, token, authLoading, loadDepartmentData]);

  // Build student ID to mentor mapping
  const studentMentorMap = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((st) => {
      if (st.mentor_name) {
        map.set(st.student_id, st.mentor_name);
      }
    });
    return map;
  }, [students]);

  // Unique Mentors
  const uniqueMentors = useMemo(() => {
    const mentorSet = new Set<string>();
    students.forEach((s) => {
      if (s.mentor_name) mentorSet.add(s.mentor_name);
    });
    return Array.from(mentorSet).sort();
  }, [students]);

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Component filter
      if (selectedComponentId !== "all" && sub.component_id !== selectedComponentId) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && sub.status !== selectedStatus) {
        return false;
      }
      // Mentor filter
      if (selectedMentorName !== "all") {
        const mentor = studentMentorMap.get(sub.student_id);
        if (mentor !== selectedMentorName) return false;
      }
      // Semester filter
      if (selectedSemester !== "all") {
        if (selectedSemester === "legacy") {
          if (sub.semester_id || sub.semester) return false;
        } else {
          const subSemNum = sub.semester?.semester_number?.toString() || sub.semester_id?.toString();
          if (subSemNum) {
            if (subSemNum !== selectedSemester) return false;
          } else {
            const comp = components.find((c) => c.id === sub.component_id);
            const sem = comp?.semester_label || "";
            if (!sem.toLowerCase().includes(selectedSemester.toLowerCase())) {
              return false;
            }
          }
        }
      }
      // Search query (debounced)
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase().trim();
        const studentName = sub.student_name?.toLowerCase() || "";
        const reg = sub.student_register_number?.toLowerCase() || "";
        const title = sub.title?.toLowerCase() || "";
        const comp = sub.component_name?.toLowerCase() || "";
        const mentor = (studentMentorMap.get(sub.student_id) || "").toLowerCase();
        if (
          !studentName.includes(q) &&
          !reg.includes(q) &&
          !title.includes(q) &&
          !comp.includes(q) &&
          !mentor.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [submissions, selectedComponentId, selectedStatus, selectedMentorName, selectedSemester, debouncedSearchQuery, studentMentorMap, components]);

  // Securely download / open evidence file
  const handleViewEvidence = async (fileId: string) => {
    try {
      setIsOpeningFile(fileId);
      setFileError(null);
      const { url } = await api.downloadFile(fileId, token);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to retrieve evidence document.";
      setFileError(msg);
    } finally {
      setIsOpeningFile(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login?signedOut=true");
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Verified
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Under Review
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Submitted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Action Required
          </span>
        );
      case "draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  if (authLoading || !user || user.role !== "hod") {
    return (
      <AppleLoadingScreen
        message="Loading Department Portal..."
        submessage="Securing your workspace"
        fullScreen={true}
      />
    );
  }


  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-6 md:pb-12 transition-colors">
      {/* Sairam Institutional Header */}
      <header className="border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          {/* Mobile Header Bar (< md) */}
          <div className="flex md:hidden items-center justify-between gap-2">
            <FineWorksBrand role="hod" size="sm" />

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => { void loadDepartmentData(); }}
                disabled={loadingSubmissions || loadingStudents}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                title="Refresh department submissions"
                aria-label="Refresh submissions"
              >
                <svg className={`w-4 h-4 ${loadingSubmissions ? "animate-spin text-purple-600" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <ThemeToggle size="sm" />
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-xs active:scale-95 transition-all cursor-pointer"
                aria-label="Open HOD menu"
                title="Open menu & tools"
              >
                {user?.full_name
                  ?.split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("") || "HOD"}
              </button>
            </div>
          </div>

          {/* Desktop Header Bar (>= md) */}
          <div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <FineWorksBrand role="hod" showDepartment size="md" />

            <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-1.5 justify-end">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.full_name || "Head of Department"}</p>
                  <DesignationBadge designation="Torch Bearer" size="sm" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
              <RoleBadge role="hod" />
              <Link
                href="/mentor"
                id="btn-goto-mentor-portal"
                prefetch={true}
                className="rounded-lg border border-blue-500 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                title="Navigate directly to Faculty Mentor portal to manage assigned mentees"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Go to Mentor Portal</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setExportStudentId("all");
                  setIsExportModalOpen(true);
                }}
                id="btn-hod-export-data"
                className="rounded-lg border border-purple-500 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                title="Export CCE Department PGPA academic report as Excel or PDF"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Export Data</span>
              </button>
              <ThemeToggle size="sm" />
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                id="btn-hod-settings"
                className="rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Account Settings & Email Verification"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/change-password")}
                className="rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              >
                Change Password
              </button>

              <button
                type="button"
                id="hod-signout-btn"
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-8 md:pb-10">
        {/* Department Overview Banner & Key Metrics */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-[#292929] bg-white dark:bg-[#111111] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                Department-Wide View-Only Access
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F5F5F5]">
                Department Submissions & Audit Oversight
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A3A3A3] mt-1 max-w-2xl">
                Oversight authority for CCE Second-Year student cohort (61 students).
                Activities and supporting evidence submitted by students are recorded directly without requiring approval.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Link
                  href="/mentor"
                  id="btn-goto-mentor-portal-banner"
                  prefetch={true}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                  title="Switch to Faculty Mentor portal to manage assigned mentees"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Go to Mentor Portal &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-slate-50/70 dark:bg-[#181818] p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">Students</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-[#F5F5F5] mt-0.5">{overview?.total_students || students.length || 61}</p>
                <p className="text-[10px] text-slate-400 dark:text-[#A3A3A3]">II Year Sec A</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-slate-50/70 dark:bg-[#181818] p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">Mentors</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-[#F5F5F5] mt-0.5">{overview?.total_mentors || uniqueMentors.length || 3}</p>
                <p className="text-[10px] text-slate-400 dark:text-[#A3A3A3]">Allocated</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-slate-50/70 dark:bg-[#181818] p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">Submissions</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-[#F5F5F5] mt-0.5">{submissions.length}</p>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Recorded</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-slate-50/70 dark:bg-[#181818] p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">Components</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-[#F5F5F5] mt-0.5">{components.length || 13}</p>
                <p className="text-[10px] text-slate-400 dark:text-[#A3A3A3]">Catalogue</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex items-center gap-2 border-t border-slate-100 dark:border-[#292929] pt-4 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("submissions")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "submissions"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#292929]"
              }`}
            >
              Department Submissions ({submissions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("students")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "students"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#292929]"
              }`}
            >
              Cohort Student Directory ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#292929]"
              }`}
            >
              Mentorship Allocations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              className={`relative rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "messages"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#292929]"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <span>Messages & Remarks</span>
              {unreadMessagesCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white animate-pulse">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("excel-import")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "excel-import"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#292929]"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Excel Import & Grading</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pgpa-grades")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "pgpa-grades"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#222222] border border-slate-200 dark:border-[#292929]"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span>PGPA Grades</span>
            </button>
          </div>
        </div>

        {/* Partial or Global Error Banner */}
        {(submissionsError || studentsError || overviewError || componentsError) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{[submissionsError, studentsError, overviewError, componentsError].filter(Boolean).join(" ")}</span>
            </div>
            <button
              type="button"
              onClick={() => loadDepartmentData(token)}
              className="font-bold text-amber-900 underline hover:no-underline cursor-pointer ml-3 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tab 1: Submissions Explorer */}
        {activeTab === "submissions" && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#292929] bg-white dark:bg-[#111111] p-5 sm:p-6 shadow-xs space-y-5">
            {/* Search and Multi-filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pb-4 border-b border-slate-100 dark:border-[#292929]">
              {/* Search text */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search student, reg no, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#181818] px-3.5 py-2 pl-9 text-xs text-slate-900 dark:text-[#F5F5F5] placeholder:text-slate-400 dark:placeholder:text-[#A3A3A3] focus:bg-white dark:focus:bg-[#181818] focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                />
                <svg
                  className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-[#A3A3A3]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Component Filter */}
              <div>
                <select
                  value={selectedComponentId}
                  onChange={(e) => setSelectedComponentId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] focus:border-purple-500 shadow-2xs"
                >
                  <option value="all">All PGPA Components ({components.length})</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{String(c.display_order).padStart(2, "0")} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mentor Filter */}
              <div>
                <select
                  value={selectedMentorName}
                  onChange={(e) => setSelectedMentorName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] focus:border-purple-500 shadow-2xs"
                >
                  <option value="all">All Faculty Mentors</option>
                  {uniqueMentors.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  aria-label="Filter submissions by semester"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] focus:border-purple-500 shadow-2xs"
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

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] focus:border-purple-500 shadow-2xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Verified (Approved)</option>
                  <option value="rejected">Action Required</option>
                </select>
              </div>
            </div>

            {/* Submissions Table */}
            {loadingSubmissions ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-[#181818] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : submissionsError ? (
              <div className="py-12 text-center rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 p-6 space-y-3">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{submissionsError}</p>
                <button
                  type="button"
                  onClick={() => loadSubmissions(token)}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  Retry Submissions
                </button>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-[#181818] text-slate-400 dark:text-[#A3A3A3] mb-3">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">No submissions found</h3>
                <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-1 max-w-sm mx-auto">
                  {submissions.length === 0
                    ? "No student submissions have been recorded across the department yet. As students upload activities and certificates, they will be listed here automatically."
                    : "No submissions matched the selected filters. Try broadening your search or resetting filters."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Responsive Cards (< md) */}
                <div className="block md:hidden space-y-3">
                  {filteredSubmissions.map((sub) => {
                    const mentorName = studentMentorMap.get(sub.student_id) || "—";
                    const hasFiles = sub.files && sub.files.length > 0;
                    const unreadCount = unreadCountsByAchievement[sub.id] || 0;
                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubmission(sub)}
                        className="rounded-xl border border-slate-200/90 dark:border-[#292929] bg-slate-50/50 dark:bg-[#181818] p-4 shadow-2xs space-y-3 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        {/* Student Name & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-[#F5F5F5] text-sm leading-snug truncate">
                              {sub.student_name || "Student"}
                            </p>
                            <p className="font-mono text-xs font-semibold text-purple-700 dark:text-purple-400 mt-0.5">
                              {sub.student_register_number || "—"}
                            </p>
                          </div>
                          <div className="shrink-0">{renderStatusBadge(sub.status)}</div>
                        </div>

                        {/* Mentor & Component & Semester */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Mentor: {mentorName}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-white dark:bg-[#111111] px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-[#F5F5F5] border border-slate-200 dark:border-[#292929]">
                            {sub.component_name || "PGPA Component"}
                          </span>
                          {sub.semester ? (
                            <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                              {sub.semester.display_name}
                            </span>
                          ) : sub.semester_id ? (
                            <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                              Semester {sub.semester_id}
                            </span>
                          ) : null}
                        </div>

                        {/* Title & Organizer */}
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-[#F5F5F5] text-xs">
                            {sub.title}
                          </p>
                          {sub.organizer && (
                            <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                              {sub.organizer}
                            </p>
                          )}
                        </div>

                        {/* Dates */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#A3A3A3] pt-2 border-t border-slate-200/60 dark:border-[#292929]">
                          <span>Submitted: <strong className="text-slate-700 dark:text-slate-300">{formatDate(sub.submitted_at || sub.created_at)}</strong></span>
                          <span>Event: <strong className="text-slate-700 dark:text-slate-300">{formatDate(sub.event_date)}</strong></span>
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-[#292929]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {hasFiles && (
                              <button
                                type="button"
                                onClick={() => handleViewEvidence(sub.files[0].id)}
                                disabled={isOpeningFile === sub.files[0].id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 text-[11px] font-semibold text-purple-700 dark:text-purple-300 active:scale-95 transition-all cursor-pointer"
                              >
                                {isOpeningFile === sub.files[0].id ? (
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                                ) : (
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                                <span>Evidence</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setDrawerAchievement(sub);
                                setDrawerStudent({
                                  id: sub.student_id,
                                  name: sub.student_name || "Student",
                                  register_number: sub.student_register_number || undefined,
                                });
                                setIsMessageDrawerOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] text-[11px] font-semibold text-slate-700 dark:text-[#F5F5F5] active:scale-95 transition-all cursor-pointer"
                            >
                              <svg className="h-3.5 w-3.5 text-purple-700 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                              </svg>
                              <span>Remarks</span>
                              {unreadCount > 0 && (
                                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-bold text-white">
                                  {unreadCount}
                                </span>
                              )}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs active:scale-95 transition-all cursor-pointer shadow-2xs"
                          >
                            <span>Inspect</span>
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-[#292929] text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider bg-slate-50/50 dark:bg-[#181818]">
                      <th className="py-3 px-4">Student & Reg No</th>
                      <th className="py-3 px-4">Assigned Mentor</th>
                      <th className="py-3 px-4">Component</th>
                      <th className="py-3 px-4">Activity Title</th>
                      <th className="py-3 px-4">Submitted Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Evidence</th>
                      <th className="py-3 px-4">Messages</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#292929]">
                    {filteredSubmissions.map((sub) => {
                      const mentorName = studentMentorMap.get(sub.student_id) || "—";
                      const hasFiles = sub.files && sub.files.length > 0;
                      const unreadCount = unreadCountsByAchievement[sub.id] || 0;
                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-[#222222]/70 transition-colors group cursor-pointer"
                          onClick={() => setSelectedSubmission(sub)}
                        >
                          {/* Student Details */}
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-[#F5F5F5] group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                              {sub.student_name || "Student"}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500 dark:text-[#A3A3A3]">
                              {sub.student_register_number || "—"}
                            </p>
                          </td>

                          {/* Mentor */}
                          <td className="py-3 px-4 text-slate-600 dark:text-[#A3A3A3] font-medium">
                            {mentorName}
                          </td>

                          {/* Component & Semester */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {sub.component_name || "PGPA Component"}
                              </span>
                              {sub.semester ? (
                                <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.2 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                                  {sub.semester.display_name}
                                </span>
                              ) : sub.semester_id ? (
                                <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.2 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                                  Semester {sub.semester_id}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Title */}
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-semibold text-slate-900 dark:text-[#F5F5F5] truncate" title={sub.title}>
                              {sub.title}
                            </p>
                            {sub.organizer && (
                              <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3] truncate">{sub.organizer}</p>
                            )}
                          </td>

                          {/* Submitted Date */}
                          <td className="py-3 px-4 text-slate-500 dark:text-[#A3A3A3]">
                            {formatDate(sub.submitted_at || sub.created_at)}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {renderStatusBadge(sub.status)}
                          </td>

                          {/* Evidence link */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {hasFiles ? (
                              <button
                                type="button"
                                onClick={() => handleViewEvidence(sub.files[0].id)}
                                disabled={isOpeningFile === sub.files[0].id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isOpeningFile === sub.files[0].id ? (
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                                ) : (
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                                <span>View File</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-[#A3A3A3]">None</span>
                            )}
                          </td>

                          {/* Messages */}
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setDrawerAchievement(sub);
                                setDrawerStudent({
                                  id: sub.student_id,
                                  name: sub.student_name || "Student",
                                  register_number: sub.student_register_number || undefined,
                                });
                                setIsMessageDrawerOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] hover:text-purple-700 dark:hover:text-purple-300 transition-colors cursor-pointer"
                              title="Send remarks, congratulations, or view message history"
                            >
                              <svg className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                              </svg>
                              <span>Remarks</span>
                              {unreadCount > 0 && (
                                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-bold text-white animate-pulse">
                                  {unreadCount}
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSubmission(sub);
                              }}
                              className="rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
            )}
          </div>
        )}

        {/* Tab 2: Cohort Student Directory */}
        {activeTab === "students" && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#292929] bg-white dark:bg-[#111111] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#292929]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
                  CCE II Year Student Directory ({loadingStudents ? "…" : `${students.length} Records`})
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                  Complete official cohort roster with verified mentor allocations
                </p>
              </div>
              <span className="rounded-full bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Department Isolated: CCE
              </span>
            </div>

            {loadingStudents ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 dark:bg-[#181818] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : studentsError ? (
              <div className="py-12 text-center rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 p-6 space-y-3">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{studentsError}</p>
                <button
                  type="button"
                  onClick={() => loadStudents(token)}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  Retry Student Directory
                </button>
              </div>
            ) : students.length === 0 ? (
              <div className="py-14 text-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">No students found</h3>
                <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-1 max-w-sm mx-auto">
                  No cohort students have been loaded into the CCE department directory.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Responsive Cards (< md) */}
                <div className="block md:hidden space-y-3">
                  {students.map((st) => {
                    const studentSubmissions = submissions.filter((s) => s.student_id === st.student_id);
                    return (
                      <div
                        key={st.student_id}
                        className="rounded-xl border border-slate-200/90 dark:border-[#292929] bg-slate-50/50 dark:bg-[#181818] p-4 shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-[#F5F5F5] text-sm leading-snug truncate">
                              {st.full_name}
                            </p>
                            <p className="font-mono text-xs font-semibold text-purple-700 dark:text-purple-400 mt-0.5">
                              {st.register_number || "—"}
                            </p>
                          </div>
                          <span className="inline-flex items-center rounded-md bg-white dark:bg-[#111111] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-[#A3A3A3] border border-slate-200 dark:border-[#292929]">
                            Sec {st.section || "A"}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-[#A3A3A3] space-y-0.5">
                          <p className="truncate">{st.email}</p>
                          <p>Mentor: <strong className="text-slate-700 dark:text-slate-300">{st.mentor_name || "Unassigned"}</strong></p>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 dark:border-[#292929] flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-600 dark:text-[#A3A3A3]">
                            {studentSubmissions.length} submissions
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setExportStudentId(st.student_id);
                                setIsExportModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              <span>Export</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery(st.register_number || st.full_name);
                                setActiveTab("submissions");
                              }}
                              className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors cursor-pointer"
                            >
                              <span>View &rarr;</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-[#292929] text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider bg-slate-50/50 dark:bg-[#181818]">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Register Number</th>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">Section</th>
                      <th className="py-3 px-4">Assigned Faculty Mentor</th>
                      <th className="py-3 px-4 text-right">Submissions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#292929]">
                    {students.map((st, idx) => {
                      const studentSubmissions = submissions.filter((s) => s.student_id === st.student_id);
                      return (
                        <tr key={st.student_id} className="hover:bg-slate-50/70 dark:hover:bg-[#222222]/70 transition-colors">
                          <td className="py-2.5 px-4 text-slate-400 dark:text-[#A3A3A3] font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-[#F5F5F5]">{st.full_name}</td>
                          <td className="py-2.5 px-4 font-mono text-purple-700 dark:text-purple-400 font-semibold">{st.register_number || "—"}</td>
                          <td className="py-2.5 px-4 text-slate-500 dark:text-[#A3A3A3]">{st.email}</td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-[#A3A3A3] font-medium">{st.section || "A"}</td>
                          <td className="py-2.5 px-4 text-slate-800 dark:text-[#F5F5F5] font-medium">{st.mentor_name || "Unassigned"}</td>
                          <td className="py-2.5 px-4 text-right flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery(st.register_number || st.full_name);
                                setActiveTab("submissions");
                              }}
                              className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                              title="Filter submissions for this student"
                            >
                              {studentSubmissions.length} &rarr;
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setExportStudentId(st.student_id);
                                setIsExportModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] hover:text-purple-700 dark:hover:text-purple-300 transition-colors cursor-pointer"
                              title="Export individual student report"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              <span>Export</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>
        )}

        {/* Tab 3: Mentorship Allocations Breakdown */}
        {activeTab === "overview" && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#292929] bg-white dark:bg-[#111111] p-5 sm:p-6 shadow-xs space-y-6">
            <div className="pb-4 border-b border-slate-100 dark:border-[#292929]">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
                CCE Department Faculty Mentorship Allocation Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                Official distribution of cohort students among department mentors
              </p>
            </div>

            {loadingStudents ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-44 bg-slate-100 dark:bg-[#181818] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : uniqueMentors.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">No faculty mentors found with active mentee allocations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {uniqueMentors.map((mentorName) => {
                const mentees = students.filter((s) => s.mentor_name === mentorName);
                const menteeIds = new Set(mentees.map((m) => m.student_id));
                const mentorSubmissions = submissions.filter((s) => menteeIds.has(s.student_id));

                return (
                  <div
                    key={mentorName}
                    className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-slate-50/50 dark:bg-[#181818] p-5 space-y-4 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-white dark:hover:bg-[#222222] transition-all shadow-2xs"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                        Faculty Mentor
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5] mt-0.5">{mentorName}</h4>
                      <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">Department of CCE</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-[#292929] text-center">
                      <div className="p-2 bg-white dark:bg-[#111111] rounded-lg border border-slate-200/60 dark:border-[#292929]">
                        <span className="block text-[10px] uppercase text-slate-400 dark:text-[#A3A3A3] font-semibold">Mentees</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-[#F5F5F5]">{mentees.length}</span>
                      </div>
                      <div className="p-2 bg-white dark:bg-[#111111] rounded-lg border border-slate-200/60 dark:border-[#292929]">
                        <span className="block text-[10px] uppercase text-purple-700 dark:text-purple-400 font-semibold">Submissions</span>
                        <span className="text-lg font-bold text-purple-700 dark:text-purple-400">{mentorSubmissions.length}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMentorName(mentorName);
                        setActiveTab("submissions");
                      }}
                      className="w-full text-center py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors cursor-pointer"
                    >
                      Inspect Submissions &rarr;
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* Tab 4: Messages & Remarks Hub */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <MessagesHubView
              portalRole="hod"
              onUnreadCountChanged={loadUnreadCounts}
            />
          </div>
        )}

        {/* Tab 5: Excel Import & Department Grading */}
        {activeTab === "excel-import" && (
          <HODExcelImportConsole token={token} />
        )}

        {/* Tab 6: Five-Component PGPA Grades Matrix & Audit */}
        {activeTab === "pgpa-grades" && (
          <HODPGPAGradesTab token={token} studentsList={students} />
        )}
      </main>

      {/* Read-Only Activity Inspector Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div
            onClick={() => setSelectedSubmission(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
            <div className="relative w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#111111] p-5 sm:p-7 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-left shadow-2xl transition-all border border-slate-200/90 dark:border-[#292929] my-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-[#292929]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {selectedSubmission.component_name || "PGPA Component"}
                    </span>
                    {selectedSubmission.semester ? (
                      <span className="rounded-md bg-cyan-50 dark:bg-cyan-950/40 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        {selectedSubmission.semester.display_name}
                      </span>
                    ) : selectedSubmission.semester_id ? (
                      <span className="rounded-md bg-cyan-50 dark:bg-cyan-950/40 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        Semester {selectedSubmission.semester_id}
                      </span>
                    ) : null}
                    {renderStatusBadge(selectedSubmission.status)}
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-[#F5F5F5] leading-snug">
                    {selectedSubmission.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181818] transition-colors cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="mt-4 space-y-4 text-xs">
                {/* Student Identity Card */}
                <div className="rounded-xl border border-slate-100 dark:border-[#292929] bg-slate-50/70 dark:bg-[#181818] p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">
                      Submitting Student
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] mt-0.5">
                      {selectedSubmission.student_name || "Student"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                      Assigned Mentor: {studentMentorMap.get(selectedSubmission.student_id) || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold text-purple-700 dark:text-purple-400">
                      {selectedSubmission.student_register_number || "—"}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-[#A3A3A3]">Department of CCE</p>
                  </div>
                </div>

                {/* Event Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200/70 dark:border-[#292929] bg-slate-50/40 dark:bg-[#181818] p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Activity Type</span>
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F5]">{selectedSubmission.activity_type || "Standard"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-[#292929] bg-slate-50/40 dark:bg-[#181818] p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Organizer / Host</span>
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F5] truncate block">{selectedSubmission.organizer || "—"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-[#292929] bg-slate-50/40 dark:bg-[#181818] p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Event Date</span>
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F5]">{formatDate(selectedSubmission.event_date)}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-[#292929] bg-slate-50/40 dark:bg-[#181818] p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Outcome / Score</span>
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F5]">{selectedSubmission.outcome || "Completed"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-[#292929] bg-slate-50/40 dark:bg-[#181818] p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Date Submitted</span>
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F5]">{formatDate(selectedSubmission.submitted_at || selectedSubmission.created_at)}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-[#292929] bg-slate-50/40 dark:bg-[#181818] p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Submission State</span>
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F5] capitalize">{selectedSubmission.status}</span>
                  </div>
                </div>

                {/* Certificate Status Banner */}
                {selectedSubmission.certificate_status === "yet_to_receive" && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <svg className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-bold">Certificate Pending Issuance</p>
                      <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                        Student completed this activity; the organizer has not yet issued the official certificate. Student can upload it later once received.
                      </p>
                    </div>
                  </div>
                )}

                {selectedSubmission.certificate_status === "not_provided" && (
                  <div className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50 dark:bg-[#181818] p-3 text-xs text-slate-700 dark:text-[#A3A3A3] flex items-start gap-2.5">
                    <svg className="h-4 w-4 text-slate-500 dark:text-[#A3A3A3] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-[#F5F5F5]">No Certificate Provided</p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-[#A3A3A3]">
                        No certificate is issued for this activity. Verify participation based on the event details and student remarks.
                      </p>
                    </div>
                  </div>
                )}

                {/* Student Remarks */}
                {selectedSubmission.remarks && (
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] text-[11px] mb-1">
                      Student Remarks
                    </p>
                    <div className="rounded-xl border border-purple-200/80 dark:border-purple-800 p-3 bg-purple-50/40 dark:bg-purple-950/30 text-slate-800 dark:text-[#F5F5F5] leading-relaxed font-medium text-xs">
                      {selectedSubmission.remarks}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedSubmission.description && (
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] text-[11px] mb-1">
                      Summary & Description
                    </p>
                    <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] p-3 bg-slate-50/50 dark:bg-[#181818] text-slate-700 dark:text-[#A3A3A3] leading-relaxed">
                      {selectedSubmission.description}
                    </div>
                  </div>
                )}

                {/* Evidence Files */}
                <div>
                  <p className="font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] text-[11px] mb-1.5">
                    Supporting Evidence ({selectedSubmission.files?.length || 0})
                  </p>
                  {selectedSubmission.files && selectedSubmission.files.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSubmission.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="truncate">
                              <p className="font-semibold text-slate-900 dark:text-[#F5F5F5] truncate">{file.original_filename}</p>
                              <p className="text-[11px] text-slate-400 dark:text-[#A3A3A3]">
                                {(file.size_bytes / 1024).toFixed(1)} KB &bull; {file.mime_type}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleViewEvidence(file.id)}
                            disabled={isOpeningFile === file.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold px-3 py-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            {isOpeningFile === file.id ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            )}
                            <span>Open Document</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-[#A3A3A3] italic">No evidence files were attached to this submission.</p>
                  )}

                  {fileError && (
                    <p className="mt-2 text-xs text-rose-600 font-medium">{fileError}</p>
                  )}
                </div>

                {/* Audit & Workflow Notice */}
                <div className="rounded-xl border border-purple-200/70 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 p-3.5 text-slate-600 dark:text-[#A3A3A3] leading-relaxed text-[11px]">
                  <p className="font-bold text-purple-900 dark:text-purple-300 mb-0.5">Department Head Oversight Access</p>
                  <p>
                    Student submissions are directly recorded upon submission and made viewable to faculty mentors and the Head of Department. No approval action is required.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-[#292929] flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const sub = selectedSubmission;
                    setSelectedSubmission(null);
                    setDrawerAchievement(sub);
                    setDrawerStudent({
                      id: sub.student_id,
                      name: sub.student_name || "Student",
                      register_number: sub.student_register_number || undefined,
                    });
                    setIsMessageDrawerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  <span>Send Remarks / Message</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Conversation Drawer */}
      {isMessageDrawerOpen && drawerStudent && (
        <MessageDrawerModal
          isOpen={isMessageDrawerOpen}
          onClose={() => {
            setIsMessageDrawerOpen(false);
            loadUnreadCounts();
          }}
          achievement={drawerAchievement}
          targetStudent={drawerStudent}
          currentUserRole="hod"
          onMessageSent={() => loadUnreadCounts()}
        />
      )}
      {/* Export Data Modal */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportStudentId("all");
        }}
        role="hod"
        students={students.map((s) => ({
          id: s.student_id,
          full_name: s.full_name,
          register_number: s.register_number,
        }))}
        token={token}
        initialStudentId={exportStudentId}
      />

      {/* Account Settings & Email Verification Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        token={token}
      />

      {/* FineWorks Footer */}
      <FineWorksFooter className="pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6 mt-8" />

      {/* Mobile Fixed Bottom Navigation Bar (< md) */}
      <HODBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenMore={() => setIsMobileMoreOpen(true)}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* Mobile Actions & Tools Drawer (< md) */}
      <HODMobileActionsDrawer
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        hodName={user?.full_name || "Head of Department"}
        hodEmail={user?.email || "hod.cce@sairam.edu.in"}
        department="CCE"
        studentCount={students.length}
        onSelectTab={setActiveTab}
        onSwitchToMentor={() => router.push("/mentor")}
        onExportClick={() => {
          setExportStudentId("all");
          setIsExportModalOpen(true);
        }}
        onRefreshClick={() => { void loadDepartmentData(); }}
        onLogout={handleLogout}
      />
    </div>
  );
}

