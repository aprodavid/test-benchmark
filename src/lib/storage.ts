import { ADMIN_DEFAULT_PASSWORD } from "@/config/security";
import { appStorageService } from "@/storage/service";
import { BorrowTransaction, Equipment } from "@/types/app";

export const DEFAULT_ADMIN_PASSWORD = ADMIN_DEFAULT_PASSWORD;

export async function loadAppState() {
  return appStorageService.loadState();
}

export function subscribeAppState(params: {
  onData: (state: Awaited<ReturnType<typeof loadAppState>>) => void;
  onError?: (error: Error) => void;
  onEmpty?: () => void;
}) {
  return appStorageService.subscribeAppState(params);
}

export async function getStorageDiagnostics() {
  return appStorageService.getDiagnostics();
}

export async function importLegacyLocalDataToFirestore() {
  await appStorageService.importLegacyLocalDataToFirestore();
}

export async function seedDefaultsIfFirestoreEmpty() {
  await appStorageService.seedDefaultsIfFirestoreEmpty();
}

export async function forceReseedDefaultsToFirestore() {
  await appStorageService.forceReseedDefaultsToFirestore();
}

export async function getEquipments(_initial?: Equipment[]) {
  return appStorageService.getEquipments();
}

export async function setEquipments(next: Equipment[]) {
  await appStorageService.setEquipments(next);
}

export async function resetEquipmentsToDefault() {
  await appStorageService.resetEquipmentsToDefault();
}

export async function getTransactions() {
  return appStorageService.getTransactions();
}

export async function setTransactions(next: BorrowTransaction[]) {
  await appStorageService.setTransactions(next);
}

export async function getAdminPassword() {
  return (await appStorageService.getAdminSettings()).password;
}

export async function isAdminPasswordCustomized() {
  return (await appStorageService.getAdminSettings()).isCustomized;
}

export async function setAdminPassword(next: string) {
  await appStorageService.setAdminPassword(next);
}
