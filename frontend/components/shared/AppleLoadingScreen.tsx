"use client";

import React, { useEffect, useState } from "react";

interface AppleLoadingScreenProps {
  message?: string;
  submessage?: string;
  isSignOut?: boolean;
  fullScreen?: boolean;
  className?: string;
}

export const AppleLoadingScreen: React.FC<AppleLoadingScreenProps> = ({
  message,
  submessage,
  isSignOut = false,
  fullScreen = true,
  className = "",
}) => {
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    if (!isSignOut) return;

    const t1 = setTimeout(() => setStep(1), 500);
    const t2 = setTimeout(() => setStep(2), 1100);

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

  const containerClasses = fullScreen
    ? "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/95 text-slate-900 dark:bg-[#090d16]/95 dark:text-slate-100 select-none transition-all duration-300 backdrop-blur-md"
    : `flex-1 flex items-center justify-center p-8 bg-slate-50/95 text-slate-900 dark:bg-[#090d16]/95 dark:text-slate-100 select-none ${className}`;

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-label={currentTitle}
    >
      {/* Subtle radial ambient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08)_0%,transparent_65%)] dark:bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.08)_0%,transparent_65%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full animate-apple-fade">
        {/* Brand Mark with Smooth Progress Halo */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Breathing ambient halo: subtle purple in light mode, subtle yellow in dark mode */}
          <div
            className="absolute -inset-2 rounded-3xl bg-purple-500/15 dark:bg-amber-400/15 blur-xl animate-apple-halo pointer-events-none"
            aria-hidden="true"
          />

          {/* Rotating progress indicator ring */}
          <div className="relative flex items-center justify-center">
            <svg
              className="h-20 w-20 animate-apple-spin text-purple-600/20 dark:text-amber-400/20"
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
              {/* Dark mode: refined subtle yellow/neutral progress stroke */}
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="url(#appleProgressGradDark)"
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
                  id="appleProgressGradDark"
                  x1="0"
                  y1="0"
                  x2="80"
                  y2="80"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#eab308" />
                  <stop offset="0.6" stopColor="#facc15" />
                  <stop offset="1" stopColor="#fde047" stopOpacity="0.2" />
                </linearGradient>
              </defs>
            </svg>

            {/* Centered Refined CCE Brand Monogram */}
            <div className="absolute inset-2.5 rounded-2xl bg-white dark:bg-[#121824] border border-purple-200/80 dark:border-amber-400/20 shadow-sm flex items-center justify-center">
              <span className="font-extrabold text-sm tracking-wider text-purple-700 dark:text-amber-400">
                CCE
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Typography with Smooth Fade Transition */}
        <div className="space-y-1.5 transition-all duration-200">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {currentTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tracking-normal">
            {currentSub}
          </p>
        </div>
      </div>
    </div>
  );
};
