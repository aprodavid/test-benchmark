export type Screen =
  | "home"
  | "borrow"
  | "ledger"
  | "admin_auth"
  | "admin_home"
  | "admin_items"
  | "admin_settings";

export type EquipmentItem = {
  id: string;
  name: string;
  emoji: string;
  totalQuantity: number;
};

export type LoanReservation = {
  id: string;
  itemId: string;
  itemNameSnapshot: string;
  quantity: number;
  startAt: string;
  endAt: string;
  place: string;
  responsiblePerson: string;
  note?: string;
  createdAt: string;
};

export type ReservationStatus = "active" | "completed";

export type ReservationWithStatus = LoanReservation & {
  status: ReservationStatus;
};
