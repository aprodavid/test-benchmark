import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { firebaseConfig } from "@/config/firebaseConfig";

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }

  return getApp();
}
