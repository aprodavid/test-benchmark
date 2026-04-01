import { EquipmentItem, LoanReservation } from "@/types/app";

export type AdminSettings = {
  password: string;
  isCustomized: boolean;
  updatedAt: string;
};

export type AppState = {
  schemaVersion: number;
  items: EquipmentItem[];
  reservations: LoanReservation[];
  adminSettings: AdminSettings;
};
