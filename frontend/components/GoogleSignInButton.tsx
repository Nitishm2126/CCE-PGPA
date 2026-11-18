"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS } from "@/lib/role-config";

// Official Google Client ID for CCE-PGPA
const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "1048685997432-ek91k3l6rkqtq43i0750h0l5jdmfo8vu.apps.googleusercontent.com";

interface GoogleSignInButtonProps {
  role: UserRole;
  onError: (msg: string) => void;
  onSuccess?: () => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: string | number;
            }
          ) => void;
          prompt?: () => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({
  role,
  onError,
  onSuccess,
  disabled = false,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const { loginWithGoogle, logout } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check if Google script is loaded
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkScript = () => {
      if (window.google?.accounts?.id) {
        setScriptLoaded(true);
        if (interval) clearInterval(interval);
      }
    };

    checkScript();

    if (!window.google?.accounts?.id) {
      interval = setInterval(checkScript, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleCredentialResponse = async (response: { credential: string }) => {
    if (!response.credential) {
      onError("Google did not return a valid authentication credential.");
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage("Verifying institutional Google account...");

      const authenticatedUser = await loginWithGoogle(response.credential, role);

      if (authenticatedUser) {
        setStatusMessage("Authentication verified. Redirecting...");
        if (onSuccess) onSuccess();

        // Verify role authorization
        const isAuthorizedForRole =
          authenticatedUser.role === role ||
          (authenticatedUser.role === "hod" && role === "mentor") ||
          (authenticatedUser.accessible_portals &&
            authenticatedUser.accessible_portals.includes(role));

        if (!isAuthorizedForRole) {
          await logout();
          onError(
            `Role Mismatch: You signed in as "${ROLE_CONFIGS[authenticatedUser.role]?.shortTitle || authenticatedUser.role}". Access to the ${ROLE_CONFIGS[role]?.shortTitle || role} portal is restricted.`
          );
          setIsLoading(false);
          setStatusMessage(null);
          return;
        }

        if (authenticatedUser.must_change_password) {
          router.replace("/change-password");
          return;
        }

        router.replace(`/${role}`);
      } else {
        onError("Account verification incomplete. Please contact department administrator.");
        setIsLoading(false);
        setStatusMessage(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google authentication failed.";
      onError(msg);
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  // Render Google Identity Services button once script is ready
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.google?.accounts?.id) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        cancel_on_tap_outside: true,
      });

      // Clear container and render button
      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 380,
        logo_alignment: "left",
      });
    } catch (err) {
      console.warn("Failed to render Google Sign-In button:", err);
    }
  }, [scriptLoaded, role]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Loading state indicator */}
      {isLoading && (
        <div className="w-full mb-3 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-300 animate-pulse">
          <svg className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{statusMessage || "Signing in with Google Workspace..."}</span>
        </div>
      )}

      {/* Official Google Button Container */}
      <div
        ref={containerRef}
        id="google-signin-btn-container"
        className={`w-full flex justify-center min-h-[44px] ${disabled || isLoading ? "opacity-50 pointer-events-none" : ""}`}
      />

      {/* Fallback button if script is blocked or still loading */}
      {!scriptLoaded && !isLoading && (
        <div className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium text-center flex items-center justify-center gap-2 shadow-2xs">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Loading Google Sign-In...</span>
        </div>
      )}
    </div>
  );
}
