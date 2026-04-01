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
    equipments: sanitizeEquipments((itemsSnap.data()?.items as Equipment[] | undefined) ?? fallback.equipments),
    transactions: normalizeTransactions((loansSnap.data()?.items as BorrowTransaction[] | undefined) ?? []),
    adminSettings: {
      ...fallback.adminSettings,
      ...(adminSnap.data() as AdminSettings | undefined),
      updatedAt: toIsoString(adminSnap.data()?.updatedAt),
    },
  };
}

async function writeStateToFirestore(state: AppState, source: "app" | "seed") {
  const db = getFirestoreDb();

  await withWriteTimeout(Promise.all([
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
  ]), "Firestore 저장");
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
    equipments: sanitizeEquipments((bundle.items?.items as Equipment[] | undefined) ?? fallback.equipments),
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
};

export type FirestoreStateAudit = {
  schemaVersion: number;
  equipmentCount: number;
  borrowedCount: number;
  returnedCount: number;
  activeBorrowByEquipment: Array<{ equipmentId: string; name: string; borrowedQuantity: number }>;
  suspectedTestLoanCount: number;
  hasBrokenEmoji: boolean;
};

const DEFAULT_EMOJI_BY_ID: Record<string, string> = Object.fromEntries(
  DEFAULT_EQUIPMENTS.map((equipment) => [equipment.id, equipment.emoji]),
);

const WRITE_TIMEOUT_MS = 10_000;

function withWriteTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} 요청이 제한 시간(10초)을 초과했습니다. 네트워크 연결을 확인해주세요.`));
      }, WRITE_TIMEOUT_MS);
    }),
  ]);
}

function sanitizeEmoji(rawEmoji: unknown, equipmentId: string): string {
  const fallback = DEFAULT_EMOJI_BY_ID[equipmentId] ?? "📦";
  if (typeof rawEmoji !== "string") return fallback;
  const normalized = rawEmoji.trim();
  if (!normalized || normalized.includes("�")) return fallback;
  return normalized;
}

function sanitizeEquipments(input: Equipment[]): Equipment[] {
  return input.map((equipment) => ({
    ...equipment,
    emoji: sanitizeEmoji(equipment.emoji, equipment.id),
    totalQuantity: Math.max(1, Number(equipment.totalQuantity) || 1),
    isQuantityTracked: Boolean(equipment.isQuantityTracked),
  }));
}

function isLikelyTestLoan(loan: BorrowTransaction) {
  const text = `${loan.borrowerName} ${loan.equipmentName}`.toLowerCase();
  return ["test", "테스트", "sample", "샘플", "dummy", "qa", "debug"].some((keyword) => text.includes(keyword));
}

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

      return {
        isConnected: true,
        isFirestoreEmpty: !firestoreState,
      };
    } catch {
      return {
        isConnected: false,
        isFirestoreEmpty: true,
      };
    }
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
    await this.patchState((state) => ({ ...state, equipments: sanitizeEquipments(equipments) }));
  }

  async resetEquipmentsToDefault() {
    const clonedDefaultEquipments = DEFAULT_EQUIPMENTS.map((equipment) => ({ ...equipment }));
    await this.patchState((state) => ({
      ...state,
      equipments: clonedDefaultEquipments,
      transactions: [],
    }));
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

  async clearAllLoans() {
    await this.patchState((state) => ({
      ...state,
      transactions: [],
    }));
  }

  async clearTestLoans() {
    await this.patchState((state) => ({
      ...state,
      transactions: state.transactions.filter((tx) => !isLikelyTestLoan(tx)),
    }));
  }

  async auditFirestoreState(): Promise<FirestoreStateAudit> {
    const state = await this.loadState();
    const borrowed = state.transactions.filter((tx) => tx.status === "borrowed");
    const returned = state.transactions.filter((tx) => tx.status === "returned");
    const borrowedMap = new Map<string, { equipmentId: string; name: string; borrowedQuantity: number }>();

    for (const loan of borrowed) {
      const current = borrowedMap.get(loan.equipmentId);
      if (current) {
        current.borrowedQuantity += loan.borrowedQuantity;
      } else {
        borrowedMap.set(loan.equipmentId, {
          equipmentId: loan.equipmentId,
          name: loan.equipmentName,
          borrowedQuantity: loan.borrowedQuantity,
        });
      }
    }

    return {
      schemaVersion: state.schemaVersion,
      equipmentCount: state.equipments.length,
      borrowedCount: borrowed.length,
      returnedCount: returned.length,
      activeBorrowByEquipment: [...borrowedMap.values()].sort((a, b) => b.borrowedQuantity - a.borrowedQuantity),
      suspectedTestLoanCount: state.transactions.filter((tx) => isLikelyTestLoan(tx)).length,
      hasBrokenEmoji: state.equipments.some((equipment) => equipment.emoji.includes("�")),
    };
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
