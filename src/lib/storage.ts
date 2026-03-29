import { BorrowTransaction, Equipment } from "@/types/app";

const KEY_EQUIPMENTS = "tb.equipments";
const KEY_TRANSACTIONS = "tb.transactions";
const KEY_ADMIN_PASSWORD = "tb.adminPassword";

export const DEFAULT_ADMIN_PASSWORD = "0000";

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getEquipments(initial: Equipment[]) {
  return readJson(KEY_EQUIPMENTS, initial);
}

export function setEquipments(next: Equipment[]) {
  writeJson(KEY_EQUIPMENTS, next);
}

export function getTransactions() {
  return readJson<BorrowTransaction[]>(KEY_TRANSACTIONS, []);
}

export function setTransactions(next: BorrowTransaction[]) {
  writeJson(KEY_TRANSACTIONS, next);
}

export function getAdminPassword() {
  return readJson(KEY_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD);
}

export function setAdminPassword(next: string) {
  writeJson(KEY_ADMIN_PASSWORD, next);
}
