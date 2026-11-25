"use client";

import React, { useState, useEffect } from "react";
import {
  EventItem,
  EventCreateRequest,
  EventMode,
  AudienceType,
  FormLayoutMode,
  EventAttachment,
  EventTemplate,
} from "@/types/events";
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { notificationsApi } from "@/lib/notifications-api";
import { EventTemplatesLibraryModal } from "@/components/events/EventTemplatesLibraryModal";
import { api, getStoredToken } from "@/lib/api-client";
import { AdminStudentItem } from "@/types/auth";
import { SemesterResponse } from "@/types/achievement";

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: EventItem, isEditMode?: boolean) => void;
  initialEvent?: EventItem | null;
  semesters?: SemesterResponse[];
}

export const EventCreateModal: React.FC<EventCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialEvent,
  semesters = [],
}) => {
  const isEdit = !!initialEvent;

  // Tabs: basic, media, audience, rules, notifications
  const [activeTab, setActiveTab] = useState<"basic" | "media" | "audience" | "rules" | "notifications">("basic");

  // Section A: Basic Details & Schedule
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [category, setCategory] = useState("Workshop");
  const [customCategory, setCustomCategory] = useState("");
  const [venue, setVenue] = useState("");
  const [mode, setMode] = useState<EventMode>("Offline");
  const [meetingUrl, setMeetingUrl] = useState("");

  const [eventStartDate, setEventStartDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventEndTime, setEventEndTime] = useState("17:00");

  const [regStartDate, setRegStartDate] = useState("");
  const [regStartTime, setRegStartTime] = useState("09:00");
  const [regDeadlineDate, setRegDeadlineDate] = useState("");
  const [regDeadlineTime, setRegDeadlineTime] = useState("23:59");

  const [academicYear, setAcademicYear] = useState("2024-2025");
  const [semesterId, setSemesterId] = useState("");

  // Section B: Rich Media & Attachments
  const [posterUrl, setPosterUrl] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");

  // Section C: Target Audience
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("A");
  const [selectedYear, setSelectedYear] = useState<string>("2");
  const [studentSearch, setStudentSearch] = useState("");
  const [allStudents, setAllStudents] = useState<AdminStudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Section D: Contact Info, Guidelines & Rules
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [instructions, setInstructions] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [formLayoutMode, setFormLayoutMode] = useState<FormLayoutMode>("single_page");
  const [registrationCapacity, setRegistrationCapacity] = useState<string>("");

  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [allowEditSubmission, setAllowEditSubmission] = useState(false);
  const [closeAfterDeadline, setCloseAfterDeadline] = useState(true);
  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(true);

  // Section E: Integrated Student Notification Settings
  const [notifyStudents, setNotifyStudents] = useState<boolean>(false);
  const [notificationTitle, setNotificationTitle] = useState<string>("");
  const [notificationMessage, setNotificationMessage] = useState<string>("");
  const [notificationImageUrl, setNotificationImageUrl] = useState<string>("");
  const [notificationPriority, setNotificationPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [notificationDisplayMode, setNotificationDisplayMode] = useState<"bell_only" | "both">("bell_only");
  const [notificationCtaLabel, setNotificationCtaLabel] = useState<string>("Register Now");
  const [notificationTiming, setNotificationTiming] = useState<"with_event" | "scheduled">("with_event");
  const [notificationScheduledDate, setNotificationScheduledDate] = useState<string>("");
  const [notificationScheduledTime, setNotificationScheduledTime] = useState<string>("09:00");
  const [sendUpdateNotification, setSendUpdateNotification] = useState<boolean>(false);
  const [updateMessage, setUpdateMessage] = useState<string>("");

  // Status & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template states
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Reset or populate state when modal opens or initialEvent changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      setIdempotencyKey("");
      setTitle(initialEvent.title || "");
      setSubtitle(initialEvent.subtitle || "");
      setShortDescription(initialEvent.short_description || "");
      setDetailedDescription(initialEvent.detailed_description || "");
      setCategory(initialEvent.category || "Workshop");
      setCustomCategory(initialEvent.custom_category || "");
      setVenue(initialEvent.venue || "");
      setMode(initialEvent.mode || "Offline");
      setMeetingUrl(initialEvent.online_meeting_url || initialEvent.meeting_url || "");

      if (initialEvent.event_start_at) {
        const [d, t] = initialEvent.event_start_at.split("T");
        setEventStartDate(d || "");
        setEventStartTime(t ? t.substring(0, 5) : "09:00");
      }
      if (initialEvent.event_end_at) {
        const [d, t] = initialEvent.event_end_at.split("T");
        setEventEndDate(d || "");
        setEventEndTime(t ? t.substring(0, 5) : "17:00");
      }
      if (initialEvent.registration_start_at) {
        const [d, t] = initialEvent.registration_start_at.split("T");
        setRegStartDate(d || "");
        setRegStartTime(t ? t.substring(0, 5) : "09:00");
      }
      if (initialEvent.registration_deadline) {
        const [d, t] = initialEvent.registration_deadline.split("T");
        setRegDeadlineDate(d || "");
        setRegDeadlineTime(t ? t.substring(0, 5) : "23:59");
      }

      setAcademicYear(initialEvent.academic_year || "2024-2025");
      setSemesterId(initialEvent.semester_id || "");

      setPosterUrl(initialEvent.banner_image_url || initialEvent.poster_url || "");
      setGalleryImages(initialEvent.gallery_images || []);
      setAttachments(initialEvent.attachments || []);

      setAudienceType(initialEvent.audience_type || "all");
      if (initialEvent.audience_type === "specific_students" && Array.isArray(initialEvent.audience_payload)) {
        setSelectedStudents(initialEvent.audience_payload);
      } else if (initialEvent.audience_type === "section" && typeof initialEvent.audience_payload === "string") {
        setSelectedSection(initialEvent.audience_payload);
      } else if (initialEvent.audience_type === "academic_year" && typeof initialEvent.audience_payload === "string") {
        setSelectedYear(initialEvent.audience_payload);
      }

      setContactPerson(initialEvent.contact_person || "");
      setContactEmail(initialEvent.contact_email || "");
      setContactPhone(initialEvent.contact_phone || "");
      setInstructions(initialEvent.instructions || "");
      setTermsConditions(initialEvent.terms_conditions || "");
      setFormLayoutMode(initialEvent.form_layout_mode || "single_page");
      setRegistrationCapacity(
        initialEvent.registration_capacity != null ? String(initialEvent.registration_capacity) : ""
      );

      setAllowMultipleResponses(Boolean(initialEvent.allow_multiple_responses));
      setAllowEditSubmission(Boolean(initialEvent.allow_edit_submission));
      setCloseAfterDeadline(initialEvent.close_after_deadline !== false);
      setIsRegistrationEnabled(initialEvent.is_registration_enabled !== false);

      setNotifyStudents(Boolean(initialEvent.notify_students));
      setNotificationTitle(initialEvent.notification_title || initialEvent.title || "");
      setNotificationMessage(initialEvent.notification_message || initialEvent.short_description || "");
      setNotificationImageUrl(initialEvent.notification_image_url || initialEvent.poster_url || "");
      setNotificationPriority((initialEvent.notification_priority as any) || "normal");
      setNotificationDisplayMode((initialEvent.notification_display_mode as any) || "bell_only");
      setNotificationCtaLabel(initialEvent.notification_cta_label || "Register Now");
      if (initialEvent.notification_schedule) {
        setNotificationTiming("scheduled");
        const [d, t] = initialEvent.notification_schedule.split("T");
        setNotificationScheduledDate(d || "");
        setNotificationScheduledTime(t ? t.substring(0, 5) : "09:00");
      } else {
        setNotificationTiming("with_event");
        setNotificationScheduledDate("");
        setNotificationScheduledTime("09:00");
      }
      setSendUpdateNotification(false);
      setUpdateMessage("");
    } else {
      setIdempotencyKey(`evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
      const today = new Date().toISOString().split("T")[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const eventDay = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0];

      setTitle("");
      setSubtitle("");
      setShortDescription("");
      setDetailedDescription("");
      setCategory("Workshop");
      setCustomCategory("");
      setVenue("Auditorium / Seminar Hall");
      setMode("Offline");
      setMeetingUrl("");

      setEventStartDate(eventDay);
      setEventStartTime("09:00");
      setEventEndDate(eventDay);
      setEventEndTime("16:30");

      setRegStartDate(today);
      setRegStartTime("09:00");
      setRegDeadlineDate(nextWeek);
      setRegDeadlineTime("23:59");

      setAcademicYear("2024-2025");
      setSemesterId(semesters[0]?.id || "");

      setPosterUrl("");
      setGalleryImages([]);
      setAttachments([]);

      setAudienceType("all");
      setSelectedStudents([]);
      setSelectedSection("A");
      setSelectedYear("2");

      setContactPerson("");
      setContactEmail("");
      setContactPhone("");
      setInstructions("");
      setTermsConditions("");
      setFormLayoutMode("single_page");
      setRegistrationCapacity("");

      setAllowMultipleResponses(false);
      setAllowEditSubmission(false);
      setCloseAfterDeadline(true);
      setIsRegistrationEnabled(true);

      setNotifyStudents(false);
      setNotificationTitle("");
      setNotificationMessage("");
      setNotificationImageUrl("");
      setNotificationPriority("normal");
      setNotificationDisplayMode("bell_only");
      setNotificationCtaLabel("Register Now");
      setNotificationTiming("with_event");
      setNotificationScheduledDate("");
      setNotificationScheduledTime("09:00");
      setSendUpdateNotification(false);
      setUpdateMessage("");
    }

    setActiveTab("basic");
    setError(null);
  }, [isOpen, initialEvent, semesters]);

  // Load students eagerly for live audience recipient count calculation
  useEffect(() => {
    if (isOpen && allStudents.length === 0) {
      setLoadingStudents(true);
      api
        .adminGetStudents()
        .then((res: AdminStudentItem[]) => {
          setAllStudents(res || []);
        })
        .catch((e: unknown) => {
          console.error("Failed to load students for audience picker", e);
        })
        .finally(() => setLoadingStudents(false));
    }
  }, [isOpen, allStudents.length]);

  const recipientCount = React.useMemo(() => {
    if (loadingStudents) return "...";
    if (audienceType === "all") return allStudents.length || 61;
    if (audienceType === "section") {
      const cnt = allStudents.filter(
        (s) => (s.section || "").trim().toUpperCase() === selectedSection.trim().toUpperCase()
      ).length;
      return cnt;
    }
    if (audienceType === "academic_year") {
      const cnt = allStudents.filter(
        (s) =>
          String(s.year || "").trim() === selectedYear.trim() ||
          String(s.batch || "").trim() === selectedYear.trim()
      ).length;
      return cnt;
    }
    if (audienceType === "specific_students") {
      return selectedStudents.length;
    }
    return allStudents.length || 61;
  }, [allStudents, audienceType, selectedSection, selectedYear, selectedStudents, loadingStudents]);

  if (!isOpen) return null;

  // Handle poster upload
  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPoster(true);
    setError(null);
    try {
      const res = await eventsApi.uploadEventFile(file, {
        eventId: initialEvent?.id,
        uploadScope: "event_media",
      });
      setPosterUrl(res.file_url || res.storage_reference);
    } catch (err: any) {
      setError(err.message || "Failed to upload poster image");
    } finally {
      setUploadingPoster(false);
    }
  };

  // Handle gallery image upload
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPoster(true);
    setError(null);
    try {
      const res = await eventsApi.uploadEventFile(file, {
        eventId: initialEvent?.id,
        uploadScope: "event_media",
      });
      const urlVal = res.file_url || res.storage_reference;
      if (urlVal) {
        setGalleryImages((prev) => [...prev, urlVal]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload gallery image");
    } finally {
      setUploadingPoster(false);
    }
  };

  // Handle document upload for attachments
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setError(null);
    try {
      const res = await eventsApi.uploadEventFile(file, {
        eventId: initialEvent?.id,
        uploadScope: "event_media",
      });
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name,
          url: res.file_url || res.storage_reference,
          type: res.mime_type,
          size: res.file_size,
        },
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide an Event Title.");
      setActiveTab("basic");
      return;
    }

    if (!eventStartDate || !eventEndDate || !regStartDate || !regDeadlineDate) {
      setError("Please fill out all event schedule and registration dates.");
      setActiveTab("basic");
      return;
    }

    const eventStartAt = `${eventStartDate}T${eventStartTime}:00`;
    const eventEndAt = `${eventEndDate}T${eventEndTime}:00`;
    const regStartAt = `${regStartDate}T${regStartTime}:00`;
    const regDeadlineAt = `${regDeadlineDate}T${regDeadlineTime}:00`;

    if (eventEndAt < eventStartAt) {
      setError("Event end date cannot be earlier than event start date.");
      setActiveTab("basic");
      return;
    }

    if (regDeadlineAt < regStartAt) {
      setError("Registration deadline cannot be earlier than registration start date.");
      setActiveTab("basic");
      return;
    }

    if (mode !== "Offline" && meetingUrl.trim() && !/^https?:\/\//i.test(meetingUrl.trim())) {
      setError("Please enter a valid online meeting URL starting with http:// or https://.");
      setActiveTab("basic");
      return;
    }

    if (notifyStudents && notificationTiming === "scheduled" && !notificationScheduledDate) {
      setError("Please select a scheduled date for the student notification.");
      setActiveTab("notifications");
      return;
    }

    let audiencePayload: any = null;
    if (audienceType === "specific_students") {
      if (selectedStudents.length === 0) {
        setError("Please select at least one student for the target audience.");
        setActiveTab("audience");
        return;
      }
      audiencePayload = selectedStudents;
    } else if (audienceType === "section") {
      audiencePayload = selectedSection;
    } else if (audienceType === "academic_year") {
      audiencePayload = selectedYear;
    }

    const capNum = registrationCapacity.trim() ? parseInt(registrationCapacity.trim(), 10) : null;

    const payload: EventCreateRequest = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      category: category === "Other" && customCategory.trim() ? customCategory.trim() : category,
      custom_category: customCategory.trim() || undefined,
      short_description: shortDescription.trim() || undefined,
      detailed_description: detailedDescription.trim() || undefined,
      venue: venue.trim() || undefined,
      mode,
      meeting_url: mode !== "Offline" ? meetingUrl.trim() || undefined : undefined,
      online_meeting_url: mode !== "Offline" ? meetingUrl.trim() || undefined : undefined,
      event_start_at: eventStartAt,
      event_end_at: eventEndAt,
      registration_start_at: regStartAt,
      registration_deadline: regDeadlineAt,
      academic_year: academicYear,
      semester_id: semesterId || undefined,
      poster_url: posterUrl || undefined,
      banner_image_url: posterUrl || undefined,
      gallery_images: galleryImages.length > 0 ? galleryImages : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      audience_type: audienceType,
      audience_payload: audiencePayload,
      contact_person: contactPerson.trim() || undefined,
      contact_email: contactEmail.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      instructions: instructions.trim() || undefined,
      terms_conditions: termsConditions.trim() || undefined,
      form_layout_mode: formLayoutMode,
      registration_capacity: capNum,
      allow_multiple_responses: allowMultipleResponses,
      allow_edit_submission: allowEditSubmission,
      close_after_deadline: closeAfterDeadline,
      is_registration_enabled: isRegistrationEnabled,
      notify_students: notifyStudents,
      notification_title: notificationTitle.trim() || title.trim(),
      notification_message:
        notificationMessage.trim() ||
        shortDescription.trim() ||
        `Registration is now open for ${title.trim()}.`,
      notification_image_url: notificationImageUrl.trim() || posterUrl || undefined,
      notification_priority: notificationPriority,
      notification_display_mode: notificationDisplayMode,
      notification_cta_label: notificationCtaLabel.trim() || "Register Now",
      notification_schedule:
        notificationTiming === "scheduled" && notificationScheduledDate
          ? `${notificationScheduledDate}T${notificationScheduledTime}:00`
          : undefined,
      send_update_notification: isEdit ? sendUpdateNotification : false,
      update_message: isEdit && sendUpdateNotification ? updateMessage.trim() : undefined,
      idempotency_key: !isEdit && idempotencyKey ? idempotencyKey : undefined,
      sections_config: !isEdit ? selectedTemplate?.sections_config : undefined,
      form_fields: !isEdit ? selectedTemplate?.fields_config : undefined,
    };

    setIsSubmitting(true);
    try {
      let savedEvent: EventItem;
      if (isEdit && initialEvent) {
        savedEvent = await eventsApi.updateEvent(initialEvent.id, payload);
      } else {
        savedEvent = await eventsApi.createEvent(payload);
      }
      onSuccess(savedEvent, isEdit);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save event. Please check inputs and retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = allStudents.filter(
    (s) =>
      (s.full_name || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.register_number || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
                {isEdit ? "Edit Event Details" : "Create New Event"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                Configure event metadata, media, audience, and registration controls.
              </p>
            </div>
            {!isEdit && (
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
              >
                <span>⚡</span> Choose from Templates
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 px-5 gap-2 pt-2 overflow-x-auto">
          {[
            { id: "basic", label: "A: Basic & Schedule" },
            { id: "media", label: "B: Media & Attachments" },
            { id: "audience", label: "C: Target Audience" },
            { id: "rules", label: "D: Rules & Guidelines" },
            {
              id: "notifications",
              label: notifyStudents
                ? `E: Notifications (${recipientCount})`
                : "E: Student Notifications",
              activeIndicator: notifyStudents,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "border-blue-600 dark:border-[#5DD62C] text-blue-600 dark:text-[#5DD62C]"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === "notifications" && notifyStudents && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 cursor-pointer">×</button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: BASIC & SCHEDULE */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Event Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. AI & Cloud Architecture Workshop 2025"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Subtitle / Tagline
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. Hands-on Agentic AI Lab"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  >
                    <option value="Workshop">Workshop</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Competition">Competition</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                    <option value="Placement">Placement &amp; Training</option>
                    <option value="Certification">Certification Drive</option>
                    <option value="Internship">Internship / Industry</option>
                    <option value="Other">Custom / Other</option>
                  </select>
                </div>

                {category === "Other" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                      Custom Category Name
                    </label>
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. Alumni Interaction"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Event Mode
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as EventMode)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  >
                    <option value="Offline">Offline (On Campus)</option>
                    <option value="Online">Online (Virtual)</option>
                    <option value="Hybrid">Hybrid (In-Person + Stream)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Short Description (Card Summary)
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="One-line hook shown on student event card"
                  maxLength={180}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Detailed Event Overview &amp; Agenda
                </label>
                <textarea
                  rows={3}
                  value={detailedDescription}
                  onChange={(e) => setDetailedDescription(e.target.value)}
                  placeholder="Provide complete event details, agenda, key takeaways, and prerequisites..."
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Venue / Campus Room
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. CCE Computing Lab 3 / Sigma Auditorium"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  />
                </div>

                {mode !== "Offline" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                      Online Meeting Link
                    </label>
                    <input
                      type="url"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                    />
                  </div>
                )}
              </div>

              {/* Event Schedule Dates */}
              <div className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 p-3.5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#D4D4D4] block">
                  Event Schedule Window
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Event Start Date &amp; Time *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={eventStartDate}
                        onChange={(e) => setEventStartDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={eventStartTime}
                        onChange={(e) => setEventStartTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Event End Date &amp; Time *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={eventEndTime}
                        onChange={(e) => setEventEndTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Window */}
              <div className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 p-3.5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#D4D4D4] block">
                  Registration Window
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Registration Opens *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={regStartDate}
                        onChange={(e) => setRegStartDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={regStartTime}
                        onChange={(e) => setRegStartTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Registration Closes *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={regDeadlineDate}
                        onChange={(e) => setRegDeadlineDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={regDeadlineTime}
                        onChange={(e) => setRegDeadlineTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Year and Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2024-2025"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Semester
                  </label>
                  <select
                    value={semesterId}
                    onChange={(e) => setSemesterId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  >
                    <option value="">-- All Semesters --</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>{s.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RICH MEDIA & ATTACHMENTS */}
          {activeTab === "media" && (
            <div className="space-y-4">
              {/* Event Poster / Banner */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Primary Event Poster / Hero Banner</span>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 w-full space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePosterUpload}
                      disabled={uploadingPoster}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#252525] dark:file:text-[#5DD62C] cursor-pointer"
                    />
                    <input
                      type="url"
                      placeholder="Or paste direct image URL (https://...)"
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                  {posterUrl && (
                    <div className="w-24 h-16 rounded-xl border border-slate-200 dark:border-[#292929] overflow-hidden bg-slate-100 flex items-center justify-center">
                      <img src={resolveEventAssetUrl(posterUrl, getStoredToken())} alt="Poster preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Gallery Images */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Event Image Gallery</span>
                  <span className="text-[11px] text-slate-400">{galleryImages.length} images</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    disabled={uploadingPoster}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#252525] dark:file:text-[#5DD62C] cursor-pointer"
                  />
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Add gallery image URL (https://...)"
                      value={newGalleryUrl}
                      onChange={(e) => setNewGalleryUrl(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGalleryUrl.trim()) {
                          setGalleryImages([...galleryImages, newGalleryUrl.trim()]);
                          setNewGalleryUrl("");
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {galleryImages.map((img, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-[#292929] aspect-video">
                        <img src={resolveEventAssetUrl(img, getStoredToken())} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setGalleryImages(galleryImages.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Document / PDF Attachments */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">PDF Guidelines / Rulebook Attachments</span>
                  <span className="text-[11px] text-slate-400">{attachments.length} files</span>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Document Title (e.g. Rulebook PDF)"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                    <input
                      type="url"
                      placeholder="URL (https://...)"
                      value={newDocUrl}
                      onChange={(e) => setNewDocUrl(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newDocName.trim() && newDocUrl.trim()) {
                          setAttachments([...attachments, { name: newDocName.trim(), url: newDocUrl.trim(), type: "application/pdf" }]);
                          setNewDocName("");
                          setNewDocUrl("");
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-[#292929] hover:bg-slate-300 cursor-pointer"
                    >
                      + Add Link
                    </button>
                  </div>

                  <div className="pt-1">
                    <label className="block text-[11px] text-slate-400 mb-1">Or upload PDF file directly:</label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleDocUpload}
                      disabled={uploadingDoc}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#252525] dark:file:text-[#5DD62C] cursor-pointer"
                    />
                    {uploadingDoc && <span className="text-[11px] text-blue-500 mt-1 block">Uploading file...</span>}
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachments.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#292929] text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">📄 {doc.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-500 text-xs px-2 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TARGET AUDIENCE */}
          {activeTab === "audience" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                  Select Event Target Audience
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: "all", title: "All Department Students", desc: "Open to all enrolled students" },
                    { id: "section", title: "Specific Section", desc: "Target section A, B, or C" },
                    { id: "academic_year", title: "Specific Year / Batch", desc: "Target by student year (1st-4th Year)" },
                    { id: "specific_students", title: "Custom Student Selection", desc: "Select specific register numbers" },
                  ].map((aud) => (
                    <label
                      key={aud.id}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        audienceType === aud.id
                          ? "border-blue-500 dark:border-[#5DD62C] bg-blue-50/40 dark:bg-[#5DD62C]/10 shadow-2xs"
                          : "border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="audienceType"
                        value={aud.id}
                        checked={audienceType === aud.id}
                        onChange={() => setAudienceType(aud.id as AudienceType)}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">{aud.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3] mt-0.5">{aud.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section Selector */}
              {audienceType === "section" && (
                <div className="rounded-xl border border-slate-200 dark:border-[#292929] p-3.5 bg-slate-50/50 dark:bg-[#202020]/40">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                    Target Section
                  </label>
                  <div className="flex gap-4">
                    {["A", "B", "C"].map((sec) => (
                      <label key={sec} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="targetSection"
                          value={sec}
                          checked={selectedSection === sec}
                          onChange={(e) => setSelectedSection(e.target.value)}
                        />
                        <span>Section {sec}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Year Selector */}
              {audienceType === "academic_year" && (
                <div className="rounded-xl border border-slate-200 dark:border-[#292929] p-3.5 bg-slate-50/50 dark:bg-[#202020]/40">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                    Target Year Cohort
                  </label>
                  <div className="flex gap-4">
                    {["1", "2", "3", "4"].map((yr) => (
                      <label key={yr} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="targetYear"
                          value={yr}
                          checked={selectedYear === yr}
                          onChange={(e) => setSelectedYear(e.target.value)}
                        />
                        <span>Year {yr}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Specific Students Selection */}
              {audienceType === "specific_students" && (
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-[#292929] p-3.5 bg-slate-50/50 dark:bg-[#202020]/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-[#D4D4D4]">
                      Selected: {selectedStudents.length} Students
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedStudents.length === filteredStudents.length) {
                          setSelectedStudents([]);
                        } else {
                          setSelectedStudents(filteredStudents.map((s) => s.id));
                        }
                      }}
                      className="text-xs font-semibold text-blue-600 dark:text-[#5DD62C] hover:underline cursor-pointer"
                    >
                      {selectedStudents.length === filteredStudents.length ? "Deselect All" : "Select All Matching"}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by student name or register number..."
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                  />

                  {loadingStudents ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Loading student records...</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-[#292929] rounded-xl p-2 bg-white dark:bg-[#181818]">
                      {filteredStudents.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">No matching students found.</p>
                      ) : (
                        filteredStudents.map((s) => {
                          const isChecked = selectedStudents.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer ${
                                isChecked
                                  ? "bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-900 dark:text-[#5DD62C] font-semibold"
                                  : "hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-[#A3A3A3]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudents([...selectedStudents, s.id]);
                                  } else {
                                    setSelectedStudents(selectedStudents.filter((id) => id !== s.id));
                                  }
                                }}
                                className="rounded text-blue-600"
                              />
                              <span className="font-mono text-[11px] font-bold">{s.register_number || "—"}</span>
                              <span className="truncate">{s.full_name}</span>
                              <span className="text-[10px] text-slate-400 ml-auto">{s.section || "Sec A"}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RULES, CONTACT INFO & GUIDELINES */}
          {activeTab === "rules" && (
            <div className="space-y-4">
              {/* Coordinator Contact Details */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Coordinator / Contact Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Coordinator Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Priya"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Contact Email</label>
                    <input
                      type="email"
                      placeholder="cce.events@sairam.edu.in"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Contact Phone / Extension</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98400 12345"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818]"
                    />
                  </div>
                </div>
              </div>

              {/* Instructions and Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Student Instructions / Preparation
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Please bring college ID card and laptop with Python 3.11 installed..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Terms &amp; Conditions
                  </label>
                  <textarea
                    rows={2}
                    value={termsConditions}
                    onChange={(e) => setTermsConditions(e.target.value)}
                    placeholder="e.g. Attendance is mandatory for all shortlisted teams..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818]"
                  />
                </div>
              </div>

              {/* Layout Mode & Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Student Form Display Mode
                  </label>
                  <select
                    value={formLayoutMode}
                    onChange={(e) => setFormLayoutMode(e.target.value as FormLayoutMode)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818]"
                  >
                    <option value="single_page">Single-Page Form (Continuous scroll)</option>
                    <option value="multi_step">Multi-Step Wizard (Next / Back buttons)</option>
                  </select>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Registration Capacity Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave blank for unlimited"
                    value={registrationCapacity}
                    onChange={(e) => setRegistrationCapacity(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818]"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!allowMultipleResponses}
                    onChange={(e) => setAllowMultipleResponses(!e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Limit to 1 Response per Student</p>
                    <p className="text-[10px] text-slate-400">Prevents duplicate submissions from the same student.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowEditSubmission}
                    onChange={(e) => setAllowEditSubmission(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Allow Students to Edit Submissions</p>
                    <p className="text-[10px] text-slate-400">Students can update their response before the deadline closes.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closeAfterDeadline}
                    onChange={(e) => setCloseAfterDeadline(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Auto-Close on Registration Deadline</p>
                    <p className="text-[10px] text-slate-400">Automatically blocks responses when deadline passes.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRegistrationEnabled}
                    onChange={(e) => setIsRegistrationEnabled(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Student Registration Active</p>
                    <p className="text-[10px] text-slate-400">Uncheck to pause registration at any time.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: STUDENT NOTIFICATION SETTINGS */}
          {activeTab === "notifications" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Main Toggle Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#292929] bg-gradient-to-br from-slate-50 to-white dark:from-[#202020] dark:to-[#181818] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔔</span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">
                        Notify Eligible Students
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          notifyStudents
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-[#5DD62C]"
                            : "bg-slate-200 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400"
                        }`}
                      >
                        {notifyStudents ? "Enabled" : "Disabled (Default)"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                      Automatically dispatch an in-app event notification to eligible students when this event is published.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notifyStudents}
                      onChange={(e) => setNotifyStudents(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-[#5DD62C]"></div>
                  </label>
                </div>

                {/* Recipient Audience Summary Pill */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-[#292929] flex flex-wrap items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-[#A3A3A3]">
                    <span className="font-semibold text-slate-800 dark:text-[#F5F5F5]">
                      Target Audience:
                    </span>
                    <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#262626] font-mono text-[11px]">
                      {audienceType === "all"
                        ? "All CCE Students"
                        : audienceType === "section"
                        ? `Section ${selectedSection}`
                        : audienceType === "academic_year"
                        ? `Year ${selectedYear}`
                        : `${selectedStudents.length} Specific Students`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-[#5DD62C]">
                    <span>👥</span>
                    <span>{recipientCount} eligible recipients</span>
                  </div>
                </div>
              </div>

              {/* Conditional Notification Configuration Fields */}
              {notifyStudents && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  {/* Title & Message */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                        Notification Title <span className="text-slate-400 font-normal">(Default: Event Title)</span>
                      </label>
                      <input
                        type="text"
                        value={notificationTitle}
                        onChange={(e) => setNotificationTitle(e.target.value)}
                        placeholder={title ? `New Event: ${title}` : "e.g. Workshop Registration Open"}
                        className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                        Notification Message <span className="text-slate-400 font-normal">(Default: Short Description)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={notificationMessage}
                        onChange={(e) => setNotificationMessage(e.target.value)}
                        placeholder={
                          shortDescription ||
                          "Registration is now open! Tap to review guidelines, requirements, and submit your application."
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] resize-none"
                      />
                    </div>
                  </div>

                  {/* Priority & Display Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Priority Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                        Priority Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "normal", label: "Normal", badge: "Standard" },
                          { id: "important", label: "Important", badge: "Highlighted" },
                          { id: "urgent", label: "Urgent", badge: "Top Priority" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setNotificationPriority(p.id as any)}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                              notificationPriority === p.id
                                ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50/50 dark:bg-[#5DD62C]/10 text-slate-900 dark:text-[#F5F5F5] font-bold"
                                : "border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3]"
                            }`}
                          >
                            <p className="text-xs">{p.label}</p>
                            <span className="text-[9px] text-slate-400">{p.badge}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Display Mode Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                        Student Display Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNotificationDisplayMode("bell_only")}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            notificationDisplayMode === "bell_only"
                              ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50/50 dark:bg-[#5DD62C]/10 text-slate-900 dark:text-[#F5F5F5] font-bold"
                              : "border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3]"
                          }`}
                        >
                          <p className="text-xs flex items-center gap-1.5">
                            <span>🔔</span> Bell Drawer
                          </p>
                          <span className="text-[9px] text-slate-400">Header flyout only</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotificationDisplayMode("both")}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            notificationDisplayMode === "both"
                              ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50/50 dark:bg-[#5DD62C]/10 text-slate-900 dark:text-[#F5F5F5] font-bold"
                              : "border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-600 dark:text-[#A3A3A3]"
                          }`}
                        >
                          <p className="text-xs flex items-center gap-1.5">
                            <span>📱</span> Popup + Bell
                          </p>
                          <span className="text-[9px] text-slate-400">Modal popup on dashboard</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CTA Label & Auto Destination */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                        Call-to-Action (CTA) Button Label
                      </label>
                      <input
                        type="text"
                        value={notificationCtaLabel}
                        onChange={(e) => setNotificationCtaLabel(e.target.value)}
                        placeholder="Register Now"
                        className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                        CTA Destination Route
                      </label>
                      <div className="w-full rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50 dark:bg-[#202020]/50 px-3.5 py-2 text-xs text-slate-500 dark:text-[#A3A3A3] min-h-[38px] flex items-center justify-between">
                        <span className="font-mono text-[11px] truncate">
                          /student?tab=events&eventId=...
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-[#5DD62C] font-semibold">
                          Linked to Event
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notification Timing */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">
                      Notification Publication Timing
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="notifTiming"
                          checked={notificationTiming === "with_event"}
                          onChange={() => setNotificationTiming("with_event")}
                          className="text-blue-600"
                        />
                        <span>Publish immediately with event</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="notifTiming"
                          checked={notificationTiming === "scheduled"}
                          onChange={() => setNotificationTiming("scheduled")}
                          className="text-blue-600"
                        />
                        <span>Schedule notification for future dispatch</span>
                      </label>
                    </div>

                    {notificationTiming === "scheduled" && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-[#292929]">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Date</label>
                          <input
                            type="date"
                            value={notificationScheduledDate}
                            onChange={(e) => setNotificationScheduledDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Time</label>
                          <input
                            type="time"
                            value={notificationScheduledTime}
                            onChange={(e) => setNotificationScheduledTime(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Optional Event Update Notification when editing an existing event */}
                  {isEdit && (
                    <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            📢 Dispatch Event Update Notification
                          </p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                            Notify registered and eligible students that event details, venue, or timings were updated.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={sendUpdateNotification}
                          onChange={(e) => setSendUpdateNotification(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                      </div>
                      {sendUpdateNotification && (
                        <textarea
                          rows={2}
                          value={updateMessage}
                          onChange={(e) => setUpdateMessage(e.target.value)}
                          placeholder="e.g. Schedule updated: The keynote session starts at 10:00 AM in Lab 3."
                          className="w-full rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#181818] p-2.5 text-xs text-slate-900 dark:text-[#F5F5F5] resize-none"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-[#5DD62C] flex items-center gap-1.5 cursor-pointer"
              >
                <span>🔔</span>
                <span>
                  Notify:{" "}
                  <strong className={notifyStudents ? "text-emerald-600 dark:text-[#5DD62C]" : "text-slate-400"}>
                    {notifyStudents ? `On (${recipientCount})` : "Off"}
                  </strong>
                </span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-5 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                {isSubmitting ? "Saving Event..." : isEdit ? "Update Event Details" : "Create Event & Configure Form"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Templates Library Modal */}
      {isTemplateModalOpen && (
        <EventTemplatesLibraryModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          onSelectTemplate={(tpl) => {
            setSelectedTemplate(tpl);
            setTitle(tpl.name);
            setSubtitle(tpl.description || "");
            setShortDescription(tpl.description || "");
            setDetailedDescription(tpl.purpose || "");
            setCategory(tpl.category || "Workshop");
            if (tpl.form_layout_mode) {
              setFormLayoutMode(tpl.form_layout_mode);
            }
            setIsTemplateModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
