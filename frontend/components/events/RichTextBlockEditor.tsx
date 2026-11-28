"use client";

import React, { useRef, useState, useEffect } from "react";
import { ContentBlockStyle } from "@/types/events";
import { sanitizeRichHtml } from "@/lib/form-utils";

interface RichTextBlockEditorProps {
  htmlValue: string;
  plainFallback?: string;
  styleConfig?: ContentBlockStyle;
  isSelected: boolean;
  onChangeHtml: (html: string, plainText: string) => void;
  onChangeStyle: (patch: Partial<ContentBlockStyle>) => void;
}

export const RichTextBlockEditor: React.FC<RichTextBlockEditorProps> = ({
  htmlValue,
  plainFallback = "",
  styleConfig = {},
  isSelected,
  onChangeHtml,
  onChangeStyle,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [showLinkBox, setShowLinkBox] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");

  // Keep DOM synchronized when switching between cards or loading templates
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const desired = sanitizeRichHtml(htmlValue || (plainFallback ? `<p>${plainFallback}</p>` : ""));
    if (el.innerHTML !== desired && document.activeElement !== el) {
      el.innerHTML = desired;
    }
  }, [htmlValue, plainFallback]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const sanitized = sanitizeRichHtml(el.innerHTML);
    const text = el.innerText || "";
    onChangeHtml(sanitized, text);
  };

  const applyCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    try {
      document.execCommand(cmd, false, value);
    } catch {
      // Fallback ignored on non-editable environments
    }
    emitChange();
  };

  const handleInsertLink = () => {
    const clean = linkUrl.trim();
    if (/^https?:\/\//i.test(clean)) {
      applyCmd("createLink", clean);
    }
    setShowLinkBox(false);
    setLinkUrl("https://");
  };

  const alignClass =
    styleConfig.alignment === "center"
      ? "text-center"
      : styleConfig.alignment === "right"
      ? "text-right"
      : "text-left";
  const sizeClass =
    styleConfig.font_size === "lg"
      ? "text-sm sm:text-base"
      : styleConfig.font_size === "sm"
      ? "text-[11px]"
      : "text-xs sm:text-sm";

  return (
    <div className="space-y-2">
      {/* Formatting Toolbar visible when selected */}
      {isSelected && (
        <div
          className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              applyCmd("bold");
            }}
            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-[#2a2a2a] text-xs font-bold cursor-pointer"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              applyCmd("italic");
            }}
            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-[#2a2a2a] text-xs italic font-serif cursor-pointer"
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              applyCmd("underline");
            }}
            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-[#2a2a2a] text-xs underline cursor-pointer"
            title="Underline"
          >
            U
          </button>

          <span className="h-4 w-px bg-slate-200 dark:bg-[#333] mx-0.5" />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              applyCmd("insertUnorderedList");
            }}
            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-[#2a2a2a] text-[11px] font-semibold cursor-pointer"
            title="Bullet List"
          >
            • List
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              applyCmd("insertOrderedList");
            }}
            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-[#2a2a2a] text-[11px] font-semibold cursor-pointer"
            title="Numbered List"
          >
            1. List
          </button>
          <button
            type="button"
            onClick={() => setShowLinkBox((v) => !v)}
            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-[#2a2a2a] text-[11px] font-semibold cursor-pointer"
            title="Insert Hyperlink"
          >
            🔗 Link
          </button>

          <span className="h-4 w-px bg-slate-200 dark:bg-[#333] mx-0.5" />

          {/* Variant */}
          <select
            value={styleConfig.variant || "plain"}
            onChange={(e) => onChangeStyle({ variant: e.target.value as ContentBlockStyle["variant"] })}
            className="text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#1c1c1c]"
            title="Block Purpose"
          >
            <option value="plain">Plain Text</option>
            <option value="instructions">Instructions</option>
            <option value="note">Note</option>
            <option value="announcement">Announcement</option>
          </select>

          {/* Alignment */}
          <select
            value={styleConfig.alignment || "left"}
            onChange={(e) => onChangeStyle({ alignment: e.target.value as ContentBlockStyle["alignment"] })}
            className="text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#1c1c1c]"
            title="Text Alignment"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>

          {/* Font Size */}
          <select
            value={styleConfig.font_size || "md"}
            onChange={(e) => onChangeStyle({ font_size: e.target.value as ContentBlockStyle["font_size"] })}
            className="text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#1c1c1c]"
            title="Text Size"
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>

          {/* Color */}
          <input
            type="color"
            value={styleConfig.text_color || "#334155"}
            onChange={(e) => onChangeStyle({ text_color: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            title="Text Color"
          />
        </div>
      )}

      {showLinkBox && isSelected && (
        <div className="flex items-center gap-2 p-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#141414]"
          />
          <button
            type="button"
            onClick={handleInsertLink}
            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
          >
            Apply Link
          </button>
          <button
            type="button"
            onClick={() => setShowLinkBox(false)}
            className="px-2 py-1 text-[11px] text-slate-500 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder="Write instructions, notes, paragraphs, bullet lists, or hyperlinks..."
        style={styleConfig.text_color ? { color: styleConfig.text_color } : undefined}
        className={`min-h-[60px] w-full rounded-xl border border-slate-200/80 dark:border-[#2d2d2d] bg-white/70 dark:bg-[#141414] px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 ${alignClass} ${sizeClass}`}
      />
    </div>
  );
};
