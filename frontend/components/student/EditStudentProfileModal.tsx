"use client";

import React, { useState, useEffect } from "react";
import { StudentDetailResponse } from "@/types/auth";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface EditStudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentData: StudentDetailResponse | null;
  onProfileUpdated: (updated: StudentDetailResponse) => void;
}

export const EditStudentProfileModal: React.FC<EditStudentProfileModalProps> = ({
  isOpen,
  onClose,
  studentData,
  onProfileUpdated,
}) => {
  const { token } = useAuth();
  const profile = studentData?.profile;

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentData) {
      setFullName(studentData.full_name || "");
      setPhoneNumber(profile?.phone_number || "");
      setError(null);
    }
  }, [studentData, profile, isOpen]);

  if (!isOpen || !studentData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Session expired. Please log in again.");
      return;
    }

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setError("Full name must be at least 2 characters long.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await api.updateStudentProfile(
        {
          full_name: trimmedName,
          phone_number: phoneNumber.trim() || undefined,
        },
        token
      );
      onProfileUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Edit Student Profile
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update your permitted personal details in the institutional registry
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Editable Field: Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={255}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. NITISH M"
            />
          </div>

          {/* Editable Field: Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contact Phone Number
            </label>
            <input
              type="tel"
              maxLength={20}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. +91 9876543210"
            />
          </div>

          {/* Institutional Protected Fields Notice */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Protected Institutional Identifiers (Read-Only)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Register No</span>
                <p className="font-mono font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                  {profile?.register_number || "—"}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Academic Batch</span>
                <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                  {profile?.batch || "2025-2029"}
                </p>
              </div>

              <div className="col-span-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-medium uppercase">Official Institutional Email</span>
                <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                  {studentData.email}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
              To update your institutional register number, college email, or academic department, please contact the CCE Department Office or System Administrator.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
