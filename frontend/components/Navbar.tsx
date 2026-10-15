"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RoleBadge } from "@/components/RoleBadge";

export const Navbar: React.FC = () => {
  const { user, role, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <span className="text-sm tracking-wider">CCE</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white text-base leading-tight tracking-tight">
              CCE Achieve
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              PGPA Management System
            </span>
          </div>
        </Link>

        {/* Navigation & User Actions */}
        <nav className="flex items-center gap-3">
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
