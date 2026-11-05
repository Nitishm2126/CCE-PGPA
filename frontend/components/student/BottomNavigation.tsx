"use client";

import React from "react";

export interface StudentNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSubmitClick?: () => void;
  unreadMessagesCount?: number;
}

export type BottomNavigationProps = StudentNavProps;
export type StudentDesktopNavProps = StudentNavProps;
export type StudentBottomNavProps = StudentNavProps;

// Shared desktop tabs list
const getDesktopTabs = (unreadMessagesCount: number) => [
  {
    id: "submit",
    label: "Submit Activity",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    id: "components",
    label: "Components",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
  {
    id: "activity",
    label: "Activity",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: "messages",
    label: "Messages",
    badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
    ),
  },
  {
    id: "progress",
    label: "Progress",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
];

// Shared mobile tabs list (5 symmetrically balanced items)
const getMobileNavTabs = (unreadMessagesCount: number) => [
  {
    id: "submit",
    label: "Submit",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    id: "components",
    label: "Components",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
  {
    id: "activity",
    label: "Activity",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: "messages",
    label: "Messages",
    badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
    ),
  },
];

/**
 * StudentDesktopNav
 * Renders the top segment control on desktop screens (>= md).
 * Positioned inside <main> at the top of the content area.
 */
export const StudentDesktopNav: React.FC<StudentDesktopNavProps> = ({
  activeTab,
  onSelectTab,
  unreadMessagesCount = 0,
}) => {
  const desktopTabs = getDesktopTabs(unreadMessagesCount);

  return (
    <div className="hidden md:flex items-center justify-between bg-white dark:bg-[#111111] border border-slate-200/90 dark:border-[#292929] px-3 py-1.5 rounded-xl shadow-2xs mb-6 transition-colors">
      <div className="flex items-center gap-1">
        {desktopTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                isActive
                  ? "bg-purple-50 dark:bg-[#202020] text-purple-700 dark:text-[#5DD62C] font-semibold border border-purple-200 dark:border-[#5DD62C]/40 shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#181818] font-medium"
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-bold text-white shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * StudentBottomNav
 * Renders the mobile bottom navigation bar (< md).
 * Positioned OUTSIDE <main> and docked flush at bottom-0 with 0 margins.
 */
export const StudentBottomNav: React.FC<StudentBottomNavProps> = ({
  activeTab,
  onSelectTab,
  unreadMessagesCount = 0,
}) => {
  const mobileNavTabs = getMobileNavTabs(unreadMessagesCount);

  return (
    <nav
      aria-label="Student Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-[60] md:hidden bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#292929] shadow-[0_-2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_-2px_16px_rgba(0,0,0,0.6)] pb-[env(safe-area-inset-bottom,0px)] transition-colors !m-0 !mb-0"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        margin: 0,
        marginBottom: 0,
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        willChange: "transform",
      }}
    >
      <div className="grid grid-cols-5 items-center justify-around w-full max-w-md mx-auto px-1 py-1">
        {mobileNavTabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex flex-col items-center justify-center py-1 transition-all duration-150 active:scale-95 cursor-pointer min-h-[48px] select-none apple-tap-feedback"
            >
              {/* Fixed Icon Box for uniform baseline across all tabs */}
              <div
                className={`flex h-5 w-5 items-center justify-center transition-colors relative ${
                  isActive
                    ? "text-purple-600 dark:text-[#5DD62C]"
                    : "text-slate-400 hover:text-slate-600 dark:text-[#737373] dark:hover:text-[#D4D4D4]"
                }`}
              >
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-bold text-white shadow-xs animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Fixed Text Label Box with single-line truncation */}
              <div className="h-3.5 flex items-center justify-center mt-1 w-full px-0.5">
                <span
                  className={`text-[10px] leading-none tracking-tight truncate max-w-full text-center ${
                    isActive
                      ? "font-semibold text-purple-700 dark:text-[#5DD62C]"
                      : "font-medium text-slate-500 dark:text-[#A3A3A3]"
                  }`}
                >
                  {tab.label}
                </span>
              </div>

              {/* Active Indicator Dot */}
              <div className="h-1 flex items-center justify-center mt-0.5">
                {isActive ? (
                  <span className="h-1 w-1 rounded-full bg-purple-600 dark:bg-[#5DD62C] animate-apple-fade" />
                ) : (
                  <span className="h-1 w-1" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// Default export & compatibility alias
export const BottomNavigation = StudentBottomNav;
