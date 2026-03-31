import { ADMIN_DEFAULT_PASSWORD } from "@/config/security";
import { appStorageService } from "@/storage/service";
import { BorrowTransaction, Equipment } from "@/types/app";

export const DEFAULT_ADMIN_PASSWORD = ADMIN_DEFAULT_PASSWORD;

export function getEquipments(_initial?: Equipment[]) {
  return appStorageService.getEquipments();
}

export function setEquipments(next: Equipment[]) {
  appStorageService.setEquipments(next);
}

export function resetEquipmentsToDefault() {
  appStorageService.resetEquipmentsToDefault();
}

export function getTransactions() {
  return appStorageService.getTransactions();
}

export function setTransactions(next: BorrowTransaction[]) {
  appStorageService.setTransactions(next);
}

export function getAdminPassword() {
  return appStorageService.getAdminSettings().password;
}

export function isAdminPasswordCustomized() {
  return appStorageService.getAdminSettings().isCustomized;
}

export function setAdminPassword(next: string) {
  appStorageService.setAdminPassword(next);
}
