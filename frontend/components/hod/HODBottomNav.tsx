"use client";

import React from "react";

interface HODBottomNavProps {
  activeTab: "submissions" | "students" | "overview" | "messages" | "excel-import" | "pgpa-grades";
  onSelectTab: (tab: "submissions" | "students" | "overview" | "messages" | "excel-import" | "pgpa-grades") => void;
  onOpenMore: () => void;
  unreadMessagesCount?: number;
}

export const HODBottomNav: React.FC<HODBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMore,
  unreadMessagesCount = 0,
}) => {
  const tabs = [
    {
      id: "submissions" as const,
      label: "Submissions",
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
      id: "students" as const,
      label: "Students",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342"
          />
        </svg>
      ),
    },
    {
      id: "overview" as const,
      label: "Mentors",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
          />
        </svg>
      ),
    },
    {
      id: "messages" as const,
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

  const isMoreActive = activeTab === "excel-import" || activeTab === "pgpa-grades";

  return (
    <nav
      aria-label="HOD Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#292929] shadow-[0_-2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_-2px_16px_rgba(0,0,0,0.6)] pb-[env(safe-area-inset-bottom,0px)] transition-colors !m-0 !mb-0"
      style={{ margin: 0, marginBottom: 0 }}
    >
      <div className="grid grid-cols-5 items-center justify-around w-full max-w-md mx-auto px-1 py-1">
        {tabs.map((tab) => {
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
              {/* Fixed Icon Box */}
              <div
                className={`flex h-6 w-6 items-center justify-center transition-colors relative ${
                  isActive
                    ? "text-purple-700 dark:text-[#FFD84D]"
                    : "text-slate-400 hover:text-slate-600 dark:text-[#737373] dark:hover:text-[#D4D4D4]"
                }`}
              >
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white shadow-xs animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Fixed Label Box */}
              <div className="h-3.5 flex items-center justify-center mt-1 w-full px-0.5">
                <span
                  className={`text-[10px] leading-none tracking-tight truncate max-w-full text-center ${
                    isActive
                      ? "font-semibold text-purple-700 dark:text-[#FFD84D]"
                      : "font-medium text-slate-500 dark:text-[#A3A3A3]"
                  }`}
                >
                  {tab.label}
                </span>
              </div>

              {/* Active Indicator Dot */}
              <div className="h-1 flex items-center justify-center mt-0.5">
                {isActive ? (
                  <span className="h-1 w-1 rounded-full bg-purple-700 dark:bg-[#FFD84D] animate-apple-fade" />
                ) : (
                  <span className="h-1 w-1" />
                )}
              </div>
            </button>
          );
        })}

        {/* 5th Tab: More Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="Open more tools and actions"
          className="relative flex flex-col items-center justify-center py-1 transition-all duration-150 active:scale-95 cursor-pointer min-h-[48px] select-none apple-tap-feedback text-slate-500 hover:text-slate-700 dark:text-[#737373] dark:hover:text-[#D4D4D4]"
        >
          <div
            className={`flex h-6 w-6 items-center justify-center transition-colors ${
              isMoreActive ? "text-purple-700 dark:text-[#FFD84D]" : ""
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <div className="h-3.5 flex items-center justify-center mt-1 w-full px-0.5">
            <span
              className={`text-[10px] leading-none tracking-tight font-medium text-center ${
                isMoreActive
                  ? "font-semibold text-purple-700 dark:text-[#FFD84D]"
                  : "text-slate-500 dark:text-[#A3A3A3]"
              }`}
            >
              More
            </span>
          </div>
          <div className="h-1 flex items-center justify-center mt-0.5">
            {isMoreActive ? (
              <span className="h-1 w-1 rounded-full bg-purple-700 dark:bg-purple-400 animate-apple-fade" />
            ) : (
              <span className="h-1 w-1" />
            )}
          </div>
        </button>
      </div>
    </nav>
  );
};

