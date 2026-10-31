"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api, getStoredToken } from "@/lib/api-client";
import { AchievementResponse, StudentComponentResultItem, PGPAComponentResponse } from "@/types/achievement";

interface PGPAPerformanceTrackerProps {
  token?: string | null;
  achievements?: AchievementResponse[];
  visibleComponents?: PGPAComponentResponse[];
  onNavigateComponents?: () => void;
  onSubmitActivity?: () => void;
}

interface ComponentSummary {
  name: string;
  slug: string;
  shortName: string;
  category: string;
  icon: React.ReactNode;
  result: StudentComponentResultItem | null;
  verifiedCount: number;
  pendingCount: number;
  criteriaPending: boolean;
}

const TARGET_SLUGS = [
  "clubs-and-cells",
  "nptel-non-credit-transfer",
  "online-certifications",
  "internship",
  "sports-and-games",
] as const;

export const PGPAPerformanceTracker: React.FC<PGPAPerformanceTrackerProps> = ({
  token: tokenProp,
  achievements: achievementsProp,
  visibleComponents,
  onNavigateComponents,
  onSubmitActivity,
}) => {
  const token = tokenProp || (typeof window !== "undefined" ? getStoredToken() : null);

  const [componentResults, setComponentResults] = useState<StudentComponentResultItem[]>([]);
  const [internalAchievements, setInternalAchievements] = useState<AchievementResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "semester" | "30days">("all");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Fetch real data on mount or when token changes
  useEffect(() => {
    let isMounted = true;
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const promises: [
          Promise<StudentComponentResultItem[]>,
          Promise<AchievementResponse[]> | Promise<null>
        ] = [
            api.getMyComponentResults({ token }),
            achievementsProp ? Promise.resolve(null) : api.getMyAchievements(token),
          ];

        const [resultsData, achievementsData] = await Promise.all(promises);

        if (!isMounted) return;
        setComponentResults(resultsData || []);
        if (achievementsData) {
          setInternalAchievements(achievementsData);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load PGPA performance data.";
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [token, achievementsProp]);

  const activeAchievements = achievementsProp || internalAchievements;

  // Filter 5 target components summaries
  const targetComponentSummaries = useMemo<ComponentSummary[]>(() => {
    const slugMap: Record<string, StudentComponentResultItem> = {};
    componentResults.forEach((r) => {
      if (r.component_slug) {
        slugMap[r.component_slug] = r;
      }
    });

    const definitions: {
      name: string;
      slug: (typeof TARGET_SLUGS)[number];
      shortName: string;
      category: string;
      icon: React.ReactNode;
    }[] = [
        {
          name: "Clubs & Cells",
          slug: "clubs-and-cells",
          shortName: "Clubs",
          category: "Institutional Engagement",
          icon: (
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          ),
        },
        {
          name: "NPTEL Non-Credit Transfer",
          slug: "nptel-non-credit-transfer",
          shortName: "NPTEL",
          category: "Academic Enrichment",
          icon: (
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-5.25 6.557c.75.25 1.5.474 2.25.672" />
            </svg>
          ),
        },
        {
          name: "Online Certifications",
          slug: "online-certifications",
          shortName: "Online Certs",
          category: "Skill Development",
          icon: (
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          ),
        },
        {
          name: "Internship",
          slug: "internship",
          shortName: "Internship",
          category: "Industry Experience",
          icon: (
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
            </svg>
          ),
        },
        {
          name: "Sports & Games",
          slug: "sports-and-games",
          shortName: "Sports",
          category: "Athletics & Physical Fitness",
          icon: (
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.004 0H9.496m5.004 0V9.75a3 3 0 10-6 0v4.5m6 0a3 3 0 00-3-3m-3 3a3 3 0 013-3m0 0V3.75" />
            </svg>
          ),
        },
      ];

    const allowedSlugs = visibleComponents
      ? new Set(visibleComponents.filter((c) => c.is_visible !== false).map((c) => c.slug))
      : null;

    const filteredDefinitions = allowedSlugs
      ? definitions.filter((d) => allowedSlugs.has(d.slug))
      : definitions;

    return filteredDefinitions.map((def) => {
      const res = slugMap[def.slug] || null;
      const verifiedCount = activeAchievements.filter(
        (a) => a.component_slug === def.slug && a.status === "approved"
      ).length;
      const pendingCount = activeAchievements.filter(
        (a) => a.component_slug === def.slug && a.status === "pending"
      ).length;

      // Pending criteria flag
      const isCriteriaPending =
        (res && ((res.notes || "").toLowerCase().includes("pending") || (def.slug === "sports-and-games" && res.category?.toLowerCase().includes("all india")))) ||
        (def.slug === "nptel-non-credit-transfer" && res?.grade === "B" && !res?.raw_score);

      return {
        ...def,
        result: res,
        verifiedCount,
        pendingCount,
        criteriaPending: Boolean(isCriteriaPending),
      };
    });
  }, [componentResults, activeAchievements, visibleComponents]);

  // Build time-series points from verified achievements & results
  const chartData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const allowedSlugs = visibleComponents
      ? new Set(visibleComponents.filter((c) => c.is_visible !== false).map((c) => c.slug))
      : null;

    // Collect verified items with their dates and points
    interface PointRecord {
      date: Date;
      dateLabel: string;
      title: string;
      points: number;
      isPending: boolean;
    }

    const records: PointRecord[] = [];

    // Verified achievements
    activeAchievements.forEach((a) => {
      const dStr = a.event_date || a.updated_at || a.created_at;
      const d = dStr ? new Date(dStr) : new Date();

      if (a.status === "approved" && a.evaluated_points !== null && a.evaluated_points !== undefined) {
        records.push({
          date: d,
          dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          title: a.title,
          points: Number(a.evaluated_points),
          isPending: false,
        });
      } else if (a.status === "pending") {
        if (allowedSlugs && a.component_slug && !allowedSlugs.has(a.component_slug)) {
          return;
        }
        // Tentative points from metadata
        const tentativePts = Number(a.component_metadata?.calculated_points || a.component_metadata?.points || 0);
        if (tentativePts > 0) {
          records.push({
            date: d,
            dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            title: a.title,
            points: tentativePts,
            isPending: true,
          });
        }
      }
    });

    // Also include verified StudentComponentResult if not already covered by achievements
    componentResults.forEach((r) => {
      if (r.is_verified && r.raw_score && r.calculated_at) {
        const d = new Date(r.calculated_at);
        // Only add if no achievement with matching points around same date
        const alreadyExists = records.some(
          (rec) => Math.abs(rec.date.getTime() - d.getTime()) < 60000 && rec.points === r.raw_score
        );
        if (!alreadyExists) {
          records.push({
            date: d,
            dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            title: r.component_name || "Verified PGPA Component",
            points: Number(r.raw_score),
            isPending: false,
          });
        }
      }
    });

    // Filter by time window
    const filtered = records.filter((r) => {
      if (timeFilter === "30days") return r.date >= thirtyDaysAgo;
      return true;
    });

    // Sort chronologically
    filtered.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running cumulative points for verified vs projected pending
    let runningVerified = 0;
    let runningProjected = 0;

    const cumulativePoints: {
      dateLabel: string;
      title: string;
      verified: number;
      projected: number;
      deltaPoints: number;
      isPending: boolean;
    }[] = [];

    // Initial baseline at 0
    if (filtered.length > 0) {
      const firstDate = new Date(filtered[0].date.getTime() - 24 * 60 * 60 * 1000);
      cumulativePoints.push({
        dateLabel: firstDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        title: "Baseline",
        verified: 0,
        projected: 0,
        deltaPoints: 0,
        isPending: false,
      });
    }

    filtered.forEach((r) => {
      if (!r.isPending) {
        runningVerified += r.points;
        runningProjected += r.points;
        cumulativePoints.push({
          dateLabel: r.dateLabel,
          title: r.title,
          verified: runningVerified,
          projected: runningProjected,
          deltaPoints: r.points,
          isPending: false,
        });
      } else {
        runningProjected += r.points;
        cumulativePoints.push({
          dateLabel: r.dateLabel,
          title: `${r.title} (Pending Audit)`,
          verified: runningVerified,
          projected: runningProjected,
          deltaPoints: r.points,
          isPending: true,
        });
      }
    });

    const maxVerified = runningVerified;
    const maxProjected = runningProjected;

    return {
      points: cumulativePoints,
      maxVerified,
      maxProjected,
      hasPending: runningProjected > runningVerified,
    };
  }, [activeAchievements, componentResults, timeFilter, visibleComponents]);

  // Pure SVG coordinate math
  const svgDimensions = { width: 560, height: 200, paddingLeft: 45, paddingRight: 20, paddingTop: 20, paddingBottom: 35 };

  const plotPoints = useMemo(() => {
    const { width, height, paddingLeft, paddingRight, paddingTop, paddingBottom } = svgDimensions;
    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;

    const dataPoints = chartData.points;
    if (dataPoints.length === 0) return { verifiedPath: "", projectedPath: "", coords: [], yTicks: [] };

    const maxY = Math.max(100, Math.ceil((chartData.maxProjected * 1.15) / 50) * 50);

    const coords = dataPoints.map((p, i) => {
      const x = paddingLeft + (i / Math.max(1, dataPoints.length - 1)) * plotW;
      const yVerified = height - paddingBottom - (p.verified / maxY) * plotH;
      const yProjected = height - paddingBottom - (p.projected / maxY) * plotH;
      return { x, yVerified, yProjected, ...p };
    });

    // Build verified SVG path
    let verifiedPath = "";
    coords.forEach((c, idx) => {
      if (idx === 0) verifiedPath += `M ${c.x} ${c.yVerified}`;
      else verifiedPath += ` L ${c.x} ${c.yVerified}`;
    });

    // Build projected SVG path
    let projectedPath = "";
    coords.forEach((c, idx) => {
      if (idx === 0) projectedPath += `M ${c.x} ${c.yProjected}`;
      else projectedPath += ` L ${c.x} ${c.yProjected}`;
    });

    // Area fill path for verified points
    const areaPath = coords.length > 0
      ? `${verifiedPath} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`
      : "";

    // Generate 4 Y-ticks
    const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
      const val = Math.round(maxY * pct);
      const y = height - paddingBottom - pct * plotH;
      return { val, y };
    });

    return { verifiedPath, projectedPath, areaPath, coords, yTicks, maxY };
  }, [chartData]);

  // Grade color helper
  const getGradeBadgeStyle = (grade?: string | null) => {
    if (!grade) {
      return "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700";
    }
    const g = grade.toUpperCase();
    if (g === "O") return "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    if (g === "A+") return "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800";
    if (g === "A") return "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800";
    if (g === "B+") return "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    if (g === "B") return "bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800";
    return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700";
  };

  return (
    <section className="bg-white dark:bg-[#171E28] rounded-2xl border border-slate-200 dark:border-[#2B3543] p-5 sm:p-6 shadow-2xs transition-colors space-y-6">
      {/* Header & Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3543]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#E8EDF4]">
              PGPA Performance &amp; Milestone Tracker
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#7E8B9C]">
            Real-time trajectory of your verified PGPA achievements, official grades, and points growth
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSubmitActivity && (
            <button
              type="button"
              onClick={onSubmitActivity}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer min-h-[34px]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Submit Activity</span>
            </button>
          )}

          {onNavigateComponents && (
            <button
              type="button"
              onClick={onNavigateComponents}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50 hover:bg-slate-100 dark:bg-[#1C2531] dark:hover:bg-[#253041] text-slate-700 dark:text-[#A0ACBC] font-semibold text-xs transition-colors cursor-pointer min-h-[34px]"
            >
              <span>View All Rules</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Responsive Layout: Left Time-Series Chart | Right 5 Component Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SECTION (Col 7): Time-Series Cumulative Points Chart */}
        <div className="lg:col-span-7 bg-slate-50/70 dark:bg-[#1C2531]/60 rounded-xl border border-slate-200/80 dark:border-[#2B3543] p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-[#E8EDF4] uppercase tracking-wider">
                  Cumulative Verified Points
                </span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                  {chartData.maxVerified} Pts
                </span>
                {chartData.hasPending && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    +{chartData.maxProjected - chartData.maxVerified} In Review
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#7E8B9C] mt-0.5">
                Sum of raw verified points approved by torch bearer mentors
              </p>
            </div>

            {/* Filter buttons: All Time | This Semester | Last 30 Days */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setTimeFilter("all")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${timeFilter === "all"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-[#7E8B9C] hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("semester")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${timeFilter === "semester"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-[#7E8B9C] hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                Semester
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("30days")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${timeFilter === "30days"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-[#7E8B9C] hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* Chart Display Area */}
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
              <svg className="animate-spin h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span>Calculating points trajectory...</span>
            </div>
          ) : chartData.points.length <= 1 && chartData.maxVerified === 0 ? (
            /* Empty State */
            <div className="h-52 flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-slate-300 dark:border-[#2B3543] bg-white/60 dark:bg-[#171E28]/60 space-y-2.5">
              <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-[#E8EDF4]">
                No verified activities yet. Submit your first activity to see your progress.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#7E8B9C] max-w-sm">
                As soon as your faculty mentor audits and approves your submissions, your cumulative points and grade trajectory will appear here.
              </p>
              {onSubmitActivity && (
                <button
                  type="button"
                  onClick={onSubmitActivity}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
                >
                  Submit Activity Now
                </button>
              )}
            </div>
          ) : (
            /* Pure Responsive SVG Chart */
            <div className="relative">
              <svg
                viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
                className="w-full h-auto overflow-visible select-none"
              >
                <defs>
                  <linearGradient id="pgpaVerifiedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines & Y-labels */}
                {plotPoints.yTicks.map((tick, idx) => (
                  <g key={idx}>
                    <line
                      x1={svgDimensions.paddingLeft}
                      y1={tick.y}
                      x2={svgDimensions.width - svgDimensions.paddingRight}
                      y2={tick.y}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-[#2B3543]"
                      strokeWidth="1"
                      strokeDasharray={idx === 0 ? "0" : "3 3"}
                    />
                    <text
                      x={svgDimensions.paddingLeft - 8}
                      y={tick.y + 3}
                      textAnchor="end"
                      className="text-[9px] fill-slate-400 dark:fill-[#7E8B9C] font-mono"
                    >
                      {tick.val}
                    </text>
                  </g>
                ))}

                {/* Area Gradient Fill */}
                {plotPoints.areaPath && (
                  <path d={plotPoints.areaPath} fill="url(#pgpaVerifiedGradient)" />
                )}

                {/* Projected Pending Trajectory (Dashed Line) */}
                {chartData.hasPending && plotPoints.projectedPath && (
                  <path
                    d={plotPoints.projectedPath}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Verified Points Solid Line */}
                {plotPoints.verifiedPath && (
                  <path
                    d={plotPoints.verifiedPath}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Points on Line */}
                {plotPoints.coords.map((c, i) => (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPointIndex(i)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                  >
                    <circle
                      cx={c.x}
                      cy={c.isPending ? c.yProjected : c.yVerified}
                      r={hoveredPointIndex === i ? "6" : "3.5"}
                      fill={c.isPending ? "#F59E0B" : "#2563EB"}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="transition-all duration-150"
                    />

                    {/* X-axis date labels */}
                    {(i === 0 || i === plotPoints.coords.length - 1 || i % Math.ceil(plotPoints.coords.length / 4) === 0) && (
                      <text
                        x={c.x}
                        y={svgDimensions.height - 12}
                        textAnchor="middle"
                        className="text-[9px] fill-slate-500 dark:fill-[#7E8B9C] font-semibold"
                      >
                        {c.dateLabel}
                      </text>
                    )}
                  </g>
                ))}
              </svg>

              {/* Hover Tooltip Overlay */}
              {hoveredPointIndex !== null && plotPoints.coords[hoveredPointIndex] && (
                <div
                  className="absolute z-10 -top-2 transform -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] shadow-lg pointer-events-none whitespace-nowrap"
                  style={{
                    left: `${(plotPoints.coords[hoveredPointIndex].x / svgDimensions.width) * 100}%`,
                  }}
                >
                  <p className="font-bold">
                    {plotPoints.coords[hoveredPointIndex].title}
                  </p>
                  <p className="text-[10px] text-slate-300">
                    Cumulative: {plotPoints.coords[hoveredPointIndex].isPending
                      ? `${plotPoints.coords[hoveredPointIndex].projected} pts (Projected)`
                      : `${plotPoints.coords[hoveredPointIndex].verified} pts`}
                    {" "} &bull; {plotPoints.coords[hoveredPointIndex].dateLabel}
                  </p>
                </div>
              )}

              {/* Legend Strip */}
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60 dark:border-[#2B3543]/60 mt-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-sm bg-blue-600" />
                    <span className="text-slate-600 dark:text-[#A0ACBC] font-medium">Verified Points</span>
                  </div>
                  {chartData.hasPending && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-0.5 w-4 border-b-2 border-dashed border-amber-500" />
                      <span className="text-slate-600 dark:text-[#A0ACBC] font-medium">In-Review Projection</span>
                    </div>
                  )}
                </div>
                <span className="text-slate-400 dark:text-[#7E8B9C] font-mono text-[10px]">
                  Official 10-Point Scale
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SECTION (Col 5): Five Component Cards */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-[#E8EDF4] uppercase tracking-wider">
              Target 5-Component Matrix
            </span>
            <span className="text-[10px] text-slate-500 dark:text-[#7E8B9C]">
              Institutional Rubric Verified
            </span>
          </div>

          <div className="space-y-2">
            {targetComponentSummaries.map((comp) => {
              const res = comp.result;
              const hasResult = Boolean(res && res.grade);

              return (
                <div
                  key={comp.slug}
                  className="rounded-xl border border-slate-200/90 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] p-3 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700/60 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#253041] shrink-0 border border-slate-200/60 dark:border-[#334155]">
                      {comp.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-[#E8EDF4] truncate">
                          {comp.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-[#7E8B9C] mt-0.5">
                        {comp.criteriaPending ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Criteria Pending HOD Configuration
                          </span>
                        ) : hasResult ? (
                          <>
                            <span>
                              Score: <strong className="text-slate-700 dark:text-[#E8EDF4] font-semibold">{res?.raw_score !== null && res?.raw_score !== undefined ? `${res.raw_score} pts` : "Evaluated"}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>{res?.grade_points ?? 0} GP ({res?.credit_value ?? 3} Cr)</span>
                          </>
                        ) : (
                          <span className="text-slate-400 dark:text-[#64748B] italic">
                            No verified submissions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Grade badge & Activity Counts */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right text-[10px] text-slate-400 dark:text-[#7E8B9C] hidden sm:block">
                      <p>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{comp.verifiedCount}</strong> verified
                      </p>
                      {comp.pendingCount > 0 && (
                        <p className="text-blue-600 dark:text-blue-400 font-medium">
                          +{comp.pendingCount} in review
                        </p>
                      )}
                    </div>

                    <div
                      className={`h-8 w-11 rounded-lg border text-xs font-extrabold flex items-center justify-center shrink-0 ${getGradeBadgeStyle(
                        hasResult ? res?.grade : null
                      )}`}
                    >
                      {hasResult ? res?.grade : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};