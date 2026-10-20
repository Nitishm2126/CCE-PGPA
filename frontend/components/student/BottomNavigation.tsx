"use client";

import React from "react";

interface BottomNavigationProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSubmitClick: () => void;
  unreadMessagesCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  onSubmitClick,
  unreadMessagesCount = 0,
}) => {
  const tabs = [
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
      id: "submit_action",
      label: "Submit",
      isAction: true,
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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

  return (
    <>
      {/* Mobile Fixed Bottom Navigation Bar (< md) */}
      <nav
        aria-label="Student Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-sm pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 transition-colors"
      >
        <div className="grid grid-cols-6 items-center justify-around px-1 max-w-md mx-auto">
          {tabs.map((tab) => {
            if (tab.isAction) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={onSubmitClick}
                  aria-label="Submit new PGPA achievement"
                  className="flex flex-col items-center justify-center -mt-3 group cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-colors">
                    {tab.icon}
                  </div>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                    {tab.label}
                  </span>
                </button>
              );
            }

            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                className="relative flex flex-col items-center justify-center py-1 transition-colors cursor-pointer"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center transition-colors relative ${
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  {tab.icon}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-0.5 text-[8px] font-bold text-white">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[9px] tracking-tight mt-0.5 truncate max-w-full ${
                    isActive
                      ? "font-bold text-blue-600 dark:text-blue-400"
                      : "font-medium text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <span className="h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Navigation Segment Control (>= md) */}
      <div className="hidden md:flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 px-3.5 py-1.5 rounded-xl shadow-xs mb-6 transition-colors">
        <div className="flex items-center gap-1">
          {tabs
            .filter((t) => !t.isAction)
            .map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/80 dark:border-blue-800 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                  }`}
                >
                  <div className="relative">
                    {tab.icon}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-bold text-white animate-pulse">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>

        <button
          type="button"
          onClick={onSubmitClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Submit Activity</span>
        </button>
      </div>
    </>
  );
};
