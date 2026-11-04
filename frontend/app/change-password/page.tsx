"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";
import { api, getStoredToken } from "@/lib/api-client";
import { ROLE_CONFIGS } from "@/lib/role-config";
import { AppleLoadingScreen } from "@/components/shared/AppleLoadingScreen";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FineWorksBrand } from "@/components/shared/FineWorksBrand";
import { FineWorksFooter } from "@/components/shared/FineWorksFooter";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, token: authToken, isLoading: authLoading, isLoggingOut, logout, updateUser, refreshUser } = useAuth();
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
    if (!authLoading && !user && !isLoggingOut) {
      router.replace("/login?signedOut=true");
    }
  }, [user, authLoading, isLoggingOut, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login?signedOut=true");
  };

  const isMandatoryChange = Boolean(user?.must_change_password);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validations
    if (!currentPassword.trim()) {
      setErrorMessage("Please enter your current or temporary password.");
      return;
    }

    if (!newPassword) {
      setErrorMessage("Please enter a new confidential password.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters in length.");
      return;
    }

    if (newPassword === currentPassword.trim()) {
      setErrorMessage("New password must be different from your current or temporary password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation password do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedUser = await api.changePassword(
        {
          current_password: currentPassword.trim(),
          new_password: newPassword,
        },
        token
      );

      // Successfully updated! Update local auth state immediately to unblock dashboard guards
      if (updatedUser) {
        updateUser(updatedUser);
      }
      await refreshUser();

      setSuccessMessage(
        "Your password has been updated securely. Entering dashboard..."
      );

      const targetRole = updatedUser?.role || user?.role;
      if (targetRole) {
        router.push(`/${targetRole}`);
      } else {
        router.push("/login");
      }
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
      <AppleLoadingScreen
        message="Checking session..."
        submessage="Securing your workspace"
        fullScreen={true}
      />
    );
  }

  const roleConfig = ROLE_CONFIGS[user.role];

  return (
    <div className="w-full min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 1. FineWorks Header */}
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl py-3 px-4 shadow-2xs transition-colors sticky top-0 z-30">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <FineWorksBrand role={user.role} showDepartment size="md" />
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <button
              type="button"
              onClick={handleLogout}
              id="change-password-header-signout"
              className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* 2. Title Hierarchy */}
      <section className="text-center pt-8 pb-4 px-4">
        <div className="mx-auto max-w-xl space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isMandatoryChange ? "Mandatory Password Update" : "Change Password"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Welcome, <strong className="font-semibold text-slate-800 dark:text-slate-200">{user.full_name}</strong>. Please update your account credentials.
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

        <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm animate-apple-slide-up transition-colors">
          {/* First Login Mandatory Banner */}
          {isMandatoryChange ? (
            <div className="mb-6 p-4 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                  !
                </span>
                <h3 className="font-bold text-sm text-amber-950 dark:text-amber-100">
                  Mandatory First-Time Password Change Required
                </h3>
              </div>
              <p className="leading-relaxed text-amber-800 dark:text-amber-300">
                Your account was provisioned with a temporary initial password. In compliance with cybersecurity guidelines, you must set a new confidential password before entering the {roleConfig.portalName}.
              </p>
            </div>
          ) : (
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800 mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Change Account Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Update your credentials for secure access to CCE-PGPA
                </p>
              </div>
              <RoleBadge role={user.role} size="sm" />
            </div>
          )}

          {/* User Account Info Pill */}
          <div className="mb-6 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Signed In User
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{user.full_name}</span>
              <span className="block text-[11px] font-mono text-slate-500 dark:text-slate-400">{user.email}</span>
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
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2 animate-apple-fade">
              <span className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">⚠</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2 animate-apple-fade">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
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
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Current / Temporary Password
                </label>
                {isMandatoryChange && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                    (Required for verification)
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current or temporary password"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showCurrentPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
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
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Must be at least 6 characters and different from temporary password.
              </p>
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
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
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="change-password-submit-btn"
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

      {/* 4. FineWorks Footer */}
      <FineWorksFooter className="mt-auto" />
    </div>
  );
}
