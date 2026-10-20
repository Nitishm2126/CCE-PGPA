"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Navbar: React.FC = () => {
  const { user, role, firebaseUser, isEmailVerified, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // On institutional portal homepage, login pages, student portal, and admin portal, hide the global navbar so official institutional header takes precedence
  if (
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/student") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 ${
        pathname?.startsWith("/student") ? "hidden md:block" : ""
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <span className="text-sm tracking-wider">CCE</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white text-base leading-tight tracking-tight">
              CCE-PGPA
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              PGPA Management System
            </span>
          </div>
        </Link>

        {/* Navigation & User Actions */}
        <nav className="flex items-center gap-3">
          <ThemeToggle size="sm" />
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {user.full_name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {user.email}
                </span>
              </div>

              {role && <RoleBadge role={role} size="sm" />}

              <Link
                href={`/${user.role}`}
                className="hidden md:inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Dashboard
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : firebaseUser ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {firebaseUser.email}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  Directory Pending
                </span>
              </div>

              <Link
                href="/verify-email"
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  isEmailVerified
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                }`}
              >
                {isEmailVerified ? "Verified" : "Verify Email"}
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-150 active:scale-95"
              >
                Portal Login
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
