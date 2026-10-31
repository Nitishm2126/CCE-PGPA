"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UserResponse } from "@/types/auth";
import { api, getStoredToken } from "@/lib/api-client";
import { RoleBadge } from "@/components/RoleBadge";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse | null;
  token?: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
}) => {
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [firebaseLinked, setFirebaseLinked] = useState<boolean>(false);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [emailSentMsg, setEmailSentMsg] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const activeToken = token || getStoredToken();

  const fetchStatus = useCallback(async () => {
    if (!activeToken) return;
    try {
      setStatusLoading(true);
      setStatusError(null);
      const res = await api.getVerificationStatus(activeToken);
      setEmailVerified(res.email_verified);
      setFirebaseLinked(res.firebase_linked);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to retrieve verification status.";
      setStatusError(msg);
    } finally {
      setStatusLoading(false);
    }
  }, [activeToken]);

  // Fetch status whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setEmailSentMsg(null);
      setStatusError(null);
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  // Handle rate-limit countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSendVerification = async () => {
    if (!activeToken || sendingEmail || cooldownSeconds > 0) return;
    try {
      setSendingEmail(true);
      setStatusError(null);
      setEmailSentMsg(null);
      const res = await api.sendVerificationEmail(activeToken);
      setEmailSentMsg(res.message || "Verification email sent. Please check your inbox.");
      setCooldownSeconds(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send verification email.";
      setStatusError(msg);
      if (msg.includes("wait") && msg.includes("seconds")) {
        const match = msg.match(/\d+/);
        if (match && match[0]) {
          setCooldownSeconds(parseInt(match[0], 10));
        } else {
          setCooldownSeconds(60);
        }
      }
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-apple-fade"
    >
      {/* Background click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xl space-y-6 z-10 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/80">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 id="settings-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Account &amp; Security Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Department of Computer and Communication Engineering
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close settings dialog"
          >
            ✕
          </button>
        </div>

        {/* User Identity Overview */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
              Active Profile
            </span>
            <RoleBadge role={user?.role || "mentor"} size="sm" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.full_name}</p>
          <p className="font-mono text-slate-600 dark:text-slate-300">{user?.email}</p>
        </div>

        {/* Email Verification Section */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Official Email Verification
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verify your institutional address via Firebase Authentication
              </p>
            </div>
            {statusLoading ? (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Checking...
              </span>
            ) : emailVerified ? (
              <span
                id="email-verified-badge"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Email Verified
              </span>
            ) : (
              <span
                id="email-pending-badge"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Verification Pending
              </span>
            )}
          </div>

          {/* Non-mandatory Explanatory Note */}
          <div className="rounded-xl border border-sky-100 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/40 p-3 text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
            <span className="font-semibold">Optional Feature:</span> Email verification is completely optional and does not restrict your access to student allocations, PGPA audits, reports, or HOD governance workflows.
          </div>

          {/* Feedback Alerts */}
          {emailSentMsg && (
            <div
              id="verification-email-sent-banner"
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2 animate-apple-fade"
            >
              <span className="font-bold text-emerald-600 mt-0.5">✓</span>
              <span>{emailSentMsg}</span>
            </div>
          )}

          {statusError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2 animate-apple-fade">
              <span className="font-bold text-rose-600 mt-0.5">⚠</span>
              <span>{statusError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-1 flex-wrap">
            {!emailVerified && (
              <button
                type="button"
                onClick={handleSendVerification}
                disabled={sendingEmail || cooldownSeconds > 0}
                id="btn-send-verification-email"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-xs px-4 py-2.5 transition shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {sendingEmail ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Link...</span>
                  </>
                ) : cooldownSeconds > 0 ? (
                  <span>Resend in {cooldownSeconds}s</span>
                ) : emailSentMsg ? (
                  <span>Resend Verification Email</span>
                ) : (
                  <span>Send Verification Email</span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={fetchStatus}
              disabled={statusLoading}
              id="btn-refresh-verification-status"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <svg
                className={`w-3.5 h-3.5 ${statusLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
