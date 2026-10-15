"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";

export default function MentorDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (!authLoading && user && user.role !== "mentor") {
      router.push(`/${user.role}`);
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading mentor dashboard from PostgreSQL...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-6 sm:p-8 text-white shadow-lg shadow-indigo-500/15">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Faculty Mentor Portal
              </span>
              <span className="text-xs text-indigo-400">&bull;</span>
              <span className="text-xs text-indigo-300">Evaluation & Verification</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              {user?.full_name}
            </h1>
            <p className="mt-1 text-sm text-indigo-200">
              Department of Computer and Communication Engineering
            </p>
          </div>

          <div className="flex sm:flex-col items-start sm:items-end gap-2">
            <RoleBadge role="mentor" />
            <span className="text-xs text-indigo-300">
              Account Status: {user?.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Review Queue & Assigned Mentees Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verification Queue Card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Pending Achievement Reviews
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Submissions awaiting faculty mentor verification
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              0 Pending
            </span>
          </div>

          {/* Real Empty State */}
          <div className="py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
              Queue is clear
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              No student submissions are currently awaiting review. When students upload certificates for PGPA verification, they will appear here.
            </p>
          </div>
        </div>

        {/* Mentees Summary Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800">
              Assigned Mentee Cohort
            </h2>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs text-slate-500 font-medium">Cohort Batch</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  CCE II Year Section A (2023-2027)
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs text-slate-500 font-medium">Audit Cycle</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  III Semester Evaluation
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 leading-tight">
              Mentee lists are governed by HOD allocations in PostgreSQL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
