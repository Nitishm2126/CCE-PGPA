"use client";

import React, { useState, useEffect } from "react";
import { NotificationItem, NotificationStatus, NotificationPriority } from "@/types/notifications";
import { notificationsApi } from "@/lib/notifications-api";
import { NotificationCreateModal } from "./NotificationCreateModal";

export const AdminNotificationsConsole: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<NotificationItem | null>(null);
  const [previewNotification, setPreviewNotification] = useState<NotificationItem | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.listNotifications({
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: 50,
      });
      setNotifications(res.notifications || []);
    } catch (err: any) {
      setError(err.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [statusFilter]);

  const handleStatusChange = async (notif: NotificationItem, newStatus: NotificationStatus) => {
    try {
      await notificationsApi.changeStatus(notif.id, newStatus);
      loadNotifications();
    } catch (err: any) {
      alert("Status change failed: " + err.message);
    }
  };

  const handleDelete = async (notif: NotificationItem) => {
    if (!confirm(`Are you sure you want to delete notification "${notif.title}"?`)) return;
    try {
      await notificationsApi.deleteNotification(notif.id);
      loadNotifications();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (priorityFilter !== "all" && n.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.short_message.toLowerCase().includes(q) ||
        (n.category && n.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate metrics
  const totalCount = notifications.length;
  const publishedCount = notifications.filter((n) => n.status === "published").length;
  const scheduledCount = notifications.filter((n) => n.status === "scheduled").length;
  const draftCount = notifications.filter((n) => n.status === "draft").length;
  const totalReads = notifications.reduce((sum, n) => sum + (n.read_count || 0), 0);
  const totalClicks = notifications.reduce((sum, n) => sum + (n.clicked_count || 0), 0);

  return (
    <div className="space-y-5">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3]">Total Announcements</p>
          <p className="text-xl font-bold text-slate-900 dark:text-[#F5F5F5] mt-0.5">{totalCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Live Published</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{publishedCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-[#5DD62C]">Scheduled</p>
          <p className="text-xl font-bold text-blue-600 dark:text-[#5DD62C] mt-0.5">{scheduledCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3]">Drafts</p>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">{draftCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs">
          <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">Total Reads</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{totalReads}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">CTA Clicks</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{totalClicks}</p>
        </div>
      </div>

      {/* Control Bar: Filters, Search & Create Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#202020] p-1 border border-slate-200 dark:border-[#292929]">
            {["all", "published", "scheduled", "draft", "paused", "archived"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50 dark:bg-[#202020] px-2.5 py-1.5 font-semibold text-slate-700 dark:text-[#D4D4D4] outline-hidden"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">🔴 Urgent</option>
            <option value="important">🟡 Important</option>
            <option value="normal">🔵 Normal</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50 dark:bg-[#202020] px-3 py-1.5 text-slate-900 dark:text-white outline-hidden w-44 sm:w-56"
          />

          <button
            type="button"
            onClick={loadNotifications}
            title="Refresh Notifications"
            className="p-2 rounded-xl border border-slate-200 dark:border-[#292929] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            ↻
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingNotification(null);
              setIsCreateModalOpen(true);
            }}
            className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-3.5 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <span>+</span> Broadcast Notification
          </button>
        </div>
      </div>

      {/* Body: Skeleton, Error, Empty, or Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 space-y-3 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="h-4 bg-slate-200 dark:bg-[#262626] rounded-md w-1/4" />
                <div className="h-4 bg-slate-200 dark:bg-[#262626] rounded-md w-1/5" />
              </div>
              <div className="h-5 bg-slate-200 dark:bg-[#262626] rounded-md w-3/4" />
              <div className="h-10 bg-slate-100 dark:bg-[#202020] rounded-xl" />
              <div className="h-14 bg-slate-100 dark:bg-[#202020] rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-center space-y-3 max-w-lg mx-auto my-6">
          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-lg font-bold">
            ⚠️
          </div>
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Unable to Load Notifications</h3>
          <p className="text-xs text-rose-700 dark:text-rose-300/90">{error}</p>
          <button
            type="button"
            onClick={loadNotifications}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
          >
            <span>↻</span> Try Again
          </button>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-300 dark:border-[#292929] text-center space-y-3 max-w-md mx-auto my-6">
          <div className="text-4xl">🔔</div>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
            {statusFilter === "published"
              ? "No active published notifications"
              : statusFilter === "scheduled"
              ? "No scheduled notifications in queue"
              : statusFilter === "draft"
              ? "No draft notifications"
              : "No notifications have been created yet"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] max-w-sm mx-auto">
            Broadcast event launches, academic deadlines, or urgent department alerts with in-app delivery and popup modals.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingNotification(null);
                setIsCreateModalOpen(true);
              }}
              className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black font-semibold text-xs px-4 py-2 cursor-pointer shadow-2xs hover:opacity-90"
            >
              + Create Your First Notification
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotifications.map((notif) => {
            const totalRec = notif.total_recipients || 0;
            const readCount = notif.read_count || 0;
            const readPercent = totalRec > 0 ? Math.round((readCount / totalRec) * 100) : 0;
            const unreadCount = notif.unread_count || 0;
            const clickCount = notif.clicked_count || 0;
            const isUrgent = notif.priority === "urgent";
            const isImportant = notif.priority === "important";

            return (
              <div
                key={notif.id}
                className={`rounded-2xl border bg-white dark:bg-[#181818] overflow-hidden shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between ${
                  isUrgent
                    ? "border-rose-400 dark:border-rose-900/70"
                    : isImportant
                    ? "border-amber-400 dark:border-amber-900/70"
                    : "border-slate-200 dark:border-[#292929]"
                }`}
              >
                {/* Optional Poster Header */}
                {notif.image_url && (
                  <div className="w-full h-28 bg-slate-100 dark:bg-[#121212] overflow-hidden border-b border-slate-100 dark:border-[#262626]">
                    <img
                      src={notif.image_url}
                      alt={notif.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Status & Priority Row */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent
                              ? "bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 animate-pulse"
                              : isImportant
                              ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
                              : "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {notif.priority}
                        </span>

                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {notif.category.replace("_", " ")}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          notif.status === "published"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                            : notif.status === "scheduled"
                            ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                            : notif.status === "paused"
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {notif.status}
                      </span>
                    </div>

                    {/* Title & Short Message */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] line-clamp-1">
                        {notif.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-[#A3A3A3] line-clamp-2 mt-1">
                        {notif.short_message}
                      </p>
                    </div>

                    {/* Audience & Channel */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>
                        🎯 Audience:{" "}
                        <strong className="text-slate-800 dark:text-slate-200 uppercase">
                          {notif.audience_type.replace("_", " ")}
                        </strong>
                      </span>
                      <span>
                        {notif.display_mode === "both"
                          ? "Bell + Popup"
                          : notif.display_mode === "popup_only" || notif.display_mode === "popup_modal"
                          ? "Popup Only"
                          : "Bell Drawer"}
                      </span>
                    </div>

                    {/* Delivery & Engagement Metrics Bar */}
                    <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#202020]/40 border border-slate-100 dark:border-[#262626] space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-500">Read Engagement:</span>
                        <span className="text-blue-600 dark:text-[#5DD62C] font-mono">
                          {readCount} / {totalRec} ({readPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[#262626] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 dark:bg-[#5DD62C] rounded-full transition-all"
                          style={{ width: `${readPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>Unread: {unreadCount}</span>
                        <span>Dismissed: {notif.dismissed_count || 0}</span>
                        {clickCount > 0 && <span className="font-semibold text-amber-600">Clicks: {clickCount}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-[#292929] flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {notif.status === "published" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(notif, "paused")}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 cursor-pointer"
                        >
                          Pause
                        </button>
                      )}
                      {notif.status === "paused" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(notif, "published")}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          Resume
                        </button>
                      )}
                      {notif.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(notif, "published")}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 cursor-pointer"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNotification(notif);
                          setIsCreateModalOpen(true);
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-slate-200 dark:border-[#333] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {notif.status !== "archived" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(notif, "archived")}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-xs"
                          title="Archive"
                        >
                          📦
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(notif)}
                        className="p-1 rounded-lg text-rose-400 hover:text-rose-600 cursor-pointer text-xs"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isCreateModalOpen && (
        <NotificationCreateModal
          isOpen={isCreateModalOpen}
          initialNotification={editingNotification}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingNotification(null);
          }}
          onSuccess={() => {
            loadNotifications();
          }}
        />
      )}
    </div>
  );
};
