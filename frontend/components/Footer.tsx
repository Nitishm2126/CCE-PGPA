"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { FineWorksFooter } from "@/components/shared/FineWorksFooter";

export const Footer: React.FC = () => {
  const pathname = usePathname();

  // Hidden on portals that already mount their own FineWorksFooter
  if (
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/student") ||
    pathname?.startsWith("/mentor") ||
    pathname?.startsWith("/hod") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/change-password")
  ) {
    return null;
  }

  return <FineWorksFooter />;
};
