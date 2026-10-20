"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
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

export default function HODDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const token = getStoredToken();

  // Data states
  const [overview, setOverview] = useState<DepartmentOverviewResponse | null>(null);
  const [students, setStudents] = useState<HODStudentItem[]>([]);
  const [components, setComponents] = useState<PGPAComponentResponse[]>([]);
  const [submissions, setSubmissions] = useState<AchievementResponse[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"submissions" | "students" | "overview" | "messages">("submissions");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("all");
  const [selectedMentorName, setSelectedMentorName] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

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

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.role !== "hod") {
      router.push(`/${user.role}`);
      return;
    }
    if (!authLoading && user && user.must_change_password) {
      router.push("/change-password");
      return;
    }
  }, [user, authLoading, router]);

  const loadUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getUnreadMessageCount(token);
      setUnreadMessagesCount(res.total_unread);
      setUnreadCountsByAchievement(res.by_achievement || {});
    } catch (err) {
      console.error("Failed to load unread messages count:", err);
    }
  }, [token]);

  // Reload department data for retry button
  const loadDepartmentData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoadingData(true);
      setDataError(null);
      const [overviewRes, studentsRes, componentsRes, submissionsRes, unreadRes] = await Promise.all([
        api.getHodOverview(token),
        api.getHodStudents(token),
        api.getComponents(token).catch(() => []),
        api.getHodSubmissions(undefined, token),
        api.getUnreadMessageCount(token).catch(() => ({ total_unread: 0, by_achievement: {} })),
      ]);
      setOverview(overviewRes);
      setStudents(studentsRes);
      setComponents(componentsRes);
      setSubmissions(submissionsRes);
      setUnreadMessagesCount(unreadRes.total_unread);
      setUnreadCountsByAchievement(unreadRes.by_achievement || {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load department overview.";
      setDataError(msg);
    } finally {
      setIsLoadingData(false);
    }
  }, [token]);

  // Initial load via asynchronous fetch
  useEffect(() => {
    let ignore = false;
    if (!token || !user || user.role !== "hod") return;

    const fetchInitial = async () => {
      try {
        const [overviewRes, studentsRes, componentsRes, submissionsRes, unreadRes] = await Promise.all([
          api.getHodOverview(token),
          api.getHodStudents(token),
          api.getComponents(token).catch(() => []),
          api.getHodSubmissions(undefined, token),
          api.getUnreadMessageCount(token).catch(() => ({ total_unread: 0, by_achievement: {} })),
        ]);
        if (ignore) return;
        setOverview(overviewRes);
        setStudents(studentsRes);
        setComponents(componentsRes);
        setSubmissions(submissionsRes);
        setUnreadMessagesCount(unreadRes.total_unread);
        setUnreadCountsByAchievement(unreadRes.by_achievement || {});
        setDataError(null);
      } catch (err: unknown) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : "Failed to load department overview.";
        setDataError(msg);
      } finally {
        if (!ignore) {
          setIsLoadingData(false);
        }
      }
    };

    fetchInitial();

    return () => {
      ignore = true;
    };
  }, [user, token]);

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
        const comp = components.find((c) => c.id === sub.component_id);
        const sem = comp?.semester_label || "";
        if (!sem.toLowerCase().includes(selectedSemester.toLowerCase())) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
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
  }, [submissions, selectedComponentId, selectedStatus, selectedMentorName, selectedSemester, searchQuery, studentMentorMap, components]);

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
    router.push("/login");
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Verified
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Submitted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Action Required
          </span>
        );
      case "draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[60vh] bg-[#fafbfc]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-700">Loading department head portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 transition-colors">
      {/* Sairam Institutional Header */}
      <header className="border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-800 via-indigo-900 to-slate-900 text-white font-extrabold text-sm shadow-xs">
                CCE
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    Sri Sairam Engineering College
                  </span>
                  <span className="text-xs text-slate-300 dark:text-slate-600">&bull;</span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Autonomous</span>
                </div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Department of Computer and Communication Engineering
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  CCE-PGPA &bull; Head of Department Portal (Department Oversight & Governance)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-1.5 justify-end">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.full_name || "Head of Department"}</p>
                  <DesignationBadge designation="Torch Bearer" size="sm" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
              <RoleBadge role="hod" />
              <ThemeToggle size="sm" />
              <button
                type="button"
                onClick={() => router.push("/change-password")}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              >
                Change Password
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Department Overview Banner & Key Metrics */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                Department-Wide View-Only Access
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Department Submissions & Audit Oversight
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Oversight authority for CCE Second-Year student cohort (61 students).
                Activities and supporting evidence submitted by students are recorded directly without requiring approval.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Students</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{overview?.total_students || students.length || 61}</p>
                <p className="text-[10px] text-slate-400">II Year Sec A</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mentors</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{overview?.total_mentors || uniqueMentors.length || 3}</p>
                <p className="text-[10px] text-slate-400">Allocated</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-700">Submissions</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{submissions.length}</p>
                <p className="text-[10px] text-purple-600 font-medium">Recorded</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-center min-w-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Components</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{components.length || 13}</p>
                <p className="text-[10px] text-slate-400">Catalogue</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setActiveTab("submissions")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "submissions"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
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
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
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
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
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
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
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
          </div>
        </div>

        {/* Global Error Banner */}
        {dataError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center justify-between">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={loadDepartmentData}
              className="font-bold underline hover:no-underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tab 1: Submissions Explorer */}
        {activeTab === "submissions" && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            {/* Search and Multi-filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pb-4 border-b border-slate-100">
              {/* Search text */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search student, reg no, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                />
                <svg
                  className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-purple-500 shadow-2xs"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-purple-500 shadow-2xs"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-purple-500 shadow-2xs"
                >
                  <option value="all">All Semesters</option>
                  <option value="sem 3">Semester III</option>
                  <option value="sem 4">Semester IV</option>
                  <option value="all sem">All Semesters</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-purple-500 shadow-2xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Submitted</option>
                  <option value="approved">Verified (Approved)</option>
                  <option value="rejected">Action Required</option>
                </select>
              </div>
            </div>

            {/* Submissions Table */}
            {isLoadingData ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900">No submissions found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {submissions.length === 0
                    ? "No student submissions have been recorded across the department yet. As students upload activities and certificates, they will be listed here automatically."
                    : "No submissions matched the selected filters. Try broadening your search or resetting filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
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
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubmissions.map((sub) => {
                      const mentorName = studentMentorMap.get(sub.student_id) || "—";
                      const hasFiles = sub.files && sub.files.length > 0;
                      const unreadCount = unreadCountsByAchievement[sub.id] || 0;
                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                          onClick={() => setSelectedSubmission(sub)}
                        >
                          {/* Student Details */}
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                              {sub.student_name || "Student"}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">
                              {sub.student_register_number || "—"}
                            </p>
                          </td>

                          {/* Mentor */}
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {mentorName}
                          </td>

                          {/* Component */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
                              {sub.component_name || "PGPA Component"}
                            </span>
                          </td>

                          {/* Title */}
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-semibold text-slate-900 truncate" title={sub.title}>
                              {sub.title}
                            </p>
                            {sub.organizer && (
                              <p className="text-[11px] text-slate-500 truncate">{sub.organizer}</p>
                            )}
                          </td>

                          {/* Submitted Date */}
                          <td className="py-3 px-4 text-slate-500">
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
                                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/70 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer disabled:opacity-50"
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
                              <span className="text-[11px] text-slate-400">None</span>
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
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-purple-700 transition-colors cursor-pointer"
                              title="Send remarks, congratulations, or view message history"
                            >
                              <svg className="h-3.5 w-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
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
            )}
          </div>
        )}

        {/* Tab 2: Cohort Student Directory */}
        {activeTab === "students" && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  CCE II Year Student Directory ({students.length} Records)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete official cohort roster with verified mentor allocations
                </p>
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                Department Isolated: CCE
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Register Number</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Section</th>
                    <th className="py-3 px-4">Assigned Faculty Mentor</th>
                    <th className="py-3 px-4 text-right">Submissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((st, idx) => {
                    const studentSubmissions = submissions.filter((s) => s.student_id === st.student_id);
                    return (
                      <tr key={st.student_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{st.full_name}</td>
                        <td className="py-2.5 px-4 font-mono text-purple-700 font-semibold">{st.register_number || "—"}</td>
                        <td className="py-2.5 px-4 text-slate-500">{st.email}</td>
                        <td className="py-2.5 px-4 text-slate-600 font-medium">{st.section || "A"}</td>
                        <td className="py-2.5 px-4 text-slate-800 font-medium">{st.mentor_name || "Unassigned"}</td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery(st.register_number || st.full_name);
                              setActiveTab("submissions");
                            }}
                            className="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                          >
                            {studentSubmissions.length} &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Mentorship Allocations Breakdown */}
        {activeTab === "overview" && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                CCE Department Faculty Mentorship Allocation Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Official distribution of 61 cohort students among department mentors
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {uniqueMentors.map((mentorName) => {
                const mentees = students.filter((s) => s.mentor_name === mentorName);
                const menteeIds = new Set(mentees.map((m) => m.student_id));
                const mentorSubmissions = submissions.filter((s) => menteeIds.has(s.student_id));

                return (
                  <div
                    key={mentorName}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-4 hover:border-purple-300 hover:bg-white transition-all shadow-2xs"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                        Faculty Mentor
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-0.5">{mentorName}</h4>
                      <p className="text-xs text-slate-500">Department of CCE</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-center">
                      <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                        <span className="block text-[10px] uppercase text-slate-400 font-semibold">Mentees</span>
                        <span className="text-lg font-bold text-slate-900">{mentees.length}</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                        <span className="block text-[10px] uppercase text-purple-700 font-semibold">Submissions</span>
                        <span className="text-lg font-bold text-purple-700">{mentorSubmissions.length}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMentorName(mentorName);
                        setActiveTab("submissions");
                      }}
                      className="w-full text-center py-2 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Inspect Submissions &rarr;
                    </button>
                  </div>
                );
              })}
            </div>
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
      </main>

      {/* Read-Only Activity Inspector Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div
            onClick={() => setSelectedSubmission(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
            <div className="relative w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-7 text-left shadow-2xl transition-all border border-slate-200/90 my-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                      {selectedSubmission.component_name || "PGPA Component"}
                    </span>
                    {renderStatusBadge(selectedSubmission.status)}
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900 leading-snug">
                    {selectedSubmission.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="mt-4 space-y-4 text-xs">
                {/* Student Identity Card */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Submitting Student
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedSubmission.student_name || "Student"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Assigned Mentor: {studentMentorMap.get(selectedSubmission.student_id) || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold text-purple-700">
                      {selectedSubmission.student_register_number || "—"}
                    </p>
                    <p className="text-[11px] text-slate-400">Department of CCE</p>
                  </div>
                </div>

                {/* Event Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200/70 p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Activity Type</span>
                    <span className="font-semibold text-slate-800">{selectedSubmission.activity_type || "Standard"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Organizer / Host</span>
                    <span className="font-semibold text-slate-800 truncate block">{selectedSubmission.organizer || "—"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Event Date</span>
                    <span className="font-semibold text-slate-800">{formatDate(selectedSubmission.event_date)}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Outcome / Score</span>
                    <span className="font-semibold text-slate-800">{selectedSubmission.outcome || "Completed"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Date Submitted</span>
                    <span className="font-semibold text-slate-800">{formatDate(selectedSubmission.submitted_at || selectedSubmission.created_at)}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 p-2.5">
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Submission State</span>
                    <span className="font-semibold text-slate-800 capitalize">{selectedSubmission.status}</span>
                  </div>
                </div>

                {/* Description */}
                {selectedSubmission.description && (
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-slate-500 text-[11px] mb-1">
                      Summary & Description
                    </p>
                    <div className="rounded-xl border border-slate-200/80 p-3 bg-slate-50/50 text-slate-700 leading-relaxed">
                      {selectedSubmission.description}
                    </div>
                  </div>
                )}

                {/* Evidence Files */}
                <div>
                  <p className="font-semibold uppercase tracking-wider text-slate-500 text-[11px] mb-1.5">
                    Supporting Evidence ({selectedSubmission.files?.length || 0})
                  </p>
                  {selectedSubmission.files && selectedSubmission.files.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSubmission.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="truncate">
                              <p className="font-semibold text-slate-900 truncate">{file.original_filename}</p>
                              <p className="text-[11px] text-slate-400">
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
                    <p className="text-slate-400 italic">No evidence files were attached to this submission.</p>
                  )}

                  {fileError && (
                    <p className="mt-2 text-xs text-rose-600 font-medium">{fileError}</p>
                  )}
                </div>

                {/* Audit & Workflow Notice */}
                <div className="rounded-xl border border-purple-200/70 bg-purple-50/50 p-3.5 text-slate-600 leading-relaxed text-[11px]">
                  <p className="font-bold text-purple-900 mb-0.5">Department Head Oversight Access</p>
                  <p>
                    Student submissions are directly recorded upon submission and made viewable to faculty mentors and the Head of Department. No approval action is required.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
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
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
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
    </div>
  );
}
