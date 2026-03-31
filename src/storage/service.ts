import { ADMIN_DEFAULT_PASSWORD } from "@/config/security";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import { getFirebaseDb } from "@/lib/firebase";
import { LocalStorageAdapter } from "@/storage/adapters/localStorageAdapter";
import { AdminSettings, AppState } from "@/storage/types";
import { BorrowTransaction, Equipment } from "@/types/app";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const STORAGE_KEY = "tb.appState.v1";
const LEGACY_KEY_EQUIPMENTS = "tb.equipments";
const LEGACY_KEY_TRANSACTIONS = "tb.transactions";
const LEGACY_KEY_ADMIN_PASSWORD = "tb.adminPassword";
const MIGRATION_BACKUP_KEY = "tb.firestoreMigrationBackup.v1";

const defaultAdminSettings: AdminSettings = {
  password: ADMIN_DEFAULT_PASSWORD,
  isCustomized: false,
  updatedAt: new Date(0).toISOString(),
};

function defaultState(): AppState {
  return {
    schemaVersion: 1,
    equipments: DEFAULT_EQUIPMENTS,
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

function migrateFromLegacyLocalStorage(adapter: LocalStorageAdapter): AppState {
  const fallback = defaultState();
  const equipments = adapter.read<Equipment[]>(LEGACY_KEY_EQUIPMENTS, fallback.equipments);
  const transactions = normalizeTransactions(adapter.read<BorrowTransaction[]>(LEGACY_KEY_TRANSACTIONS, []));
  const customPassword = adapter.read<string | null>(LEGACY_KEY_ADMIN_PASSWORD, null);

  return {
    schemaVersion: 1,
    equipments,
    transactions,
    adminSettings: {
      password: customPassword ?? ADMIN_DEFAULT_PASSWORD,
      isCustomized: typeof customPassword === "string" && customPassword.length > 0,
      updatedAt: customPassword ? new Date().toISOString() : new Date(0).toISOString(),
    },
  };
}

async function readFromFirestore(): Promise<AppState | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const [metaSnap, equipmentSnap, transactionSnap, adminSnap] = await Promise.all([
      getDoc(doc(db, "app_meta", "state")),
      getDoc(doc(db, "equipments", "list")),
      getDoc(doc(db, "loans", "transactions")),
      getDoc(doc(db, "settings", "admin")),
    ]);

    if (!metaSnap.exists() && !equipmentSnap.exists() && !transactionSnap.exists() && !adminSnap.exists()) {
      return null;
    }

    const fallback = defaultState();
    const schemaVersion = (metaSnap.data()?.schemaVersion as number | undefined) ?? 1;
    const equipments = (equipmentSnap.data()?.items as Equipment[] | undefined) ?? fallback.equipments;
    const transactions = normalizeTransactions((transactionSnap.data()?.items as BorrowTransaction[] | undefined) ?? []);
    const adminSettings = (adminSnap.data() as AdminSettings | undefined) ?? fallback.adminSettings;

    return {
      schemaVersion,
      equipments,
      transactions,
      adminSettings,
    };
  } catch (error) {
    console.warn("[storage] Firestore read failed. Falling back to localStorage.", error);
    return null;
  }
}

async function writeToFirestore(state: AppState, migratedFromLocalStorage: boolean): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    await Promise.all([
      setDoc(doc(db, "app_meta", "state"), {
        schemaVersion: state.schemaVersion,
        updatedAt: serverTimestamp(),
        migratedFromLocalStorage,
      }, { merge: true }),
      setDoc(doc(db, "equipments", "list"), {
        items: state.equipments,
        updatedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, "loans", "transactions"), {
        items: state.transactions,
        updatedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, "settings", "admin"), {
        ...state.adminSettings,
        updatedAt: state.adminSettings.updatedAt,
      }, { merge: true }),
    ]);

    return true;
  } catch (error) {
    console.warn("[storage] Firestore write failed. Local backup is still updated.", error);
    return false;
  }
}

export class AppStorageService {
  private readonly local = new LocalStorageAdapter();

  private readLocalState(): AppState | null {
    const state = this.local.read<AppState | null>(STORAGE_KEY, null);
    if (!state) return null;

    return {
      ...state,
      transactions: normalizeTransactions(state.transactions ?? []),
    };
  }

  private writeLocalState(next: AppState) {
    this.local.write(STORAGE_KEY, next);
  }

  async loadState(): Promise<AppState> {
    const firestoreState = await readFromFirestore();
    if (firestoreState) {
      this.writeLocalState(firestoreState);
      return firestoreState;
    }

    const localState = this.readLocalState();
    if (localState) {
      await writeToFirestore(localState, false);
      return localState;
    }

    const migrated = migrateFromLegacyLocalStorage(this.local);
    this.local.write(MIGRATION_BACKUP_KEY, migrated);
    this.writeLocalState(migrated);
    await writeToFirestore(migrated, true);

    return migrated;
  }

  private async patchState(mutator: (state: AppState) => AppState) {
    const current = await this.loadState();
    const next = mutator(current);

    this.writeLocalState(next);
    await writeToFirestore(next, false);

    return next;
  }

  async getEquipments() {
    return (await this.loadState()).equipments;
  }

  async setEquipments(equipments: Equipment[]) {
    await this.patchState((state) => ({ ...state, equipments }));
  }

  async resetEquipmentsToDefault() {
    await this.patchState((state) => ({ ...state, equipments: DEFAULT_EQUIPMENTS }));
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
