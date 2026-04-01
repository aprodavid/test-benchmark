import { ADMIN_DEFAULT_PASSWORD } from "@/config/security";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import { getFirestoreDb } from "@/lib/firestore";
import { AdminSettings, AppState } from "@/storage/types";
import { EquipmentItem, LoanReservation } from "@/types/app";
import {
  DocumentData,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";

const META_DOC = { col: "meta", id: "app" };
const ITEMS_DOC = { col: "items", id: "master" };
const RESERVATIONS_DOC = { col: "reservations", id: "records" };
const ADMIN_SETTINGS_DOC = { col: "settings", id: "adminSettings" };
const LEGACY_LOANS_DOC = { col: "loans", id: "records" };

const defaultAdminSettings: AdminSettings = {
  password: ADMIN_DEFAULT_PASSWORD,
  isCustomized: false,
  updatedAt: new Date(0).toISOString(),
};

function defaultState(): AppState {
  return {
    schemaVersion: 3,
    items: DEFAULT_EQUIPMENTS.map((item) => ({ ...item })),
    reservations: [],
    adminSettings: defaultAdminSettings,
  };
}

function toIsoString(input: unknown): string {
  if (!input) return new Date(0).toISOString();
  if (typeof input === "string") return input;
  if (input instanceof Timestamp) return input.toDate().toISOString();
  if (input instanceof Date) return input.toISOString();
  return new Date(0).toISOString();
}

const DEFAULT_EMOJI_BY_ID: Record<string, string> = Object.fromEntries(
  DEFAULT_EQUIPMENTS.map((item) => [item.id, item.emoji]),
);

function sanitizeEmoji(rawEmoji: unknown, itemId: string): string {
  const fallback = DEFAULT_EMOJI_BY_ID[itemId] ?? "📦";
  if (typeof rawEmoji !== "string") return fallback;
  const trimmed = rawEmoji.trim();
  if (!trimmed || trimmed.includes("�")) return fallback;
  return trimmed;
}

function sanitizeItems(input: EquipmentItem[]): EquipmentItem[] {
  return input.map((item) => ({
    ...item,
    emoji: sanitizeEmoji(item.emoji, item.id),
    totalQuantity: Math.max(1, Number(item.totalQuantity) || 1),
  }));
}

function sanitizeReservations(input: LoanReservation[]): LoanReservation[] {
  return input
    .filter((row) => row && row.itemId && row.startAt && row.endAt)
    .map((row) => ({
      ...row,
      quantity: Math.max(1, Number(row.quantity) || 1),
      note: row.note?.trim() ? row.note.trim() : "",
      createdAt: toIsoString(row.createdAt),
      startAt: toIsoString(row.startAt),
      endAt: toIsoString(row.endAt),
      actualReturnedAt: row.actualReturnedAt ? toIsoString(row.actualReturnedAt) : undefined,
      returnMode: row.returnMode === "forced" ? "forced" : row.returnMode === "auto" ? "auto" : undefined,
      returnedByAdmin: row.returnedByAdmin?.trim() ? row.returnedByAdmin.trim() : undefined,
      returnNote: row.returnNote?.trim() ? row.returnNote.trim() : undefined,
    }));
}

function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return null as T;
  if (value === null) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForFirestore(entry)) as T;
  }
  if (value instanceof Date || value instanceof Timestamp) {
    return value;
  }
  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
      if (raw === undefined) return;
      next[key] = sanitizeForFirestore(raw);
    });
    return next as T;
  }
  return value;
}

async function readStateFromFirestore(): Promise<AppState | null> {
  const db = getFirestoreDb();
  const [metaSnap, itemsSnap, reservationsSnap, adminSnap] = await Promise.all([
    getDoc(doc(db, META_DOC.col, META_DOC.id)),
    getDoc(doc(db, ITEMS_DOC.col, ITEMS_DOC.id)),
    getDoc(doc(db, RESERVATIONS_DOC.col, RESERVATIONS_DOC.id)),
    getDoc(doc(db, ADMIN_SETTINGS_DOC.col, ADMIN_SETTINGS_DOC.id)),
  ]);

  if (!metaSnap.exists() && !itemsSnap.exists() && !reservationsSnap.exists() && !adminSnap.exists()) {
    return null;
  }

  const fallback = defaultState();
  return {
    schemaVersion: (metaSnap.data()?.schemaVersion as number | undefined) ?? 3,
    items: sanitizeItems((itemsSnap.data()?.items as EquipmentItem[] | undefined) ?? fallback.items),
    reservations: sanitizeReservations((reservationsSnap.data()?.items as LoanReservation[] | undefined) ?? []),
    adminSettings: {
      ...fallback.adminSettings,
      ...(adminSnap.data() as AdminSettings | undefined),
      updatedAt: toIsoString(adminSnap.data()?.updatedAt),
    },
  };
}

async function writeStateToFirestore(state: AppState, source: "app" | "seed") {
  const db = getFirestoreDb();
  const cleanReservations = sanitizeForFirestore(sanitizeReservations(state.reservations));
  const cleanItems = sanitizeForFirestore(sanitizeItems(state.items));
  const cleanAdminSettings = sanitizeForFirestore({
    ...defaultAdminSettings,
    ...state.adminSettings,
    password: state.adminSettings.password || ADMIN_DEFAULT_PASSWORD,
    updatedAt: state.adminSettings.updatedAt || new Date().toISOString(),
  });
  await Promise.all([
    setDoc(doc(db, META_DOC.col, META_DOC.id), { schemaVersion: 3, source, updatedAt: serverTimestamp() }, { merge: true }),
    setDoc(doc(db, ITEMS_DOC.col, ITEMS_DOC.id), { items: cleanItems, updatedAt: serverTimestamp() }, { merge: true }),
    setDoc(doc(db, RESERVATIONS_DOC.col, RESERVATIONS_DOC.id), { items: cleanReservations, updatedAt: serverTimestamp() }, { merge: true }),
    setDoc(doc(db, ADMIN_SETTINGS_DOC.col, ADMIN_SETTINGS_DOC.id), cleanAdminSettings, { merge: true }),
  ]);
}

type SnapshotBundle = { meta: DocumentData | null; items: DocumentData | null; reservations: DocumentData | null; admin: DocumentData | null };

function parseBundle(bundle: SnapshotBundle): AppState | null {
  if (!bundle.meta && !bundle.items && !bundle.reservations && !bundle.admin) return null;
  const fallback = defaultState();
  return {
    schemaVersion: (bundle.meta?.schemaVersion as number | undefined) ?? 3,
    items: sanitizeItems((bundle.items?.items as EquipmentItem[] | undefined) ?? fallback.items),
    reservations: sanitizeReservations((bundle.reservations?.items as LoanReservation[] | undefined) ?? []),
    adminSettings: {
      ...fallback.adminSettings,
      ...(bundle.admin as AdminSettings | undefined),
      updatedAt: toIsoString(bundle.admin?.updatedAt),
    },
  };
}

export type FirestoreDiagnostics = { isConnected: boolean; isFirestoreEmpty: boolean };

export type InventorySummary = {
  itemId: string;
  itemName: string;
  totalQuantity: number;
  activeQuantity: number;
  availableQuantity: number;
  latestPlace: string;
};

export type LegacyCleanupResult = {
  removedReservationCount: number;
  removedLegacyLoanCount: number;
  reason: string;
};

export class AppStorageService {
  async loadState(): Promise<AppState> {
    return (await readStateFromFirestore()) ?? defaultState();
  }

  subscribeAppState(handlers: { onData: (state: AppState) => void; onError?: (error: Error) => void; onEmpty?: () => void }): Unsubscribe {
    const db = getFirestoreDb();
    const bundle: SnapshotBundle = { meta: null, items: null, reservations: null, admin: null };
    const push = () => {
      const parsed = parseBundle(bundle);
      if (parsed) handlers.onData(parsed);
      else handlers.onEmpty?.();
    };

    const watchers = [
      onSnapshot(doc(db, META_DOC.col, META_DOC.id), (snap) => { bundle.meta = snap.exists() ? snap.data() : null; push(); }, (e) => handlers.onError?.(e as Error)),
      onSnapshot(doc(db, ITEMS_DOC.col, ITEMS_DOC.id), (snap) => { bundle.items = snap.exists() ? snap.data() : null; push(); }, (e) => handlers.onError?.(e as Error)),
      onSnapshot(doc(db, RESERVATIONS_DOC.col, RESERVATIONS_DOC.id), (snap) => { bundle.reservations = snap.exists() ? snap.data() : null; push(); }, (e) => handlers.onError?.(e as Error)),
      onSnapshot(doc(db, ADMIN_SETTINGS_DOC.col, ADMIN_SETTINGS_DOC.id), (snap) => { bundle.admin = snap.exists() ? snap.data() : null; push(); }, (e) => handlers.onError?.(e as Error)),
    ];

    return () => watchers.forEach((off) => off());
  }

  private async patchState(mutator: (state: AppState) => AppState) {
    const current = await this.loadState();
    await writeStateToFirestore(mutator(current), "app");
  }

  async getDiagnostics(): Promise<FirestoreDiagnostics> {
    try {
      const state = await readStateFromFirestore();
      return { isConnected: true, isFirestoreEmpty: !state };
    } catch {
      return { isConnected: false, isFirestoreEmpty: true };
    }
  }

  async seedDefaultsIfFirestoreEmpty() {
    const d = await this.getDiagnostics();
    if (!d.isConnected) throw new Error("Firestore 연결 오류");
    if (!d.isFirestoreEmpty) return;
    await writeStateToFirestore(defaultState(), "seed");
  }

  async forceReseedDefaultsToFirestore() {
    const state = await this.loadState();
    await writeStateToFirestore({ ...state, schemaVersion: 3, items: DEFAULT_EQUIPMENTS.map((item) => ({ ...item })) }, "seed");
    return { itemCount: DEFAULT_EQUIPMENTS.length };
  }

  async cleanupLegacyLoanData(): Promise<LegacyCleanupResult> {
    const db = getFirestoreDb();
    const state = await this.loadState();
    const itemIds = new Set(state.items.map((item) => item.id));

    const legacyRegex = /(test|테스트|legacy|샘플|sample)/i;
    const nextReservations = state.reservations.filter((row) => {
      const hasUnknownItem = !itemIds.has(row.itemId);
      const flaggedAsLegacy = legacyRegex.test(`${row.place} ${row.responsiblePerson} ${row.note ?? ""}`);
      const isVeryOld = new Date(row.createdAt).getUTCFullYear() < 2025;
      return !(hasUnknownItem || flaggedAsLegacy || isVeryOld);
    });

    const removedReservationCount = state.reservations.length - nextReservations.length;
    if (removedReservationCount > 0) {
      await this.setReservations(nextReservations);
    }

    const legacyLoanColSnap = await getDocs(collection(db, LEGACY_LOANS_DOC.col));
    const legacyLoanDeletes = legacyLoanColSnap.docs.map(async (snap) => {
      const data = snap.data();
      if (snap.id === LEGACY_LOANS_DOC.id) {
        await setDoc(doc(db, LEGACY_LOANS_DOC.col, LEGACY_LOANS_DOC.id), {
          items: [],
          archivedAt: serverTimestamp(),
          note: "legacy loans cleared after schedule-reservation migration",
        }, { merge: true });
        return 0;
      }
      if (!legacyRegex.test(snap.id) && !legacyRegex.test(JSON.stringify(data))) {
        return 0;
      }
      await deleteDoc(doc(db, LEGACY_LOANS_DOC.col, snap.id));
      return 1;
    });
    const removedLegacyLoanCount = (await Promise.all(legacyLoanDeletes)).reduce<number>((sum, count) => sum + count, 0);
    return {
      removedReservationCount,
      removedLegacyLoanCount,
      reason: "unknown-item/test/legacy/old reservations and legacy loan docs",
    };
  }

  async initializeBaseData() {
    const current = await this.loadState();
    const normalized = {
      ...defaultState(),
      ...current,
      schemaVersion: 3,
      items: sanitizeItems(current.items?.length ? current.items : DEFAULT_EQUIPMENTS),
      reservations: sanitizeReservations(current.reservations ?? []),
      adminSettings: {
        ...defaultAdminSettings,
        ...current.adminSettings,
        password: current.adminSettings?.password || ADMIN_DEFAULT_PASSWORD,
        updatedAt: current.adminSettings?.updatedAt || new Date().toISOString(),
      },
    };
    await writeStateToFirestore(normalized, "seed");
    return {
      itemCount: normalized.items.length,
      reservationCount: normalized.reservations.length,
    };
  }

  async forceReturnReservation(reservationId: string) {
    const current = await this.loadState();
    const nowIso = new Date().toISOString();
    let found = false;
    const next = current.reservations.map((row) => {
      if (row.id !== reservationId) return row;
      found = true;
      return {
        ...row,
        actualReturnedAt: nowIso,
        returnMode: "forced" as const,
        returnedByAdmin: "admin",
        returnNote: row.returnNote ?? "관리자 강제 반납",
      };
    });
    if (!found) throw new Error("강제 반납 대상 예약을 찾지 못했습니다.");
    await this.setReservations(next);
    return { updatedReservationId: reservationId };
  }

  async getItems() { return (await this.loadState()).items; }
  async setItems(items: EquipmentItem[]) { await this.patchState((s) => ({ ...s, items: sanitizeItems(items) })); }

  async getReservations() { return (await this.loadState()).reservations; }
  async setReservations(reservations: LoanReservation[]) {
    await this.patchState((s) => ({ ...s, reservations: sanitizeReservations(reservations) }));
  }

  async getAdminSettings() { return (await this.loadState()).adminSettings; }
  async setAdminPassword(password: string) {
    await this.patchState((s) => ({ ...s, adminSettings: { password, isCustomized: true, updatedAt: new Date().toISOString() } }));
  }
}

export const appStorageService = new AppStorageService();
