"use client";

import React, { useEffect, useState } from "react";

interface AppleLoadingScreenProps {
  message?: string;
  submessage?: string;
  isSignOut?: boolean;
  fullScreen?: boolean;
  className?: string;
  variant?: "default" | "login";
}

export const AppleLoadingScreen: React.FC<AppleLoadingScreenProps> = ({
  message,
  submessage,
  isSignOut = false,
  fullScreen = true,
  className = "",
  variant = "default",
}) => {
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    if (!isSignOut) return;

    const t1 = setTimeout(() => setStep(1), 120);
    const t2 = setTimeout(() => setStep(2), 260);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSignOut]);

  // Derived messages
  let currentTitle = message || "Preparing your dashboard...";
  let currentSub = submessage || "Securing your workspace and syncing records";

  if (isSignOut) {
    if (step === 0) {
      currentTitle = "Signing you out...";
      currentSub = "Securing your session...";
    } else if (step === 1) {
      currentTitle = "Securing your session...";
      currentSub = "Clearing active workspace credentials";
    } else {
      currentTitle = "See you again!";
      currentSub = "Session closed safely";
    }
  }

  const isLoginVariant = variant === "login";

  const containerClasses = fullScreen
    ? "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/95 text-slate-900 dark:bg-[#0F0F0F]/95 dark:text-[#F8F8F8] select-none transition-all duration-300 backdrop-blur-md"
    : `flex-1 flex items-center justify-center p-8 bg-slate-50/95 text-slate-900 dark:bg-[#0F0F0F]/95 dark:text-[#F8F8F8] select-none ${className}`;

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-label={currentTitle}
    >
      {/* Subtle radial ambient backdrop */}
      <div
        className={`absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08)_0%,transparent_65%)] ${
          isLoginVariant
            ? "dark:bg-[radial-gradient(circle_at_center,rgba(93,214,44,0.10)_0%,transparent_65%)]"
            : "dark:bg-[radial-gradient(circle_at_center,rgba(93,214,44,0.08)_0%,transparent_65%)]"
        }`}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full animate-apple-fade">
        {/* Brand Mark with Smooth Progress Halo */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Breathing ambient halo: subtle purple in light mode, yellow or indigo in dark mode */}
          <div
            className={`absolute -inset-2 rounded-3xl bg-purple-500/15 blur-xl animate-apple-halo pointer-events-none ${
              "dark:bg-[#5DD62C]/15"
            }`}
            aria-hidden="true"
          />

          {/* Rotating progress indicator ring */}
          <div className="relative flex items-center justify-center">
            <svg
              className={`h-20 w-20 animate-apple-spin text-purple-600/20 ${
                "dark:text-[#5DD62C]/20"
              }`}
              viewBox="0 0 80 80"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="opacity-20"
              />
              {/* Light mode: refined subtle purple/neutral progress stroke */}
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="url(#appleProgressGradLight)"
                strokeWidth="2.5"
                strokeDasharray="160 80"
                strokeLinecap="round"
                className="dark:hidden"
              />
              {/* Dark mode: refined subtle yellow or indigo progress stroke */}
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="url(#appleProgressGradDarkGreen)"
                strokeWidth="2.5"
                strokeDasharray="160 80"
                strokeLinecap="round"
                className="hidden dark:block"
              />
              <defs>
                <linearGradient
                  id="appleProgressGradLight"
                  x1="0"
                  y1="0"
                  x2="80"
                  y2="80"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#7c3aed" />
                  <stop offset="0.6" stopColor="#a78bfa" />
                  <stop offset="1" stopColor="#c4b5fd" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient
                  id="appleProgressGradDarkGreen"
                  x1="0"
                  y1="0"
                  x2="80"
                  y2="80"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#5DD62C" />
                  <stop offset="0.6" stopColor="#4ec224" />
                  <stop offset="1" stopColor="#337418" stopOpacity="0.2" />
                </linearGradient>
              </defs>
            </svg>

            {/* Centered Clean CCE Brand Monogram */}
            <div className="absolute inset-2 rounded-2xl bg-white dark:bg-[#202020] border border-purple-200/80 dark:border-[#2e2e2e] shadow-sm flex items-center justify-center p-1.5 overflow-hidden">
              <span className="font-extrabold text-base tracking-wider text-purple-700 dark:text-[#5DD62C] select-none">
                CCE
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Typography with Smooth Fade Transition */}
        <div className="space-y-1.5 transition-all duration-200">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-[#F8F8F8]">
            {currentTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#B0B0B0] tracking-normal">
            {currentSub}
          </p>
        </div>
      </div>
    </div>
  );
};
