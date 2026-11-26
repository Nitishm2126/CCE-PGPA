"use client";

import React, { useState, useEffect } from "react";
import { StudentNotificationItem } from "@/types/notifications";
import { notificationsApi } from "@/lib/notifications-api";
import { resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";

interface StudentNotificationPopupProps {
  onNavigateToEvent?: (eventId?: string, action?: "details" | "register") => void;
}

export const StudentNotificationPopup: React.FC<StudentNotificationPopupProps> = ({
  onNavigateToEvent,
}) => {
  const [activePopup, setActivePopup] = useState<StudentNotificationItem | null>(null);

  useEffect(() => {
    // Check for popup-mode notifications that haven't been dismissed
    const checkPopups = async () => {
      try {
        const res = await notificationsApi.listStudentNotifications({ limit: 10 });
        if (res?.notifications) {
          const eligible = res.notifications.find(
            (n) => (n.display_mode === "popup_only" || n.display_mode === "popup_modal" || n.display_mode === "both") && !n.is_dismissed
          );
          if (eligible) {
            // Check session storage so we don't annoy the student repeatedly if they haven't dismissed permanently
            const sessionDismissed = sessionStorage.getItem(`cce_popup_seen_${eligible.id}`);
            if (!sessionDismissed) {
              setActivePopup(eligible);
            }
          }
        }
      } catch {
        // Silently ignore popup check errors
      }
    };

    checkPopups();
  }, []);

  if (!activePopup) return null;

  const handleDismiss = async () => {
    if (activePopup) {
      sessionStorage.setItem(`cce_popup_seen_${activePopup.id}`, "true");
      try {
        await notificationsApi.dismissNotification(activePopup.id);
      } catch (err) {
        console.warn("Failed to dismiss popup notification", err);
      }
      setActivePopup(null);
    }
  };

  const handleCta = async () => {
    if (activePopup) {
      sessionStorage.setItem(`cce_popup_seen_${activePopup.id}`, "true");
      try {
        await notificationsApi.recordClick(activePopup.id);
        await notificationsApi.markAsRead(activePopup.id);
      } catch {
        // ignore
      }

      const ctaUrl = activePopup.cta_url;
      const eventId =
        activePopup.event_id ||
        (ctaUrl?.includes("eventId=")
          ? new URLSearchParams(ctaUrl.split("?")[1] || "").get("eventId") || undefined
          : undefined);
      setActivePopup(null);

      if ((eventId || ctaUrl?.startsWith("/student?tab=events")) && onNavigateToEvent) {
        onNavigateToEvent(eventId, "register");
      } else if (ctaUrl) {
        if (ctaUrl.startsWith("/")) {
          window.location.href = ctaUrl;
        } else {
          window.open(ctaUrl, "_blank", "noopener,noreferrer");
        }
      }
    }
  };

  const isUrgent = activePopup.priority === "urgent";
  const isImportant = activePopup.priority === "important";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Banner image if available */}
        {activePopup.image_url && (
          <div className="w-full h-44 bg-slate-100 dark:bg-[#121212] overflow-hidden border-b border-slate-100 dark:border-[#262626] relative">
            <img
              src={resolveEventAssetUrl(activePopup.image_url, getStoredToken())}
              alt={activePopup.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-3 left-3">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${
                  isUrgent ? "bg-rose-600 animate-pulse" : isImportant ? "bg-amber-600" : "bg-blue-600"
                }`}
              >
                {activePopup.priority} announcement
              </span>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4">
          {!activePopup.image_url && (
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isUrgent
                    ? "bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 animate-pulse"
                    : isImportant
                    ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
                    : "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300"
                }`}
              >
                {activePopup.priority} alert
              </span>
              <span className="text-xs text-slate-400 font-semibold uppercase">
                {activePopup.category?.replace("_", " ")}
              </span>
            </div>
          )}

          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F5F5] leading-snug">
              {activePopup.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A3A3] mt-2 leading-relaxed">
              {activePopup.short_message}
            </p>
            {activePopup.detailed_message && (
              <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-[#202020] border border-slate-100 dark:border-[#2d2d2d] text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line max-h-40 overflow-y-auto">
                {activePopup.detailed_message}
              </div>
            )}
          </div>

          {activePopup.attachment_url && (
            <div className="pt-1">
              <a
                href={resolveEventAssetUrl(activePopup.attachment_url, getStoredToken(), true)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-[#5DD62C] font-semibold hover:underline"
              >
                <span>📎</span> Download Official Attachment / Document
              </a>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-[#2d2d2d] bg-white dark:bg-[#181818] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#202020] cursor-pointer"
            >
              {activePopup.can_dismiss ? "Dismiss" : "Close"}
            </button>

            {activePopup.cta_label && (
              <button
                type="button"
                onClick={handleCta}
                className="px-5 py-2 rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95"
              >
                {activePopup.cta_label} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
