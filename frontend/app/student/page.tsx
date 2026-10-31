"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { StudentDetailResponse } from "@/types/auth";
import {
  PGPAComponentResponse,
  AchievementResponse,
  AchievementCreate,
  SemesterResponse,
} from "@/types/achievement";

import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentDrawer } from "@/components/student/StudentDrawer";
import { RecentActivitySection } from "@/components/student/RecentActivitySection";
import { PGPAComponentsSection } from "@/components/student/PGPAComponentsSection";
import { ProgressAnalyticsSection } from "@/components/student/ProgressAnalyticsSection";
import { StudentProfileSection } from "@/components/student/StudentProfileSection";
import { SubmitAchievementModal } from "@/components/student/SubmitAchievementModal";
import { EditAchievementModal } from "@/components/student/EditAchievementModal";
import { DeleteAchievementModal } from "@/components/student/DeleteAchievementModal";
import { BottomNavigation } from "@/components/student/BottomNavigation";
import { MessageDrawerModal } from "@/components/messages/MessageDrawerModal";
import { MessagesHubView } from "@/components/messages/MessagesHubView";
import { DesignationBadge } from "@/components/DesignationBadge";
import { RoleBadge } from "@/components/RoleBadge";
import { PGPAPerformanceTracker } from "@/components/student/PGPAPerformanceTracker";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, token, logout, isLoading: authLoading } = useAuth();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Data states
  const [studentData, setStudentData] = useState<StudentDetailResponse | null>(null);
  const [components, setComponents] = useState<PGPAComponentResponse[]>([]);
  const [achievements, setAchievements] = useState<AchievementResponse[]>([]);
  const [semesters, setSemesters] = useState<SemesterResponse[]>([]);
  const [selectedCatalogueSemesterId, setSelectedCatalogueSemesterId] = useState<string>("");

  // Loading states
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isLoadingComponents, setIsLoadingComponents] = useState<boolean>(true);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState<boolean>(true);

  // Error states
  const [profileError, setProfileError] = useState<string | null>(null);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);

  // Interactive UI states
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [preselectedComponentId, setPreselectedComponentId] = useState<string | null>(null);
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit and Delete Modals state
  const [editingAchievement, setEditingAchievement] = useState<AchievementResponse | null>(null);
  const [deletingAchievement, setDeletingAchievement] = useState<AchievementResponse | null>(null);

  // Messages & Remarks state
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [unreadCountsByAchievement, setUnreadCountsByAchievement] = useState<Record<string, number>>({});
  const [activeAchievementForMessages, setActiveAchievementForMessages] = useState<AchievementResponse | null>(null);
  const [isMessageDrawerOpen, setIsMessageDrawerOpen] = useState<boolean>(false);

  // Authentication & Role Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login/student");
      return;
    }
    if (!authLoading && user && user.role !== "student") {
      router.push("/login/student");
      return;
    }
    if (!authLoading && user && user.must_change_password) {
      router.push("/change-password");
      return;
    }
  }, [user, authLoading, router]);

  // Data loading callbacks
  const loadProfile = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoadingProfile(true);
      setProfileError(null);
      const data = await api.getStudentDetail(token);
      setStudentData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load student profile.";
      setProfileError(msg);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [token]);

  const loadComponents = useCallback(async (semId?: string) => {
    if (!token) return;
    try {
      setIsLoadingComponents(true);
      setComponentsError(null);
      const targetSemId = semId !== undefined ? semId : selectedCatalogueSemesterId;
      const data = await api.getComponents({
        semesterId: targetSemId || undefined,
        token,
        forceRefresh: true,
      });
      setComponents(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load PGPA components.";
      setComponentsError(msg);
    } finally {
      setIsLoadingComponents(false);
    }
  }, [token, selectedCatalogueSemesterId]);

  const handleCatalogueSemesterChange = (semId: string) => {
    setSelectedCatalogueSemesterId(semId);
    loadComponents(semId);
  };

  const loadAchievements = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoadingAchievements(true);
      setAchievementsError(null);
      const data = await api.getMyAchievements(token);
      setAchievements(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load achievements.";
      setAchievementsError(msg);
    } finally {
      setIsLoadingAchievements(false);
    }
  }, [token]);

  const loadUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getUnreadMessageCount(token);
      setUnreadMessagesCount(res.total_unread);
      setUnreadCountsByAchievement(res.by_achievement || {});
    } catch (err) {
      console.error("Failed to fetch unread messages count:", err);
    }
  }, [token]);

  // Initial data hydration
  useEffect(() => {
    let ignore = false;
    if (!token) return;

    const fetchAllData = async () => {
      try {
        const [profileRes, compRes, achRes, unreadRes, semsRes] = await Promise.allSettled([
          api.getStudentDetail(token),
          api.getComponents({ token, forceRefresh: true }),
          api.getMyAchievements(token),
          api.getUnreadMessageCount(token),
          api.studentGetSemesters(token),
        ]);

        if (ignore) return;

        if (semsRes.status === "fulfilled") {
          const sems = semsRes.value;
          setSemesters(sems);
          const studentSemStr = profileRes.status === "fulfilled" ? profileRes.value.profile?.semester : null;
          const matchedSem = studentSemStr
            ? sems.find(
                (s) =>
                  s.display_name?.toLowerCase() === studentSemStr.toLowerCase() ||
                  s.semester_number.toString() === studentSemStr.replace(/\D/g, "")
              )
            : null;
          if (matchedSem) {
            setSelectedCatalogueSemesterId(matchedSem.id);
          } else if (sems.length > 0) {
            setSelectedCatalogueSemesterId(sems[0].id);
          }
        }

        if (profileRes.status === "fulfilled") {
          setStudentData(profileRes.value);
          setProfileError(null);
        } else {
          setProfileError(
            profileRes.reason instanceof Error
              ? profileRes.reason.message
              : "Failed to load student profile."
          );
        }

        if (compRes.status === "fulfilled") {
          setComponents(compRes.value);
          setComponentsError(null);
        } else {
          setComponentsError(
            compRes.reason instanceof Error
              ? compRes.reason.message
              : "Failed to load components catalogue."
          );
        }

        if (achRes.status === "fulfilled") {
          setAchievements(achRes.value);
          setAchievementsError(null);
        } else {
          setAchievementsError(
            achRes.reason instanceof Error
              ? achRes.reason.message
              : "Failed to load activity history."
          );
        }

        if (unreadRes.status === "fulfilled") {
          setUnreadMessagesCount(unreadRes.value.total_unread);
          setUnreadCountsByAchievement(unreadRes.value.by_achievement || {});
        }
      } finally {
        if (!ignore) {
          setIsLoadingProfile(false);
          setIsLoadingComponents(false);
          setIsLoadingAchievements(false);
        }
      }
    };

    fetchAllData();

    return () => {
      ignore = true;
    };
  }, [token]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Achievement metrics calculation for balanced Progress Summary
  const achievementMetrics = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let draft = 0;

    achievements.forEach((a) => {
      if (a.status === "approved") approved++;
      else if (a.status === "pending") pending++;
      else if (a.status === "rejected") rejected++;
      else if (a.status === "draft") draft++;
    });

    return {
      total: achievements.length,
      approved,
      pending,
      rejected,
      draft,
    };
  }, [achievements]);

  // Create achievement handler
  const handleCreateAchievement = async (
    data: AchievementCreate,
    evidenceFile: File | null,
    submitImmediately: boolean
  ) => {
    if (!token) return;

    const created = await api.createAchievement(data, token);

    let uploadSucceeded = false;
    let uploadErrorMsg: string | null = null;

    if (evidenceFile) {
      try {
        await api.uploadEvidenceFile(created.id, evidenceFile, "certificate", token);
        uploadSucceeded = true;
      } catch (uploadErr: unknown) {
        uploadErrorMsg = uploadErr instanceof Error ? uploadErr.message : "Evidence upload failed";
        console.error("Evidence upload failed:", uploadErr);
        // Do NOT delete the created draft when Drive is unavailable!
        if (submitImmediately) {
          await loadAchievements();
          throw new Error(
            `Draft was saved successfully, but Google Drive upload failed: ${uploadErrorMsg}. You can reconnect Drive or upload your file later.`
          );
        }
      }
    }

    if (submitImmediately) {
      try {
        await api.submitAchievement(created.id, token);
        setToastMessage(
          uploadSucceeded
            ? "Achievement and evidence submitted successfully for mentor review!"
            : "Achievement submitted successfully for mentor review!"
        );
      } catch (submitErr: unknown) {
        await loadAchievements();
        throw submitErr;
      }
    } else {
      if (uploadErrorMsg) {
        setToastMessage(`Achievement saved as draft. Evidence upload failed: ${uploadErrorMsg}`);
      } else if (uploadSucceeded) {
        setToastMessage("Achievement and evidence saved as draft.");
      } else {
        setToastMessage("Achievement saved as draft.");
      }
    }

    await loadAchievements();
  };

  // Edit achievement handler
  const handleSaveAchievementEdit = async (
    achievementId: string,
    updatedFields: Partial<AchievementCreate>
  ) => {
    if (!token) return;
    await api.updateAchievement(achievementId, updatedFields, token);
    setToastMessage("Achievement updated successfully.");
    await loadAchievements();
  };

  // Delete achievement handler
  const handleConfirmDeleteAchievement = async (achievementId: string) => {
    if (!token) return;
    await api.deleteAchievement(achievementId, token);
    setToastMessage("Achievement record deleted successfully.");
    await loadAchievements();
  };

  // 1-Click submit for drafts
  const handleSubmitForReview = async (achievementId: string) => {
    if (!token) return;
    try {
      setSubmittingReviewId(achievementId);
      await api.submitAchievement(achievementId, token);
      setToastMessage("Achievement submitted successfully for mentor review!");
      await loadAchievements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit for review.";
      setToastMessage(msg);
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const handleOpenSubmitModal = (componentId?: string | null) => {
    setPreselectedComponentId(componentId || null);
    setIsSubmitModalOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Global Auth loading state
  if (authLoading || (isLoadingProfile && !studentData && !profileError)) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] p-6 bg-slate-50 dark:bg-[#0F141B]">
        <div className="flex flex-col items-center gap-3 text-center bg-white dark:bg-[#1C2531] p-8 rounded-2xl border border-slate-200 dark:border-[#2B3543] shadow-xs max-w-sm w-full">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent shadow-2xs" />
          <p className="text-xs font-semibold text-slate-800 dark:text-[#E8EDF4]">
            Connecting to PostgreSQL CCE Student Records...
          </p>
          <p className="text-[11px] text-slate-500 dark:text-[#7E8B9C]">
            Verifying cohort authentication and academic profile
          </p>
        </div>
      </div>
    );
  }

  // Profile fatal error state
  if (profileError && !studentData) {
    return (
      <div className="mx-auto max-w-lg p-6 my-12">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 mb-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            Unable to load student record
          </h2>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{profileError}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={loadProfile}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-[#1C2531] px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const profile = studentData?.profile;
  const fullName = studentData?.full_name || user?.full_name || "Student";
  const firstName = fullName.split(" ")[0] || "Student";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F141B] flex flex-col font-sans text-slate-900 dark:text-[#E8EDF4] transition-colors">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl bg-slate-900 dark:bg-[#1C2531] text-white dark:text-[#E8EDF4] px-4 py-3 shadow-xl flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 border border-slate-700 dark:border-[#2B3543]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white dark:hover:text-[#E8EDF4] cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center text-base"
          >
            &times;
          </button>
        </div>
      )}

      {/* 1. Institutional Student Header */}
      <StudentHeader
        studentData={studentData}
        fallbackName={fullName}
        onOpenMenu={() => setIsDrawerOpen(true)}
        onOpenProfile={() => setActiveTab("profile")}
        onSubmitClick={() => handleOpenSubmitModal(null)}
        onLogout={handleLogout}
        onOpenMessages={() => setActiveTab("messages")}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* 2. Slide-Over Navigation Drawer */}
      <StudentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        studentData={studentData}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onSubmitClick={() => handleOpenSubmitModal(null)}
        onLogout={handleLogout}
        unreadMessagesCount={unreadMessagesCount}
      />

      {/* 3. Main Dashboard Body Container with Harmonious Spacing */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
        {/* Desktop Segment Navigation */}
        <BottomNavigation
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onSubmitClick={() => handleOpenSubmitModal(null)}
          unreadMessagesCount={unreadMessagesCount}
        />

        {/* Dynamic Student Greeting & Institutional Banner */}
        <div className="bg-white dark:bg-[#171E28] rounded-2xl border border-slate-200 dark:border-[#2B3543] p-5 sm:p-7 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#E8EDF4]">
                Hi, {firstName}
              </h1>
              <DesignationBadge designation="Change Maker" size="md" />
              <RoleBadge role="student" size="sm" />
            </div>
            <p className="text-sm font-semibold text-blue-600 dark:text-[#4C83E6]">
              Department of Computer and Communication Engineering
            </p>
            <p className="text-xs text-slate-500 dark:text-[#7E8B9C] font-normal">
              Academic Year {profile?.year || 2} &bull; Section {profile?.section || "A"} &bull; {profile?.semester || "III SEM"} &bull; Batch {profile?.batch || "2025-2029"}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenSubmitModal(null)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-2xs transition-colors cursor-pointer min-h-[44px]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Submit Activity</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DASHBOARD (Balanced Spacing & Clean Overview - NO duplicate components catalogue) */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Academic Summary Strip */}
            <div className="bg-white dark:bg-[#171E28] rounded-2xl border border-slate-200 dark:border-[#2B3543] p-4 sm:p-5 shadow-2xs transition-colors">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50/70 dark:bg-[#1C2531]/70 p-3.5 rounded-xl border border-slate-200/60 dark:border-[#2B3543]/60">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E8B9C] uppercase tracking-wider block">
                    Register Number
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-[#E8EDF4]">
                    {profile?.register_number || "SEC25CO031"}
                  </p>
                </div>

                <div className="bg-slate-50/70 dark:bg-[#1C2531]/70 p-3.5 rounded-xl border border-slate-200/60 dark:border-[#2B3543]/60">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E8B9C] uppercase tracking-wider block">
                    Class Cohort
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-[#E8EDF4]">
                    Year {profile?.year || 2} &bull; Sec {profile?.section || "A"} ({profile?.semester || "III SEM"})
                  </p>
                </div>

                <div className="bg-slate-50/70 dark:bg-[#1C2531]/70 p-3.5 rounded-xl border border-slate-200/60 dark:border-[#2B3543]/60">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E8B9C] uppercase tracking-wider block">
                    Academic Batch
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-[#E8EDF4]">
                    {profile?.batch || "2025-2029"}
                  </p>
                </div>

                <div className="bg-slate-50/70 dark:bg-[#1C2531]/70 p-3.5 rounded-xl border border-slate-200/60 dark:border-[#2B3543]/60">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E8B9C] uppercase tracking-wider block">
                    Assigned Mentor
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 dark:text-[#E8EDF4]">
                      {studentData?.assigned_mentor?.full_name || profile?.original_mentor_name || "LURDHUMARY J"}
                    </p>
                    <DesignationBadge designation="Torch Bearer" size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive PGPA Performance Tracker (Pure SVG Points Time-Series & 5 Target Cards) */}
            <PGPAPerformanceTracker
              token={token}
              achievements={achievements}
              visibleComponents={components}
              onNavigateComponents={() => setActiveTab("components")}
              onSubmitActivity={() => handleOpenSubmitModal(null)}
            />

            {/* Balanced PGPA Progress Summary Metrics Card */}
            <div className="bg-white dark:bg-[#171E28] rounded-2xl border border-slate-200 dark:border-[#2B3543] p-5 sm:p-6 shadow-2xs transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3543]">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-[#E8EDF4]">
                    Activity Submission Status
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#7E8B9C] mt-0.5">
                    Real-time status of your student activity submissions and mentor audits
                  </p>
                </div>

                {/* Direct CTA to dedicated Components Page */}
                <button
                  type="button"
                  onClick={() => setActiveTab("components")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs shadow-2xs transition-colors cursor-pointer min-h-[36px]"
                >
                  <span>Browse All 14 Components</span>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl bg-emerald-50/60 dark:bg-[#122422] border border-emerald-200/70 dark:border-emerald-800/60 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Approved Records
                  </span>
                  <p className="text-2xl font-extrabold text-emerald-900 dark:text-[#5EEAD4] mt-1">
                    {achievementMetrics.approved}
                  </p>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400/80 mt-0.5 block">
                    Verified by Mentor
                  </span>
                </div>

                <div className="rounded-xl bg-blue-50/60 dark:bg-[#132338] border border-blue-200/70 dark:border-blue-800/60 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-400">
                    In Review
                  </span>
                  <p className="text-2xl font-extrabold text-blue-900 dark:text-[#93C5FD] mt-1">
                    {achievementMetrics.pending}
                  </p>
                  <span className="text-[10px] text-blue-700 dark:text-blue-400/80 mt-0.5 block">
                    Awaiting Audit
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-[#1C2531] border border-slate-200/70 dark:border-[#2B3543] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E8B9C]">
                    Draft Records
                  </span>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-[#E8EDF4] mt-1">
                    {achievementMetrics.draft}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-[#7E8B9C] mt-0.5 block">
                    Editable Submissions
                  </span>
                </div>

                <div className="rounded-xl bg-slate-100/60 dark:bg-[#1E293B]/70 border border-slate-200/80 dark:border-[#334155] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#94A3B8]">
                    Total Tracked
                  </span>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-[#E8EDF4] mt-1">
                    {achievementMetrics.total}
                  </p>
                  <span className="text-[10px] text-slate-600 dark:text-[#94A3B8] mt-0.5 block">
                    Across 14 Categories
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Activity Section (Equipped with Edit, Delete, and Remarks) */}
            <RecentActivitySection
              achievements={achievements}
              isLoading={isLoadingAchievements}
              error={achievementsError}
              onRetry={loadAchievements}
              onSubmitClick={() => handleOpenSubmitModal(null)}
              onViewAll={() => setActiveTab("activity")}
              onSubmitForReview={handleSubmitForReview}
              onEditAchievement={(item) => setEditingAchievement(item)}
              onDeleteAchievement={(item) => setDeletingAchievement(item)}
              onOpenMessages={(item) => {
                setActiveAchievementForMessages(item);
                setIsMessageDrawerOpen(true);
              }}
              unreadCountsByAchievement={unreadCountsByAchievement}
              isSubmittingId={submittingReviewId}
              maxDisplay={4}
            />
          </div>
        )}

        {/* TAB 2: COMPONENTS (Dedicated Component Catalogue with all 13 components preserved) */}
        {activeTab === "components" && (
          <div className="space-y-6">
            <PGPAComponentsSection
              components={components}
              achievements={achievements}
              isLoading={isLoadingComponents}
              error={componentsError}
              onRetry={() => loadComponents()}
              onSelectComponentForSubmit={(c) => handleOpenSubmitModal(c.id)}
              studentSemester={profile?.semester}
              semesters={semesters}
              selectedSemesterId={selectedCatalogueSemesterId}
              onSemesterChange={handleCatalogueSemesterChange}
            />
          </div>
        )}

        {/* TAB 3: ACTIVITY (Full Submissions List & Review Status with Edit & Delete) */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            <RecentActivitySection
              achievements={achievements}
              isLoading={isLoadingAchievements}
              error={achievementsError}
              onRetry={loadAchievements}
              onSubmitClick={() => handleOpenSubmitModal(null)}
              onSubmitForReview={handleSubmitForReview}
              onEditAchievement={(item) => setEditingAchievement(item)}
              onDeleteAchievement={(item) => setDeletingAchievement(item)}
              onOpenMessages={(item) => {
                setActiveAchievementForMessages(item);
                setIsMessageDrawerOpen(true);
              }}
              unreadCountsByAchievement={unreadCountsByAchievement}
              isSubmittingId={submittingReviewId}
              showAll={true}
            />
          </div>
        )}

        {/* TAB 4: MESSAGES & REMARKS (Dedicated Communications Hub) */}
        {activeTab === "messages" && (
          <div className="space-y-6">
            <MessagesHubView
              portalRole="student"
              initialAchievementId={activeAchievementForMessages?.id}
              onUnreadCountChanged={loadUnreadCounts}
            />
          </div>
        )}

        {/* TAB 5: PROGRESS (Real PGPA Progress Analytics) */}
        {activeTab === "progress" && (
          <div className="space-y-6">
            <PGPAPerformanceTracker
              token={token}
              achievements={achievements}
              visibleComponents={components}
              onNavigateComponents={() => setActiveTab("components")}
              onSubmitActivity={() => handleOpenSubmitModal(null)}
            />
            <ProgressAnalyticsSection
              components={components}
              achievements={achievements}
              onSubmitClick={() => handleOpenSubmitModal(null)}
            />
          </div>
        )}

        {/* TAB 6: PROFILE (Student & Mentor Academic Profile) */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <StudentProfileSection
              studentData={studentData}
              onLogout={handleLogout}
              onProfileUpdated={(updated) => setStudentData(updated)}
            />
          </div>
        )}
      </main>

      {/* 4. Official Sairam SDG Banner Strip */}
      <section aria-label="Sustainable Development Goals" className="w-full mt-6 px-4">
        <div className="mx-auto max-w-6xl">
          <Image
            src="/images/sairam-sdg.png"
            alt="United Nations Sustainable Development Goals - Sri Sairam Engineering College"
            width={1600}
            height={125}
            className="w-full h-auto object-contain mx-auto dark:opacity-85"
          />
        </div>
      </section>

      {/* 5. Official Sairam Leo Muthu Artwork Footer Banner */}
      <footer className="w-full mt-4 sm:mt-6 px-4 pb-20 md:pb-6">
        <div className="mx-auto max-w-6xl">
          <Image
            src="/images/sairam-footer.png"
            alt="Sri Sairam Engineering College - Founder Chairman MJF. Ln. Leo Muthu"
            width={1600}
            height={251}
            className="w-full h-auto object-contain mx-auto dark:opacity-85"
          />
        </div>

        {/* Attribution & Legal Notice */}
        <div className="text-center pt-4 pb-4 space-y-1">
          <p className="text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] tracking-wide">
            Designed and Developed by Team FineWorks
          </p>
          <p className="text-xs text-slate-500 dark:text-[#7E8B9C]">
            Department of Computer and Communication Engineering &bull; Sri Sairam Engineering College
          </p>
          <p className="text-[11px] text-slate-400 dark:text-[#64748B]">
            CCE-PGPA Management System &bull; Version 1.0.0 &bull; All Institutional Rights Reserved
          </p>
        </div>
      </footer>

      {/* 6. Modals Container */}
      {/* Submit Achievement Modal */}
      <SubmitAchievementModal
        isOpen={isSubmitModalOpen}
        onClose={() => {
          setIsSubmitModalOpen(false);
          setPreselectedComponentId(null);
        }}
        components={components}
        initialComponentId={preselectedComponentId}
        onSubmit={handleCreateAchievement}
      />

      {/* Edit Achievement Modal */}
      {editingAchievement && (
        <EditAchievementModal
          isOpen={!!editingAchievement}
          onClose={() => setEditingAchievement(null)}
          achievement={editingAchievement}
          onSave={handleSaveAchievementEdit}
          onRefreshed={loadAchievements}
        />
      )}

      {/* Delete Achievement Modal */}
      {deletingAchievement && (
        <DeleteAchievementModal
          isOpen={!!deletingAchievement}
          onClose={() => setDeletingAchievement(null)}
          achievement={deletingAchievement}
          onConfirmDelete={handleConfirmDeleteAchievement}
        />
      )}

      {/* Messages Conversation Drawer */}
      {isMessageDrawerOpen && activeAchievementForMessages && (
        <MessageDrawerModal
          isOpen={isMessageDrawerOpen}
          onClose={() => {
            setIsMessageDrawerOpen(false);
            loadUnreadCounts();
          }}
          achievement={activeAchievementForMessages}
          targetStudent={{
            id: user?.id || "",
            name: user?.full_name || "Student",
            register_number: studentData?.profile?.register_number || "",
          }}
          currentUserRole="student"
          onMessageSent={() => loadUnreadCounts()}
        />
      )}
    </div>
  );
}
