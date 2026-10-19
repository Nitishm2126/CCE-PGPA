"use client";

import React, { useState } from "react";
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
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-slate-500 text-[11px]">Email</span>
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
