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
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md p-4 transition-colors select-none ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="relative flex flex-col items-center">
          {/* Circular Logo Presentation - Strictly NO white square/card */}
          <div className="relative flex items-center justify-center h-24 w-24 sm:h-28 sm:w-28">
            {/* Ambient Amber Glow */}
            <div className="absolute inset-1 rounded-full bg-[#FFB347]/15 dark:bg-[#FFB347]/10 blur-xl pointer-events-none" />

            {/* Smooth Subtle Circular Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-[#FFB347]/20 border-t-[#FFB347] animate-spin [animation-duration:2.5s] motion-reduce:animate-none pointer-events-none" />

            {/* Original Clean Logo */}
            <div className="relative flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-transparent overflow-hidden">
              <img
                src="/websitelogo.png"
                alt="CCE-PGPA Logo"
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

          {/* Institutional Label */}
          <div className="mt-2 text-center space-y-1">
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
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  const imgDimensionMap = {
    sm: "h-8 w-8",
    md: "h-11 w-11",
    lg: "h-14 w-14",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center py-6 px-4 text-center select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`relative flex items-center justify-center rounded-full ${dimensionMap[size]}`}>
        {/* Subtle Rotating Amber Ring */}
        <div className="absolute inset-0 rounded-full border border-[#FFB347]/25 border-t-[#FFB347] animate-spin [animation-duration:2.5s] motion-reduce:animate-none pointer-events-none" />

        {/* Official Website Logo */}
        <img
          src="/websitelogo.png"
          alt="CCE Logo"
          className={`${imgDimensionMap[size]} object-contain select-none`}
        />
      </div>

      {/* Inline Equalizer Bars directly below logo */}
      <div className="flex items-end justify-center gap-1 h-4 mt-2.5 mb-1.5 select-none" aria-hidden="true">
        <span className="w-1 h-4 rounded-full bg-[#FFB347] animate-equalizer-1" />
        <span className="w-1 h-4 rounded-full bg-[#FFB347] animate-equalizer-2" />
        <span className="w-1 h-4 rounded-full bg-[#FFB347] animate-equalizer-3" />
        <span className="w-1 h-4 rounded-full bg-[#FFB347] animate-equalizer-4" />
        <span className="w-1 h-4 rounded-full bg-[#FFB347] animate-equalizer-5" />
      </div>

      {message && (
        <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
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
