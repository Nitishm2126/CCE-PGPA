import React from "react";
import { notFound } from "next/navigation";
import { RoleLoginForm } from "@/components/RoleLoginForm";
import { UserRole } from "@/types/auth";
import { ROLE_CONFIGS, ALL_ROLES } from "@/lib/role-config";
import type { Metadata } from "next";

const VALID_ROLES = ALL_ROLES;

export function generateStaticParams() {
  return [
    { role: "student" },
    { role: "mentor" },
    { role: "hod" },
    { role: "admin" },
  ];
}

interface PageProps {
  params: Promise<{ role: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { role } = await params;
  if (!VALID_ROLES.includes(role as UserRole)) {
    return {
      title: "Login - CCE-PGPA",
    };
  }
  const config = ROLE_CONFIGS[role as UserRole];
  return {
    title: `${config.portalTitle} - CCE-PGPA Management System`,
    description: config.description,
  };
}

async function RoleSpecificLoginContent({ params }: PageProps) {
  const { role } = await params;

  if (!VALID_ROLES.includes(role as UserRole)) {
    notFound();
  }

  return <RoleLoginForm key={role} role={role as UserRole} />;
}

function RoleLoginSkeleton() {
  return (
    <div className="w-full min-h-screen flex flex-col bg-white text-slate-900">
      <header className="w-full border-b border-slate-100 bg-white pt-4 pb-3 sm:pt-6 sm:pb-4 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="h-12 sm:h-16 w-full max-w-xl mx-auto bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </header>

      <section className="text-center pt-6 pb-4 sm:pt-8 sm:pb-6 px-4">
        <div className="mx-auto max-w-4xl space-y-2">
          <div className="h-5 w-64 sm:w-80 mx-auto bg-slate-200 rounded animate-pulse" />
          <div className="h-10 w-44 sm:w-56 mx-auto bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-72 sm:w-96 mx-auto bg-slate-100 rounded animate-pulse" />
        </div>
      </section>

      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 pb-10 flex-1 flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-4 text-xs">
          <span className="text-slate-400">&larr; Back to Portal Selection</span>
        </div>

        <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs animate-pulse">
          <div className="pb-5 border-b border-slate-100 mb-6 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-6 w-36 sm:w-44 bg-slate-200 rounded-md" />
              <div className="h-6 w-20 bg-slate-200 rounded-full" />
            </div>
            <div className="h-3 w-56 sm:w-72 bg-slate-100 rounded" />
          </div>

          <div className="space-y-4 sm:space-y-5">
            <div>
              <div className="h-3 w-28 bg-slate-200 rounded mb-1.5" />
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
            </div>
            <div>
              <div className="h-3 w-28 bg-slate-200 rounded mb-1.5" />
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
            </div>
            <div className="pt-2">
              <div className="h-11 w-full bg-blue-600/40 rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RoleSpecificLoginPage({ params }: PageProps) {
  return (
    <React.Suspense fallback={<RoleLoginSkeleton />}>
      <RoleSpecificLoginContent params={params} />
    </React.Suspense>
  );
}
