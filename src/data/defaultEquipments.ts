import { Equipment } from "@/types/app";

export const DEFAULT_EQUIPMENTS: Equipment[] = [
  { id: "eq-basketball", name: "농구공", emoji: "🏀", totalQuantity: 15, isQuantityTracked: true },
  { id: "eq-soccer", name: "축구공", emoji: "⚽", totalQuantity: 12, isQuantityTracked: true },
  { id: "eq-volleyball", name: "배구공", emoji: "🏐", totalQuantity: 10, isQuantityTracked: true },
  { id: "eq-vault", name: "뜀틀 세트", emoji: "🤸", totalQuantity: 2, isQuantityTracked: false },
  { id: "eq-jumprope", name: "줄넘기", emoji: "➰", totalQuantity: 30, isQuantityTracked: true },
  { id: "eq-vest", name: "팀 조끼 (세트)", emoji: "🎽", totalQuantity: 4, isQuantityTracked: true }
];
