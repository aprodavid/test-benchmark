import { ADMIN_DEFAULT_PASSWORD } from "@/config/security";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import { LocalStorageAdapter } from "@/storage/adapters/localStorageAdapter";
import { AdminSettings, AppState, StorageAdapter } from "@/storage/types";
import { BorrowTransaction, Equipment } from "@/types/app";

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

function migrateFromLegacy(adapter: StorageAdapter): AppState {
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

export class AppStorageService {
  constructor(private readonly adapter: StorageAdapter) {}

  private loadState(): AppState {
    const fallback = defaultState();
    const state = this.adapter.read<AppState | null>(STORAGE_KEY, null);
    if (state) {
      return {
        ...state,
        transactions: normalizeTransactions(state.transactions ?? []),
      };
    }

    const migrated = migrateFromLegacy(this.adapter);
    this.adapter.write(STORAGE_KEY, migrated);
    return migrated;
  }

  private saveState(next: AppState) {
    this.adapter.write(STORAGE_KEY, next);
  }

  getEquipments() {
    return this.loadState().equipments;
  }

  setEquipments(equipments: Equipment[]) {
    const state = this.loadState();
    this.saveState({ ...state, equipments });
  }

  resetEquipmentsToDefault() {
    const state = this.loadState();
    this.saveState({ ...state, equipments: DEFAULT_EQUIPMENTS });
  }

  getTransactions() {
    return this.loadState().transactions;
  }

  setTransactions(transactions: BorrowTransaction[]) {
    const state = this.loadState();
    this.saveState({ ...state, transactions: normalizeTransactions(transactions) });
  }

  getAdminSettings() {
    return this.loadState().adminSettings;
  }

  setAdminPassword(password: string) {
    const state = this.loadState();
    this.saveState({
      ...state,
      adminSettings: {
        password,
        isCustomized: true,
        updatedAt: new Date().toISOString(),
      },
    });
  }
}

export const appStorageService = new AppStorageService(new LocalStorageAdapter());
