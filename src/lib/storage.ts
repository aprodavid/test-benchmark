import { ADMIN_DEFAULT_PASSWORD } from "@/config/security";
import { appStorageService } from "@/storage/service";
import { EquipmentItem, LoanReservation } from "@/types/app";

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

export async function seedDefaultsIfFirestoreEmpty() {
  await appStorageService.seedDefaultsIfFirestoreEmpty();
}

export async function forceReseedDefaultsToFirestore() {
  return appStorageService.forceReseedDefaultsToFirestore();
}

export async function cleanupLegacyLoanData() {
  return appStorageService.cleanupLegacyLoanData();
}

export async function initializeBaseData() {
  return appStorageService.initializeBaseData();
}

export async function forceReturnReservation(reservationId: string) {
  return appStorageService.forceReturnReservation(reservationId);
}

export async function getItems() {
  return appStorageService.getItems();
}

export async function setItems(next: EquipmentItem[]) {
  await appStorageService.setItems(next);
}

export async function getReservations() {
  return appStorageService.getReservations();
}

export async function setReservations(next: LoanReservation[]) {
  await appStorageService.setReservations(next);
}

export async function getAdminPassword() {
  return (await appStorageService.getAdminSettings()).password;
}

export async function setAdminPassword(next: string) {
  await appStorageService.setAdminPassword(next);
}
