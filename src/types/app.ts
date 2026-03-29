export type Screen =
  | "home"
  | "borrow_select"
  | "borrow_qty"
  | "borrow_user"
  | "return_select"
  | "admin_home"
  | "admin_equipments"
  | "admin_history"
  | "admin_settings";

export type BorrowerMode = "select" | "manual";

export type Equipment = {
  id: string;
  name: string;
  emoji: string;
  totalQuantity: number;
  isQuantityTracked: boolean;
};

export type TransactionStatus = "borrowed" | "returned";

export type BorrowTransaction = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  borrowedQuantity: number;
  borrowerName: string;
  status: TransactionStatus;
  timestamp: number;
};
