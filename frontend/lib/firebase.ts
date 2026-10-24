import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyBNh7GnJGjlHTb1oz2nl0jAKVTMighELJU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "cce-pgpa.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cce-pgpa",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "cce-pgpa.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "299574573723",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:299574573723:web:6a35431aa6c4c47c8ba43e",
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey.length > 5 &&
    !firebaseConfig.apiKey.startsWith("AIzaSy...") &&
    firebaseConfig.projectId
  );
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export const getFirebaseAuth = (): Auth | null => {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  try {
    if (!app) {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    }
    if (!auth) {
      auth = getAuth(app);
    }
    return auth;
  } catch (error) {
    console.error("Failed to initialize Firebase Auth instance:", error);
    return null;
  }
};

if (typeof window !== "undefined") {
  if (isFirebaseConfigured()) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(app);
    } catch (error) {
      console.warn("Failed to initialize Firebase Web SDK:", error);
    }
  }
}

export { app, auth };
export default firebaseConfig;
