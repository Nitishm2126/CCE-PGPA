"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserResponse, UserRole } from "@/types/auth";
import { api, getStoredToken, setStoredToken, clearStoredToken, ApiError } from "@/lib/api-client";
import { auth as firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";

interface AuthContextType {
  user: UserResponse | null;
  role: UserRole | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isFirebaseAvailable: boolean;
  login: (email: string, password: string) => Promise<UserResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      const stored = getStoredToken();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await api.getMe(stored);
        setUser(userData);
        setToken(stored);
      } catch {
        // Stored token is invalid or expired
        clearStoredToken();
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  const login = async (email: string, password: string): Promise<UserResponse> => {
    setIsLoading(true);
    setError(null);

    // 1. If Firebase is configured with active credentials, try Firebase Auth first
    if (isFirebaseConfigured() && firebaseAuth) {
      try {
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const idToken = await userCredential.user.getIdToken();

        // Validate token against backend /me endpoint
        const userData = await api.getMe(idToken);
        setStoredToken(idToken);
        setToken(idToken);
        setUser(userData);
        setIsLoading(false);
        return userData;
      } catch (fbError: unknown) {
        // If Firebase Auth fails with specific error, check if it's user not found or wrong password
        const msg = fbError instanceof Error ? fbError.message : "Firebase authentication failed";
        // If Firebase accounts are not yet provisioned, fall back to backend direct authentication
        console.warn("Firebase sign-in failed or unprovisioned, falling back to direct verification:", msg);
      }
    }

    // 2. Direct FastAPI Authentication fallback (active during onboarding / prior to Firebase account sync)
    try {
      const tokenResponse = await api.login(email, password);
      setStoredToken(tokenResponse.access_token);
      setToken(tokenResponse.access_token);

      const userData = await api.getMe(tokenResponse.access_token);
      setUser(userData);
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

  const logout = async () => {
    setIsLoading(true);
    try {
      if (firebaseAuth && firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      await api.logout(token);
    } catch {
      // Best-effort logout
    } finally {
      clearStoredToken();
      setUser(null);
      setToken(null);
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
