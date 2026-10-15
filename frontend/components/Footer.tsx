import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Department of Computer and Communication Engineering (CCE)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sri Sairam Engineering College, Chennai &bull; CCE Achieve PGPA Management System
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              PostgreSQL Verified
            </span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span>Version 1.0.0</span>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200/60 dark:border-slate-850 pt-4 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Confidential Academic Evaluation Platform &bull; Closed Cohort Access Only &bull; All activity logged for department audit
          </p>
        </div>
      </div>
    </footer>
  );
};
