"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export const EmailVerificationBanner: React.FC = () => {
  const { firebaseUser, isEmailVerified, isLoading } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const pathname = usePathname();

  // Hide on login and root portal pages
  if (pathname === "/" || pathname?.startsWith("/login")) {
    return null;
  }

  // Only display if user is logged into Firebase and email is NOT verified
  if (isLoading || !firebaseUser || isEmailVerified || isDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Email Verification Notice"
      className="w-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 sm:px-6"
    >
      <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <svg
            className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>
            <strong>Account Verification Required:</strong> Your Firebase email (
            <span className="font-mono font-semibold">{firebaseUser.email}</span>) is unverified.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/verify-email"
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 text-xs font-semibold shadow-sm transition-colors"
          >
            Verify Email &rarr;
          </Link>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss banner"
            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 text-sm font-bold px-1"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
};
