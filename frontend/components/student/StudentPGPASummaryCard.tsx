"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { StudentPGPAResponse, SemesterResponse } from "@/types/achievement";

interface StudentPGPASummaryCardProps {
  token?: string | null;
  onNavigateComponents?: () => void;
}

export const StudentPGPASummaryCard: React.FC<StudentPGPASummaryCardProps> = ({
  token,
  onNavigateComponents,
}) => {
  const [pgpaData, setPgpaData] = useState<StudentPGPAResponse | null>(null);
  const [semesters, setSemesters] = useState<SemesterResponse[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<boolean>(false);

  // Load Semesters
  useEffect(() => {
    let mounted = true;
    api.studentGetSemesters(token)
      .then((sems) => {
        if (!mounted) return;
        setSemesters(sems);
        if (sems.length > 0) {
          setSelectedSemesterId(sems[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load semesters for PGPA card:", err);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  // Load PGPA Data whenever selectedSemesterId changes
  const loadPGPA = useCallback(async (semId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMyPGPA(semId, token);
      setPgpaData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load PGPA report.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (selectedSemesterId) {
      loadPGPA(selectedSemesterId);
    }
  }, [selectedSemesterId, loadPGPA]);

  const a1 = pgpaData?.a1_score ?? 0;
  const gpa = pgpaData?.semester_gpa ?? null;
  const pgpa = pgpaData?.pgpa ?? null;

  return (
    <div className="bg-white dark:bg-[#171E28] rounded-2xl border border-slate-200 dark:border-[#2B3543] p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
      {/* 1. Header & Semester Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#2B3543]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#E8EDF4]">
              Point-Grade Performance Audit (PGPA)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#7E8B9C]">
            Official institutional evaluation based on the 14-component guidelines formula: PGPA = (A1 &times; 0.6) + (GPA &times; 0.4)
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-800 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name} (Sem {s.semester_number})
              </option>
            ))}
          </select>

          {onNavigateComponents && (
            <button
              type="button"
              onClick={onNavigateComponents}
              className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-xs hover:bg-blue-100 transition cursor-pointer"
            >
              Browse 14 Components
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Score Highlights */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-blue-600 border-t-transparent mb-2" />
          <p>Calculating verified PGPA score...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Final PGPA */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white p-5 shadow-xs relative overflow-hidden">
              <div className="relative z-10 flex flex-col justify-between h-full space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 font-mono">
                    Final PGPA Score
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                    Sem {pgpaData?.semester_number || 1}
                  </span>
                </div>
                <div>
                  <span className="text-4xl font-extrabold tracking-tight text-white">
                    {pgpa !== null ? pgpa.toFixed(2) : "—"}
                  </span>
                  <span className="text-xs text-slate-300 font-medium ml-1.5">/ 10.0</span>
                </div>
                <p className="text-[11px] text-blue-200/80 leading-tight">
                  {pgpa !== null
                    ? "Combined score: (A1 × 0.6) + (GPA × 0.4)"
                    : "Awaiting Semester GPA for final weighting"}
                </p>
              </div>
            </div>

            {/* Card 2: A1 Score (Component Activities) */}
            <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/80 bg-indigo-50/50 dark:bg-[#131E2C] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-400">
                    A1 Score (60% Weight)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {pgpaData?.total_credits_earned || 0} Credits
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold text-indigo-900 dark:text-indigo-200">
                    {a1.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium ml-1">/ 10.0</span>
                </div>
              </div>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-2">
                Formula: &Sigma;(Grade &times; Credit) / &Sigma;(Credits Attempted)
              </p>
            </div>

            {/* Card 3: Semester University GPA */}
            <div className="rounded-2xl border border-emerald-100 dark:border-emerald-950/80 bg-emerald-50/50 dark:bg-[#122422] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    University GPA (40% Weight)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    Academics
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold text-emerald-900 dark:text-[#5EEAD4]">
                    {gpa !== null ? gpa.toFixed(2) : "—"}
                  </span>
                  <span className="text-xs text-slate-400 font-medium ml-1">/ 10.0</span>
                </div>
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-2">
                {gpa !== null ? "Official university semester grade point average" : "Pending HOD semester GPA import"}
              </p>
            </div>
          </div>

          {/* 3. Formula Explanation Banner */}
          {pgpaData?.formula_explanation && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 p-3.5 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
              <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">&bull;</span>
              <span className="font-mono text-[11px] leading-relaxed">
                {pgpaData.formula_explanation}
              </span>
            </div>
          )}

          {/* 4. Verified Component Breakdown Trigger */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setExpandedBreakdown(!expandedBreakdown)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 cursor-pointer"
            >
              <span>{expandedBreakdown ? "Hide Component Breakdown" : `View Verified Component Grades (${pgpaData?.results.length || 0})`}</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${expandedBreakdown ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Collapsible Table of Component Results */}
            {expandedBreakdown && (
              <div className="mt-3 rounded-xl border border-slate-200 dark:border-[#2B3543] overflow-hidden">
                {pgpaData?.results && pgpaData.results.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-[#2B3543] font-bold text-slate-700 dark:text-slate-300">
                        <th className="py-2.5 px-3">Component</th>
                        <th className="py-2.5 px-3 text-center">Credit Value</th>
                        <th className="py-2.5 px-3 text-center">Table B Grade</th>
                        <th className="py-2.5 px-3 text-center">Grade Points</th>
                        <th className="py-2.5 px-3">Verification Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pgpaData.results.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {r.component_name}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400">
                            {r.credit_value} cr
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {r.grade || "—"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {r.grade_points ?? "—"}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 capitalize">
                            {r.source.replace(/_/g, " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No verified component results recorded for Semester {pgpaData?.semester_number || 1} yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
