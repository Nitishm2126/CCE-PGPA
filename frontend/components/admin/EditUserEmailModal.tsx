"use client";

import React, { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";
import { AdminEmailUpdateResponse } from "@/types/auth";

export interface TargetUserInfo {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface EditUserEmailModalProps {
  user: TargetUserInfo | null;
  onClose: () => void;
  onSuccess: (result: AdminEmailUpdateResponse) => void;
}

export const EditUserEmailModal: React.FC<EditUserEmailModalProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<AdminEmailUpdateResponse | null>(null);

  // Live verification state
  const [currentVerification, setCurrentVerification] = useState<{
    verified: boolean;
    loading: boolean;
  }>({ verified: false, loading: true });

  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    link?: string | null;
    message?: string;
    copied?: boolean;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    if (!user) return;
    setCurrentVerification({ verified: false, loading: true });
    api
      .adminGetVerificationStatus(user.id)
      .then((res) => {
        if (!ignore) {
          setCurrentVerification({ verified: res.email_verified, loading: false });
        }
      })
      .catch(() => {
        if (!ignore) {
          setCurrentVerification({ verified: false, loading: false });
        }
      });
    return () => {
      ignore = true;
    };
  }, [user]);

  const handleSendVerification = async () => {
    if (!user) return;
    setSendingVerification(true);
    try {
      const res = await api.adminSendVerificationEmail(user.id);
      setVerificationResult({
        link: res.verification_link,
        message: res.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate verification link.";
      setVerificationResult({
        message: msg,
      });
    } finally {
      setSendingVerification(false);
    }
  };

  const handleCopyLink = async () => {
    if (verificationResult?.link) {
      await navigator.clipboard.writeText(verificationResult.link);
      setVerificationResult((prev) => (prev ? { ...prev, copied: true } : prev));
      setTimeout(() => {
        setVerificationResult((prev) => (prev ? { ...prev, copied: false } : prev));
      }, 3000);
    }
  };

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedNew = newEmail.trim().toLowerCase();
    const trimmedConfirm = confirmEmail.trim().toLowerCase();

    // 1. Client-side validations
    if (!trimmedNew || !trimmedConfirm) {
      setErrorMsg("Please provide both the new email address and confirmation.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedNew)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setErrorMsg("New email address and confirmation do not match.");
      return;
    }

    if (trimmedNew === user.email.toLowerCase()) {
      setErrorMsg("The new email address is identical to the current registered email.");
      return;
    }

    if (!adminPassword) {
      setErrorMsg("Administrator password is required for security verification.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.adminUpdateUserEmail(user.id, {
        new_email: trimmedNew,
        confirm_new_email: trimmedConfirm,
        admin_password: adminPassword,
      });

      setSuccessResult(res);
      onSuccess(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMsg("Administrator reauthentication failed. Please check your admin password.");
        } else if (err.status === 409) {
          setErrorMsg(`Email '${trimmedNew}' is already registered to another account.`);
        } else {
          setErrorMsg(err.message || "Failed to update email address.");
        }
      } else {
        setErrorMsg("A network error occurred while updating the email address.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-email-title"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Security &bull; Account Management
            </span>
            <h2 id="edit-email-title" className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              Edit Registered Email Address
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update user credentials and synchronize with Firebase Authentication
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Email Updated Successfully</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
                {successResult.message}
              </p>
              <div className="mt-3 text-xs space-y-1 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Account:</span> {successResult.full_name} ({successResult.role.toUpperCase()})
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Effective Email:</span> {successResult.new_email}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Verification Status:</span>{" "}
                  {successResult.status === "pending_verification" ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                      Pending Email Verification
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Verified
                    </span>
                  )}
                </p>
              </div>

              {/* Email Verification Link Dispatch */}
              <div className="mt-3 p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-bold text-blue-900 dark:text-blue-200 text-xs flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Firebase Email Verification Dispatch
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Send or generate a live verification link for {successResult.new_email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendVerification}
                    disabled={sendingVerification}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {sendingVerification ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <span>Generate Verification Link</span>
                    )}
                  </button>
                </div>

                {verificationResult && (
                  <div className="text-[11px] space-y-1.5 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                    <p className="text-blue-800 dark:text-blue-300 font-semibold">{verificationResult.message}</p>
                    {verificationResult.link && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={verificationResult.link}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-[10px] font-mono text-slate-800 dark:text-slate-200 select-all"
                        />
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] shrink-0 cursor-pointer shadow-2xs"
                        >
                          {verificationResult.copied ? "Copied!" : "Copy Link"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Details Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{user.full_name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {user.role}
                </span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2 text-slate-500 dark:text-slate-400">
                <div>
                  Current Registered Email:{" "}
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{user.email}</span>
                </div>
                <div>
                  {currentVerification.loading ? (
                    <span className="text-[10px] text-slate-400">Checking Firebase Auth...</span>
                  ) : currentVerification.verified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Email Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Pending Verification
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Inputs */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. user.new@cce.edu"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs transition"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Re-enter new email address"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs transition"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Administrator Password (Reauthentication) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your current admin password"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs transition"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Fresh authentication is required before updating identity credentials.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Verifying &amp; Updating...</span>
                  </>
                ) : (
                  <span>Save Email Changes</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
