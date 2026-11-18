"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserResponse, UserRole } from "@/types/auth";
import { api, getStoredToken, setStoredToken, clearStoredToken, clearApiCache, ApiError } from "@/lib/api-client";
import { auth as firebaseAuth, isFirebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  User as FirebaseUser,
  ActionCodeSettings,
} from "firebase/auth";

export interface AuthContextType {
  user: UserResponse | null;
  role: UserRole | null;
  token: string | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  error: string | null;
  isFirebaseAvailable: boolean;

  // Firebase user state & email verification
  firebaseUser: FirebaseUser | null;
  isEmailVerified: boolean;
  isProvisioned: boolean;
  sendVerificationEmail: () => Promise<void>;
  reloadFirebaseUser: () => Promise<boolean>;

  login: (email: string, password: string, portalRole?: UserRole) => Promise<UserResponse | null>;
  logout: () => Promise<void>;
  updateUser: (updated: UserResponse) => void;
  refreshUser: () => Promise<UserResponse | null>;
  clearError: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isProvisioned, setIsProvisioned] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const isLoggingInRef = React.useRef(false);
  const isLoggingOutRef = React.useRef(false);

  // Initialize session and sync with Firebase Auth state
  useEffect(() => {
    let isMounted = true;

    const activeAuth = getFirebaseAuth() || firebaseAuth;

    if (!isFirebaseConfigured() || !activeAuth) {
      // Direct / Legacy session initialization when Firebase is not configured
      const stored = getStoredToken();
      if (!stored || isLoggingOutRef.current) {
        queueMicrotask(() => {
          if (isMounted) setIsLoading(false);
        });
        return;
      }

      api
        .getMe(stored)
        .then((userData) => {
          if (isMounted && !isLoggingOutRef.current && !isLoggingInRef.current) {
            setUser(userData);
            setToken(stored);
            setIsProvisioned(true);
          }
        })
        .catch(() => {
          if (isMounted) {
            clearStoredToken();
            clearApiCache();
            setUser(null);
            setToken(null);
            setIsProvisioned(false);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return;
    }

    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(activeAuth, async (fbUser) => {
      if (!isMounted) return;

      // Prevent background auth listener from mutating session during active login or logout
      if (isLoggingOutRef.current || isLoggingInRef.current) {
        return;
      }

      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          if (!isMounted || isLoggingOutRef.current || isLoggingInRef.current) return;
          setToken(idToken);
          setStoredToken(idToken);

          try {
            const userData = await api.getMe(idToken);
            if (isMounted && !isLoggingOutRef.current && !isLoggingInRef.current) {
              setUser(userData);
              setIsProvisioned(true);
            }
          } catch {
            // Firebase account is authenticated, but database record is pending provisioning
            if (isMounted && !isLoggingOutRef.current) {
              setUser(null);
              setIsProvisioned(false);
            }
          }
        } catch {
          if (isMounted) {
            clearStoredToken();
            clearApiCache();
            setToken(null);
            setUser(null);
            setIsProvisioned(false);
          }
        }
      } else {
        if (isMounted) {
          if (isLoggingOutRef.current) {
            setFirebaseUser(null);
            setUser(null);
            setToken(null);
            setIsProvisioned(false);
            setIsLoading(false);
            return;
          }

          const stored = getStoredToken();
          if (stored) {
            api
              .getMe(stored)
              .then((userData) => {
                if (isMounted && !isLoggingOutRef.current && !isLoggingInRef.current) {
                  setUser(userData);
                  setToken(stored);
                  setIsProvisioned(true);
                  setIsLoading(false);
                }
              })
              .catch(() => {
                if (isMounted) {
                  setFirebaseUser(null);
                  setUser(null);
                  setToken(null);
                  setIsProvisioned(false);
                  clearStoredToken();
                  clearApiCache();
                  setIsLoading(false);
                }
              });
            return;
          }

          setFirebaseUser(null);
          setUser(null);
          setToken(null);
          setIsProvisioned(false);
          clearStoredToken();
          clearApiCache();
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string,
    portalRole?: UserRole
  ): Promise<UserResponse | null> => {
    setIsLoading(true);
    setError(null);
    isLoggingInRef.current = true;

    // STEP 0: Flush any preexisting session credentials to guarantee complete role isolation
    clearStoredToken();
    clearApiCache();
    setUser(null);
    setToken(null);
    setFirebaseUser(null);
    setIsProvisioned(false);

    let normalizedEmail = email.trim().toLowerCase();
    // Normalize user ID: Students -> @sairamtap.edu.in, Mentors/HOD -> @sairam.edu.in
    if (!normalizedEmail.includes("@")) {
      if (portalRole === "mentor" || portalRole === "hod") {
        normalizedEmail = `${normalizedEmail}@sairam.edu.in`;
      } else {
        normalizedEmail = `${normalizedEmail}@sairamtap.edu.in`;
      }
    }

    // Authentication: Firebase Email/Password Authentication ONLY
    try {
      const activeAuth = getFirebaseAuth() || firebaseAuth;
      if (!activeAuth || !isFirebaseConfigured()) {
        throw new Error("Firebase Authentication is not configured.");
      }

      const userCredential = await signInWithEmailAndPassword(activeAuth, normalizedEmail, password);
      const fbUser = userCredential.user;
      setFirebaseUser(fbUser);

      // Acquire Firebase ID Token (RS256 JWT)
      const idToken = await fbUser.getIdToken();

      // Exchange / Verify with Cloudflare backend via POST /api/v1/auth/firebase/session
      const sessionResponse = await api.loginWithFirebase(idToken, portalRole);
      setStoredToken(sessionResponse.access_token);
      setToken(sessionResponse.access_token);

      // Fetch user profile from Cloudflare D1
      const userData = await api.getMe(sessionResponse.access_token);
      setUser(userData);
      setIsProvisioned(true);
      return userData;
    } catch (err: unknown) {
      let message = "Invalid email/ID or password. Please verify your credentials.";
      const errObj = err as { code?: string; message?: string };

      if (errObj.code === "auth/invalid-credential" || errObj.code === "auth/wrong-password") {
        message = "Incorrect email/ID or password. Please verify your credentials.";
      } else if (errObj.code === "auth/user-not-found") {
        message = "Account not found in Firebase Authentication.";
      } else if (errObj.code === "auth/too-many-requests") {
        message = "Too many failed login attempts. Please wait a few minutes before trying again.";
      } else if (errObj.code === "auth/user-disabled") {
        message = "This account has been disabled. Please contact an administrator.";
      } else if (errObj.code === "auth/network-request-failed") {
        message = "Network error: Unable to connect to Firebase Authentication.";
      } else if (err instanceof ApiError) {
        message = err.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
      isLoggingInRef.current = false;
    }
  };

  const sendVerificationEmail = async (): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error("Firebase Authentication is not configured.");
    }
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error("No active Firebase session found. Please sign in first.");
    }

    try {
      const continueUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/verify-email`
          : "http://localhost:3000/verify-email";

      const actionCodeSettings: ActionCodeSettings = {
        url: continueUrl,
        handleCodeInApp: false,
      };

      try {
        await sendEmailVerification(currentUser, actionCodeSettings);
      } catch (innerErr: unknown) {
        const fbCode = (innerErr as { code?: string })?.code;
        if (fbCode === "auth/unauthorized-continue-uri") {
          // Fallback without actionCodeSettings if redirect URL is not whitelisted in Firebase Console
          await sendEmailVerification(currentUser);
        } else {
          throw innerErr;
        }
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj?.code === "auth/too-many-requests") {
        throw new Error("Too many verification requests. Please wait a few minutes before trying again.");
      }
      const message = errObj?.message || "Failed to send verification email.";
      throw new Error(message);
    }
  };

  const reloadFirebaseUser = async (): Promise<boolean> => {
    if (!firebaseAuth || !firebaseAuth.currentUser) {
      return false;
    }

    await firebaseAuth.currentUser.reload();
    const updated = firebaseAuth.currentUser;
    setFirebaseUser(updated);

    if (updated) {
      try {
        const idToken = await updated.getIdToken(true);
        setToken(idToken);
        setStoredToken(idToken);

        try {
          const userData = await api.getMe(idToken);
          setUser(userData);
          setIsProvisioned(true);
        } catch {
          // Still unprovisioned in Cloudflare D1
        }
      } catch {
        // Token refresh error
      }
      return updated.emailVerified;
    }

    return false;
  };

  const updateUser = useCallback((updated: UserResponse) => {
    setUser(updated);
  }, []);

  const refreshUser = useCallback(async (): Promise<UserResponse | null> => {
    const activeToken = token || getStoredToken();
    if (!activeToken) return null;
    try {
      const updated = await api.getMe(activeToken);
      setUser(updated);
      return updated;
    } catch {
      return null;
    }
  }, [token]);

  const logout = async (): Promise<void> => {
    setIsLoggingOut(true);
    isLoggingOutRef.current = true;
    setIsLoading(true);

    // 1. Immediately and synchronously flush stored token and in-memory caches
    clearStoredToken();
    clearApiCache();

    // 2. Clear browser client storage & cookies
    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
        localStorage.removeItem("cce_achieve_token");
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      } catch {
        // Ignore storage access errors in sandboxed contexts
      }
    }

    // 3. Synchronously nullify user state to prevent any stale reads
    setFirebaseUser(null);
    setUser(null);
    setToken(null);
    setIsProvisioned(false);
    setError(null);

    // 4. Perform asynchronous remote sign-outs
    try {
      const activeAuth = getFirebaseAuth() || firebaseAuth;
      if (activeAuth && activeAuth.currentUser) {
        await firebaseSignOut(activeAuth).catch(() => {});
      }
      if (token) {
        await api.logout(token).catch(() => {});
      }
    } catch {
      // Best-effort remote session revocation
    } finally {
      // 5. Guarantee state and storage are completely clear
      clearStoredToken();
      clearApiCache();
      setFirebaseUser(null);
      setUser(null);
      setToken(null);
      setIsProvisioned(false);
      setIsLoading(false);
      setError(null);
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        token,
        isLoading,
        isLoggingOut,
        error,
        isFirebaseAvailable: isFirebaseConfigured(),
        firebaseUser,
        isEmailVerified: Boolean(firebaseUser?.emailVerified),
        isProvisioned,
        sendVerificationEmail,
        reloadFirebaseUser,
        login,
        logout,
        updateUser,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
