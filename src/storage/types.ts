import { BorrowTransaction, Equipment } from "@/types/app";

export type AdminSettings = {
  password: string;
  isCustomized: boolean;
  updatedAt: string;
};

export type AppState = {
  schemaVersion: number;
  equipments: Equipment[];
  transactions: BorrowTransaction[];
  adminSettings: AdminSettings;
};
