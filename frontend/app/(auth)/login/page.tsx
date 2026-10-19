import React from "react";
import { PortalSelection } from "@/components/PortalSelection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College",
  description:
    "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators.",
};

export default function LoginPage() {
  return <PortalSelection />;
}
