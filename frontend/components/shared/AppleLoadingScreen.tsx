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
    ? "fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0F15] text-[#E8EDF4] select-none transition-all duration-300"
    : `flex-1 flex items-center justify-center p-8 bg-[#0B0F15] text-[#E8EDF4] select-none ${className}`;

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-label={currentTitle}
    >
      {/* Subtle radial ambient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12)_0%,transparent_65%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full animate-apple-fade">
        {/* Brand Mark with Smooth Progress Halo */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Breathing ambient halo */}
          <div
            className="absolute -inset-2 rounded-3xl bg-blue-500/20 blur-xl animate-apple-halo pointer-events-none"
            aria-hidden="true"
          />

          {/* Rotating progress indicator ring */}
          <div className="relative flex items-center justify-center">
            <svg
              className="h-20 w-20 animate-apple-spin text-blue-500/30"
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
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="url(#appleProgressGrad)"
                strokeWidth="2.5"
                strokeDasharray="160 80"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient
                  id="appleProgressGrad"
                  x1="0"
                  y1="0"
                  x2="80"
                  y2="80"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#3B82F6" />
                  <stop offset="0.6" stopColor="#60A5FA" />
                  <stop offset="1" stopColor="#93C5FD" stopOpacity="0.2" />
                </linearGradient>
              </defs>
            </svg>

            {/* Centered Refined CCE Brand Monogram */}
            <div className="absolute inset-2.5 rounded-2xl bg-gradient-to-b from-[#1C2531] to-[#111721] border border-white/10 shadow-2xl flex items-center justify-center">
              <span className="font-extrabold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-300">
                CCE
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Typography with Smooth Fade Transition */}
        <div className="space-y-1.5 transition-all duration-200">
          <h2 className="text-sm font-semibold tracking-tight text-[#E8EDF4]">
            {currentTitle}
          </h2>
          <p className="text-xs text-[#7E8B9C] tracking-normal">
            {currentSub}
          </p>
        </div>
      </div>
    </div>
  );
};
