"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { StudentDetailResponse } from "@/types/auth";
import {
  PGPAComponentResponse,
  AchievementResponse,
  AchievementCreate,
} from "@/types/achievement";

import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentDrawer } from "@/components/student/StudentDrawer";
import { RecentActivitySection } from "@/components/student/RecentActivitySection";
import { PGPAComponentsSection } from "@/components/student/PGPAComponentsSection";
import { ProgressAnalyticsSection } from "@/components/student/ProgressAnalyticsSection";
import { StudentProfileSection } from "@/components/student/StudentProfileSection";
import { SubmitAchievementModal } from "@/components/student/SubmitAchievementModal";
import { BottomNavigation } from "@/components/student/BottomNavigation";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, token, logout, isLoading: authLoading } = useAuth();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Data states
  const [studentData, setStudentData] = useState<StudentDetailResponse | null>(null);
  const [components, setComponents] = useState<PGPAComponentResponse[]>([]);
  const [achievements, setAchievements] = useState<AchievementResponse[]>([]);

  // Loading states
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isLoadingComponents, setIsLoadingComponents] = useState<boolean>(true);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState<boolean>(true);

  // Error states
  const [profileError, setProfileError] = useState<string | null>(null);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [preselectedComponentId, setPreselectedComponentId] = useState<string | null>(null);
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Authentication guards
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.role !== "student") {
      router.push(`/${user.role}`);
      return;
    }
    if (!authLoading && user && user.must_change_password) {
      router.push("/change-password");
      return;
    }
  }, [user, authLoading, router]);

  // Load Profile from /api/v1/students/me
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

  // Load PGPA Components from /api/v1/students/components
  const loadComponents = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoadingComponents(true);
      setComponentsError(null);
      const data = await api.getComponents(token);
      setComponents(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load components catalogue.";
      setComponentsError(msg);
    } finally {
      setIsLoadingComponents(false);
    }
  }, [token]);

  // Load Achievements from /api/v1/students/me/achievements
  const loadAchievements = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoadingAchievements(true);
      setAchievementsError(null);
      const data = await api.getMyAchievements(token);
      setAchievements(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load activity history.";
      setAchievementsError(msg);
    } finally {
      setIsLoadingAchievements(false);
    }
  }, [token]);

  // Initial load via asynchronous fetch
  useEffect(() => {
    let ignore = false;
    if (!token) return;

    const fetchAllData = async () => {
      try {
        const [profileRes, compRes, achRes] = await Promise.allSettled([
          api.getStudentDetail(token),
          api.getComponents(token),
          api.getMyAchievements(token),
        ]);

        if (ignore) return;

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

  // Handle Toast Auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Submit achievement handler
  const handleCreateAchievement = async (
    data: AchievementCreate,
    evidenceFile: File,
    submitImmediately: boolean
  ) => {
    if (!token) return;

    // 1. Create draft achievement record
    const created = await api.createAchievement(data, token);

    try {
      // 2. Upload required PDF evidence binary to Google Drive
      await api.uploadEvidenceFile(created.id, evidenceFile, "certificate", token);

      // 3. Transition status if immediate submission requested
      if (submitImmediately) {
        await api.submitAchievement(created.id, token);
        setToastMessage("Achievement and PDF evidence submitted successfully!");
      } else {
        setToastMessage("Achievement and PDF evidence saved as draft.");
      }
    } catch (uploadErr: unknown) {
      // Rollback: Clean up the draft achievement in PostgreSQL so no incomplete record without evidence remains
      try {
        await api.deleteAchievement(created.id, token);
      } catch (delErr) {
        console.error("Failed to delete draft after upload failure:", delErr);
      }
      throw uploadErr;
    }

    // Refresh activity list
    await loadAchievements();
  };

  // 1-Click submit for drafts
  const handleSubmitForReview = async (achievementId: string) => {
    if (!token) return;
    try {
      setSubmittingReviewId(achievementId);
      await api.submitAchievement(achievementId, token);
      setToastMessage("Achievement submitted successfully!");
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
      <div className="flex-1 flex items-center justify-center min-h-[60vh] p-6 bg-[#fafbfc]">
        <div className="flex flex-col items-center gap-3 text-center bg-white p-8 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] max-w-sm w-full">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent shadow-xs" />
          <p className="text-xs font-semibold text-slate-800">
            Connecting to PostgreSQL CCE Student Records...
          </p>
          <p className="text-[11px] text-slate-500">
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-rose-900">
            Unable to load student record
          </h2>
          <p className="text-xs text-rose-700 mt-1">{profileError}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={loadProfile}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer"
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
    <div className="min-h-screen bg-[#fafbfc] flex flex-col font-sans text-slate-900">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl bg-slate-900 text-white px-4 py-3 shadow-xl flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* 1. Institutional Student Header with Sairam Logos */}
      <StudentHeader
        studentData={studentData}
        fallbackName={user?.full_name}
        onOpenMenu={() => setIsDrawerOpen(true)}
        onOpenProfile={() => setActiveTab("profile")}
        onSubmitClick={() => handleOpenSubmitModal(null)}
        onLogout={handleLogout}
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
      />

      {/* 3. Main Dashboard Body Container with Harmonious Spacing */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
        {/* Desktop Segment Navigation (Visible >= md) */}
        <BottomNavigation
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onSubmitClick={() => handleOpenSubmitModal(null)}
        />

        {/* Dynamic Student Greeting & Institutional Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Hi, {firstName}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                Student
              </span>
            </div>
            <p className="text-sm font-semibold text-[#0284c7]">
              Department of Computer and Communication Engineering
            </p>
            <p className="text-xs text-slate-500 font-normal">
              Academic Year {profile?.year || 2} &bull; Section {profile?.section || "A"} &bull; {profile?.semester || "III SEM"} &bull; Batch {profile?.batch || "2025-2029"}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenSubmitModal(null)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-xs transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Submit Activity</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DASHBOARD (Default Overview) */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Academic Summary and Mentor Information Strip */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="pt-2 sm:pt-0 sm:px-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Register Number
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {profile?.register_number || "SEC25CO031"}
                  </p>
                </div>

                <div className="pt-2 sm:pt-0 sm:px-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Class Cohort
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Year {profile?.year || 2} &bull; Sec {profile?.section || "A"} ({profile?.semester || "III SEM"})
                  </p>
                </div>

                <div className="pt-2 sm:pt-0 sm:px-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Academic Batch
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {profile?.batch || "2025-2029"}
                  </p>
                </div>

                <div className="pt-2 sm:pt-0 sm:px-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Assigned Mentor
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {studentData?.assigned_mentor?.full_name || profile?.original_mentor_name || "LURDHUMARY J"}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Activity Section */}
            <RecentActivitySection
              achievements={achievements}
              isLoading={isLoadingAchievements}
              error={achievementsError}
              onRetry={loadAchievements}
              onSubmitClick={() => handleOpenSubmitModal(null)}
              onViewAll={() => setActiveTab("activity")}
              onSubmitForReview={handleSubmitForReview}
              isSubmittingId={submittingReviewId}
              maxDisplay={3}
            />

            {/* PGPA Components Catalogue (Highest Priority) */}
            <PGPAComponentsSection
              components={components}
              achievements={achievements}
              isLoading={isLoadingComponents}
              error={componentsError}
              onRetry={loadComponents}
              onSelectComponentForSubmit={(c) => handleOpenSubmitModal(c.id)}
              studentSemester={profile?.semester}
            />
          </div>
        )}

        {/* TAB 2: COMPONENTS (Dedicated Component Catalogue) */}
        {activeTab === "components" && (
          <div className="space-y-6">
            <PGPAComponentsSection
              components={components}
              achievements={achievements}
              isLoading={isLoadingComponents}
              error={componentsError}
              onRetry={loadComponents}
              onSelectComponentForSubmit={(c) => handleOpenSubmitModal(c.id)}
              studentSemester={profile?.semester}
            />
          </div>
        )}

        {/* TAB 3: ACTIVITY (Full Submissions List & Review Status) */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            <RecentActivitySection
              achievements={achievements}
              isLoading={isLoadingAchievements}
              error={achievementsError}
              onRetry={loadAchievements}
              onSubmitClick={() => handleOpenSubmitModal(null)}
              onSubmitForReview={handleSubmitForReview}
              isSubmittingId={submittingReviewId}
              showAll={true}
            />
          </div>
        )}

        {/* TAB 4: PROGRESS (Real PGPA Progress Analytics) */}
        {activeTab === "progress" && (
          <div className="space-y-6">
            <ProgressAnalyticsSection
              components={components}
              achievements={achievements}
              onSubmitClick={() => handleOpenSubmitModal(null)}
            />
          </div>
        )}

        {/* TAB 5: PROFILE (Student & Mentor Academic Profile) */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <StudentProfileSection
              studentData={studentData}
              onLogout={handleLogout}
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
            className="w-full h-auto object-contain mx-auto"
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
            className="w-full h-auto object-contain mx-auto"
          />
        </div>

        {/* Attribution & Legal Notice */}
        <div className="text-center pt-4 pb-4 space-y-1">
          <p className="text-xs font-semibold text-slate-700 tracking-wide">
            Designed and Developed by Team FineWorks
          </p>
          <p className="text-xs text-slate-500">
            Department of Computer and Communication Engineering &bull; Sri Sairam Engineering College
          </p>
          <p className="text-[11px] text-slate-400">
            CCE-PGPA Management System &bull; Version 1.0.0 &bull; All Institutional Rights Reserved
          </p>
        </div>
      </footer>

      {/* 6. Submit Achievement Modal */}
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
    </div>
  );
}
