import { ADMIN_DEFAULT_PASSWORD } from "@/config/security";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import { getFirestoreDb } from "@/lib/firestore";
import { AdminSettings, AppState } from "@/storage/types";
import { BorrowTransaction, Equipment } from "@/types/app";
import {
  DocumentData,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";

const META_DOC = { col: "meta", id: "app" };
const ITEMS_DOC = { col: "items", id: "master" };
const LOANS_DOC = { col: "loans", id: "records" };
const ADMIN_SETTINGS_DOC = { col: "settings", id: "adminSettings" };

const STORAGE_KEY = "tb.appState.v1";
const LEGACY_KEY_EQUIPMENTS = "tb.equipments";
const LEGACY_KEY_TRANSACTIONS = "tb.transactions";
const LEGACY_KEY_ADMIN_PASSWORD = "tb.adminPassword";

const defaultAdminSettings: AdminSettings = {
  password: ADMIN_DEFAULT_PASSWORD,
  isCustomized: false,
  updatedAt: new Date(0).toISOString(),
};

function defaultState(): AppState {
  const clonedDefaultEquipments = DEFAULT_EQUIPMENTS.map((equipment) => ({ ...equipment }));

  return {
    schemaVersion: 2,
    equipments: clonedDefaultEquipments,
    transactions: [],
    adminSettings: defaultAdminSettings,
  };
}

function normalizeTransactions(transactions: BorrowTransaction[]) {
  return transactions.map((tx) => ({
    ...tx,
    borrowPin: typeof tx.borrowPin === "string" ? tx.borrowPin : undefined,
  }));
}

function toIsoString(input: unknown): string {
  if (!input) return new Date(0).toISOString();
  if (typeof input === "string") return input;
  if (input instanceof Timestamp) return input.toDate().toISOString();
  if (input instanceof Date) return input.toISOString();
  return new Date(0).toISOString();
}

function readLegacyLocalStorage(): AppState | null {
  if (typeof window === "undefined") return null;

  const readJson = <T>(key: string, fallback: T): T => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const fromSnapshot = readJson<AppState | null>(STORAGE_KEY, null);
  if (fromSnapshot) {
    return {
      ...fromSnapshot,
      schemaVersion: 2,
      transactions: normalizeTransactions(fromSnapshot.transactions ?? []),
      adminSettings: {
        ...defaultAdminSettings,
        ...(fromSnapshot.adminSettings ?? {}),
        updatedAt: toIsoString(fromSnapshot.adminSettings?.updatedAt),
      },
    };
  }

  const equipments = readJson<Equipment[]>(LEGACY_KEY_EQUIPMENTS, []);
  const transactions = normalizeTransactions(readJson<BorrowTransaction[]>(LEGACY_KEY_TRANSACTIONS, []));
  const customPassword = readJson<string | null>(LEGACY_KEY_ADMIN_PASSWORD, null);

  if (equipments.length === 0 && transactions.length === 0 && !customPassword) {
    return null;
  }

  return {
    schemaVersion: 2,
    equipments: equipments.length > 0 ? equipments : DEFAULT_EQUIPMENTS,
    transactions,
    adminSettings: {
      password: customPassword ?? ADMIN_DEFAULT_PASSWORD,
      isCustomized: Boolean(customPassword),
      updatedAt: customPassword ? new Date().toISOString() : new Date(0).toISOString(),
    },
  };
}

async function readStateFromFirestore(): Promise<AppState | null> {
  const db = getFirestoreDb();
  const [metaSnap, itemsSnap, loansSnap, adminSnap] = await Promise.all([
    getDoc(doc(db, META_DOC.col, META_DOC.id)),
    getDoc(doc(db, ITEMS_DOC.col, ITEMS_DOC.id)),
    getDoc(doc(db, LOANS_DOC.col, LOANS_DOC.id)),
    getDoc(doc(db, ADMIN_SETTINGS_DOC.col, ADMIN_SETTINGS_DOC.id)),
  ]);

  if (!metaSnap.exists() && !itemsSnap.exists() && !loansSnap.exists() && !adminSnap.exists()) {
    return null;
  }

  const fallback = defaultState();

  return {
    schemaVersion: (metaSnap.data()?.schemaVersion as number | undefined) ?? 2,
    equipments: (itemsSnap.data()?.items as Equipment[] | undefined) ?? fallback.equipments,
    transactions: normalizeTransactions((loansSnap.data()?.items as BorrowTransaction[] | undefined) ?? []),
    adminSettings: {
      ...fallback.adminSettings,
      ...(adminSnap.data() as AdminSettings | undefined),
      updatedAt: toIsoString(adminSnap.data()?.updatedAt),
    },
  };
}

async function writeStateToFirestore(state: AppState, source: "app" | "migration" | "seed") {
  const db = getFirestoreDb();

  await Promise.all([
    setDoc(doc(db, META_DOC.col, META_DOC.id), {
      schemaVersion: state.schemaVersion,
      source,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
    setDoc(doc(db, ITEMS_DOC.col, ITEMS_DOC.id), {
      items: state.equipments,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
    setDoc(doc(db, LOANS_DOC.col, LOANS_DOC.id), {
      items: state.transactions,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
    setDoc(doc(db, ADMIN_SETTINGS_DOC.col, ADMIN_SETTINGS_DOC.id), {
      ...state.adminSettings,
      updatedAt: state.adminSettings.updatedAt,
    }, { merge: true }),
  ]);
}

type SnapshotBundle = {
  meta: DocumentData | null;
  items: DocumentData | null;
  loans: DocumentData | null;
  admin: DocumentData | null;
};

function parseSnapshotBundle(bundle: SnapshotBundle): AppState | null {
  if (!bundle.meta && !bundle.items && !bundle.loans && !bundle.admin) {
    return null;
  }

  const fallback = defaultState();
  return {
    schemaVersion: (bundle.meta?.schemaVersion as number | undefined) ?? 2,
    equipments: (bundle.items?.items as Equipment[] | undefined) ?? fallback.equipments,
    transactions: normalizeTransactions((bundle.loans?.items as BorrowTransaction[] | undefined) ?? []),
    adminSettings: {
      ...fallback.adminSettings,
      ...(bundle.admin as AdminSettings | undefined),
      updatedAt: toIsoString(bundle.admin?.updatedAt),
    },
  };
}

export type FirestoreDiagnostics = {
  isConnected: boolean;
  isFirestoreEmpty: boolean;
  canImportLegacyLocalData: boolean;
};

export class AppStorageService {
  async loadState(): Promise<AppState> {
    const firestoreState = await readStateFromFirestore();
    if (!firestoreState) {
      return defaultState();
    }

    return firestoreState;
  }

  subscribeAppState(handlers: {
    onData: (state: AppState) => void;
    onError?: (error: Error) => void;
    onEmpty?: () => void;
  }): Unsubscribe {
    const db = getFirestoreDb();
    const bundle: SnapshotBundle = { meta: null, items: null, loans: null, admin: null };

    const pushSnapshot = () => {
      const parsed = parseSnapshotBundle(bundle);
      if (parsed) {
        handlers.onData(parsed);
      } else {
        handlers.onEmpty?.();
      }
    };

    const watchers: Unsubscribe[] = [
      onSnapshot(doc(db, META_DOC.col, META_DOC.id), (snap) => {
        bundle.meta = snap.exists() ? snap.data() : null;
        pushSnapshot();
      }, (error) => handlers.onError?.(error as Error)),
      onSnapshot(doc(db, ITEMS_DOC.col, ITEMS_DOC.id), (snap) => {
        bundle.items = snap.exists() ? snap.data() : null;
        pushSnapshot();
      }, (error) => handlers.onError?.(error as Error)),
      onSnapshot(doc(db, LOANS_DOC.col, LOANS_DOC.id), (snap) => {
        bundle.loans = snap.exists() ? snap.data() : null;
        pushSnapshot();
      }, (error) => handlers.onError?.(error as Error)),
      onSnapshot(doc(db, ADMIN_SETTINGS_DOC.col, ADMIN_SETTINGS_DOC.id), (snap) => {
        bundle.admin = snap.exists() ? snap.data() : null;
        pushSnapshot();
      }, (error) => handlers.onError?.(error as Error)),
    ];

    return () => watchers.forEach((off) => off());
  }

  private async patchState(mutator: (state: AppState) => AppState) {
    const current = await this.loadState();
    const next = mutator(current);
    await writeStateToFirestore(next, "app");
  }

  async getDiagnostics(): Promise<FirestoreDiagnostics> {
    try {
      const firestoreState = await readStateFromFirestore();
      const legacyState = readLegacyLocalStorage();

      return {
        isConnected: true,
        isFirestoreEmpty: !firestoreState,
        canImportLegacyLocalData: !firestoreState && Boolean(legacyState),
      };
    } catch {
      return {
        isConnected: false,
        isFirestoreEmpty: true,
        canImportLegacyLocalData: false,
      };
    }
  }

  async importLegacyLocalDataToFirestore() {
    const diagnostics = await this.getDiagnostics();
    if (!diagnostics.isConnected) {
      throw new Error("Firebase 연결 오류로 가져오기를 진행할 수 없습니다.");
    }
    if (!diagnostics.isFirestoreEmpty) {
      throw new Error("Firestore에 이미 데이터가 있어 가져오기를 중단했습니다.");
    }

    const legacy = readLegacyLocalStorage();
    if (!legacy) {
      throw new Error("가져올 localStorage 데이터가 없습니다.");
    }

    await writeStateToFirestore(legacy, "migration");
  }

  async seedDefaultsIfFirestoreEmpty() {
    const diagnostics = await this.getDiagnostics();
    if (!diagnostics.isConnected) {
      throw new Error("Firebase 연결 오류로 초기 시드를 진행할 수 없습니다.");
    }
    if (!diagnostics.isFirestoreEmpty) {
      return;
    }

    await writeStateToFirestore(defaultState(), "seed");
  }

  async getEquipments() {
    return (await this.loadState()).equipments;
  }

  async setEquipments(equipments: Equipment[]) {
    await this.patchState((state) => ({ ...state, equipments }));
  }

  async resetEquipmentsToDefault() {
    const clonedDefaultEquipments = DEFAULT_EQUIPMENTS.map((equipment) => ({ ...equipment }));
    await this.patchState((state) => ({ ...state, equipments: clonedDefaultEquipments }));
  }

  async forceReseedDefaultsToFirestore() {
    const diagnostics = await this.getDiagnostics();
    if (!diagnostics.isConnected) {
      throw new Error("Firebase 연결 오류로 기본 시드를 진행할 수 없습니다.");
    }

    await writeStateToFirestore(defaultState(), "seed");
  }

  async getTransactions() {
    return (await this.loadState()).transactions;
  }

  async setTransactions(transactions: BorrowTransaction[]) {
    await this.patchState((state) => ({
      ...state,
      transactions: normalizeTransactions(transactions),
    }));
  }

  async getAdminSettings() {
    return (await this.loadState()).adminSettings;
  }

  async setAdminPassword(password: string) {
    await this.patchState((state) => ({
      ...state,
      adminSettings: {
        password,
        isCustomized: true,
        updatedAt: new Date().toISOString(),
      },
    }));
  }
}

export const appStorageService = new AppStorageService();
