"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StudentDetailResponse } from "@/types/auth";
import { RoleBadge } from "@/components/RoleBadge";
import { DesignationBadge } from "@/components/DesignationBadge";
import { EditStudentProfileModal } from "./EditStudentProfileModal";

interface StudentProfileSectionProps {
  studentData: StudentDetailResponse | null;
  onLogout: () => void;
  onProfileUpdated?: (updated: StudentDetailResponse) => void;
}

export const StudentProfileSection: React.FC<StudentProfileSectionProps> = ({
  studentData,
  onLogout,
  onProfileUpdated,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const profile = studentData?.profile;
  const assignedMentor = studentData?.assigned_mentor;
  const hodSupervisor = studentData?.hod_supervisor;

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
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-base shadow-2xs">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {studentData?.full_name || "Student"}
                </h2>
                <DesignationBadge designation="Change Maker" size="sm" />
                <RoleBadge role="student" size="sm" />
              </div>
              <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                {profile?.register_number || "Register No. Pending"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Edit Profile Action */}
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              <svg className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              <span>Edit Profile</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Active Institutional Record
            </span>
          </div>
        </div>

        {/* Academic Details Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
          <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Department
            </span>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              {profile?.department || "CCE"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Year & Section
            </span>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              Year {profile?.year || 2} &bull; Section {profile?.section || "A"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Semester
            </span>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              {profile?.semester || "III SEM"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Academic Cohort
            </span>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              Batch {profile?.batch || "2025-2029"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Phone Number
            </span>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              {profile?.phone_number || "Not specified"}
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Official Email
            </span>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white truncate">
              {studentData?.email}
            </p>
          </div>
        </div>
      </div>

      {/* 3-Tier Academic Mentorship Structure Card */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Academic Mentorship Hierarchy (3-Tier Structure)
          </h3>
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-800">
            Department of CCE
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary Assigned Faculty Mentor */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Primary Faculty Mentor
              </span>
              <DesignationBadge designation="Torch Bearer" size="sm" />
            </div>
            {assignedMentor ? (
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {assignedMentor.full_name}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {assignedMentor.email}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Department of {assignedMentor.department} &bull; Faculty Mentor
                </p>
              </div>
            ) : profile?.original_mentor_name ? (
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {profile.original_mentor_name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Department of Computer and Communication Engineering
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Faculty mentor allocation pending.</p>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60 pt-2 leading-relaxed">
              Conducts direct verification and primary audit for all submitted PGPA activities.
            </p>
          </div>

          {/* Department HOD as Mentor 3 / Supervisory Authority */}
          <div className="rounded-xl border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 dark:text-purple-300">
                Department HOD &bull; Mentor 3 (Supervisory)
              </span>
              <DesignationBadge designation="Torch Bearer" size="sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {hodSupervisor?.full_name || "Dr. Pachaiammal Alias Priya"}
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                {hodSupervisor?.email || "sundatplus4@gmail.com"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Head of Department &bull; Supervisory Authority (Mentor 3)
              </p>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-purple-200/60 dark:border-purple-800/60 pt-2 leading-relaxed">
              Provides departmental governance, final PGPA grade approval, and supervisory oversight across all cohort mentees.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
          The Department of Computer and Communication Engineering operates on a structured 3-tier mentorship model (Faculty Mentor 1: P. LEKHA, Faculty Mentor 2: LURDHUMARY J, and Department HOD as Mentor 3) ensuring dual faculty oversight and institutional grade integrity for autonomous accreditation.
        </p>
      </div>

      {/* Account Session Controls */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Account Session</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Securely sign out of CCE-PGPA on this workstation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/change-password"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95 transition-all cursor-pointer"
            >
              Change Password
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 active:scale-95 transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditStudentProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          studentData={studentData}
          onProfileUpdated={(updated) => {
            if (onProfileUpdated) onProfileUpdated(updated);
          }}
        />
      )}
    </div>
  );
};
