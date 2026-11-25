"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { StudentNotificationItem } from "@/types/notifications";
import { notificationsApi } from "@/lib/notifications-api";
import { resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";

interface StudentNotificationBellProps {
  onNavigateToEvent?: (eventId?: string) => void;
}

export const StudentNotificationBell: React.FC<StudentNotificationBellProps> = ({
  onNavigateToEvent,
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<StudentNotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getStudentUnreadCount();
      setUnreadCount(res.unread_count || 0);
    } catch {
      // Ignore background fetch errors
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.listStudentNotifications({
        unread_only: filter === "unread",
      });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch (err) {
      console.warn("Failed to fetch student notifications", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (notif: StudentNotificationItem) => {
    if (notif.is_read) return;
    try {
      await notificationsApi.markAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.warn("Failed to mark notification as read", e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      console.warn("Failed to mark all as read", e);
    }
  };

  const handleDismiss = async (notif: StudentNotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.dismissNotification(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      if (!notif.is_read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.warn("Failed to dismiss notification", err);
    }
  };

  const handleCtaClick = async (notif: StudentNotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.recordClick(notif.id);
    } catch {
      // ignore
    }
    await handleMarkAsRead(notif);

    const linkedEventId =
      notif.event_id ||
      (notif.cta_url?.includes("eventId=")
        ? new URLSearchParams(notif.cta_url.split("?")[1] || "").get("eventId") || undefined
        : undefined);

    if ((linkedEventId || notif.cta_url?.startsWith("/student?tab=events")) && onNavigateToEvent) {
      setIsOpen(false);
      onNavigateToEvent(linkedEventId);
    } else if (notif.cta_url) {
      if (notif.cta_url.startsWith("/")) {
        window.location.href = notif.cta_url;
      } else {
        window.open(notif.cta_url, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        title="View Notifications & Announcements"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-bounce">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[400px] max-h-[85vh] rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between bg-slate-50/60 dark:bg-[#202020]/40">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-[#F5F5F5]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-semibold text-blue-600 dark:text-[#5DD62C] hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-4 py-2 border-b border-slate-100 dark:border-[#292929] flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === "all"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === "unread"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Unread only ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#262626]">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <span className="text-3xl">🎉</span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  You&apos;re all caught up!
                </p>
                <p className="text-[11px] text-slate-400">
                  {filter === "unread" ? "No unread notifications right now." : "No announcements available."}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUrgent = notif.priority === "urgent";
                const isImportant = notif.priority === "important";
                const isExpanded = expandedId === notif.id;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif)}
                    className={`p-3.5 space-y-2 transition-colors cursor-pointer ${
                      !notif.is_read
                        ? "bg-blue-50/40 dark:bg-[#1a2333]/40"
                        : "hover:bg-slate-50 dark:hover:bg-[#202020]/40"
                    }`}
                  >
                    {/* Header line: Priority, Category, Dismiss */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isUrgent
                              ? "bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 animate-pulse"
                              : isImportant
                              ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
                              : "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {notif.priority}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">
                          {notif.category?.replace("_", " ")}
                        </span>
                        {!notif.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-[#5DD62C]" />
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">
                          {notif.published_at || notif.created_at
                            ? new Date(notif.published_at || notif.created_at!).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : "Today"}
                        </span>
                        {notif.can_dismiss && (
                          <button
                            type="button"
                            onClick={(e) => handleDismiss(notif, e)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title="Dismiss notification"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Banner Image */}
                    {notif.image_url && (
                      <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#222]">
                        <img
                          src={resolveEventAssetUrl(notif.image_url, getStoredToken())}
                          alt={notif.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {/* Title & Short Message */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] leading-snug">
                        {notif.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-[#A3A3A3] mt-0.5 leading-relaxed">
                        {notif.short_message}
                      </p>
                    </div>

                    {/* Expanded Detailed Message */}
                    {isExpanded && notif.detailed_message && (
                      <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-[#222] text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line border border-slate-200/60 dark:border-[#333]">
                        {notif.detailed_message}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      {notif.detailed_message ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : notif.id);
                          }}
                          className="text-blue-600 dark:text-[#5DD62C] font-semibold hover:underline"
                        >
                          {isExpanded ? "Show less" : "Read details"}
                        </button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-2">
                        {notif.attachment_url && (
                          <a
                            href={resolveEventAssetUrl(notif.attachment_url, getStoredToken(), true)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                          >
                            <span>📎</span> File
                          </a>
                        )}

                        {notif.cta_label && (
                          <button
                            type="button"
                            onClick={(e) => handleCtaClick(notif, e)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 dark:bg-[#5DD62C] hover:opacity-90 text-white dark:text-black font-bold text-[10px] shadow-2xs cursor-pointer"
                          >
                            {notif.cta_label} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
