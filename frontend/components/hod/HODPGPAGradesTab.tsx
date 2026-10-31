"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";
import {
  StudentPGPAGradeRow,
  StudentPGPAComponentScore,
  AchievementResponse,
} from "@/types/achievement";
import { HODStudentItem } from "@/types/auth";

interface HODPGPAGradesTabProps {
  token?: string | null;
  studentsList?: HODStudentItem[];
}

const TARGET_COMPONENTS = [
  { slug: "clubs-and-cells", label: "Clubs & Cells", icon: "🏛️" },
  { slug: "nptel-non-credit-transfer", label: "NPTEL (Non-Credit)", icon: "📜" },
  { slug: "online-certifications", label: "Online Certifications", icon: "💻" },
  { slug: "internship", label: "Internship", icon: "🏢" },
  { slug: "sports-and-games", label: "Sports & Games", icon: "🏆" },
] as const;

export const HODPGPAGradesTab: React.FC<HODPGPAGradesTabProps> = ({
  token,
  studentsList = [],
}) => {
  // Data states
  const [rows, setRows] = useState<StudentPGPAGradeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [mentorFilter, setMentorFilter] = useState<string>("all");
  const [componentSlugFilter, setComponentSlugFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  // Inspection modal state
  const [selectedStudent, setSelectedStudent] = useState<StudentPGPAGradeRow | null>(null);
  const [studentAchievements, setStudentAchievements] = useState<AchievementResponse[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState<boolean>(false);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Mentors list from studentsList or loaded rows
  const uniqueMentors = useMemo(() => {
    const map = new Map<string, { id?: string; name: string }>();
    studentsList.forEach((s) => {
      if (s.mentor_name) {
        map.set(s.mentor_id || s.mentor_name, {
          id: s.mentor_id || undefined,
          name: s.mentor_name,
        });
      }
    });
    // Also scan rows
    rows.forEach((r) => {
      if (r.mentor_name) {
        map.set(r.mentor_id || r.mentor_name, {
          id: r.mentor_id || undefined,
          name: r.mentor_name,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentsList, rows]);

  // Fetch PGPA Grades data
  const loadGrades = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const filters: {
        semester_id?: string;
        section?: string;
        mentor_id?: string;
        component_slug?: string;
        grade?: string;
        search?: string;
      } = {};

      if (semesterFilter !== "all") filters.semester_id = semesterFilter;
      if (sectionFilter !== "all") filters.section = sectionFilter;
      if (mentorFilter !== "all") filters.mentor_id = mentorFilter;
      if (componentSlugFilter !== "all") filters.component_slug = componentSlugFilter;
      if (gradeFilter !== "all") filters.grade = gradeFilter;
      if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();

      const data = await api.getHodStudentPgpaGrades(filters, token);
      setRows(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load student PGPA grades.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, semesterFilter, sectionFilter, mentorFilter, componentSlugFilter, gradeFilter, debouncedSearch]);

  // Trigger load on filter changes
  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  // Load achievements when inspecting a student
  useEffect(() => {
    if (!selectedStudent || !token) {
      setStudentAchievements([]);
      return;
    }
    let ignore = false;
    const fetchSubmissions = async () => {
      try {
        setLoadingAchievements(true);
        setAchievementsError(null);
        const res = await api.getStudentAchievementsForHod(selectedStudent.student_id, token);
        if (!ignore) {
          setStudentAchievements(res);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Failed to load student activity submissions.";
          setAchievementsError(msg);
        }
      } finally {
        if (!ignore) {
          setLoadingAchievements(false);
        }
      }
    };
    fetchSubmissions();
    return () => {
      ignore = true;
    };
  }, [selectedStudent, token]);

  const handleOpenEvidence = async (fileId: string) => {
    try {
      setOpeningFileId(fileId);
      const { url } = await api.downloadFile(fileId, token);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to open evidence file:", err);
    } finally {
      setOpeningFileId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setSemesterFilter("all");
    setSectionFilter("all");
    setMentorFilter("all");
    setComponentSlugFilter("all");
    setGradeFilter("all");
  };

  const isFilterActive =
    search.trim() !== "" ||
    semesterFilter !== "all" ||
    sectionFilter !== "all" ||
    mentorFilter !== "all" ||
    componentSlugFilter !== "all" ||
    gradeFilter !== "all";

  // Render Grade Badge helper
  const renderGradeBadge = (score?: StudentPGPAComponentScore | null) => {
    const points = score?.raw_score ?? score?.points ?? 0;
    if (!score || (!score.grade && points === 0 && !score.criteria_pending)) {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
          —
        </span>
      );
    }

    if (score.criteria_pending) {
      return (
        <div className="flex flex-col items-center">
          <span
            title="Criteria Pending HOD Configuration (e.g. All India competition level)"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shadow-2xs"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            HOD Req
          </span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5 font-medium">
            {points} pts
          </span>
        </div>
      );
    }

    if (!score.grade) {
      return (
        <div className="flex flex-col items-center">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
            In Review
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">{points} pts</span>
        </div>
      );
    }

    const grade = (score.grade || "").toUpperCase();
    let badgeStyle = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
    if (grade === "O") {
      badgeStyle = "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-800";
    } else if (grade === "A+") {
      badgeStyle = "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-800";
    } else if (grade === "A") {
      badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800";
    } else if (grade === "B+") {
      badgeStyle = "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800";
    } else if (grade === "B") {
      badgeStyle = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800";
    } else if (grade === "C") {
      badgeStyle = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800";
    }

    return (
      <div className="flex flex-col items-center">
        <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-xs font-black border ${badgeStyle}`}>
          {grade}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 font-medium">
          {points} pts
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 dark:bg-purple-950/50 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />
            CCE Five-Component PGPA Matrix
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Department PGPA Performance & Grades
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Live evaluation matrix across Clubs & Cells, NPTEL, Online Certifications, Internship, and Sports & Games.
            Click any student row or the Inspect button to view component breakdowns and activity submissions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadGrades}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin text-purple-600" : "text-slate-500"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <input
              type="text"
              placeholder="Search by student name or register number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2 pl-9 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Semester */}
          <div>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              aria-label="Filter by semester"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-purple-500 shadow-2xs"
            >
              <option value="all">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
              <option value="7">Semester 7</option>
              <option value="8">Semester 8</option>
            </select>
          </div>

          {/* Section */}
          <div>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              aria-label="Filter by section"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-purple-500 shadow-2xs"
            >
              <option value="all">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          {/* Mentor */}
          <div>
            <select
              value={mentorFilter}
              onChange={(e) => setMentorFilter(e.target.value)}
              aria-label="Filter by mentor"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-purple-500 shadow-2xs truncate"
            >
              <option value="all">All Mentors</option>
              {uniqueMentors.map((m) => (
                <option key={m.id || m.name} value={m.id || m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              aria-label="Filter by grade"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-purple-500 shadow-2xs"
            >
              <option value="all">All Grades</option>
              <option value="O">Grade O (Outstanding)</option>
              <option value="A+">Grade A+ (Excellent)</option>
              <option value="A">Grade A (Very Good)</option>
              <option value="B+">Grade B+ (Good)</option>
              <option value="B">Grade B (Above Average)</option>
              <option value="C">Grade C (Pass / Minimum)</option>
            </select>
          </div>
        </div>

        {/* Secondary filters row & Reset */}
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Component Scope:
            </span>
            <button
              type="button"
              onClick={() => setComponentSlugFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                componentSlugFilter === "all"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All 5 Components
            </button>
            {TARGET_COMPONENTS.map((tc) => (
              <button
                key={tc.slug}
                type="button"
                onClick={() => setComponentSlugFilter(tc.slug)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  componentSlugFilter === tc.slug
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                <span>{tc.icon}</span>
                <span>{tc.label}</span>
              </button>
            ))}
          </div>

          {isFilterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="py-10 text-center rounded-xl border border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20 p-6 space-y-3">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={loadGrades}
            className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer"
          >
            Retry Loading Grades
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No student records found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {isFilterActive
              ? "No student PGPA records match your selected criteria. Try adjusting or clearing your filters."
              : "No student records are currently enrolled in the department database."}
          </p>
          {isFilterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/70 dark:bg-slate-800/50">
                <th className="py-3 px-4 font-bold">Register No.</th>
                <th className="py-3 px-4 font-bold">Student Name</th>
                <th className="py-3 px-3 text-center">Clubs & Cells</th>
                <th className="py-3 px-3 text-center">NPTEL</th>
                <th className="py-3 px-3 text-center">Online Certs</th>
                <th className="py-3 px-3 text-center">Internship</th>
                <th className="py-3 px-3 text-center">Sports & Games</th>
                <th className="py-3 px-4 text-center font-bold">Total Pts</th>
                <th className="py-3 px-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => {
                const clubs = row.components["clubs-and-cells"];
                const nptel = row.components["nptel-non-credit-transfer"];
                const certs = row.components["online-certifications"];
                const internship = row.components["internship"];
                const sports = row.components["sports-and-games"];

                const hasPendingCriteria =
                  clubs?.criteria_pending ||
                  nptel?.criteria_pending ||
                  certs?.criteria_pending ||
                  internship?.criteria_pending ||
                  sports?.criteria_pending;

                return (
                  <tr
                    key={row.student_id}
                    onClick={() => setSelectedStudent(row)}
                    className="hover:bg-purple-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    {/* Register Number */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.register_number || "—"}
                    </td>

                    {/* Student Name & Meta */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                          {row.student_name}
                        </span>
                        {hasPendingCriteria && (
                          <span
                            title="Contains activity requiring HOD criteria configuration"
                            className="inline-flex h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-ping"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {row.section && <span>Sec {row.section}</span>}
                        {row.mentor_name && (
                          <>
                            <span>&bull;</span>
                            <span className="truncate max-w-[140px]">{row.mentor_name}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Clubs & Cells */}
                    <td className="py-3.5 px-3 text-center">{renderGradeBadge(clubs)}</td>

                    {/* NPTEL */}
                    <td className="py-3.5 px-3 text-center">{renderGradeBadge(nptel)}</td>

                    {/* Online Certifications */}
                    <td className="py-3.5 px-3 text-center">{renderGradeBadge(certs)}</td>

                    {/* Internship */}
                    <td className="py-3.5 px-3 text-center">{renderGradeBadge(internship)}</td>

                    {/* Sports & Games */}
                    <td className="py-3.5 px-3 text-center">{renderGradeBadge(sports)}</td>

                    {/* Total Points */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-mono">
                        {row.total_points}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudent(row);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900/60 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Detail Inspection Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div
            onClick={() => setSelectedStudent(null)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
          />

          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
            <div className="relative w-full max-w-4xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-7 text-left shadow-2xl transition-all border border-slate-200/90 dark:border-slate-800 my-auto max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      CCE-PGPA Student Audit
                    </span>
                    {selectedStudent.section && (
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Section {selectedStudent.section}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedStudent.student_name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    Register Number: <span className="font-bold text-purple-700 dark:text-purple-400">{selectedStudent.register_number}</span> &bull; Mentor: {selectedStudent.mentor_name || "Unassigned"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Total PGPA Points</span>
                    <span className="text-lg font-black text-purple-700 dark:text-purple-400 font-mono">
                      {selectedStudent.total_points} pts
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="mt-5 space-y-6">
                {/* Check for Pending Criteria in any component */}
                {Object.values(selectedStudent.components).some((c) => Boolean(c?.criteria_pending)) && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                    <span className="text-amber-600 text-xl shrink-0">⚠️</span>
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                        Criteria Pending HOD Configuration
                      </p>
                      <p className="mt-1 text-amber-800 dark:text-amber-300 leading-relaxed">
                        This student has submitted one or more activities (e.g. Sports & Games with All India level competition) where point criteria require Head of Department confirmation. Points and final grades will be officially awarded once criteria parameters are set.
                      </p>
                    </div>
                  </div>
                )}

                {/* 5 Component Breakdown Cards */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Five-Component Performance Breakdown
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {TARGET_COMPONENTS.map((tc) => {
                      const comp = selectedStudent.components[tc.slug];
                      const grade = comp?.grade || "—";
                      const pts = comp?.raw_score ?? comp?.points ?? 0;
                      const gp = comp?.grade_points ?? comp?.grade_point;
                      const isPending = Boolean(comp?.criteria_pending);
                      const isVerified = Boolean(comp?.is_verified);

                      return (
                        <div
                          key={tc.slug}
                          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="text-base">{tc.icon}</span>
                              {isPending ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                  HOD Req
                                </span>
                              ) : isVerified ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                  Verified
                                </span>
                              ) : comp?.grade ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                  Evaluated
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Not Started</span>
                              )}
                            </div>
                            <h5 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                              {tc.label}
                            </h5>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-end justify-between">
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase">Grade</p>
                              <p className="text-lg font-black text-purple-700 dark:text-purple-400">
                                {grade}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase">Points</p>
                              <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                                {pts} pts
                              </p>
                              {gp !== undefined && gp !== null && (
                                <p className="text-[10px] text-slate-400 font-mono">GP: {gp}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Student's Submissions List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Recent Activity Submissions ({studentAchievements.length})
                    </h4>
                  </div>

                  {loadingAchievements ? (
                    <div className="space-y-2 py-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : achievementsError ? (
                    <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-xs text-rose-700 dark:text-rose-300">
                      {achievementsError}
                    </div>
                  ) : studentAchievements.length === 0 ? (
                    <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                      No individual achievement submissions recorded for this student yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {studentAchievements.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs hover:border-purple-200 transition-colors"
                        >
                          <div className="truncate pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {sub.title}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                                {sub.component_name || "PGPA Component"}
                              </span>
                              {sub.status === "approved" ? (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  ✓ Verified
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400 capitalize">
                                  {sub.status}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {sub.activity_type && <span>{sub.activity_type} &bull; </span>}
                              {sub.organizer && <span>{sub.organizer} &bull; </span>}
                              {sub.outcome && <span>{sub.outcome}</span>}
                            </p>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {sub.files && sub.files.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenEvidence(sub.files[0].id)}
                                disabled={openingFileId === sub.files[0].id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                {openingFileId === sub.files[0].id ? (
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                                ) : (
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                )}
                                <span>Evidence</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No files</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
