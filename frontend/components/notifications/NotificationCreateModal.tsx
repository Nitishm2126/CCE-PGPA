"use client";

import React, { useState, useEffect } from "react";
import {
  NotificationCreateRequest,
  NotificationItem,
  NotificationPriority,
  NotificationCategory,
  NotificationDisplayMode,
} from "@/types/notifications";
import { notificationsApi } from "@/lib/notifications-api";
import { eventsApi } from "@/lib/events-api";
import { api } from "@/lib/api-client";
import { AdminStudentItem } from "@/types/auth";
import { EventItem } from "@/types/events";

interface NotificationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (notification: NotificationItem) => void;
  initialNotification?: NotificationItem | null;
  prefillEvent?: EventItem | null;
}

export const NotificationCreateModal: React.FC<NotificationCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialNotification,
  prefillEvent,
}) => {
  const isEdit = !!initialNotification;

  // Form State
  const [title, setTitle] = useState("");
  const [shortMessage, setShortMessage] = useState("");
  const [detailedMessage, setDetailedMessage] = useState("");
  const [category, setCategory] = useState<NotificationCategory>("event_announcement");
  const [priority, setPriority] = useState<NotificationPriority>("normal");
  const [imageUrl, setImageUrl] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [eventId, setEventId] = useState<string>("");

  // Audience
  const [audienceType, setAudienceType] = useState<"all" | "academic_year" | "section" | "specific_students">("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("A");
  const [selectedYear, setSelectedYear] = useState<string>("2");

  // Display Mode & Delivery
  const [displayMode, setDisplayMode] = useState<NotificationDisplayMode>("both");
  const [publishAction, setPublishAction] = useState<"publish" | "schedule" | "draft">("publish");
  const [scheduledAt, setScheduledAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [canDismiss, setCanDismiss] = useState(true);

  // Helper lists & status
  const [students, setStudents] = useState<AdminStudentItem[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState(false);

  // Initialize data
  useEffect(() => {
    if (!isOpen) return;

    // Fetch students for targeting
    api.adminGetStudents()
      .then((res: AdminStudentItem[]) => {
        if (Array.isArray(res)) setStudents(res);
      })
      .catch((e: any) => console.warn("Failed to load students for audience selection", e));

    // Fetch events for association
    eventsApi.listEvents({})
      .then((res) => {
        if (res?.events) setEventsList(res.events);
      })
      .catch((e: any) => console.warn("Failed to load events for dropdown", e));

    if (initialNotification) {
      setTitle(initialNotification.title || "");
      setShortMessage(initialNotification.short_message || "");
      setDetailedMessage(initialNotification.detailed_message || "");
      setCategory((initialNotification.category as any) || "event_announcement");
      setPriority(initialNotification.priority || "normal");
      setImageUrl(initialNotification.image_url || "");
      setAttachmentUrl(initialNotification.attachment_url || "");
      setCtaLabel(initialNotification.cta_label || "");
      setCtaUrl(initialNotification.cta_url || "");
      setEventId(initialNotification.event_id || "");
      setAudienceType(
        (["all", "academic_year", "section", "specific_students"].includes(initialNotification.audience_type)
          ? initialNotification.audience_type
          : "all") as any
      );
      setDisplayMode(initialNotification.display_mode || "both");
      setPublishAction(initialNotification.status === "scheduled" ? "schedule" : initialNotification.status === "draft" ? "draft" : "publish");
      setScheduledAt(initialNotification.scheduled_at ? initialNotification.scheduled_at.substring(0, 16) : "");
      setExpiresAt(initialNotification.expires_at ? initialNotification.expires_at.substring(0, 16) : "");
      setCanDismiss(Boolean(initialNotification.can_dismiss));

      if (initialNotification.audience_type === "specific_students" && Array.isArray(initialNotification.audience_payload)) {
        setSelectedStudents(initialNotification.audience_payload);
      } else if (initialNotification.audience_type === "section" && typeof initialNotification.audience_payload === "string") {
        setSelectedSection(initialNotification.audience_payload);
      } else if (initialNotification.audience_type === "academic_year" && typeof initialNotification.audience_payload === "string") {
        setSelectedYear(initialNotification.audience_payload);
      }
    } else if (prefillEvent) {
      setTitle(`Announcement: ${prefillEvent.title}`);
      setShortMessage(prefillEvent.short_description || `Registration is open for ${prefillEvent.title}.`);
      setCategory("event_announcement");
      setPriority("important");
      setEventId(prefillEvent.id);
      setImageUrl(prefillEvent.banner_image_url || prefillEvent.poster_url || "");
      setCtaLabel("View Event & Register");
      setCtaUrl(`/student?tab=events&eventId=${prefillEvent.id}`);
      setAudienceType((prefillEvent.audience_type as any) || "all");
      setDisplayMode("both");
      setPublishAction("publish");
    } else {
      // Reset defaults
      setTitle("");
      setShortMessage("");
      setDetailedMessage("");
      setCategory("event_announcement");
      setPriority("normal");
      setImageUrl("");
      setAttachmentUrl("");
      setCtaLabel("");
      setCtaUrl("");
      setEventId("");
      setAudienceType("all");
      setSelectedStudents([]);
      setDisplayMode("both");
      setPublishAction("publish");
      setScheduledAt("");
      setExpiresAt("");
      setCanDismiss(true);
      setError(null);
    }
  }, [isOpen, initialNotification, prefillEvent]);

  if (!isOpen) return null;

  // Handle media file upload
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "image" | "attachment") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const res = await eventsApi.uploadEventFile(file);
      if (field === "image") {
        setImageUrl(res.file_url || res.storage_reference);
      } else {
        setAttachmentUrl(res.file_url || res.storage_reference);
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide a notification title.");
      return;
    }
    if (!shortMessage.trim()) {
      setError("Please provide a concise short message.");
      return;
    }

    let audiencePayload: any = null;
    if (audienceType === "specific_students") {
      if (selectedStudents.length === 0) {
        setError("Please select at least one student for audience targeting.");
        return;
      }
      audiencePayload = selectedStudents;
    } else if (audienceType === "section") {
      audiencePayload = selectedSection;
    } else if (audienceType === "academic_year") {
      audiencePayload = selectedYear;
    }

    if (publishAction === "schedule" && !scheduledAt) {
      setError("Please provide a date and time for scheduled release.");
      return;
    }

    const payload: NotificationCreateRequest = {
      title: title.trim(),
      short_message: shortMessage.trim(),
      detailed_message: detailedMessage.trim() || undefined,
      category,
      priority,
      image_url: imageUrl.trim() || undefined,
      attachment_url: attachmentUrl.trim() || undefined,
      cta_label: ctaLabel.trim() || undefined,
      cta_url: ctaUrl.trim() || undefined,
      event_id: eventId || undefined,
      audience_type: audienceType,
      audience_payload: audiencePayload,
      display_mode: displayMode,
      status: publishAction === "publish" ? "published" : publishAction === "schedule" ? "scheduled" : "draft",
      scheduled_at: publishAction === "schedule" && scheduledAt ? `${scheduledAt}:00` : undefined,
      expires_at: expiresAt ? `${expiresAt}:00` : undefined,
      can_dismiss: canDismiss,
    };

    setIsSubmitting(true);
    try {
      let saved: NotificationItem;
      if (isEdit && initialNotification) {
        saved = await notificationsApi.updateNotification(initialNotification.id, payload);
      } else {
        saved = await notificationsApi.createNotification(payload);
      }
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save notification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      (s.full_name || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.register_number || "").toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-[#5DD62C] text-sm">
              🔔
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
                {isEdit ? "Edit In-App Notification" : "Create In-App Notification"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">
                Broadcast announcements, event invites, and reminders directly to students.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* View Toggle: Editor vs Student Preview */}
        <div className="px-5 pt-2.5 pb-1 border-b border-slate-100 dark:border-[#292929] flex gap-2 bg-slate-50/50 dark:bg-[#202020]/40">
          <button
            type="button"
            onClick={() => setPreviewTab(false)}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              !previewTab
                ? "border-blue-600 dark:border-[#5DD62C] text-blue-600 dark:text-[#5DD62C]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            ✏️ Configuration
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab(true)}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              previewTab
                ? "border-blue-600 dark:border-[#5DD62C] text-blue-600 dark:text-[#5DD62C]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            👁️ Live Student Preview
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 cursor-pointer">×</button>
          </div>
        )}

        {/* Modal Body */}
        {previewTab ? (
          /* LIVE STUDENT PREVIEW TAB */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-100/60 dark:bg-[#121212]">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">
                Student Feed View
              </div>

              {/* Notification Card Preview */}
              <div
                className={`rounded-2xl border bg-white dark:bg-[#1c1c1c] overflow-hidden shadow-md ${
                  priority === "urgent"
                    ? "border-rose-500/80 ring-2 ring-rose-500/20"
                    : priority === "important"
                    ? "border-amber-500/80"
                    : "border-slate-200 dark:border-[#2d2d2d]"
                }`}
              >
                {imageUrl && (
                  <div className="w-full h-36 bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-slate-100 dark:border-[#262626]">
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        priority === "urgent"
                          ? "bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 animate-pulse"
                          : priority === "important"
                          ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
                          : "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {priority.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400">Just now</span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">
                      {title || "Untitled Notification"}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-[#A3A3A3] mt-1 leading-relaxed">
                      {shortMessage || "Notification summary will appear here."}
                    </p>
                    {detailedMessage && (
                      <p className="text-[11px] text-slate-500 dark:text-[#888] mt-2 whitespace-pre-line border-t border-slate-100 dark:border-[#262626] pt-2">
                        {detailedMessage}
                      </p>
                    )}
                  </div>

                  {ctaLabel && (
                    <div className="pt-2">
                      <button
                        type="button"
                        className="w-full py-2 px-3 rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black text-xs font-semibold shadow-xs"
                      >
                        {ctaLabel} →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(displayMode === "popup_only" || displayMode === "popup_modal" || displayMode === "both") && (
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 text-center">
                  💡 This announcement will also display as an <strong>In-App Popup Modal</strong> immediately upon student login.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* CONFIGURATION TAB */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Title & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Notification Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Workshop Registration Open: Cloud AI Architectures"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#5DD62C] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                >
                  <option value="event_announcement">Event Announcement</option>
                  <option value="academic">Academic / Exam</option>
                  <option value="reminder">Deadline / Reminder</option>
                  <option value="opportunity">Internship / Job</option>
                  <option value="urgent_alert">Urgent Alert</option>
                  <option value="general">General Notice</option>
                </select>
              </div>
            </div>

            {/* Short Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                Summary / Short Message <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Brief summary visible directly in the notification bell drawer..."
                value={shortMessage}
                onChange={(e) => setShortMessage(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#5DD62C] outline-hidden"
              />
            </div>

            {/* Detailed Message (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                Detailed Message / Instructions <span className="text-slate-400">(Optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Full context, prerequisites, room details, or instructions..."
                value={detailedMessage}
                onChange={(e) => setDetailedMessage(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#5DD62C] outline-hidden font-sans"
              />
            </div>

            {/* Priority & Associated Event */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Priority Level
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["normal", "important", "urgent"] as NotificationPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer capitalize ${
                        priority === p
                          ? p === "urgent"
                            ? "bg-rose-500 text-white border-rose-500"
                            : p === "important"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-blue-600 text-white border-blue-600"
                          : "border-slate-200 dark:border-[#292929] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#202020]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Link to Event <span className="text-slate-400">(Optional)</span>
                </label>
                <select
                  value={eventId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setEventId(id);
                    const selected = eventsList.find((ev) => ev.id === id);
                    if (selected) {
                      setCtaLabel("View Event & Register");
                      setCtaUrl(`/student?tab=events&eventId=${selected.id}`);
                    }
                  }}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                >
                  <option value="">None (Independent Announcement)</option>
                  {eventsList.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Call to Action Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-[#202020]/40 border border-slate-200/60 dark:border-[#292929]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  CTA Button Label <span className="text-slate-400">(e.g. Register Now)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Register Now or View Guidelines"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  CTA Action URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. /student?tab=events or https://..."
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                />
              </div>
            </div>

            {/* Media & Attachments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Banner Image URL / Upload
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                  />
                  <label className="px-3 py-2 rounded-xl border border-slate-300 dark:border-[#292929] bg-slate-50 dark:bg-[#222] hover:bg-slate-100 dark:hover:bg-[#2c2c2c] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center">
                    <span>{uploadingMedia ? "⏳" : "📁"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleMediaUpload(e, "image")}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Document / PDF Attachment URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                  />
                  <label className="px-3 py-2 rounded-xl border border-slate-300 dark:border-[#292929] bg-slate-50 dark:bg-[#222] hover:bg-slate-100 dark:hover:bg-[#2c2c2c] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center">
                    <span>{uploadingMedia ? "⏳" : "📎"}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleMediaUpload(e, "attachment")}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Target Audience Controls */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#292929] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">
                  Target Audience
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 uppercase">
                  {audienceType === "all"
                    ? "All 61 Students"
                    : audienceType === "section"
                    ? `Section ${selectedSection}`
                    : audienceType === "academic_year"
                    ? `Year ${selectedYear}`
                    : `${selectedStudents.length} Specific Student(s)`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "all", label: "All Students (61)" },
                  { id: "academic_year", label: "By Year" },
                  { id: "section", label: "By Section" },
                  { id: "specific_students", label: "Specific Students" },
                ].map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setAudienceType(aud.id as any)}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                      audienceType === aud.id
                        ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-700 dark:text-[#5DD62C]"
                        : "border-slate-200 dark:border-[#292929] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#202020]"
                    }`}
                  >
                    {aud.label}
                  </button>
                ))}
              </div>

              {audienceType === "section" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Select Section:</span>
                  {["A", "B"].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        selectedSection === sec
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-300 dark:border-[#333] text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Section {sec}
                    </button>
                  ))}
                </div>
              )}

              {audienceType === "academic_year" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Select Year:</span>
                  {["1", "2", "3", "4"].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        selectedYear === yr
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-300 dark:border-[#333] text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Year {yr}
                    </button>
                  ))}
                </div>
              )}

              {audienceType === "specific_students" && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    placeholder="Search by name or reg number..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 outline-hidden"
                  />
                  <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-[#292929] rounded-xl p-2 space-y-1">
                    {filteredStudents.slice(0, 30).map((st) => {
                      const isSelected = selectedStudents.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#202020] text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents((prev) => [...prev, st.id]);
                              } else {
                                setSelectedStudents((prev) => prev.filter((id) => id !== st.id));
                              }
                            }}
                            className="rounded text-blue-600"
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {st.full_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({st.register_number})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Display Mode, Scheduling & Dismissal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-[#292929]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Display Mode
                </label>
                <select
                  value={displayMode}
                  onChange={(e) => setDisplayMode(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                >
                  <option value="both">Both (Bell Drawer + Login Popup)</option>
                  <option value="normal">Bell Drawer Only</option>
                  <option value="popup_modal">Login Popup Modal Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Delivery Timing
                </label>
                <select
                  value={publishAction}
                  onChange={(e) => setPublishAction(e.target.value as any)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] px-3 py-2 outline-hidden"
                >
                  <option value="publish">Publish Immediately</option>
                  <option value="schedule">Schedule for Later</option>
                  <option value="draft">Save as Draft</option>
                </select>
              </div>

              {publishAction === "schedule" && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Scheduled Publish Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Auto-Expiry Date <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 outline-hidden"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={canDismiss}
                    onChange={(e) => setCanDismiss(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Allow student to dismiss this notification</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-[#292929] flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-700 dark:text-[#D4D4D4] hover:bg-slate-50 dark:hover:bg-[#202020] cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-5 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                {isSubmitting
                  ? "Saving Notification..."
                  : isEdit
                  ? "Update Notification"
                  : publishAction === "publish"
                  ? "🚀 Publish Notification Now"
                  : publishAction === "schedule"
                  ? "⏰ Schedule Notification"
                  : "💾 Save Draft"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
