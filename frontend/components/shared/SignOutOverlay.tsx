"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { AppleLoadingScreen } from "./AppleLoadingScreen";

export const SignOutOverlay: React.FC = () => {
  const { isLoggingOut } = useAuth();

  if (!isLoggingOut) return null;

  return <AppleLoadingScreen isSignOut={true} fullScreen={true} />;
};
