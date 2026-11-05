"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ManualComponentPointResponse } from "@/types/achievement";

interface ManualPointsSectionProps {
  token: string | null;
}

export const ManualPointsSection: React.FC<ManualPointsSectionProps> = ({ token }) => {
  const [pointsList, setPointsList] = useState<ManualComponentPointResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchPoints = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.getStudentManualPoints(token);
        setPointsList(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load manual points.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPoints();
  }, [token]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/90 dark:border-[#2e2e2e] bg-white dark:bg-[#0F0F0F] p-5 sm:p-6 shadow-xs animate-pulse">
        <div className="h-4 w-48 bg-slate-200 dark:bg-[#202020] rounded-md mb-3" />
        <div className="h-16 bg-slate-100 dark:bg-[#202020] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return null; // Silently omit if not applicable or error
  }

  if (pointsList.length === 0) {
    return null; // Omit if no manual points awarded yet
  }

  const totalPoints = pointsList.reduce((acc, curr) => acc + curr.points, 0);

  return (
    <section
      aria-label="Manual Component Points"
      className="rounded-2xl border border-slate-200/90 dark:border-[#2e2e2e] bg-white dark:bg-[#0F0F0F] p-5 sm:p-6 shadow-xs space-y-4 transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#2e2e2e]">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-600 dark:bg-[#5DD62C]" />
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
              Mentor Manual Component Points
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
            Special component points awarded directly by your faculty mentor
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-[#202020] border border-purple-200/80 dark:border-[#2e2e2e] text-xs font-bold text-purple-700 dark:text-[#5DD62C] self-start sm:self-auto">
          <span>Total Awarded:</span>
          <span className="font-mono text-sm">{totalPoints.toFixed(1)} pts</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pointsList.map((mp) => (
          <div
            key={mp.id}
            className="p-3.5 rounded-xl border border-slate-200/80 dark:border-[#2e2e2e] bg-slate-50/60 dark:bg-[#202020] space-y-2 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-[#F5F5F5] text-xs">
                  {mp.component_name || "PGPA Component"}
                </h3>
                <span className="text-[10px] font-semibold text-purple-600 dark:text-[#5DD62C]">
                  {mp.semester_name || `Semester ${mp.semester_number || ""}`}
                </span>
              </div>
              <span className="font-mono font-bold text-sm px-2 py-0.5 rounded-lg bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-[#2e2e2e] text-purple-700 dark:text-[#5DD62C]">
                +{mp.points.toFixed(1)} pts
              </span>
            </div>

            <p className="text-slate-600 dark:text-[#D4D4D4] text-[11px] leading-relaxed bg-white/70 dark:bg-[#0F0F0F]/70 p-2 rounded-lg border border-slate-200/50 dark:border-[#2e2e2e]">
              &ldquo;{mp.remarks}&rdquo;
            </p>

            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-[#737373] pt-1">
              <span>Awarded by {mp.mentor_name || "Faculty Mentor"}</span>
              <span>{new Date(mp.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
