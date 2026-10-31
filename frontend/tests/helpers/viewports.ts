export interface ViewportDefinition {
  name: string;
  width: number;
  height: number;
  category: 'mobile' | 'tablet' | 'desktop';
}

export const VIEWPORTS: ViewportDefinition[] = [
  // Mobile viewports
  { name: 'mobile-360x800', width: 360, height: 800, category: 'mobile' },
  { name: 'mobile-375x667', width: 375, height: 667, category: 'mobile' },
  { name: 'mobile-390x844', width: 390, height: 844, category: 'mobile' },
  { name: 'mobile-402x874', width: 402, height: 874, category: 'mobile' },
  { name: 'mobile-412x915', width: 412, height: 915, category: 'mobile' },
  { name: 'mobile-430x932', width: 430, height: 932, category: 'mobile' },
  // Tablet viewport
  { name: 'tablet-768x1024', width: 768, height: 1024, category: 'tablet' },
  // Desktop viewports
  { name: 'desktop-1280x720', width: 1280, height: 720, category: 'desktop' },
  { name: 'desktop-1366x768', width: 1366, height: 768, category: 'desktop' },
  { name: 'desktop-1440x900', width: 1440, height: 900, category: 'desktop' },
  { name: 'desktop-1920x1080', width: 1920, height: 1080, category: 'desktop' },
];

export const TARGET_DESKTOP_VIEWPORTS: ViewportDefinition[] = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080, category: 'desktop' },
  { name: 'desktop-1440x900', width: 1440, height: 900, category: 'desktop' },
  { name: 'desktop-1366x768', width: 1366, height: 768, category: 'desktop' },
  { name: 'desktop-1280x720', width: 1280, height: 720, category: 'desktop' },
];

export const TARGET_MOBILE_VIEWPORTS: ViewportDefinition[] = [
  { name: 'mobile-360x800', width: 360, height: 800, category: 'mobile' },
  { name: 'mobile-375x667', width: 375, height: 667, category: 'mobile' },
  { name: 'mobile-390x844', width: 390, height: 844, category: 'mobile' },
  { name: 'mobile-412x915', width: 412, height: 915, category: 'mobile' },
  { name: 'mobile-430x932', width: 430, height: 932, category: 'mobile' },
];

export interface PageDefinition {
  id: string;
  title: string;
  path: string;
}

export const PAGES: PageDefinition[] = [
  { id: 'landing', title: 'Landing Page', path: '/' },
  { id: 'login-student', title: 'Student Login', path: '/login/student' },
  { id: 'login-mentor', title: 'Faculty Mentor Login', path: '/login/mentor' },
  { id: 'login-hod', title: 'HOD Login', path: '/login/hod' },
  { id: 'login-admin', title: 'Admin Login', path: '/login/admin' },
];

export const LOGIN_PAGES: PageDefinition[] = [
  { id: 'login-student', title: 'Student Login', path: '/login/student' },
  { id: 'login-mentor', title: 'Faculty Mentor Login', path: '/login/mentor' },
  { id: 'login-hod', title: 'HOD Login', path: '/login/hod' },
  { id: 'login-admin', title: 'Admin Login', path: '/login/admin' },
];
