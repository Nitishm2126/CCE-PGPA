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
    <div className="w-full min-h-[100dvh] flex flex-col justify-between bg-[#fbfbfc] dark:bg-[#0c1117] text-slate-900 dark:text-slate-100">
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-12 sm:h-13 px-4">
        <div className="mx-auto max-w-7xl h-full flex items-center justify-between">
          <div className="h-8 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </header>

      <section className="text-center pt-2 sm:pt-2.5 pb-1 sm:pb-1.5 px-4">
        <div className="mx-auto max-w-4xl space-y-1 sm:space-y-1.5">
          <div className="h-5 w-72 sm:w-80 mx-auto bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
          <div className="h-8 w-40 sm:w-48 mx-auto bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-3 w-52 sm:w-64 mx-auto bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
        </div>
      </section>

      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 flex-1 flex flex-col justify-center items-center py-1 sm:py-2 min-h-0">
        <div className="w-full flex items-center justify-between mb-2 text-xs">
          <span className="text-slate-400 dark:text-slate-500">&larr; Back to Portal Selection</span>
        </div>

        <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 p-4 sm:p-5 shadow-xs animate-pulse">
          <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 sm:w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="h-3 w-52 sm:w-64 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            <div>
              <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-1" />
              <div className="h-9 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            </div>
            <div>
              <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-1" />
              <div className="h-9 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            </div>
            <div className="pt-1">
              <div className="h-10 w-full bg-sky-600/30 rounded-xl" />
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
