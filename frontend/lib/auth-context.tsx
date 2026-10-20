"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserResponse, UserRole } from "@/types/auth";
import { api, getStoredToken, setStoredToken, clearStoredToken, ApiError } from "@/lib/api-client";
import { auth as firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
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

  login: (email: string, password: string) => Promise<UserResponse | null>;
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

  // Initialize session and sync with Firebase Auth state
  useEffect(() => {
    let isMounted = true;

    if (!isFirebaseConfigured() || !firebaseAuth) {
      // Direct / Legacy session initialization when Firebase is not configured
      const stored = getStoredToken();
      if (!stored) {
        queueMicrotask(() => {
          if (isMounted) setIsLoading(false);
        });
        return;
      }

      api
        .getMe(stored)
        .then((userData) => {
          if (isMounted) {
            setUser(userData);
            setToken(stored);
            setIsProvisioned(true);
          }
        })
        .catch(() => {
          if (isMounted) {
            clearStoredToken();
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
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (!isMounted) return;

      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          setStoredToken(idToken);

          try {
            const userData = await api.getMe(idToken);
            if (isMounted) {
              setUser(userData);
              setIsProvisioned(true);
            }
          } catch {
            // Firebase account is authenticated, but database record is pending provisioning
            if (isMounted) {
              setUser(null);
              setIsProvisioned(false);
            }
          }
        } catch {
          if (isMounted) {
            clearStoredToken();
            setToken(null);
            setUser(null);
            setIsProvisioned(false);
          }
        }
      } else {
        if (isMounted) {
          const stored = getStoredToken();
          if (stored) {
            api
              .getMe(stored)
              .then((userData) => {
                if (isMounted) {
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

  const login = async (email: string, password: string): Promise<UserResponse | null> => {
    setIsLoading(true);
    setError(null);

    // 1. Authenticate via Firebase Web SDK
    if (isFirebaseConfigured() && firebaseAuth) {
      try {
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const fbUser = userCredential.user;
        setFirebaseUser(fbUser);

        const idToken = await fbUser.getIdToken();
        setStoredToken(idToken);
        setToken(idToken);

        // Validate server-side PostgreSQL directory user
        try {
          const userData = await api.getMe(idToken);
          setUser(userData);
          setIsProvisioned(true);
          setIsLoading(false);
          return userData;
        } catch {
          // Firebase authenticated successfully, but user is not yet provisioned in PostgreSQL.
          // We preserve the Firebase session so the user can verify their email.
          setUser(null);
          setIsProvisioned(false);
          setIsLoading(false);
          return null;
        }
      } catch (fbError: unknown) {
        // Fall back to direct FastAPI authentication if user is in PostgreSQL
        try {
          const tokenResponse = await api.login(email, password);
          setStoredToken(tokenResponse.access_token);
          setToken(tokenResponse.access_token);

          const userData = await api.getMe(tokenResponse.access_token);
          setUser(userData);
          setIsProvisioned(true);
          setIsLoading(false);
          return userData;
        } catch {
          setIsLoading(false);
          const msg =
            fbError instanceof ApiError
              ? fbError.message
              : fbError instanceof Error
              ? fbError.message
              : "Authentication failed. Please verify your credentials.";
          setError(msg);
          throw new Error(msg);
        }
      }
    }

    // 2. Direct FastAPI Authentication fallback (when Firebase Web SDK is not configured)
    try {
      const tokenResponse = await api.login(email, password);
      setStoredToken(tokenResponse.access_token);
      setToken(tokenResponse.access_token);

      const userData = await api.getMe(tokenResponse.access_token);
      setUser(userData);
      setIsProvisioned(true);
      setIsLoading(false);
      return userData;
    } catch (err: unknown) {
      setIsLoading(false);
      let message = "Invalid email or password. Please verify your credentials.";
      if (err instanceof ApiError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      throw new Error(message);
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

  const logout = async () => {
    setIsLoading(true);
    try {
      if (firebaseAuth && firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      if (token) {
        await api.logout(token).catch(() => {});
      }
    } catch {
      // Best-effort logout
    } finally {
      clearStoredToken();
      setFirebaseUser(null);
      setUser(null);
      setToken(null);
      setIsProvisioned(false);
      setIsLoading(false);
      setError(null);
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
