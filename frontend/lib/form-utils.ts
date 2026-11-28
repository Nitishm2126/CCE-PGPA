// ==============================================================================
// Shared Google Forms-Style Sanitizer, Video Embed Parser & Theme Helpers
// ==============================================================================

import { FormThemeConfig } from "@/types/events";

export const DEFAULT_FORM_THEME: Required<FormThemeConfig> = {
  background_color: "#f3f4f6",
  theme_color: "#2563eb",
  banner_image_url: "",
  font_family: "sans",
  heading_font_size: "lg",
  body_font_size: "md",
  card_appearance: "elevated",
  border_style: "solid",
  corner_radius: "xl",
  content_alignment: "left",
  button_style: "solid",
};

/**
 * Strips potentially unsafe scripts, embeds, event handlers, and javascript: URIs
 * while keeping standard formatting tags (b, strong, i, em, u, ul, ol, li, p, br, a, span).
 */
export function sanitizeRichHtml(raw?: string | null): string {
  if (!raw) return "";
  let clean = String(raw);
  clean = clean.replace(/<\s*(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  clean = clean.replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|input|button)[^>]*>/gi, "");
  clean = clean.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  clean = clean.replace(/(href|src)\s*=\s*(["'])\s*(javascript|vbscript|data):[^"']*\2/gi, '$1="#"');
  return clean;
}

export interface ParsedVideoUrl {
  valid: boolean;
  embedUrl?: string;
  provider?: "youtube" | "vimeo" | "drive";
  error?: string;
}

/**
 * Validates and converts YouTube, Vimeo, and Google Drive video links to safe embed URLs.
 */
export function parseVideoEmbedUrl(rawUrl?: string | null): ParsedVideoUrl {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return { valid: false, error: "Please enter a video URL." };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { valid: false, error: "Video URL must start with http:// or https://." };
  }

  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,20})/i);
  if (ytMatch) {
    return {
      valid: true,
      provider: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
    };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d{5,15})/i);
  if (vimeoMatch) {
    return {
      valid: true,
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/i);
  if (driveMatch) {
    return {
      valid: true,
      provider: "drive",
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  return {
    valid: false,
    error: "Supported video URLs: YouTube (youtube.com / youtu.be), Vimeo, or Google Drive file links.",
  };
}

export function normalizeGoogleDriveImageUrl(rawUrl?: string | null): string {
  const url = String(rawUrl || "").trim();
  if (!url) return "";
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/i);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  return url;
}

let _idCounter = 0;

export function generateUniqueId(prefix = "id"): string {
  _idCounter += 1;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}

export function getResolvedTheme(theme?: FormThemeConfig | null): Required<FormThemeConfig> {
  return {
    ...DEFAULT_FORM_THEME,
    ...(theme || {}),
  };
}

export function getFontFamilyCss(fontFamily?: FormThemeConfig["font_family"]): string {
  switch (fontFamily) {
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "mono":
      return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    case "display":
      return '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    default:
      return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }
}

export function getRadiusClass(radius?: FormThemeConfig["corner_radius"]): string {
  switch (radius) {
    case "none":
      return "rounded-none";
    case "md":
      return "rounded-lg";
    case "2xl":
      return "rounded-3xl";
    default:
      return "rounded-2xl";
  }
}

export function getHeadingSizeClass(size?: FormThemeConfig["heading_font_size"]): string {
  switch (size) {
    case "sm":
      return "text-base sm:text-lg";
    case "md":
      return "text-lg sm:text-xl";
    case "xl":
      return "text-2xl sm:text-3xl";
    default:
      return "text-xl sm:text-2xl";
  }
}

export function getBodySizeClass(size?: FormThemeConfig["body_font_size"]): string {
  switch (size) {
    case "sm":
      return "text-xs";
    case "lg":
      return "text-sm sm:text-base";
    default:
      return "text-xs sm:text-sm";
  }
}
