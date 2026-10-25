"use client";

import React, { useState, useEffect } from "react";
import { AchievementResponse, AchievementCreate, AchievementFileResponse } from "@/types/achievement";
import { api } from "@/lib/api-client";

interface EditAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: AchievementResponse | null;
  onSave: (achievementId: string, updatedFields: Partial<AchievementCreate>) => Promise<void>;
  onRefreshed?: () => Promise<void>;
}

export const EditAchievementModal: React.FC<EditAchievementModalProps> = ({
  isOpen,
  onClose,
  achievement,
  onSave,
  onRefreshed,
}) => {
  const isAcademics =
    achievement?.component_slug === "academics-gpa" ||
    achievement?.component_name?.toLowerCase().includes("academic") ||
    achievement?.component_name?.toLowerCase().includes("gpa");

  const isClubsAndCells =
    achievement?.component_slug === "clubs-and-cells" ||
    achievement?.component_name?.toLowerCase().includes("club");

  // General fields
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("Certification");
  const [organizer, setOrganizer] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [outcome, setOutcome] = useState("");
  const [description, setDescription] = useState("");

  // Academics specific
  const [gpa, setGpa] = useState("");

  // Clubs & Cells specific
  const [clubName, setClubName] = useState("");
  const [roleCategory, setRoleCategory] = useState("Member");
  const [eventLevel, setEventLevel] = useState("Within College");
  const [activityName, setActivityName] = useState("");

  const [attachedFiles, setAttachedFiles] = useState<AchievementFileResponse[]>([]);
  const [newEvidenceFile, setNewEvidenceFile] = useState<File | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (achievement) {
      const meta = achievement.component_metadata || {};
      setTitle(achievement.title || "");
      setActivityType(achievement.activity_type || "Certification");
      setOrganizer(achievement.organizer || "");
      setEventDate(
        achievement.event_date
          ? achievement.event_date.split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setOutcome(achievement.outcome || "");
      setDescription(achievement.description || "");

      // Academics
      if (meta.gpa !== undefined) {
        setGpa(meta.gpa.toString());
      } else if (achievement.outcome && !isNaN(parseFloat(achievement.outcome))) {
        setGpa(achievement.outcome);
      } else {
        setGpa("");
      }

      // Clubs & Cells
      setClubName(meta.club_name || achievement.organizer || "");
      setRoleCategory(meta.role_category || "Member");
      setEventLevel(meta.event_level || "Within College");
      setActivityName(achievement.title || "");

      setAttachedFiles(achievement.files || []);
      setNewEvidenceFile(null);
      setError(null);
    }
  }, [achievement, isOpen]);

  // Live calculation helpers
  const calculatedGradePreview = React.useMemo(() => {
    if (!isAcademics || !gpa) return null;
    const gpaNum = parseFloat(gpa);
    if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 10) return null;
    if (gpaNum >= 9.0) return { grade: "O", gp: 10.0, label: "Outstanding" };
    if (gpaNum >= 7.0) return { grade: "A+", gp: 9.0, label: "Excellent" };
    if (gpaNum >= 4.0) return { grade: "A", gp: 8.0, label: "Very Good" };
    if (gpaNum >= 2.0) return { grade: "B+", gp: 7.0, label: "Good" };
    if (gpaNum >= 1.0) return { grade: "B", gp: 6.0, label: "Fair" };
    return { grade: "C", gp: 5.0, label: "Satisfactory" };
  }, [isAcademics, gpa]);

  const calculatedClubsPointsPreview = React.useMemo(() => {
    if (!isClubsAndCells) return 0;
    if (roleCategory === "Member") return 100;
    if (roleCategory === "MAGIC") return 200;
    if (roleCategory === "Event Coordinator") return 200;
    if (roleCategory === "Volunteer") return 100;
    if (roleCategory === "Event Participation") {
      switch (eventLevel) {
        case "Within College": return 100;
        case "Within State (Other College)": return 200;
        case "National Level (Other State)": return 300;
        case "International Level (In College / Others)": return 400;
        case "International Level (Other Country)": return 500;
        default: return 100;
      }
    }
    if (roleCategory === "Winner") {
      switch (eventLevel) {
        case "Within College": return 200;
        case "Within State (Other College)": return 300;
        case "National Level (Other State)": return 500;
        case "International Level (In College / Others)": return 600;
        case "International Level (Other Country)": return 700;
        default: return 200;
      }
    }
    return 100;
  }, [isClubsAndCells, roleCategory, eventLevel]);

  if (!isOpen || !achievement) return null;

  const isApproved = achievement.status === "approved";
  const isPending = achievement.status === "pending";

  const handleDeleteEvidence = async (fileId: string) => {
    try {
      setDeletingFileId(fileId);
      setError(null);
      await api.deleteEvidenceFile(achievement.id, fileId);
      setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (onRefreshed) await onRefreshed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove evidence file.";
      setError(msg);
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. If student attached a replacement or additional evidence file, upload it
      if (newEvidenceFile) {
        await api.uploadEvidenceFile(achievement.id, newEvidenceFile);
      }

      // 2. Prepare payload based on component
      if (isAcademics) {
        const gpaNum = parseFloat(gpa);
        if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 10) {
          setError("Please enter a valid GPA between 0.00 and 10.00.");
          setIsSubmitting(false);
          return;
        }

        const semDisplay = achievement.semester?.display_name || (achievement.semester_id ? `Semester ${achievement.semester_id}` : "Current Semester");
        await onSave(achievement.id, {
          title: `${semDisplay} GPA: ${gpaNum.toFixed(2)}`,
          activity_type: "Academic GPA",
          outcome: gpaNum.toFixed(2),
          component_metadata: {
            gpa: gpaNum,
            scale: "10.00",
          },
        });
      } else if (isClubsAndCells) {
        if (!clubName.trim()) {
          setError("Please select or enter the Club/Cell name.");
          setIsSubmitting(false);
          return;
        }
        if (!activityName.trim()) {
          setError("Please specify the activity or event name.");
          setIsSubmitting(false);
          return;
        }

        const finalLevel = (roleCategory === "Event Participation" || roleCategory === "Winner") ? eventLevel : undefined;
        await onSave(achievement.id, {
          title: activityName.trim(),
          organizer: clubName.trim(),
          activity_type: roleCategory,
          event_date: eventDate || undefined,
          outcome: `${roleCategory}${finalLevel ? ` (${finalLevel})` : ""} - ${calculatedClubsPointsPreview} Points`,
          component_metadata: {
            club_name: clubName.trim(),
            role_category: roleCategory,
            event_level: finalLevel,
            calculated_points: calculatedClubsPointsPreview,
          },
        });
      } else {
        if (!title.trim()) {
          setError("Please provide an achievement title.");
          setIsSubmitting(false);
          return;
        }

        await onSave(achievement.id, {
          title: title.trim(),
          activity_type: activityType,
          organizer: organizer.trim() || undefined,
          event_date: eventDate || undefined,
          outcome: outcome.trim() || undefined,
          description: description.trim() || undefined,
          component_metadata: achievement.component_metadata || undefined,
        });
      }

      if (onRefreshed) {
        await onRefreshed();
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update achievement.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#171E28] border border-slate-200 dark:border-[#2B3543] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2B3543] shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#E8EDF4]">
              {isApproved ? "Revise Approved Achievement" : "Edit Achievement Details"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#7E8B9C] mt-0.5">
              Update activity title, organizer, outcome, or replace evidence file
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2531] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Controlled Revision Workflow Banner */}
          {isApproved && (
            <div className="rounded-xl bg-amber-50 dark:bg-[#2A2012] border border-amber-200/80 dark:border-amber-800/80 p-3.5 text-xs text-amber-800 dark:text-[#FCD34D] flex items-start gap-2.5">
              <svg className="h-5 w-5 text-amber-600 dark:text-[#FCD34D] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="font-bold">Controlled Revision Workflow</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  This achievement was previously approved. Saving changes will initiate an official revision workflow, resetting its status to &quot;Submitted for Review&quot; for your mentor to re-audit while preserving your prior verification history.
                </p>
              </div>
            </div>
          )}

          {/* Pending Submission Notice */}
          {isPending && (
            <div className="rounded-xl bg-blue-50 dark:bg-[#132338] border border-blue-200/80 dark:border-blue-800/80 p-3 text-xs text-blue-800 dark:text-[#93C5FD] flex items-start gap-2">
              <svg className="h-4 w-4 text-blue-600 dark:text-[#4C83E6] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-[11px] leading-relaxed">
                This record is currently in the mentor review queue. You can update any fields or replace evidence files freely.
              </p>
            </div>
          )}

          {/* Component Banner */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#1C2531] p-3 border border-slate-200 dark:border-[#2B3543] text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#7E8B9C] tracking-wider">
              PGPA Component
            </span>
            <p className="font-semibold text-slate-900 dark:text-[#E8EDF4] mt-0.5">
              {achievement.component_name || "PGPA Component"}
            </p>
          </div>

          {/* Component-Specific Form Content */}
          {isAcademics ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Academics / Anna University GPA
                  </span>
                  {calculatedGradePreview && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold text-xs shadow-xs">
                      Tentative Grade: {calculatedGradePreview.grade} ({calculatedGradePreview.gp} GP)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mb-3">
                  Enter your official Anna University Semester GPA on a 10.00 point scale. Grade Points are computed using Table B authoritative rules.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Semester GPA (0.00 – 10.00) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    required
                    value={gpa}
                    onChange={(e) => setGpa(e.target.value)}
                    placeholder="e.g. 8.75"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] placeholder:text-slate-400 dark:placeholder:text-[#7E8B9C] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  />
                </div>
              </div>
            </div>
          ) : isClubsAndCells ? (
            <div className="space-y-4">
              {/* Table 7.1 Badge */}
              <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/40 p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                    Table 7.1 Point Allocation
                  </p>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    {roleCategory} {roleCategory === "Event Participation" || roleCategory === "Winner" ? `(${eventLevel})` : ""}
                  </p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-600 text-white font-bold text-xs shadow-xs">
                  {calculatedClubsPointsPreview} Points
                </span>
              </div>

              {/* Club / Cell */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Club or Professional Cell <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="e.g. Coding Club, IEEE Student Branch, Robotics Club"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                />
              </div>

              {/* Role Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Participation / Role Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={roleCategory}
                  onChange={(e) => setRoleCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                >
                  <option value="Member">Club Member (100 Points)</option>
                  <option value="Event Participation">Event Participation (100 – 500 Points)</option>
                  <option value="Winner">Winner / Position Award (200 – 700 Points)</option>
                  <option value="MAGIC">MAGIC (200 Points)</option>
                  <option value="Event Coordinator">Event Coordinator (200 Points)</option>
                  <option value="Volunteer">Volunteer (100 Points)</option>
                </select>
              </div>

              {/* Event Level if Participation or Winner */}
              {(roleCategory === "Event Participation" || roleCategory === "Winner") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Event Level <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={eventLevel}
                    onChange={(e) => setEventLevel(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  >
                    <option value="Within College">Within College</option>
                    <option value="Within State (Other College)">Within State (Other College)</option>
                    <option value="National Level (Other State)">National Level (Other State)</option>
                    <option value="International Level (In College / Others)">International Level (In College / Others)</option>
                    <option value="International Level (Other Country)">International Level (Other Country)</option>
                  </select>
                </div>
              )}

              {/* Activity Name & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Activity / Event Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={activityName}
                    onChange={(e) => setActivityName(e.target.value)}
                    placeholder="e.g. Annual Hackathon 2026"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Activity Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] placeholder:text-slate-400 dark:placeholder:text-[#7E8B9C] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  placeholder="e.g. NPTEL Elite Gold Cloud Computing"
                />
              </div>

              {/* Activity Type & Event Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Activity Type
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  >
                    <option value="Certification" className="dark:bg-[#1C2531] dark:text-[#E8EDF4]">Online Certification</option>
                    <option value="Hackathon" className="dark:bg-[#1C2531] dark:text-[#E8EDF4]">Hackathon / Contest</option>
                    <option value="Workshop" className="dark:bg-[#1C2531] dark:text-[#E8EDF4]">Technical Workshop</option>
                    <option value="Internship" className="dark:bg-[#1C2531] dark:text-[#E8EDF4]">Industry Internship</option>
                    <option value="Publication" className="dark:bg-[#1C2531] dark:text-[#E8EDF4]">Research Publication</option>
                    <option value="Community Service" className="dark:bg-[#1C2531] dark:text-[#E8EDF4]">Social / Community</option>
                    <option value="Club Activity" className="dark:bg-[#1C2531] dark:text-[#E8EDF4]">Student Club Activity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Event / Completion Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  />
                </div>
              </div>

              {/* Organizer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Organizing Body / Platform
                </label>
                <input
                  type="text"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] placeholder:text-slate-400 dark:placeholder:text-[#7E8B9C] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  placeholder="e.g. NPTEL / IIT Madras, Coursera, LeetCode"
                />
              </div>

              {/* Outcome / Score */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Outcome / Score / Grade
                </label>
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] placeholder:text-slate-400 dark:placeholder:text-[#7E8B9C] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  placeholder="e.g. 92% (Top 1%), First Place, Grade A+"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Brief Description / Highlights
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] placeholder:text-slate-400 dark:placeholder:text-[#7E8B9C] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Provide context or key learning outcomes..."
                />
              </div>
            </>
          )}

          {/* Attached Evidence Files & Replacement */}
          <div className="pt-2 border-t border-slate-200 dark:border-[#2B3543] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 dark:text-[#E8EDF4]">
                Supporting Evidence Files (PDF)
              </label>
              <span className="text-[11px] text-slate-400 dark:text-[#7E8B9C]">
                {attachedFiles.length} file(s) attached
              </span>
            </div>

            {attachedFiles.length > 0 && (
              <div className="space-y-2">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/70 dark:bg-[#1C2531] text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-rose-600 text-[9px] font-bold text-white shrink-0">
                        PDF
                      </span>
                      <span className="font-medium text-slate-900 dark:text-[#E8EDF4] truncate" title={file.original_filename}>
                        {file.original_filename}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-[#7E8B9C] shrink-0">
                        ({(file.size_bytes / 1024).toFixed(0)} KB)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteEvidence(file.id)}
                      disabled={deletingFileId === file.id}
                      title="Remove this evidence file"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50 min-h-[32px]"
                    >
                      {deletingFileId === file.id ? (
                        <span className="h-3 w-3 animate-spin rounded-full border border-rose-600 border-t-transparent" />
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Replacement / Additional PDF */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A0ACBC] mb-1">
                {attachedFiles.length > 0 ? "Replace or Add Evidence File (PDF)" : "Upload PDF Evidence"}
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setNewEvidenceFile(f);
                }}
                className="w-full text-xs text-slate-500 dark:text-[#A0ACBC] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-[#1C2531] file:text-blue-700 dark:file:text-[#4C83E6] hover:file:bg-blue-100 cursor-pointer"
              />
              {newEvidenceFile && (
                <p className="mt-1 text-[11px] text-emerald-600 dark:text-[#5EEAD4] font-medium">
                  ✓ Selected: {newEvidenceFile.name} ({(newEvidenceFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-[#2B3543]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#2B3543] text-slate-700 dark:text-[#E8EDF4] hover:bg-slate-50 dark:hover:bg-[#232E3E] transition-colors cursor-pointer min-h-[36px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer min-h-[36px]"
            >
              {isSubmitting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>{isApproved ? "Confirm Revision" : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
