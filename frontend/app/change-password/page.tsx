"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";
import { api, getStoredToken } from "@/lib/api-client";
import { ROLE_CONFIGS } from "@/lib/role-config";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, token: authToken, isLoading: authLoading, logout } = useAuth();
  const token = authToken || getStoredToken();

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auth guard: must be authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isMandatoryChange = Boolean(user?.must_change_password);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validations
    if (!newPassword) {
      setErrorMessage("Please enter a new confidential password.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters in length.");
      return;
    }

    if (newPassword === "cce@123") {
      setErrorMessage("New password cannot be the default institutional password ('cce@123'). Please select a secure custom password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation password do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.changePassword(
        {
          current_password: currentPassword || undefined,
          new_password: newPassword,
        },
        token
      );

      // Successfully updated!
      setSuccessMessage(
        "Your password has been updated securely. Redirecting to your dashboard..."
      );

      // Redirect after 1.5s
      setTimeout(() => {
        if (user) {
          router.push(`/${user.role}`);
        } else {
          router.push("/login");
        }
      }, 1500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to update password. Please check your current password and try again.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Checking session credentials...</p>
        </div>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIGS[user.role];

  return (
    <div className="w-full min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 1. Official Sairam Logos Header Banner */}
      <header className="w-full border-b border-slate-200/80 bg-white py-3 sm:py-3.5 px-4 shadow-2xs">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 max-w-3xl">
            <Image
              src="/images/sairam-logos.png"
              alt="Sri Sairam Engineering College - Autonomous Institution - Affiliated to Anna University"
              width={1600}
              height={130}
              priority
              className="w-full h-auto max-h-10 sm:max-h-12 object-contain"
            />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            id="change-password-header-signout"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* 2. Institutional Title Hierarchy */}
      <section className="text-center pt-6 pb-3 sm:pt-8 sm:pb-4 px-4">
        <div className="mx-auto max-w-4xl space-y-1.5">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0284c7]">
            Department of Computer and Communication Engineering
          </h2>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#800000]">
            CCE PGPA Management System
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Account Credential & Security Management
          </p>
        </div>
      </section>

      {/* 3. Main Card */}
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 pb-12 flex-1 flex flex-col items-center justify-center">
        {/* Navigation Breadcrumb (only if not mandatory change) */}
        {!isMandatoryChange && (
          <div className="w-full flex items-center justify-between mb-3 text-xs">
            <Link
              href={`/${user.role}`}
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              <span>&larr;</span>
              <span>Back to {roleConfig.shortTitle} Dashboard</span>
            </Link>
          </div>
        )}

        <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          {/* First Login Mandatory Banner */}
          {isMandatoryChange ? (
            <div className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                  !
                </span>
                <h3 className="font-bold text-sm text-amber-950">
                  Mandatory First-Time Password Change Required
                </h3>
              </div>
              <p className="leading-relaxed text-amber-800">
                Your account was provisioned with the temporary institutional password (<code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 text-amber-950">cce@123</code>). In compliance with cybersecurity guidelines, you must set a new confidential password before entering the {roleConfig.portalName}.
              </p>
            </div>
          ) : (
            <div className="pb-4 border-b border-slate-100 mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Change Account Password
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your credentials for secure access to CCE-PGPA
                </p>
              </div>
              <RoleBadge role={user.role} size="sm" />
            </div>
          )}

          {/* User Account Info Pill */}
          <div className="mb-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Signed In User
              </span>
              <span className="font-bold text-slate-900">{user.full_name}</span>
              <span className="block text-[11px] font-mono text-slate-500">{user.email}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Role
              </span>
              <RoleBadge role={user.role} size="sm" />
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fade-in">
              <span className="font-bold text-rose-600 mt-0.5">⚠</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-fade-in">
              <span className="font-bold text-emerald-600 mt-0.5">✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="current-password"
                  className="text-xs font-semibold text-slate-700"
                >
                  Current / Temporary Password
                </label>
                {isMandatoryChange && (
                  <span className="text-[10px] text-amber-700 font-medium">
                    (Initial: cce@123)
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={isMandatoryChange ? "Enter cce@123" : "Enter current password"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                New Confidential Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Must be at least 6 characters and different from &apos;cce@123&apos;.
              </p>
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || Boolean(successMessage)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-3 shadow-md shadow-blue-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Set New Password & Proceed &rarr;</span>
                )}
              </button>
            </div>
          </form>

          {/* Alternative sign out if user wants to cancel or switch account */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Wrong account or need to switch role?</span>
            <button
              type="button"
              onClick={handleLogout}
              id="change-password-card-signout"
              className="text-rose-600 hover:text-rose-800 hover:underline font-semibold cursor-pointer"
            >
              Sign Out &amp; Switch Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
