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
        className={`absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,179,71,0.12)_0%,transparent_65%)] ${
          isLoginVariant
            ? "dark:bg-[radial-gradient(circle_at_center,rgba(93,214,44,0.10)_0%,transparent_65%)]"
            : "dark:bg-[radial-gradient(circle_at_center,rgba(93,214,44,0.08)_0%,transparent_65%)]"
        }`}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full animate-apple-fade">
        {/* Brand Mark with Smooth Circular Ring */}
        <div className="relative flex flex-col items-center justify-center">
          {/* Circular Logo Presentation - Strictly NO white square/card */}
          <div className="relative flex items-center justify-center h-24 w-24 sm:h-28 sm:w-28">
            {/* Ambient subtle amber glow */}
            <div className="absolute inset-1 rounded-full bg-[#FFB347]/15 dark:bg-[#FFB347]/10 blur-md pointer-events-none" />

            {/* Smooth subtle rotating circular ring */}
            <div className="absolute inset-0 rounded-full border-2 border-[#FFB347]/20 border-t-[#FFB347] animate-spin [animation-duration:2.5s] motion-reduce:animate-none pointer-events-none" />

            {/* Original Logo inside clean circular presentation */}
            <div className="relative flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-transparent overflow-hidden">
              <img
                src="/websitelogo.png"
                alt="CCE Logo"
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-md select-none"
              />
            </div>
          </div>

          {/* Animated Equalizer Bars directly BELOW the logo */}
          <div className="flex items-end justify-center gap-1.5 h-6 mt-4 mb-3 select-none" aria-label="Loading animation" role="presentation">
            <span className="w-1.5 h-6 rounded-full bg-[#FFB347] shadow-[0_0_8px_rgba(255,179,71,0.4)] animate-equalizer-1" />
            <span className="w-1.5 h-6 rounded-full bg-[#FFB347] shadow-[0_0_8px_rgba(255,179,71,0.4)] animate-equalizer-2" />
            <span className="w-1.5 h-6 rounded-full bg-[#FFB347] shadow-[0_0_8px_rgba(255,179,71,0.4)] animate-equalizer-3" />
            <span className="w-1.5 h-6 rounded-full bg-[#FFB347] shadow-[0_0_8px_rgba(255,179,71,0.4)] animate-equalizer-4" />
            <span className="w-1.5 h-6 rounded-full bg-[#FFB347] shadow-[0_0_8px_rgba(255,179,71,0.4)] animate-equalizer-5" />
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
