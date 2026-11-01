"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppleLoadingScreen } from "@/components/shared/AppleLoadingScreen";

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace(`/${user.role}`);
      } else {
        router.replace("/login");
      }
    }
  }, [user, isLoading, router]);

  return (
    <AppleLoadingScreen
      message="Preparing your dashboard..."
      submessage="Navigating to verified workspace"
      fullScreen={true}
    />
  );
}
