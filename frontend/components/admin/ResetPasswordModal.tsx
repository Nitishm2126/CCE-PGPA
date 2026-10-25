"use client";

import React, { useState } from "react";
import { api } from "@/lib/api-client";
import { AdminResetUserPasswordResponse, UserRole } from "@/types/auth";

export interface TargetPasswordResetUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole | string;
  staff_id?: string | null;
  department?: string | null;
}

interface ResetPasswordModalProps {
  user: TargetPasswordResetUser | null;
  onClose: () => void;
  onSuccess?: (result: AdminResetUserPasswordResponse) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [showPasswordPlain, setShowPasswordPlain] = useState(false);
  const [confirmingStep, setConfirmingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<AdminResetUserPasswordResponse | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!user) return null;

  const roleNormalized = (typeof user.role === "string" ? user.role.toLowerCase() : "") as UserRole;
  const roleLabel =
    roleNormalized === "mentor"
      ? "Faculty Mentor"
      : roleNormalized === "hod"
      ? "Department HOD"
      : roleNormalized === "student"
      ? "Student"
      : "User";

  const roleBadgeStyle =
    roleNormalized === "mentor"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900/60"
      : roleNormalized === "hod"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900/60"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/60";

  const handleGeneratePassword = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const chars = ["!", "@", "#", "$", "%"];
    const special = chars[Math.floor(Math.random() * chars.length)];
    const generated = `Sairam@${randomSuffix}${special}`;
    setNewPassword(generated);
    setShowPasswordPlain(true);
    setErrorMsg(null);
  };

  const handleExecuteReset = async () => {
    const cleanPw = newPassword.trim();
    if (!cleanPw || cleanPw.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      let res: AdminResetUserPasswordResponse;
      const payload = {
        new_password: cleanPw,
        must_change_password: mustChangePassword,
      };

      if (roleNormalized === "mentor") {
        res = await api.adminResetMentorPassword(user.id, payload);
      } else if (roleNormalized === "hod") {
        res = await api.adminResetHODPassword(user.id, payload);
      } else {
        res = await api.adminResetUserPassword(user.id, payload);
      }

      setSuccessResult(res);
      setConfirmingStep(false);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to reset password. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (newPassword.trim()) {
      await navigator.clipboard.writeText(newPassword.trim());
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2500);
    }
  };

  const handleCopyResetLink = async () => {
    if (successResult?.password_reset_link) {
      await navigator.clipboard.writeText(successResult.password_reset_link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleClose = () => {
    setNewPassword("");
    setShowPasswordPlain(false);
    setConfirmingStep(false);
    setErrorMsg(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Reset Login Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Administrative security control for institutional accounts
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Target User Info Summary */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {user.full_name}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadgeStyle}`}
              >
                {roleLabel}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {user.email}
            </div>
            {(user.staff_id || user.department) && (
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {user.staff_id && (
                  <span>
                    Staff ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{user.staff_id}</strong>
                  </span>
                )}
                {user.department && (
                  <span>
                    Dept: <strong className="text-slate-700 dark:text-slate-300">{user.department}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Success State */}
        {successResult ? (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-sm">
                <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Password Reset Successfully</span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                {successResult.message}
              </p>
            </div>

            {/* Temporary password display */}
            <div className="p-3.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px]">New Password Assigned:</span>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  {mustChangePassword ? "Must change on next login" : "Standard login"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-sm text-slate-900 dark:text-slate-100">
                <span className="font-bold select-all tracking-wide">{newPassword.trim()}</span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500 hover:bg-amber-600 text-white transition flex items-center gap-1 shadow-2xs"
                >
                  {copiedPassword ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                        />
                      </svg>
                      Copy Password
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Please share this temporary password securely with the user.
              </p>
            </div>

            {/* Optional Firebase Reset Link */}
            {successResult.password_reset_link && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-300 font-semibold">
                  <span>Direct Firebase Password Reset Link</span>
                  <button
                    type="button"
                    onClick={handleCopyResetLink}
                    className="text-[11px] font-bold text-blue-700 dark:text-blue-400 underline hover:no-underline cursor-pointer"
                  >
                    {copiedLink ? "Link Copied!" : "Copy Link"}
                  </button>
                </div>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 break-all select-all font-mono">
                  {successResult.password_reset_link}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-md transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 text-xs bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 animate-shake">
                <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Accidental Reset Security Notice */}
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/70 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Security Notice
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-400">
                Resetting the password will immediately replace the account credentials in both PostgreSQL and Firebase Authentication. The existing password will cease to work immediately.
              </p>
            </div>

            {/* Input Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New / Temporary Password
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPasswordPlain ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      disabled={isSubmitting || confirmingStep}
                      className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-amber-500 outline-none"
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
                    disabled={isSubmitting || confirmingStep}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs whitespace-nowrap transition cursor-pointer"
                  >
                    Generate Secure
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="resetMustChangePassword"
                  checked={mustChangePassword}
                  onChange={(e) => setMustChangePassword(e.target.checked)}
                  disabled={isSubmitting || confirmingStep}
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <label
                  htmlFor="resetMustChangePassword"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Force mandatory password change upon next login (Recommended)
                </label>
              </div>
            </div>

            {/* Accidental Reset Confirmation Step */}
            {confirmingStep ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 rounded-xl border-2 border-amber-400 dark:border-amber-700 space-y-3 animate-fade-in">
                <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                  <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <span>Confirm Password Reset</span>
                    <p className="text-[11px] font-normal text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                      Are you sure you want to reset the login password for <strong>{user.full_name}</strong> ({roleLabel})?
                      Their current password will stop working immediately.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmingStep(false)}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Resetting...
                      </>
                    ) : (
                      "Yes, Reset Password"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanPw = newPassword.trim();
                    if (!cleanPw || cleanPw.length < 6) {
                      setErrorMsg("Password must be at least 6 characters long.");
                      return;
                    }
                    setErrorMsg(null);
                    setConfirmingStep(true);
                  }}
                  disabled={isSubmitting || !newPassword.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  Reset Password
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
