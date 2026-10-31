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
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isProvisioned, setIsProvisioned] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

    const normalizedEmail = email.trim().toLowerCase();
    const isAdminAccount =
      portalRole === "admin" || normalizedEmail === "cce.pgpa@gmail.com";

    // 1. System Administrator authentication: STRICTLY via Firebase Web SDK
    if (isAdminAccount) {
      const activeAuth = getFirebaseAuth() || firebaseAuth;
      if (!isFirebaseConfigured() || !activeAuth) {
        const msg = "Firebase Authentication is not available. Please verify client configuration.";
        setError(msg);
        setIsLoading(false);
        isLoggingInRef.current = false;
        throw new Error(msg);
      }

      try {
        const userCredential = await signInWithEmailAndPassword(activeAuth, normalizedEmail, password);
        const fbUser = userCredential.user;
        setFirebaseUser(fbUser);

        const idToken = await fbUser.getIdToken();
        setStoredToken(idToken);
        setToken(idToken);

        // Fetch verified user profile from backend via GET /api/v1/auth/me
        try {
          const userData = await api.getMe(idToken);
          setUser(userData);
          setIsProvisioned(true);
          return userData;
        } catch (meErr: unknown) {
          if (meErr instanceof ApiError && meErr.status === 401) {
            setUser(null);
            setIsProvisioned(false);
            return null;
          }
          const msg =
            meErr instanceof ApiError
              ? meErr.message
              : "Unable to verify administrator profile with backend.";
          setError(msg);
          throw new Error(msg);
        }
      } catch (fbErr: unknown) {
        // MANDATORY: Never fall back to direct password login for FIREBASE_MANAGED_ACCOUNT!
        // Directly inspect and surface actionable error details from Firebase.
        const errObj = fbErr as { code?: string; message?: string };
        let msg = "Invalid email or password. Please verify your credentials.";

        if (errObj.code === "auth/invalid-credential" || errObj.code === "auth/wrong-password") {
          msg = "Invalid email or password. Please verify your credentials.";
        } else if (errObj.code === "auth/user-not-found") {
          msg = "Administrator account not found in Firebase Authentication.";
        } else if (errObj.code === "auth/too-many-requests") {
          msg = "Too many failed login attempts. Please wait a few minutes before trying again.";
        } else if (errObj.code === "auth/user-disabled") {
          msg = "This administrator account has been disabled.";
        } else if (errObj.code === "auth/network-request-failed") {
          msg = "Network error: Unable to reach Firebase Authentication service. Please check connection.";
        } else if (errObj.code === "auth/unauthorized-domain") {
          msg = "Domain unauthorized: Please add cce-pgpa.vercel.app to Firebase Console > Authentication > Settings > Authorized Domains.";
        } else if (errObj.code) {
          msg = `Firebase Authentication error (${errObj.code}): ${errObj.message || ""}`;
        }

        console.error("Firebase admin sign-in error:", fbErr);
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
        isLoggingInRef.current = false;
      }
    }

    // 2. Non-admin roles (Students, Mentors, HOD): Authenticate directly via FastAPI / PostgreSQL
    try {
      const tokenResponse = await api.login(email, password);
      setStoredToken(tokenResponse.access_token);
      setToken(tokenResponse.access_token);

      const userData = await api.getMe(tokenResponse.access_token);
      setUser(userData);
      setIsProvisioned(true);
      return userData;
    } catch (err: unknown) {
      let message = "Invalid email or password. Please verify your credentials.";
      if (err instanceof ApiError) {
        if (err.status === 408) {
          message = "Login request timed out. Please retry.";
        } else if (err.status === 0) {
          message = "Backend service unavailable. Please check your connection.";
        } else if (err.status === 401) {
          message = "Invalid email or password. Please verify your credentials.";
        } else if (err.status === 403) {
          message = err.message || "Account is deactivated. Please contact an administrator.";
        } else if (err.status >= 500) {
          message = `Backend server error (${err.status}): ${err.message}`;
        } else {
          message = err.message;
        }
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
          // Still unprovisioned in PostgreSQL
        }
      } catch {
        // Token refresh error
      }
      return updated.emailVerified;
    }

    return false;
  };

  const logout = async (): Promise<void> => {
    isLoggingOutRef.current = true;
    setIsLoading(true);

    // 1. Immediately and synchronously flush stored token and in-memory caches
    clearStoredToken();
    clearApiCache();

    // 2. Synchronously nullify user state to prevent any stale reads
    setFirebaseUser(null);
    setUser(null);
    setToken(null);
    setIsProvisioned(false);
    setError(null);

    // 3. Perform asynchronous sign-outs
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
      // 4. Guarantee state and storage are completely clear
      clearStoredToken();
      clearApiCache();
      setFirebaseUser(null);
      setUser(null);
      setToken(null);
      setIsProvisioned(false);
      setIsLoading(false);
      setError(null);
      isLoggingOutRef.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        token,
        isLoading,
        error,
        isFirebaseAvailable: isFirebaseConfigured(),
        firebaseUser,
        isEmailVerified: Boolean(firebaseUser?.emailVerified),
        isProvisioned,
        sendVerificationEmail,
        reloadFirebaseUser,
        login,
        logout,
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
