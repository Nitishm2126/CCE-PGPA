"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { MessageItem, MessageType } from "@/types/auth";
import { DesignationBadge } from "@/components/DesignationBadge";
import { MessageDrawerModal } from "./MessageDrawerModal";

export interface MessagesHubViewProps {
  portalRole: "student" | "mentor" | "hod" | "admin";
  initialAchievementId?: string | null;
  initialStudentId?: string | null;
  onUnreadCountChanged?: () => void;
}

export const MessagesHubView: React.FC<MessagesHubViewProps> = ({
  portalRole,
  initialAchievementId,
  initialStudentId,
  onUnreadCountChanged,
}) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Active drawer state for inspect/reply
  const [activeMessage, setActiveMessage] = useState<MessageItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getMessages(
        {
          achievement_id: initialAchievementId || undefined,
          student_id: initialStudentId || undefined,
        },
        token
      );
      setMessages(data);
      if (onUnreadCountChanged) {
        onUnreadCountChanged();
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [token, initialAchievementId, initialStudentId, onUnreadCountChanged]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Unread filter
      if (unreadOnly && (m.is_read || m.recipient_id !== user?.id)) {
        return false;
      }
      // Type filter
      if (typeFilter !== "all" && m.message_type !== typeFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchBody = m.message_body.toLowerCase().includes(q);
        const matchSender = m.sender_name.toLowerCase().includes(q);
        const matchRecipient = m.recipient_name.toLowerCase().includes(q);
        const matchAch = m.achievement_title?.toLowerCase().includes(q) || false;
        return matchBody || matchSender || matchRecipient || matchAch;
      }
      return true;
    });
  }, [messages, unreadOnly, typeFilter, searchQuery, user?.id]);

  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.is_read && m.recipient_id === user?.id).length;
  }, [messages, user?.id]);

  const handleOpenThread = (msg: MessageItem) => {
    setActiveMessage(msg);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner / Stats */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Institutional Messages, Remarks &amp; Feedback
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {portalRole === "student"
              ? "Official remarks, congratulations, and action items from your Faculty Mentors and Head of Department."
              : portalRole === "mentor"
              ? "Communication history with your assigned mentees. Send congratulations, remarks, and action requirements."
              : "Department-wide academic communication oversight and supervisory notifications."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              {unreadCount} Unread Message{unreadCount !== 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={loadMessages}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh messages"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages by content, sender, or activity title..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium outline-hidden"
          >
            <option value="all">All Message Types</option>
            <option value="Congratulations">🎉 Congratulations</option>
            <option value="Remark">💬 Remarks</option>
            <option value="Action Required">⚠️ Action Required</option>
            <option value="General Message">✉️ General Messages</option>
          </select>

          <button
            type="button"
            onClick={() => setUnreadOnly((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${
              unreadOnly
                ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            }`}
          >
            {unreadOnly ? "Showing Unread Only" : "Show All"}
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading messages directory...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="py-16 text-center space-y-2 max-w-sm mx-auto p-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Messages Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {searchQuery || typeFilter !== "all" || unreadOnly
                ? "No communications match your current filter criteria."
                : "There are currently no messages or remarks posted."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredMessages.map((m) => {
              const isUnread = !m.is_read && m.recipient_id === user?.id;
              const isCongrats = m.message_type === "Congratulations";
              const isAction = m.message_type === "Action Required";
              const isRemark = m.message_type === "Remark";

              return (
                <div
                  key={m.id}
                  onClick={() => handleOpenThread(m)}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group ${
                    isUnread ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" title="Unread message" />
                      )}
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {m.sender_name}
                      </span>
                      {m.sender_role === "student" ? (
                        <DesignationBadge designation="Change Maker" size="sm" />
                      ) : (
                        <DesignationBadge designation="Torch Bearer" size="sm" />
                      )}

                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isCongrats
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                            : isAction
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                            : isRemark
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {m.message_type}
                      </span>

                      {m.achievement_title && (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-[240px]">
                          📌 {m.achievement_title}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                      {m.message_body}
                    </p>

                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>To: {m.recipient_name} ({m.recipient_role})</span>
                      <span>•</span>
                      <span>{new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>

                  <div className="self-end sm:self-center flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                      <span>View &amp; Reply</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-over Conversation Modal */}
      <MessageDrawerModal
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setActiveMessage(null);
          loadMessages();
        }}
        achievementId={activeMessage?.achievement_id}
        achievementTitle={activeMessage?.achievement_title}
        targetStudentId={activeMessage?.sender_role === "student" ? activeMessage.sender_id : activeMessage?.recipient_id}
        targetStudentName={activeMessage?.sender_role === "student" ? activeMessage.sender_name : activeMessage?.recipient_name}
        recipientId={activeMessage?.sender_id === user?.id ? activeMessage?.recipient_id : activeMessage?.sender_id}
        recipientName={activeMessage?.sender_id === user?.id ? activeMessage?.recipient_name : activeMessage?.sender_name}
        onMessageSent={loadMessages}
      />
    </div>
  );
};
