import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { SignOutOverlay } from "@/components/shared/SignOutOverlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export const metadata: Metadata = {
  title: "CCE-PGPA - Student Achievement Management System",
  description:
    "Student Achievement and Point-Grade-Performance-Audit (PGPA) Management System for the Department of Computer and Communication Engineering, Sri Sairam Engineering College.",
  icons: {
    icon: "/websitelogo.png",
    shortcut: "/websitelogo.png",
    apple: "/websitelogo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark min-h-[100dvh] antialiased`}
    >
      <head>
        <link rel="icon" href="/websitelogo.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/websitelogo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/websitelogo.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cce_theme')||'dark';if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-theme','light');}else{document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-[100dvh] flex flex-col font-sans transition-colors duration-150">
        <ThemeProvider>
          <AuthProvider>
            <SignOutOverlay />
            <Navbar />
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
