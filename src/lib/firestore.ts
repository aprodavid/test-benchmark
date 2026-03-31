import { Firestore, getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirestoreDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
