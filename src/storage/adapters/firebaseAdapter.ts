import { AppState } from "@/storage/types";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

/**
 * 하위 호환용 경량 어댑터입니다.
 * 현재 앱에서는 AppStorageService가 직접 Firestore 컬렉션을 사용합니다.
 */
export class FirebaseAdapter {
  async readWholeState(): Promise<AppState | null> {
    const db = getFirebaseDb();
    if (!db) return null;

    const [metaSnap, equipmentSnap, transactionSnap, adminSnap] = await Promise.all([
      getDoc(doc(db, "app_meta", "state")),
      getDoc(doc(db, "equipments", "list")),
      getDoc(doc(db, "loans", "transactions")),
      getDoc(doc(db, "settings", "admin")),
    ]);

    if (!metaSnap.exists() && !equipmentSnap.exists() && !transactionSnap.exists() && !adminSnap.exists()) {
      return null;
    }

    return {
      schemaVersion: (metaSnap.data()?.schemaVersion as number | undefined) ?? 1,
      equipments: (equipmentSnap.data()?.items as AppState["equipments"] | undefined) ?? [],
      transactions: (transactionSnap.data()?.items as AppState["transactions"] | undefined) ?? [],
      adminSettings: (adminSnap.data() as AppState["adminSettings"] | undefined) ?? {
        password: "0000",
        isCustomized: false,
        updatedAt: new Date(0).toISOString(),
      },
    };
  }

  async writeWholeState(state: AppState): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;

    await Promise.all([
      setDoc(doc(db, "app_meta", "state"), { schemaVersion: state.schemaVersion, updatedAt: serverTimestamp() }, { merge: true }),
      setDoc(doc(db, "equipments", "list"), { items: state.equipments, updatedAt: serverTimestamp() }, { merge: true }),
      setDoc(doc(db, "loans", "transactions"), { items: state.transactions, updatedAt: serverTimestamp() }, { merge: true }),
      setDoc(doc(db, "settings", "admin"), state.adminSettings, { merge: true }),
    ]);
  }
}
