"use client";

import React from "react";
import Link from "next/link";
import { StudentDetailResponse } from "@/types/auth";
import { RoleBadge } from "@/components/RoleBadge";

interface StudentProfileSectionProps {
  studentData: StudentDetailResponse | null;
  onLogout: () => void;
}

export const StudentProfileSection: React.FC<StudentProfileSectionProps> = ({
  studentData,
  onLogout,
}) => {
  const profile = studentData?.profile;
  const assignedMentor = studentData?.assigned_mentor;

  const initials =
    studentData?.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "ST";

  return (
    <div className="space-y-5">
      {/* Student Identity Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-base shadow-2xs">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {studentData?.full_name || "Student"}
                </h2>
                <RoleBadge role="student" size="sm" />
              </div>
              <p className="text-xs font-mono font-semibold text-blue-600 mt-0.5">
                {profile?.register_number || "Register No. Pending"}
              </p>
            </div>
          </div>

          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active Institutional Record
          </span>
        </div>

        {/* Academic Details Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
          <div className="rounded-lg bg-slate-50/70 p-3.5 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Department
            </span>
            <p className="mt-1 font-semibold text-slate-900">
              {profile?.department || "CCE"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50/70 p-3.5 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Year & Section
            </span>
            <p className="mt-1 font-semibold text-slate-900">
              Year {profile?.year || 2} &bull; Section {profile?.section || "A"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50/70 p-3.5 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Semester
            </span>
            <p className="mt-1 font-semibold text-slate-900">
              {profile?.semester || "III SEM"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50/70 p-3.5 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Academic Cohort
            </span>
            <p className="mt-1 font-semibold text-slate-900">
              Batch {profile?.batch || "2025-2029"}
            </p>
          </div>

          <div className="col-span-2 rounded-lg bg-slate-50/70 p-3.5 border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Official Email
            </span>
            <p className="mt-1 font-semibold text-slate-900 truncate">
              {studentData?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Mentor Information Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Assigned Faculty Mentor
        </h3>

        <div className="mt-4">
          {assignedMentor ? (
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-900">
                {assignedMentor.full_name}
              </p>
              <p className="text-xs text-blue-600 font-medium">
                {assignedMentor.email}
              </p>
              <p className="text-xs text-slate-500">
                Department of {assignedMentor.department} &bull; Faculty Mentor
              </p>
            </div>
          ) : profile?.original_mentor_name ? (
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-900">
                {profile.original_mentor_name}
              </p>
              <p className="text-xs text-slate-500">
                Department of Computer and Communication Engineering
              </p>
              <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                Verified from Department Roster
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Faculty mentor allocation pending.</p>
          )}

          <p className="mt-4 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
            All submitted PGPA activities are audited and verified by your assigned faculty mentor before points are computed into your final audit grade.
          </p>
        </div>
      </div>

      {/* Account Session Controls */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Account Session</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely sign out of CCE-PGPA on this workstation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/change-password"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 active:scale-95 transition-all cursor-pointer"
            >
              Change Password
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:scale-95 transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
