"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import {
  AdminHODItem,
  AdminHODCreate,
  AdminHODUpdate,
  AdminHODDeleteRequest,
  AdminMentorItem,
  UserResponse,
} from "@/types/auth";

interface ViewHODModalProps {
  hod: AdminHODItem | null;
  onClose: () => void;
}

export const ViewHODModal: React.FC<ViewHODModalProps> = ({ hod, onClose }) => {
  const [verificationStatus, setVerificationStatus] = useState<{
    verified: boolean;
    loading: boolean;
  }>({ verified: false, loading: true });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<{ link?: string | null; message: string; copied?: boolean } | null>(null);

  useEffect(() => {
    let ignore = false;
    if (!hod) return;
    setVerificationStatus({ verified: false, loading: true });
    setVerificationMsg(null);
    api
      .adminGetVerificationStatus(hod.id)
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
  }, [hod]);

  const handleSendVerification = async () => {
    if (!hod) return;
    setSendingEmail(true);
    try {
      const res = await api.adminSendVerificationEmail(hod.id);
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

  if (!hod) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Department Head (HOD) Profile
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {hod.full_name}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Staff ID: {hod.staff_id || "Unassigned"} &bull; {hod.designation || "Professor & Head"}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
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
              {hod.email}
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">Department</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {hod.department}
            </p>
          </div>
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
            <span className="text-purple-600 dark:text-purple-400 text-[11px]">Review Approvals</span>
            <p className="font-bold text-lg text-purple-700 dark:text-purple-300 mt-0.5">
              {hod.reviews_count}
            </p>
          </div>
        </div>

        {/* Firebase Email Verification Action Card */}
        <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200/70 dark:border-purple-900/40 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Firebase Authentication &bull; Email Verification
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {verificationStatus.verified
                  ? "This HOD account's email address is verified in Firebase Authentication."
                  : "Email verification is pending. Generate a verification link to send to the department head."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendVerification}
              disabled={sendingEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
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
            <div className="pt-2 border-t border-purple-100 dark:border-purple-900/40 space-y-1.5 text-[11px]">
              <p className="text-purple-800 dark:text-purple-300 font-semibold">{verificationMsg.message}</p>
              {verificationMsg.link && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={verificationMsg.link}
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-[10px] font-mono text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold text-[10px] shrink-0 cursor-pointer shadow-2xs"
                  >
                    {verificationMsg.copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account Status / Sync */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Account Status:</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                hod.is_active
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
              }`}
            >
              {hod.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Firebase Auth Sync:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {hod.firebase_uid ? "Linked (UID configured)" : "No Firebase UID"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Created:</span>
            <span className="text-slate-700 dark:text-slate-300">
              {new Date(hod.created_at).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface AddHODModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AdminHODCreate) => Promise<void>;
  existingDepartments?: string[];
}

export const AddHODModal: React.FC<AddHODModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingDepartments = ["AI&DS", "CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"],
}) => {
  const [formData, setFormData] = useState<AdminHODCreate>({
    full_name: "",
    email: "",
    staff_id: "",
    department: "AI&DS",
    designation: "Professor & Head",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      setError("Full name and email are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        errObj.response?.data?.detail ||
          errObj.message ||
          "Failed to create Head of Department."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Add Head of Department (HOD)
            </h3>
            <p className="text-xs text-slate-500">
              Provision a new HOD account with departmental oversight privileges
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. K. Ramesh"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="hod.aids@cce.edu.in"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Staff ID
              </label>
              <input
                type="text"
                placeholder="CCE-HOD-01"
                value={formData.staff_id || ""}
                onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Department
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {existingDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Designation
              </label>
              <input
                type="text"
                placeholder="Professor & Head"
                value={formData.designation || ""}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Initial Password (Optional)
            </label>
            <input
              type="password"
              placeholder="Leave blank for auto-generated password"
              value={formData.password || ""}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-300 text-[11px]">
            <strong>Note:</strong> Creating this HOD will synchronize login credentials with Firebase Authentication and allocate the user to the {formData.department || "selected"} department.
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium shadow-md shadow-purple-600/20 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create HOD"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditHODModalProps {
  hod: AdminHODItem | null;
  onClose: () => void;
  onSubmit: (id: string, data: AdminHODUpdate) => Promise<void>;
  existingDepartments?: string[];
}

export const EditHODModal: React.FC<EditHODModalProps> = ({
  hod,
  onClose,
  onSubmit,
  existingDepartments = ["AI&DS", "CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"],
}) => {
  const [formData, setFormData] = useState<AdminHODUpdate>({
    full_name: hod?.full_name || "",
    email: hod?.email || "",
    staff_id: hod?.staff_id || "",
    department: hod?.department || "AI&DS",
    designation: hod?.designation || "Professor & Head",
    is_active: hod?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hod) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(hod.id, formData);
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        errObj.response?.data?.detail ||
          errObj.message ||
          "Failed to update HOD profile."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Edit HOD Profile
            </h3>
            <p className="text-xs text-slate-500">
              Update HOD details and department assignments
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name || ""}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Staff ID
              </label>
              <input
                type="text"
                value={formData.staff_id || ""}
                onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Department
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {existingDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Designation
              </label>
              <input
                type="text"
                value={formData.designation || ""}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Active status */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="hod_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 dark:border-slate-700 focus:ring-purple-500"
            />
            <label
              htmlFor="hod_is_active"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Account Active (Can log in and review submissions)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium shadow-md shadow-purple-600/20 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteHODModalProps {
  hod: AdminHODItem | null;
  currentUser: UserResponse | null;
  allMentors: AdminMentorItem[];
  allHODs: AdminHODItem[];
  onClose: () => void;
  onConfirm: (id: string, req: AdminHODDeleteRequest) => Promise<void>;
}

export const DeleteHODModal: React.FC<DeleteHODModalProps> = ({
  hod,
  currentUser,
  allMentors,
  allHODs,
  onClose,
  onConfirm,
}) => {
  const [replacementHODId, setReplacementHODId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hod) return null;

  // Self deletion prevention check
  const isSelf = currentUser && (currentUser.id === hod.id || currentUser.email === hod.email);

  // Candidates for replacement: other HODs or faculty mentors
  const otherHODs = allHODs.filter((h) => h.id !== hod.id);
  const mentorCandidates = allMentors.filter((m) => m.department === hod.department && m.is_active);

  const handleConfirm = async () => {
    if (isSelf) {
      setError("Security violation: You cannot delete your own Administrator/HOD account.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(hod.id, {
        replacement_hod_id: replacementHODId || null,
      });
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        errObj.response?.data?.detail ||
          errObj.message ||
          "Failed to delete HOD account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg">
              !
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Head of Department
              </h3>
              <p className="text-xs text-slate-500">
                {hod.full_name} &bull; {hod.department}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        {isSelf && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-300 text-xs space-y-1">
            <strong>Self-Account Deletion Blocked:</strong>
            <p>
              You are currently authenticated as this user. Administrators are strictly forbidden from deleting their own active credentials to prevent administrative lockout.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        {!isSelf && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="text-slate-700 dark:text-slate-300">
                Deleting this HOD account will remove their login access in both PostgreSQL and Firebase Authentication.
              </p>
              <p className="text-slate-500">
                Department historical review records ({hod.reviews_count} completed approvals) will be preserved and reassigned safely.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Select Replacement HOD (Recommended if department is active)
              </label>
              <select
                value={replacementHODId}
                onChange={(e) => setReplacementHODId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">No replacement (or defer assignment)</option>
                <optgroup label={`Faculty from ${hod.department}`}>
                  {mentorCandidates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email}) - {m.designation || "Faculty"}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other HODs / Faculty">
                  {otherHODs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.full_name} ({h.email}) - {h.department}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Selecting a replacement automatically promotes them to HOD of {hod.department} and transfers verification logs.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          {!isSelf && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium shadow-md shadow-rose-600/20 transition disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Confirm HOD Deletion"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
