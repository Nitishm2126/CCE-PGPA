"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { MessageItem, MessageType } from "@/types/auth";
import { DesignationBadge } from "@/components/DesignationBadge";

export interface MessageDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievementId?: string | null;
  achievementTitle?: string | null;
  achievement?: {
    id: string;
    title: string;
    component_name?: string | null;
    student_id?: string | null;
    student_name?: string | null;
    student_register_number?: string | null;
  } | null;
  targetStudentId?: string | null;
  targetStudentName?: string | null;
  targetStudent?: {
    id: string;
    name: string;
    register_number?: string | null;
  } | null;
  recipientId?: string | null;
  recipientName?: string | null;
  currentUserRole?: string;
  onMessageSent?: () => void;
}

export const MessageDrawerModal: React.FC<MessageDrawerModalProps> = ({
  isOpen,
  onClose,
  achievementId: propAchievementId,
  achievementTitle: propAchievementTitle,
  achievement,
  targetStudentId: propTargetStudentId,
  targetStudentName: propTargetStudentName,
  targetStudent,
  recipientId: propRecipientId,
  recipientName: propRecipientName,
  onMessageSent,
}) => {
  const achievementId = propAchievementId || achievement?.id || null;
  const achievementTitle = propAchievementTitle || achievement?.title || null;
  const targetStudentId = propTargetStudentId || targetStudent?.id || achievement?.student_id || null;
  const targetStudentName = propTargetStudentName || targetStudent?.name || achievement?.student_name || null;

  const { user, token } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compose State
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("Remark");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine effective recipient ID
  // If mentor/HOD viewing student submission: targetStudentId or propRecipientId
  // If student viewing: recipient is their assigned mentor or HOD
  const resolveRecipientId = useCallback((): string | null => {
    if (propRecipientId) return propRecipientId;
    if (user?.role !== "student") {
      return targetStudentId || null;
    }
    // If student, check if messages exist to reply to last sender
    if (messages.length > 0) {
      const otherParty = messages.find((m) => m.sender_id !== user.id);
      if (otherParty) return otherParty.sender_id;
    }
    return null;
  }, [propRecipientId, targetStudentId, user, messages]);

  const fetchMessages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMessages(
        {
          achievement_id: achievementId || undefined,
          student_id: targetStudentId || undefined,
        },
        token
      );
      setMessages(data);

      // Automatically mark as read if there are unread messages addressed to caller
      const unreadIds = data.filter((m) => !m.is_read && m.recipient_id === user?.id).map((m) => m.id);
      if (unreadIds.length > 0) {
        api.markAllMessagesRead(
          { achievement_id: achievementId || undefined, message_ids: unreadIds },
          token
        ).catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load conversation history.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [achievementId, targetStudentId, token, user?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    } else {
      setMessages([]);
      setMessageBody("");
      setError(null);
    }
  }, [isOpen, fetchMessages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim() || !token) return;

    const recipient = resolveRecipientId();
    if (!recipient) {
      setError("Please specify a recipient or wait for a mentor remark to reply to.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const newMsg = await api.sendMessage(
        {
          recipient_id: recipient,
          message_body: messageBody.trim(),
          message_type: messageType,
          achievement_id: achievementId || undefined,
        },
        token
      );
      setMessages((prev) => [...prev, newMsg]);
      setMessageBody("");
      if (onMessageSent) onMessageSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (type: MessageType, text: string) => {
    setMessageType(type);
    setMessageBody(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#171E28] border border-slate-200 dark:border-[#2B3543] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2B3543] bg-slate-50 dark:bg-[#1C2531] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-[#4C83E6]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </span>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-[#E8EDF4] truncate">
                {achievementTitle ? `Messages & Remarks: ${achievementTitle}` : "Messages & Remarks Thread"}
              </h3>
            </div>
            {(targetStudentName || propRecipientName) && (
              <p className="text-xs text-slate-500 dark:text-[#7E8B9C] mt-0.5 truncate">
                Discussion with <span className="font-semibold text-slate-700 dark:text-[#E8EDF4]">{targetStudentName || propRecipientName}</span>
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2531] transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Templates Bar (For Mentor & HOD) */}
        {user?.role !== "student" && (
          <div className="px-5 py-2.5 bg-blue-50/50 dark:bg-[#131922] border-b border-blue-100 dark:border-[#2B3543] flex items-center gap-2 overflow-x-auto text-xs">
            <span className="font-bold text-[10px] uppercase text-slate-500 dark:text-[#7E8B9C] whitespace-nowrap">Quick Actions:</span>
            <button
              type="button"
              onClick={() => applyTemplate("Congratulations", "Hearty congratulations on your achievement! Well done.")}
              className="px-2.5 py-1 rounded-full font-semibold bg-emerald-100 dark:bg-[#122422] text-emerald-800 dark:text-[#5EEAD4] border border-emerald-200/80 dark:border-emerald-800/70 hover:bg-emerald-200 transition whitespace-nowrap flex items-center gap-1 cursor-pointer"
            >
              <span>🎉</span> Congratulations
            </button>
            <button
              type="button"
              onClick={() => applyTemplate("Remark", "Verified and noted. Excellent technical presentation.")}
              className="px-2.5 py-1 rounded-full font-semibold bg-blue-100 dark:bg-[#132338] text-blue-800 dark:text-[#93C5FD] border border-blue-200/80 dark:border-blue-800/70 hover:bg-blue-200 transition whitespace-nowrap flex items-center gap-1 cursor-pointer"
            >
              <span>💬</span> Positive Remark
            </button>
            <button
              type="button"
              onClick={() => applyTemplate("Action Required", "Please re-upload a clear copy of your official completion certificate.")}
              className="px-2.5 py-1 rounded-full font-semibold bg-amber-100 dark:bg-[#2A2012] text-amber-800 dark:text-[#FCD34D] border border-amber-200/80 dark:border-amber-800/70 hover:bg-amber-200 transition whitespace-nowrap flex items-center gap-1 cursor-pointer"
            >
              <span>⚠️</span> Action Required
            </button>
          </div>
        )}

        {/* Message Thread Body */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 bg-slate-50/40 dark:bg-[#0F141B] min-h-[220px]">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 dark:text-[#7E8B9C]">Loading messages &amp; remarks...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center space-y-2 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#1C2531] border border-slate-200 dark:border-[#2B3543] flex items-center justify-center mx-auto text-slate-400 dark:text-[#7E8B9C]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-[#E8EDF4]">No Messages Yet</h4>
              <p className="text-xs text-slate-500 dark:text-[#7E8B9C]">
                {user?.role === "student"
                  ? "Your faculty mentor or HOD will post remarks, congratulations, and action items here."
                  : "Start the conversation by sharing a remark, congratulations, or required action."}
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === user?.id;
              const isCongrats = m.message_type === "Congratulations";
              const isAction = m.message_type === "Action Required";
              const isRemark = m.message_type === "Remark";

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 shadow-2xs border transition ${
                      isMine
                        ? "bg-blue-600 dark:bg-[#2563EB] text-white border-blue-600 dark:border-[#2563EB] rounded-br-xs"
                        : isCongrats
                        ? "bg-emerald-50 dark:bg-[#122422] border-emerald-300 dark:border-emerald-800/80 text-slate-900 dark:text-[#E8EDF4] rounded-bl-xs"
                        : isAction
                        ? "bg-amber-50 dark:bg-[#2A2012] border-amber-300 dark:border-amber-800/80 text-slate-900 dark:text-[#E8EDF4] rounded-bl-xs"
                        : "bg-white dark:bg-[#1C2531] border-slate-200 dark:border-[#2B3543] text-slate-900 dark:text-[#E8EDF4] rounded-bl-xs"
                    }`}
                  >
                    {/* Message Header */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[11px] font-bold ${isMine ? "text-blue-100" : "text-slate-900 dark:text-[#E8EDF4]"}`}>
                        {m.sender_name}
                      </span>
                      {m.sender_role === "student" ? (
                        <DesignationBadge designation="Change Maker" size="sm" />
                      ) : (
                        <DesignationBadge designation="Torch Bearer" size="sm" />
                      )}

                      {/* Type Badge */}
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          isMine
                            ? "bg-blue-700 text-blue-100 border-blue-800"
                            : isCongrats
                            ? "bg-emerald-200 dark:bg-[#1B3830] text-emerald-900 dark:text-[#5EEAD4] border-emerald-300/80 dark:border-emerald-700/60"
                            : isAction
                            ? "bg-amber-200 dark:bg-[#3D2E16] text-amber-900 dark:text-[#FCD34D] border-amber-300/80 dark:border-amber-700/60"
                            : isRemark
                            ? "bg-blue-100 dark:bg-[#1E3352] text-blue-800 dark:text-[#93C5FD] border-blue-200/80 dark:border-blue-800/60"
                            : "bg-slate-200 dark:bg-[#253245] text-slate-700 dark:text-[#A0ACBC] border-slate-300 dark:border-[#384860]"
                        }`}
                      >
                        {m.message_type}
                      </span>
                    </div>

                    {/* Message Content */}
                    <div className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                      {m.message_body}
                    </div>

                    {/* Message Footer */}
                    <div
                      className={`mt-2 pt-1.5 border-t flex items-center justify-between gap-2 text-[10px] ${
                        isMine
                          ? "border-blue-500/50 text-blue-100"
                          : "border-slate-200/60 dark:border-[#2B3543] text-slate-400 dark:text-[#7E8B9C]"
                      }`}
                    >
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} •{" "}
                        {new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                      {isMine && (
                        <span>
                          {m.is_read ? "✓✓ Read" : "✓ Sent"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Compose Form */}
        <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="message-type-select" className="text-xs font-semibold text-slate-600 dark:text-[#A0ACBC]">Message Category:</label>
              <select
                id="message-type-select"
                value={messageType}
                onChange={(e) => setMessageType(e.target.value as MessageType)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2B3543] bg-slate-50 dark:bg-[#1C2531] text-slate-800 dark:text-[#E8EDF4] focus:ring-2 focus:ring-blue-500 outline-hidden font-medium min-h-[36px]"
              >
                <option value="Remark">Remark</option>
                <option value="Congratulations">Congratulations</option>
                <option value="Action Required">Action Required</option>
                <option value="General Message">General Message</option>
              </select>
            </div>

            <div className="flex gap-2">
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={
                  user?.role === "student"
                    ? "Type your reply or remark..."
                    : "Share congratulations, feedback, or action items..."
                }
                rows={2}
                className="flex-1 p-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50 dark:bg-[#1C2531] text-slate-900 dark:text-[#E8EDF4] placeholder:text-slate-400 dark:placeholder:text-[#7E8B9C] focus:ring-2 focus:ring-blue-500 outline-hidden resize-none"
              />
              <button
                type="submit"
                disabled={sending || !messageBody.trim()}
                className="self-end px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer flex items-center gap-1.5 min-h-[44px]"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
