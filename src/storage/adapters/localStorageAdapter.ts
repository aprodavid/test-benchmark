import { StorageAdapter } from "@/storage/types";

export class LocalStorageAdapter implements StorageAdapter {
  read<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}
