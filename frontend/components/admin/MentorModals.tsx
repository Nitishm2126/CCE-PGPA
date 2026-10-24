"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import {
  AdminMentorItem,
  AdminMentorDetailResponse,
  AdminMentorCreate,
  AdminMentorUpdate,
  AdminMentorDeleteRequest,
  AdminMentorReassignRequest,
} from "@/types/auth";

interface ViewMentorModalProps {
  mentor: AdminMentorDetailResponse | null;
  onClose: () => void;
}

export const ViewMentorModal: React.FC<ViewMentorModalProps> = ({ mentor, onClose }) => {
  const [verificationStatus, setVerificationStatus] = useState<{
    verified: boolean;
    loading: boolean;
  }>({ verified: false, loading: true });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<{ link?: string | null; message: string; copied?: boolean } | null>(null);

  useEffect(() => {
    let ignore = false;
    if (!mentor) return;
    setVerificationStatus({ verified: false, loading: true });
    setVerificationMsg(null);
    api
      .adminGetVerificationStatus(mentor.id)
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
  }, [mentor]);

  const handleSendVerification = async () => {
    if (!mentor) return;
    setSendingEmail(true);
    try {
      const res = await api.adminSendVerificationEmail(mentor.id);
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

  if (!mentor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Faculty Mentor Profile
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {mentor.full_name}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Staff ID: {mentor.staff_id || "Unassigned"} &bull; {mentor.designation || "Assistant Professor"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">Email &amp; Status</span>
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
              {mentor.email}
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">Department</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {mentor.department}
            </p>
          </div>
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <span className="text-blue-600 dark:text-blue-400 text-[11px]">Assigned Mentees</span>
            <p className="font-bold text-lg text-blue-700 dark:text-blue-300 mt-0.5">
              {mentor.assigned_student_count}
            </p>
          </div>
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
            <span className="text-purple-600 dark:text-purple-400 text-[11px]">Reviews Conducted</span>
            <p className="font-bold text-lg text-purple-700 dark:text-purple-300 mt-0.5">
              {mentor.reviews_count}
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
                  ? "This faculty account's email address is verified in Firebase Authentication."
                  : "Email verification is pending. Generate a verification link to send to the faculty member."}
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

        {/* Assigned Mentees List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Assigned Students Cohort ({mentor.assigned_students.length})
            </h3>
            <span className="text-[11px] text-slate-400">Active Mentorship Links</span>
          </div>

          {mentor.assigned_students.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
              No students are currently assigned to this faculty mentor.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5 text-xs">
              {mentor.assigned_students.map((st, i) => (
                <div
                  key={st.student_id || i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                      {st.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {st.full_name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {st.register_number || "No Reg"} &bull; {st.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Year {st.year} &bull; Sec {st.section || "A"}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Assigned: {new Date(st.assigned_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

interface AddMentorModalProps {
  onClose: () => void;
  onSubmit: (data: AdminMentorCreate) => Promise<void>;
}

export const AddMentorModal: React.FC<AddMentorModalProps> = ({ onClose, onSubmit }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [staffId, setStaffId] = useState("");
  const [department, setDepartment] = useState("CCE");
  const [designation, setDesignation] = useState("Assistant Professor");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setFormError("Full Name and Email are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await onSubmit({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        staff_id: staffId.trim() || undefined,
        department: department.trim(),
        designation: designation.trim() || undefined,
        password: password.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create mentor account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Faculty Mentor</h2>
            <p className="text-xs text-slate-500">
              Provision a new faculty advisor into PostgreSQL and Firebase Authentication.
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
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. John Doe"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institutional Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. mentor@sairam.edu.in"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Staff / Employee ID
              </label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g. STF_CCE_01"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Assistant Professor"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Password (Optional)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty to auto-generate secure temporary password"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Creating Mentor..." : "Create Mentor Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditMentorModalProps {
  mentor: AdminMentorItem | null;
  onClose: () => void;
  onSubmit: (mentorId: string, data: AdminMentorUpdate) => Promise<void>;
}

export const EditMentorModal: React.FC<EditMentorModalProps> = ({ mentor, onClose, onSubmit }) => {
  if (!mentor) return null;

  const [fullName, setFullName] = useState(mentor.full_name);
  const [email, setEmail] = useState(mentor.email);
  const [staffId, setStaffId] = useState(mentor.staff_id || "");
  const [department, setDepartment] = useState(mentor.department || "CCE");
  const [designation, setDesignation] = useState(mentor.designation || "Assistant Professor");
  const [isActive, setIsActive] = useState(mentor.is_active);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setFormError(null);
      await onSubmit(mentor.id, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        staff_id: staffId.trim() || undefined,
        department: department.trim(),
        designation: designation.trim() || undefined,
        is_active: isActive,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update mentor details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Mentor Details</h2>
            <p className="text-xs text-slate-500 font-mono">ID: {mentor.id}</p>
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
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institutional Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Staff ID
              </label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="mentorIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <label htmlFor="mentorIsActive" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Account is Active
            </label>
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
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ReassignStudentsModalProps {
  sourceMentor: AdminMentorItem | null;
  allMentors: AdminMentorItem[];
  onClose: () => void;
  onSubmit: (sourceMentorId: string, targetMentorId: string) => Promise<void>;
}

export const ReassignStudentsModal: React.FC<ReassignStudentsModalProps> = ({
  sourceMentor,
  allMentors,
  onClose,
  onSubmit,
}) => {
  if (!sourceMentor) return null;

  const otherMentors = allMentors.filter((m) => m.id !== sourceMentor.id && m.is_active);
  const [targetMentorId, setTargetMentorId] = useState(otherMentors[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!targetMentorId) {
      setErrorMessage("Please select an active target mentor.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onSubmit(sourceMentor.id, targetMentorId);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Reassignment failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reassign Students</h2>
            <p className="text-xs text-slate-500">
              Transfer student mentorship assignments from {sourceMentor.full_name}.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">
            &times;
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200/60">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">Source Mentor:</span>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">
              {sourceMentor.full_name} ({sourceMentor.assigned_student_count} mentees)
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transfer All Mentees To Target Mentor:
            </label>
            {otherMentors.length === 0 ? (
              <p className="text-xs text-rose-600">
                No other active mentors available in the system. Add another mentor first.
              </p>
            ) : (
              <select
                value={targetMentorId}
                onChange={(e) => setTargetMentorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {otherMentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} &bull; {m.assigned_student_count} current mentees ({m.staff_id || m.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isSubmitting || otherMentors.length === 0}
            className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting ? "Reassigning..." : "Confirm Reassignment"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteMentorModalProps {
  mentor: AdminMentorItem | null;
  allMentors: AdminMentorItem[];
  onClose: () => void;
  onConfirm: (mentorId: string, req: AdminMentorDeleteRequest) => Promise<void>;
}

export const DeleteMentorModal: React.FC<DeleteMentorModalProps> = ({
  mentor,
  allMentors,
  onClose,
  onConfirm,
}) => {
  if (!mentor) return null;

  const otherMentors = allMentors.filter((m) => m.id !== mentor.id && m.is_active);
  const hasAssignedStudents = mentor.assigned_student_count > 0;
  const [reassignMentorId, setReassignMentorId] = useState(otherMentors[0]?.id || "");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExecute = async () => {
    if (hasAssignedStudents && !reassignMentorId) {
      setErrorMessage("You must select an active mentor to reassign students before deleting.");
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await onConfirm(mentor.id, {
        reassign_mentor_id: reassignMentorId || null,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete mentor account.");
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Delete Faculty Mentor Account</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">
            &times;
          </button>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Target: {mentor.full_name} ({mentor.email})
          </p>
          <p className="text-slate-500">
            Staff ID: {mentor.staff_id || "—"} &bull; {mentor.assigned_student_count} active student(s) assigned
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200/60">
            {errorMessage}
          </div>
        )}

        {hasAssignedStudents ? (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-300">
              <p className="font-bold">Student Reassignment Mandate:</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                This mentor has {mentor.assigned_student_count} actively assigned student(s). System security rules require reassigning these students to another active faculty mentor before deleting. All student submissions and review history will be safely preserved.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Active Replacement Mentor:
              </label>
              {otherMentors.length === 0 ? (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs">
                  Cannot delete: No other active mentors exist. Please create or activate another mentor first.
                </div>
              ) : (
                <select
                  value={reassignMentorId}
                  onChange={(e) => setReassignMentorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {otherMentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.assigned_student_count} current students)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            This mentor has no currently assigned students. Deleting will permanently remove their mentor credentials and profile while preserving any historical review logs.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isDeleting || (hasAssignedStudents && otherMentors.length === 0)}
            className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-40"
          >
            {isDeleting ? "Deleting..." : "Confirm Deletion & Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
};
