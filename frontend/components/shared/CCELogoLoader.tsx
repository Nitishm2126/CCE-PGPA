"use client";

import React from "react";

interface CCELogoLoaderProps {
  size?: "sm" | "md" | "lg" | "fullscreen";
  message?: string;
  submessage?: string;
  className?: string;
}

export const CCELogoLoader: React.FC<CCELogoLoaderProps> = ({
  size = "md",
  message = "Loading CCE-PGPA...",
  submessage,
  className = "",
}) => {
  if (size === "fullscreen") {
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#0A0A0A] p-4 transition-colors select-none ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="relative flex flex-col items-center">
          {/* Subtle Ambient Amber Glow */}
          <div className="absolute -inset-4 rounded-full bg-[#FFB347]/15 dark:bg-[#FFB347]/10 blur-xl animate-pulse motion-reduce:animate-none" />

          {/* Animated Spinner Ring */}
          <div className="relative flex items-center justify-center h-24 w-24 sm:h-28 sm:w-28">
            <svg
              className="absolute inset-0 h-full w-full animate-spin motion-reduce:animate-none text-[#FFB347]"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="currentColor"
                strokeOpacity="0.15"
              />
              <path
                d="M50 6 A44 44 0 0 1 94 50"
                stroke="currentColor"
                strokeLinecap="round"
              />
            </svg>

            {/* Official Website Logo */}
            <img
              src="/websitelogo.png"
              alt="CCE-PGPA Logo"
              className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-sm animate-pulse motion-reduce:animate-none"
            />
          </div>

          {/* Institutional Label */}
          <div className="mt-5 text-center space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {message}
            </h3>
            {submessage && (
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {submessage}
              </p>
            )}
            <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#FFB347]">
              <span>Department of Computer and Communication Engineering</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Section / Card / Inline loader
  const dimensionMap = {
    sm: "h-10 w-10",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  const imgDimensionMap = {
    sm: "h-7 w-7",
    md: "h-11 w-11",
    lg: "h-14 w-14",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center py-6 px-4 text-center select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`relative flex items-center justify-center ${dimensionMap[size]}`}>
        {/* Subtle Rotating Amber Arc */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin motion-reduce:animate-none text-[#FFB347]"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="currentColor"
            strokeOpacity="0.15"
          />
          <path
            d="M50 6 A44 44 0 0 1 94 50"
            stroke="currentColor"
            strokeLinecap="round"
          />
        </svg>

        {/* Official Website Logo */}
        <img
          src="/websitelogo.png"
          alt="CCE Logo"
          className={`${imgDimensionMap[size]} object-contain animate-pulse motion-reduce:animate-none`}
        />
      </div>

      {message && (
        <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {message}
        </p>
      )}
      {submessage && (
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 max-w-xs">
          {submessage}
        </p>
      )}
    </div>
  );
};
