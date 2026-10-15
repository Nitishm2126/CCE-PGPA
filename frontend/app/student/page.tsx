"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { StudentDetailResponse } from "@/types/auth";
import { RoleBadge } from "@/components/RoleBadge";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  const [studentData, setStudentData] = useState<StudentDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (!authLoading && user && user.role !== "student") {
      router.push(`/${user.role}`);
      return;
    }

    const loadStudentData = async () => {
      if (!token) return;
      try {
        setIsLoading(true);
        const data = await api.getStudentDetail(token);
        setStudentData(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load profile.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && token) {
      loadStudentData();
    }
  }, [user, token, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading student profile from PostgreSQL...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Unable to load student record</p>
          <p className="text-xs text-rose-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const profile = studentData?.profile;
  const assignedMentor = studentData?.assigned_mentor;

  return (
    <div className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner / Welcome */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 p-6 sm:p-8 text-white shadow-lg shadow-indigo-500/15">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                Student Portal
              </span>
              <span className="text-xs text-indigo-300">&bull;</span>
              <span className="text-xs text-indigo-200">Academic Year 2024-2025</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {studentData?.full_name || user?.full_name}
            </h1>
            <p className="mt-1 text-sm text-indigo-100/90">
              Department of Computer and Communication Engineering (CCE)
            </p>
          </div>

          <div className="flex sm:flex-col items-start sm:items-end gap-2">
            <RoleBadge role="student" />
            <span className="text-xs text-indigo-200">
              Account Status: {user?.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Profile & Cohort Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Academic Profile Details */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Student Academic Profile
            </h2>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300">
              {profile?.register_number || "Register No. Pending"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
            <div>
              <p className="text-xs text-slate-500 font-medium">Department</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                {profile?.department || "CCE"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Current Year</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                Year {profile?.year || 2}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Section</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                Section {profile?.section || "A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Semester</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                {profile?.semester || "III SEM"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Academic Batch</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                {profile?.batch || "2023-2027"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Institutional Email</p>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white truncate" title={studentData?.email || user?.email}>
                {studentData?.email || user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Faculty Mentor Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Faculty Mentor
            </h2>

            <div className="mt-6 space-y-3">
              {assignedMentor ? (
                <div>
                  <p className="text-xs text-slate-500 font-medium">Assigned Mentor</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                    {assignedMentor.full_name}
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {assignedMentor.email}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Department of {assignedMentor.department}
                  </p>
                </div>
              ) : profile?.original_mentor_name ? (
                <div>
                  <p className="text-xs text-slate-500 font-medium">Allocated Mentor (Roster)</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                    {profile.original_mentor_name}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                    Staff account onboarding pending
                  </span>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Unassigned Mentor
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Mentor allocation will be assigned by HOD.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 leading-tight">
              All submitted PGPA activities are reviewed and verified by your assigned faculty mentor.
            </p>
          </div>
        </div>
      </div>

      {/* PGPA Achievement Records Placeholder with Real Empty State */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              PGPA Achievement Submissions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Point-Grade-Performance-Audit evaluation submissions and evidence certificates
            </p>
          </div>

          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500"
            title="Activity submission workflow opens upon phase completion"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Submit Achievement (Phase 7)
          </button>
        </div>

        {/* Real Empty State - Zero Fake Data */}
        <div className="py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
            No achievement records submitted
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Your cohort profile has been verified from the CCE department roster. Activity submission and Google Drive evidence upload will activate in Phase 7.
          </p>
        </div>
      </div>
    </div>
  );
}
