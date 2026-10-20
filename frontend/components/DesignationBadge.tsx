"use client";

import React from "react";

export type DesignationType = "Change Maker" | "Torch Bearer";

interface DesignationBadgeProps {
  designation: DesignationType;
  size?: "sm" | "md";
  className?: string;
}

export const DesignationBadge: React.FC<DesignationBadgeProps> = ({
  designation,
  size = "sm",
  className = "",
}) => {
  const isChangeMaker = designation === "Change Maker";

  const sizeClasses =
    size === "sm"
      ? "text-[10px] sm:text-[11px] px-2 py-0.5 gap-1"
      : "text-xs sm:text-xs px-2.5 py-1 gap-1.5";

  if (isChangeMaker) {
    return (
      <span
        title="Institutional Title: Change Maker"
        className={`inline-flex items-center font-semibold rounded-full tracking-wide transition-all select-none border shadow-2xs ${sizeClasses} bg-teal-50 text-teal-800 border-teal-200/90 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-700/80 ${className}`}
      >
        {/* Subtle sparkle icon */}
        <svg
          className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span>Change Maker</span>
      </span>
    );
  }

  // Torch Bearer (Faculty Mentor / HOD)
  return (
    <span
      title="Academic Mentorship Designation: Torch Bearer"
      className={`inline-flex items-center font-semibold rounded-full tracking-wide transition-all select-none border shadow-2xs ${sizeClasses} bg-amber-50 text-amber-800 border-amber-200/90 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/80 ${className}`}
    >
      {/* Subtle torch/flame icon */}
      <svg
        className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.527.82-1.12 2.05-1.517 3.14-.37.99-.606 1.85-.75 2.518a4.992 4.992 0 00-1.564-.475 1 1 0 00-1.044.622C4.316 11.02 4 12.39 4 13.5 4 16.538 6.462 19 9.5 19s5.5-2.462 5.5-5.5c0-1.52-.5-3.08-1.28-4.52-.39-.72-.85-1.42-1.325-2.067-.53-.72-1.1-1.39-1.68-1.98a1 1 0 00-.73-.38h-.02zM9.5 17a3.5 3.5 0 01-3.5-3.5c0-.65.17-1.47.47-2.31.57.17 1.18.25 1.81.25 1.34 0 2.57-.42 3.56-1.14.73 1.09 1.16 2.18 1.16 3.2 0 1.93-1.57 3.5-3.5 3.5z"
          clipRule="evenodd"
        />
      </svg>
      <span>Torch Bearer</span>
    </span>
  );
};
