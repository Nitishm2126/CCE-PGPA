"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import {
  AdminStudentItem,
  AdminStudentDetailResponse,
  AdminStudentCreate,
  AdminStudentUpdate,
  AdminStudentDeleteRequest,
  AdminMentorItem,
} from "@/types/auth";

interface ViewStudentModalProps {
  student: AdminStudentDetailResponse | null;
  onClose: () => void;
}

export const ViewStudentModal: React.FC<ViewStudentModalProps> = ({ student, onClose }) => {
  const [verificationStatus, setVerificationStatus] = useState<{
    verified: boolean;
    loading: boolean;
  }>({ verified: false, loading: true });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<{ link?: string | null; message: string; copied?: boolean } | null>(null);

  useEffect(() => {
    let ignore = false;
    if (!student) return;
    setVerificationStatus({ verified: false, loading: true });
    setVerificationMsg(null);
    api
      .adminGetVerificationStatus(student.id)
      .then((res) => {
        if (!ignore) {
          setVerificationStatus({ verified: res.email_verified, loading: false });
        }
      })
      .catch(() => {
        if (!ignore) {
          setVerificationStatus({ verified: false, loading: false });
        }
      });
    return () => {
      ignore = true;
    };
  }, [student]);

  const handleSendVerification = async () => {
    if (!student) return;
    setSendingEmail(true);
    try {
      const res = await api.adminSendVerificationEmail(student.id);
      setVerificationMsg({ link: res.verification_link, message: res.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate verification link.";
      setVerificationMsg({ message: msg });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopyLink = async () => {
    if (verificationMsg?.link) {
      await navigator.clipboard.writeText(verificationMsg.link);
      setVerificationMsg((prev) => (prev ? { ...prev, copied: true } : prev));
      setTimeout(() => {
        setVerificationMsg((prev) => (prev ? { ...prev, copied: false } : prev));
      }, 3000);
    }
  };

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Student Profile Inspection
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {student.full_name}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Register No: {student.register_number || "Unassigned"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Profile Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">Email &amp; Verification</span>
              {verificationStatus.loading ? (
                <span className="text-[10px] text-slate-400">Checking...</span>
              ) : verificationStatus.verified ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Unverified
                </span>
              )}
            </div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
              {student.email}
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">Department / Year</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {student.department} &bull; Year {student.year}
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">Section & Semester</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              Sec {student.section || "—"} &bull; {student.semester || "—"}
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">Batch</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {student.batch || "2025-2029"}
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">Account Status</span>
            <p className="font-semibold mt-0.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  student.is_active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {student.is_active ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">Firebase Identity</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5 font-mono text-[11px]">
              {student.firebase_uid ? "Linked" : "Pending First Login"}
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-3">
            <span className="text-slate-500 text-[11px]">Dedicated Google Drive Storage Folder</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5 font-mono text-[11px] flex items-center gap-1.5">
              {student.google_drive_folder_id ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-700 dark:text-emerald-300">{student.google_drive_folder_id}</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-amber-700 dark:text-amber-300">Pending Provisioning (auto-bound on first PDF submission or bulk setup)</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Firebase Email Verification Action Card */}
        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/70 dark:border-blue-900/40 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Firebase Authentication &bull; Email Verification
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {verificationStatus.verified
                  ? "This account's email address has been verified in Firebase Authentication."
                  : "Email verification is pending. Generate a verification link to send to the student."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendVerification}
              disabled={sendingEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              {sendingEmail ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              <span>{verificationStatus.verified ? "Resend Verification Link" : "Generate Verification Link"}</span>
            </button>
          </div>

          {verificationMsg && (
            <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 space-y-1.5 text-[11px]">
              <p className="text-blue-800 dark:text-blue-300 font-semibold">{verificationMsg.message}</p>
              {verificationMsg.link && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={verificationMsg.link}
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-[10px] font-mono text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shrink-0 cursor-pointer shadow-2xs"
                  >
                    {verificationMsg.copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assigned Mentor Card */}
        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Assigned Faculty Mentor
          </span>
          {student.assigned_mentor ? (
            <div className="mt-1 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {student.assigned_mentor.full_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {student.assigned_mentor.email} &bull; Staff ID:{" "}
                  {student.assigned_mentor.staff_id || "—"}
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                Primary Mentor
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500 italic">No active faculty mentor assigned.</p>
          )}
        </div>

        {/* Submissions & Files Summary */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">Submissions</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {student.submission_count}
            </p>
          </div>
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Approved</span>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {student.approved_count}
            </p>
          </div>
          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
            <span className="text-xs text-amber-600 dark:text-amber-400">Pending</span>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
              {student.pending_count}
            </p>
          </div>
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
            <span className="text-xs text-purple-600 dark:text-purple-400">Drive Files</span>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-0.5">
              {student.evidence_files_count}
            </p>
          </div>
        </div>

        {/* Assignment History */}
        {student.assignment_history && student.assignment_history.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Mentorship Assignment History
            </h3>
            <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
              {student.assignment_history.map((hist, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {hist.mentor_name}
                  </span>
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span>
                      {new Date(hist.assigned_at).toLocaleDateString()}
                      {hist.ended_at ? ` - ${new Date(hist.ended_at).toLocaleDateString()}` : " (Current)"}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        hist.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {hist.is_active ? "Active" : "Past"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

interface AddStudentModalProps {
  mentors: AdminMentorItem[];
  onClose: () => void;
  onSubmit: (data: AdminStudentCreate) => Promise<void>;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ mentors, onClose, onSubmit }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [department, setDepartment] = useState("CCE");
  const [year, setYear] = useState(2);
  const [section, setSection] = useState("A");
  const [semester, setSemester] = useState("IV SEM");
  const [batch, setBatch] = useState("2025-2029");
  const [assignedMentorId, setAssignedMentorId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !registerNumber.trim()) {
      setFormError("Full Name, Email, and Register Number are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await onSubmit({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        register_number: registerNumber.trim().toUpperCase(),
        department: department.trim(),
        year,
        section: section.trim() || undefined,
        semester: semester.trim() || undefined,
        batch: batch.trim() || undefined,
        assigned_mentor_id: assignedMentorId || null,
        password: password.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create student account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Student</h2>
            <p className="text-xs text-slate-500">
              Provision a new cohort member into PostgreSQL and Firebase Authentication.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        {formError && (
          <div className="p-3 text-xs bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200/60">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Student full name"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institutional Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rollno@sairam.edu.in"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Register Number *
              </label>
              <input
                type="text"
                required
                value={registerNumber}
                onChange={(e) => setRegisterNumber(e.target.value)}
                placeholder="e.g. 312423205001"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Section
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A / B"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Semester
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. IV SEM"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Batch
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="2025-2029"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Faculty Mentor
            </label>
            <select
              value={assignedMentorId}
              onChange={(e) => setAssignedMentorId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">-- No Mentor Assigned (Unassigned) --</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.staff_id || m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Password (Optional)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty to auto-generate secure credentials"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? "Creating Student..." : "Create Student Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditStudentModalProps {
  student: AdminStudentItem | null;
  mentors: AdminMentorItem[];
  token?: string | null;
  onClose: () => void;
  onSubmit: (studentId: string, data: AdminStudentUpdate) => Promise<void>;
  onPasswordResetSuccess?: (message: string) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  student,
  mentors,
  token,
  onClose,
  onSubmit,
  onPasswordResetSuccess,
}) => {
  if (!student) return null;

  const [fullName, setFullName] = useState(student.full_name);
  const [email, setEmail] = useState(student.email);
  const [registerNumber, setRegisterNumber] = useState(student.register_number || "");
  const [department, setDepartment] = useState(student.department || "CCE");
  const [year, setYear] = useState(student.year || 2);
  const [section, setSection] = useState(student.section || "");
  const [semester, setSemester] = useState(student.semester || "");
  const [batch, setBatch] = useState(student.batch || "");
  const [phoneNumber, setPhoneNumber] = useState(student.phone_number || "");
  const [assignedMentorId, setAssignedMentorId] = useState(
    student.assigned_mentor?.mentor_id || ""
  );
  const [isActive, setIsActive] = useState(student.is_active);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Individual Student Password Reset state
  const [showResetSection, setShowResetSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [showPasswordPlain, setShowPasswordPlain] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleGeneratePassword = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const chars = ["!", "@", "#", "$", "%"];
    const special = chars[Math.floor(Math.random() * chars.length)];
    const generated = `Sairam@${randomSuffix}${special}`;
    setNewPassword(generated);
    setShowPasswordPlain(true);
    setResetErrorMessage(null);
  };

  const handleExecuteResetPassword = async () => {
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setResetErrorMessage("New password must be at least 6 characters long.");
      return;
    }

    try {
      setIsResettingPassword(true);
      setResetErrorMessage(null);
      setResetSuccessMessage(null);

      const res = await api.adminResetStudentPassword(
        student.id,
        {
          new_password: newPassword.trim(),
          must_change_password: mustChangePassword,
        },
        token
      );

      setResetSuccessMessage(
        `Password for ${student.full_name} (${student.email}) has been successfully reset. Temporary password: "${newPassword.trim()}". Please share it securely with the student.`
      );
      setConfirmingReset(false);
      if (onPasswordResetSuccess) {
        onPasswordResetSuccess(res.message);
      }
    } catch (err: unknown) {
      setResetErrorMessage(err instanceof Error ? err.message : "Failed to reset student password.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setFormError(null);
      await onSubmit(student.id, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        register_number: registerNumber.trim().toUpperCase(),
        department: department.trim(),
        year,
        section: section.trim() || undefined,
        semester: semester.trim() || undefined,
        batch: batch.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        assigned_mentor_id: assignedMentorId || null,
        is_active: isActive,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update student details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Student Details</h2>
            <p className="text-xs text-slate-500 font-mono">ID: {student.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        {formError && (
          <div className="p-3 text-xs bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200/60">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Register Number
              </label>
              <input
                type="text"
                required
                value={registerNumber}
                onChange={(e) => setRegisterNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Section
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A / B"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Semester
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reassign Faculty Mentor
            </label>
            <select
              value={assignedMentorId}
              onChange={(e) => setAssignedMentorId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">-- No Mentor Assigned --</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.staff_id || m.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="editIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
            />
            <label htmlFor="editIsActive" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Account is Active (Uncheck to deactivate login)
            </label>
          </div>

          {/* ========================================================= */}
          {/* LOGIN CREDENTIALS & PASSWORD RESET SECTION */}
          {/* ========================================================= */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  Login Credentials & Password Reset
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Securely reset this individual student&apos;s login credentials without affecting any other account.
                </p>
              </div>

              {!showResetSection && (
                <button
                  type="button"
                  onClick={() => {
                    setShowResetSection(true);
                    setResetErrorMessage(null);
                    setResetSuccessMessage(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
                >
                  Reset Student Password
                </button>
              )}
            </div>

            {resetSuccessMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Password Reset Successful</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300 select-all font-mono bg-white/70 dark:bg-black/20 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                  {resetSuccessMessage}
                </p>
              </div>
            )}

            {resetErrorMessage && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs">
                {resetErrorMessage}
              </div>
            )}

            {showResetSection && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    New Password / Temporary Password
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPasswordPlain ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        disabled={isResettingPassword}
                        className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordPlain(!showPasswordPlain)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                        title={showPasswordPlain ? "Hide password" : "Show password"}
                      >
                        {showPasswordPlain ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      disabled={isResettingPassword}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs whitespace-nowrap transition"
                    >
                      Generate Secure
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editMustChangePassword"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    disabled={isResettingPassword}
                    className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <label htmlFor="editMustChangePassword" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    Force mandatory password change upon next login (Recommended)
                  </label>
                </div>

                {confirmingReset ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800 space-y-2">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Confirm Password Reset: Are you sure you want to reset the login password for {student.full_name}? The previous password will immediately stop working.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmingReset(false)}
                        disabled={isResettingPassword}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteResetPassword}
                        disabled={isResettingPassword}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-2xs transition disabled:opacity-50"
                      >
                        {isResettingPassword ? "Resetting..." : "Yes, Reset Password"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowResetSection(false)}
                      disabled={isResettingPassword}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPassword.trim() || newPassword.trim().length < 6) {
                          setResetErrorMessage("New password must be at least 6 characters long.");
                          return;
                        }
                        setResetErrorMessage(null);
                        setConfirmingReset(true);
                      }}
                      disabled={isResettingPassword || !newPassword.trim()}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-2xs transition disabled:opacity-50"
                    >
                      Confirm Password Reset
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteStudentModalProps {
  student: AdminStudentItem | null;
  onClose: () => void;
  onConfirm: (studentId: string, req: AdminStudentDeleteRequest) => Promise<void>;
}

export const DeleteStudentModal: React.FC<DeleteStudentModalProps> = ({
  student,
  onClose,
  onConfirm,
}) => {
  if (!student) return null;

  const [mode, setMode] = useState<"deactivate" | "delete_login" | "permanent">("deactivate");
  const [typedRegNo, setTypedRegNo] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const regNo = student.register_number || "";
  const isMatch = typedRegNo.trim().toUpperCase() === regNo.toUpperCase();

  const handleExecute = async () => {
    if (mode === "permanent" && !isMatch) {
      setErrorMessage(`Please type exactly "${regNo}" to verify permanent deletion.`);
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await onConfirm(student.id, {
        delete_mode: mode,
        confirmation_register_number: mode === "permanent" ? typedRegNo.trim().toUpperCase() : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Deletion operation failed.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Student Account Safety Options</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Target: {student.full_name} ({student.email})
          </p>
          <p className="text-slate-500">
            Register No: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{regNo}</span> &bull; {student.submission_count} submissions recorded
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200/60">
            {errorMessage}
          </div>
        )}

        <div className="space-y-2.5 text-xs">
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Choose Deletion Action:
          </label>

          {/* Option 1: Deactivate */}
          <div
            onClick={() => setMode("deactivate")}
            className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
              mode === "deactivate"
                ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-600"
                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <input
              type="radio"
              name="deleteMode"
              checked={mode === "deactivate"}
              onChange={() => setMode("deactivate")}
              className="mt-0.5 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">1. Deactivate Account (Recommended)</p>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Disables login in PostgreSQL and Firebase. All academic records, portfolio submissions, certificates, and review history are strictly preserved.
              </p>
            </div>
          </div>

          {/* Option 2: Delete Login */}
          <div
            onClick={() => setMode("delete_login")}
            className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
              mode === "delete_login"
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-600"
                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <input
              type="radio"
              name="deleteMode"
              checked={mode === "delete_login"}
              onChange={() => setMode("delete_login")}
              className="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">2. Delete Login Access Only</p>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Removes Firebase authentication account so student cannot log in. Student record in database remains for institutional historical preservation.
              </p>
            </div>
          </div>

          {/* Option 3: Permanent Deletion */}
          <div
            onClick={() => setMode("permanent")}
            className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
              mode === "permanent"
                ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 dark:border-rose-600"
                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <input
              type="radio"
              name="deleteMode"
              checked={mode === "permanent"}
              onChange={() => setMode("permanent")}
              className="mt-0.5 text-rose-600 focus:ring-rose-500"
            />
            <div>
              <p className="font-bold text-rose-700 dark:text-rose-400">3. Permanently Delete Student & Data</p>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Irreversible. Permanently purges student record, submissions, review history, and triggers Google Drive binary cleanup.
              </p>
            </div>
          </div>
        </div>

        {/* Typed verification for permanent mode */}
        {mode === "permanent" && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs space-y-2 animate-fade-in">
            <p className="font-bold text-rose-800 dark:text-rose-300">
              Security Verification Required:
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
              Type the student&apos;s register number <span className="font-mono font-bold text-rose-700 dark:text-rose-300">{regNo}</span> below to confirm permanent deletion:
            </p>
            <input
              type="text"
              value={typedRegNo}
              onChange={(e) => setTypedRegNo(e.target.value)}
              placeholder={`Type ${regNo}`}
              className="w-full px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 font-mono text-xs uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isDeleting || (mode === "permanent" && !isMatch)}
            className={`px-4 py-2 font-semibold text-white rounded-xl shadow-sm transition disabled:opacity-40 flex items-center gap-1.5 ${
              mode === "permanent"
                ? "bg-rose-600 hover:bg-rose-700"
                : mode === "delete_login"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {isDeleting ? "Processing..." : mode === "permanent" ? "Permanently Delete" : mode === "delete_login" ? "Delete Login Access" : "Deactivate Account"}
          </button>
        </div>
      </div>
    </div>
  );
};
