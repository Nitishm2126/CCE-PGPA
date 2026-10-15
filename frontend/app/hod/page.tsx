"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";

export default function HODDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (!authLoading && user && user.role !== "hod") {
      router.push(`/${user.role}`);
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading department overview from PostgreSQL...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-lg shadow-purple-500/15">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                Department Head Portal
              </span>
              <span className="text-xs text-purple-400">&bull;</span>
              <span className="text-xs text-purple-300">Academic Audit & Governance</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
              {user?.full_name || "Head of Department"}
            </h1>
            <p className="mt-1 text-sm text-purple-200">
              Department of Computer and Communication Engineering (CCE)
            </p>
          </div>

          <div className="flex sm:flex-col items-start sm:items-end gap-2">
            <RoleBadge role="hod" />
            <span className="text-xs text-purple-300">
              Account Status: {user?.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Cohort Overview & Department Audit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Department Cohort Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verified student cohorts and mentor assignments
              </p>
            </div>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-900">
              CCE II Year A (61 Students)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <p className="text-xs text-slate-500 font-medium">Department Code</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                CCE (Computer & Communication)
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <p className="text-xs text-slate-500 font-medium">Academic Year / Semester</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Year 2 &bull; Semester III
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/60 p-4 text-xs text-slate-600 dark:text-slate-400 dark:border-slate-800 space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Roster Import Status:
            </p>
            <p>
              61 student records imported from official department workbook with preserved mentor allocations:
              <br />
              &bull; LURDHUMARY J (25 students)
              <br />
              &bull; P. LEKHA (25 students)
              <br />
              &bull; PACHHAIAMMAL PRIYA M (11 students)
            </p>
          </div>
        </div>

        {/* Audit Security Summary */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800">
              Security & Audit Guard
            </h2>

            <div className="mt-6 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span>PostgreSQL Role-Based Access Control</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span>Google Drive Proxy Storage Protected</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span>Closed Cohort Authentication Guard</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 leading-tight">
              Audit logs record every achievement verification, grade change, and certificate access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
