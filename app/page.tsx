"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { AdminCards, Container, Header, HomeCards } from "@/components/ui";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import {
  cleanupLegacyLoanData,
  DEFAULT_ADMIN_PASSWORD,
  forceReseedDefaultsToFirestore,
  forceReturnReservation,
  getStorageDiagnostics,
  initializeBaseData,
  loadAppState,
  setAdminPassword,
  setItems,
  setReservations,
  subscribeAppState,
} from "@/lib/storage";
import { EquipmentItem, LoanReservation, ReservationWithStatus, Screen } from "@/types/app";

const ICON_OPTIONS = ["📦", "🎹", "🥁", "🎼", "🔔", "🛎️", "🎶"];
const MUSIC_ROOM = "음악교구실";
const ICON_BY_ITEM_ID: Record<string, string> = {
  "eq-electronic-piano": "🎹",
  "eq-rhythm-set": "🥁",
  "eq-wood-block": "🥁",
  "eq-big-drum": "🥁",
  "eq-small-drum": "🥁",
  "eq-xylophone": "🎼",
  "eq-janggu": "🥁",
  "eq-samul-drum": "🥁",
  "eq-kkwaenggwari": "🔔",
  "eq-sogo": "🥁",
  "eq-music-stand": "🎼",
  "eq-steel-tongue-drum": "🛎️",
  "eq-kalimba": "🎶",
};

function toDateTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function toTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function combineDateTime(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText}:00`).toISOString();
}

function isOverlapped(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime();
}

function getPreferredEndAt(row: LoanReservation) {
  return row.actualReturnedAt ?? row.endAt;
}

function getReservationStatus(row: LoanReservation, currentTime: number): ReservationWithStatus["status"] {
  if (row.returnMode === "forced" && row.actualReturnedAt) return "forced_returned";
  if (new Date(row.startAt).getTime() > currentTime) return "scheduled";
  return new Date(getPreferredEndAt(row)).getTime() > currentTime ? "active" : "completed";
}

function getStableItemIcon(item: EquipmentItem): string {
  const normalized = item.emoji?.trim();
  if (normalized && !normalized.includes("�")) return normalized;
  return ICON_BY_ITEM_ID[item.id] ?? "📦";
}

function toActionErrorMessage(error: unknown, fallback: string) {
  const text = error instanceof Error ? error.message : String(error);
  if (/permission|denied|권한/i.test(text)) return `권한 오류: ${text} (Firestore Rules 확인 필요)`;
  return `${fallback}: ${text}`;
}

function IconBadge({ item }: { item: EquipmentItem }) {
  const icon = getStableItemIcon(item);
  const fallbackText = item.name.slice(0, 1);
  return (
    <span className="inline-flex min-w-8 items-center justify-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm">
      <span aria-hidden>{icon}</span>
      <span className="sr-only">{item.name}</span>
      <span className="text-[10px] font-bold text-gray-500">{fallbackText}</span>
    </span>
  );
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [items, setItemsState] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENTS);
  const [reservations, setReservationsState] = useState<LoanReservation[]>([]);
  const [adminPassword, setAdminPasswordState] = useState(DEFAULT_ADMIN_PASSWORD);
  const [storageStatus, setStorageStatus] = useState("Firestore 연결 확인 중...");
  const [storageErrorMessage, setStorageErrorMessage] = useState("");
  const [isFirestoreEmpty, setIsFirestoreEmpty] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date().getTime());
  const [isSubmittingBorrow, setIsSubmittingBorrow] = useState(false);
  const [borrowError, setBorrowError] = useState("");
  const [adminActionMessage, setAdminActionMessage] = useState("");
  const [adminActionError, setAdminActionError] = useState("");
  const [adminActionBusy, setAdminActionBusy] = useState("");

  const [adminAuthInput, setAdminAuthInput] = useState("");
  const [adminAuthError, setAdminAuthError] = useState("");

  const now = new Date();
  const [borrowForm, setBorrowForm] = useState({
    itemId: DEFAULT_EQUIPMENTS[0].id,
    quantity: 1,
    startDate: toInputDate(now),
    startTime: "09:00",
    endDate: toInputDate(now),
    endTime: "10:00",
    place: "",
    responsiblePerson: "",
    note: "",
  });

  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [newQuantity, setNewQuantity] = useState(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [scheduleView, setScheduleView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toInputDate(new Date()));

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const state = await loadAppState();
        if (!alive) return;
        setItemsState(state.items);
        setReservationsState(state.reservations);
        setAdminPasswordState(state.adminSettings.password);
        setStorageStatus("저장 위치: Firestore");
        const d = await getStorageDiagnostics();
        setIsFirestoreEmpty(d.isFirestoreEmpty);
      } catch (error) {
        console.error("loadAppState failed", error);
        if (!alive) return;
        setStorageStatus("Firebase 연결 오류");
        setStorageErrorMessage(toActionErrorMessage(error, "Firestore 연결을 확인해주세요"));
      }
    })();

    const unsub = subscribeAppState({
      onData: (state) => {
        if (!alive) return;
        setItemsState(state.items);
        setReservationsState(state.reservations);
        setAdminPasswordState(state.adminSettings.password);
        setStorageStatus("저장 위치: Firestore");
        setStorageErrorMessage("");
      },
      onError: (error) => {
        console.error("subscribeAppState failed", error);
        if (!alive) return;
        setStorageStatus("Firebase 연결 오류");
        setStorageErrorMessage(toActionErrorMessage(error, "실시간 동기화 오류"));
      },
      onEmpty: () => setIsFirestoreEmpty(true),
    });

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().getTime()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const reservationsWithStatus = useMemo<ReservationWithStatus[]>(() => {
    return reservations
      .map((row) => ({
        ...row,
        status: getReservationStatus(row, currentTime),
      }))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [reservations, currentTime]);

  const inventoryRows = useMemo(() => {
    return items.map((item) => {
      const activeRows = reservations.filter(
        (row) => row.itemId === item.id && getReservationStatus(row, currentTime) === "active",
      );
      const activeQuantity = activeRows.reduce((sum, row) => sum + row.quantity, 0);
      const availableQuantity = Math.max(0, item.totalQuantity - activeQuantity);
      const latestPlace = activeRows.slice().sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0]?.place ?? "";
      return { item, activeQuantity, availableQuantity, latestPlace };
    });
  }, [items, reservations, currentTime]);

  const selectedItemId = items.some((item) => item.id === borrowForm.itemId) ? borrowForm.itemId : items[0]?.id ?? "";
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const totalForSelected = selectedItem?.totalQuantity ?? 1;
  const startAt = combineDateTime(borrowForm.startDate, borrowForm.startTime);
  const endAt = combineDateTime(borrowForm.endDate, borrowForm.endTime);

  const overlapRows = reservations
    .filter((row) => row.itemId === selectedItemId && isOverlapped(startAt, endAt, row.startAt, getPreferredEndAt(row)))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const maxOverlappedReserved = overlapRows.reduce((max, base) => {
    const concurrent = overlapRows
      .filter((row) => isOverlapped(base.startAt, base.endAt, row.startAt, row.endAt))
      .reduce((sum, row) => sum + row.quantity, 0);
    return Math.max(max, concurrent);
  }, 0);

  const availableForRequest = Math.max(0, totalForSelected - maxOverlappedReserved);
  const activeReservations = useMemo(
    () => reservationsWithStatus.filter((row) => row.status === "active"),
    [reservationsWithStatus],
  );

  const todayRows = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    return reservationsWithStatus.filter((row) => {
      const start = new Date(row.startAt);
      const end = new Date(getPreferredEndAt(row));
      return (start >= todayStart && start < todayEnd) || (end >= todayStart && end < todayEnd) || (start < todayStart && end > todayStart);
    });
  }, [reservationsWithStatus]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ date: null, key: `empty-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      cells.push({ date, key: toInputDate(date) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, key: `tail-${cells.length}` });
    return cells;
  }, [calendarMonth]);

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, ReservationWithStatus[]>();
    reservationsWithStatus.forEach((row) => {
      const key = toInputDate(new Date(row.startAt));
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, row]);
    });
    return map;
  }, [reservationsWithStatus]);

  const selectedDateRows = reservationsByDate.get(selectedCalendarDate) ?? [];

  async function handleCreateReservation() {
    setBorrowError("");
    setIsSubmittingBorrow(true);
    try {
      if (!borrowForm.place.trim() || !borrowForm.responsiblePerson.trim()) {
        throw new Error("대여장소와 대여책임자를 입력해주세요.");
      }
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        throw new Error("반납일시는 대여일시 이후여야 합니다.");
      }
      if (borrowForm.quantity > availableForRequest) {
        throw new Error(`재고 부족: 해당 시간대에 최대 ${availableForRequest}개만 예약할 수 있습니다.`);
      }

      const item = items.find((row) => row.id === selectedItemId);
      if (!item) throw new Error("선택한 악기 정보를 찾을 수 없습니다.");

      const next: LoanReservation = {
        id: `rsv-${crypto.randomUUID()}`,
        itemId: selectedItemId,
        itemNameSnapshot: item.name,
        quantity: borrowForm.quantity,
        startAt,
        endAt,
        place: borrowForm.place.trim(),
        responsiblePerson: borrowForm.responsiblePerson.trim(),
        note: borrowForm.note.trim(),
        createdAt: new Date().toISOString(),
      };

      await setReservations([next, ...reservations]);
      setBorrowForm((prev) => ({ ...prev, quantity: 1, place: "", responsiblePerson: "", note: "" }));
      alert("대여 스케줄이 등록되었습니다.");
      setScreen("ledger");
    } catch (error) {
      console.error("handleCreateReservation failed", error);
      setBorrowError(toActionErrorMessage(error, "대여 저장 실패"));
    } finally {
      setIsSubmittingBorrow(false);
    }
  }

  async function runAdminAction(actionId: string, action: () => Promise<string>) {
    setAdminActionMessage("");
    setAdminActionError("");
    setAdminActionBusy(actionId);
    try {
      const msg = await action();
      setAdminActionMessage(msg);
    } catch (error) {
      console.error(`admin action failed: ${actionId}`, error);
      setAdminActionError(toActionErrorMessage(error, "관리자 작업 실패"));
    } finally {
      setAdminActionBusy("");
    }
  }

  async function handleForceReturn(target: LoanReservation) {
    const ok = window.confirm(`[강제 반납 확인]\n${target.itemNameSnapshot} ${target.quantity}개\n책임자: ${target.responsiblePerson}\n지금 즉시 반납 처리할까요?`);
    if (!ok) return;
    await runAdminAction(`force-return-${target.id}`, async () => {
      const result = await forceReturnReservation(target.id);
      return `강제 반납 완료: reservations/records에서 ${result.updatedReservationId} 1건을 forced 상태로 갱신했습니다.`;
    });
  }

  function AdminOperationsPanel() {
    return (
      <>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <h3 className="mb-3 text-lg font-bold">운영 관리 / 유지보수 도구</h3>
          {adminActionMessage && <p className="mb-2 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-700">{adminActionMessage}</p>}
          {adminActionError && <p className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{adminActionError}</p>}
          <div className="space-y-2">
            <button disabled={!!adminActionBusy} className="w-full rounded-xl border border-blue-200 bg-white py-3 font-semibold text-blue-700 disabled:opacity-50" onClick={() => void runAdminAction("reseed", async () => {
              const result = await forceReseedDefaultsToFirestore();
              return `완료: items/master 기본 악기 ${result.itemCount}종을 재설정했습니다.`;
            })}>기본 악기 목록 다시 설정</button>
            <p className="text-sm text-amber-700">items/master의 이름, 아이콘, 수량을 기본값으로 맞춥니다.</p>

            <button disabled={!!adminActionBusy} className="w-full rounded-xl border border-amber-200 bg-white py-3 font-semibold text-amber-700 disabled:opacity-50" onClick={() => void runAdminAction("cleanup", async () => {
              const result = await cleanupLegacyLoanData();
              return `완료: reservations ${result.removedReservationCount}건 + loans ${result.removedLegacyLoanCount}건 정리 (${result.reason}).`;
            })}>구형 테스트 대여기록 정리</button>
            <p className="text-sm text-amber-700">운영 화면에 영향을 주는 reservations/records와 legacy loans를 함께 정리합니다.</p>

            <button disabled={!!adminActionBusy} className="w-full rounded-xl border border-emerald-200 bg-white py-3 font-semibold text-emerald-700 disabled:opacity-50" onClick={() => void runAdminAction("init-base", async () => {
              const result = await initializeBaseData();
              return `완료: 필수 문서 초기 구성 (items ${result.itemCount}건, reservations ${result.reservationCount}건 유지).`;
            })}>앱 기본 데이터 초기 구성</button>
            <p className="text-sm text-amber-700">meta/app, items/master, reservations/records, settings/adminSettings를 생성/보완합니다.</p>
            {isFirestoreEmpty && <p className="text-xs text-gray-600">Firestore가 비어 있어 초기 구성이 필요합니다.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-gray-800">진행중 대여 강제 반납</h3>
          {activeReservations.length === 0 && <p className="text-sm text-gray-500">현재 진행중인 대여가 없습니다.</p>}
          <div className="space-y-2">
            {activeReservations.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-medium text-gray-700">{row.itemNameSnapshot} ({row.quantity}개) · {row.place} · {row.responsiblePerson}<span className="ml-2 text-xs text-gray-500">{toDateTimeLabel(row.startAt)} ~ {toDateTimeLabel(getPreferredEndAt(row))}</span></p>
                <button disabled={!!adminActionBusy} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-rose-300" onClick={() => void handleForceReturn(row)}>강제 반납</button>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <Container>
      <Header
        title={
          screen === "home"
            ? "악기 대여 스케줄 매니저"
            : screen === "borrow"
              ? "대여 등록"
              : screen === "ledger"
                ? "악기관리대장"
                : screen === "schedule"
                  ? "예약스케줄"
                  : "관리자"
        }
        onBack={screen !== "home" ? () => {
          if (screen === "admin_home" || screen === "admin_auth") {
            setScreen("home");
            return;
          }
          if (screen.startsWith("admin")) {
            setScreen("admin_home");
            return;
          }
          setScreen("home");
        } : undefined}
      />

      <div className="px-4 pt-3 md:px-6">
        <p className={`rounded-xl border p-3 text-sm font-semibold ${storageStatus.includes("저장 위치") ? "border-green-100 bg-green-50 text-green-700" : "border-red-100 bg-red-50 text-red-700"}`}>{storageStatus}</p>
        {storageErrorMessage && <p className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{storageErrorMessage}</p>}
      </div>

      {screen === "home" && (
        <>
          <HomeCards onGo={(next) => setScreen(next === "admin_home" ? "admin_auth" : (next as Screen))} />
          <section className="px-4 pb-4 md:px-6">
            <h2 className="mb-3 text-lg font-bold text-gray-800">오늘의 대여 예정</h2>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              {todayRows.length === 0 && <p className="text-sm text-indigo-700">오늘 예정된 대여가 없습니다.</p>}
              <div className="space-y-2">
                {todayRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-indigo-200 bg-white p-3 text-sm">
                    <p className="font-semibold text-gray-800">{row.itemNameSnapshot} ({row.quantity}개)</p>
                    <p className="text-gray-600">{toTimeLabel(row.startAt)} ~ {toTimeLabel(getPreferredEndAt(row))} · {row.place} · {row.responsiblePerson}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="px-4 pb-8 md:px-6">
            <h2 className="mb-3 text-lg font-bold text-gray-800">현재 물품 현황</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-3 py-3">악기명</th>
                    <th className="px-3 py-3">개수</th>
                    <th className="px-3 py-3">물품 현재 위치</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.map(({ item, availableQuantity, activeQuantity, latestPlace }) => (
                    <tr key={item.id} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-3 font-semibold"><IconBadge item={item} /> <span className="ml-2">{item.name}</span></td>
                      <td className="px-3 py-3">{item.totalQuantity}</td>
                      <td className="px-3 py-3">
                        {activeQuantity === 0
                          ? MUSIC_ROOM
                          : availableQuantity > 0
                            ? `${MUSIC_ROOM}(남은 ${availableQuantity}개) / 대여중 ${activeQuantity}개`
                            : `전량 대여중 · 최근 대여장소: ${latestPlace || "미입력"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {screen === "borrow" && (
        <section className="space-y-4 p-4 md:p-6">
          <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-2">
            <label className="text-sm font-medium text-gray-600">물품명
              <select className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={selectedItemId} onChange={(e) => setBorrowForm((p) => ({ ...p, itemId: e.target.value, quantity: 1 }))}>
                {items.map((item) => <option key={item.id} value={item.id}>{getStableItemIcon(item)} {item.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-600">수량
              <input type="number" min={1} max={Math.max(1, availableForRequest)} className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.quantity} onChange={(e) => setBorrowForm((p) => ({ ...p, quantity: Math.max(1, Number(e.target.value) || 1) }))} />
            </label>
            <label className="text-sm font-medium text-gray-600">대여일자
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.startDate} onChange={(e) => setBorrowForm((p) => ({ ...p, startDate: e.target.value }))} />
            </label>
            <label className="text-sm font-medium text-gray-600">대여 시작 시각
              <input type="time" className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.startTime} onChange={(e) => setBorrowForm((p) => ({ ...p, startTime: e.target.value }))} />
            </label>
            <label className="text-sm font-medium text-gray-600">반납일자
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.endDate} onChange={(e) => setBorrowForm((p) => ({ ...p, endDate: e.target.value }))} />
            </label>
            <label className="text-sm font-medium text-gray-600">반납 시각
              <input type="time" className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.endTime} onChange={(e) => setBorrowForm((p) => ({ ...p, endTime: e.target.value }))} />
            </label>
            <label className="text-sm font-medium text-gray-600">대여장소
              <input className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.place} onChange={(e) => setBorrowForm((p) => ({ ...p, place: e.target.value }))} />
            </label>
            <label className="text-sm font-medium text-gray-600">대여책임자
              <input className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.responsiblePerson} onChange={(e) => setBorrowForm((p) => ({ ...p, responsiblePerson: e.target.value }))} />
            </label>
            <label className="text-sm font-medium text-gray-600 md:col-span-2">비고(선택)
              <input className="mt-1 w-full rounded-lg border border-gray-200 p-3" value={borrowForm.note} onChange={(e) => setBorrowForm((p) => ({ ...p, note: e.target.value }))} placeholder="예: 3~4교시 사용" />
            </label>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            같은 시간대 예약 가능 수량: <b>{availableForRequest}개</b> / 총 {totalForSelected}개
            {overlapRows.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {overlapRows.slice(0, 4).map((row) => (
                  <li key={row.id}>{row.place} · {row.responsiblePerson} · {toDateTimeLabel(row.startAt)}~{toDateTimeLabel(getPreferredEndAt(row))} ({row.quantity}개)</li>
                ))}
              </ul>
            )}
          </div>

          {borrowError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{borrowError}</p>}
          <button disabled={isSubmittingBorrow} onClick={() => void handleCreateReservation()} className="w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300">{isSubmittingBorrow ? "처리 중..." : "대여 스케줄 등록"}</button>
        </section>
      )}

      {screen === "ledger" && (
        <section className="p-4 md:p-6">
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="min-w-[960px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-3 py-3">no</th><th className="px-3 py-3">물품명</th><th className="px-3 py-3">대여일자</th><th className="px-3 py-3">반납일자</th><th className="px-3 py-3">대여장소</th><th className="px-3 py-3">책임자</th><th className="px-3 py-3">비고</th><th className="px-3 py-3">상태</th></tr></thead>
              <tbody>
                {reservationsWithStatus.map((row, idx) => (
                  <tr key={row.id} className="border-t border-gray-100 align-top"><td className="px-3 py-3">{idx + 1}</td><td className="px-3 py-3 font-semibold">{row.itemNameSnapshot} ({row.quantity}개)</td><td className="px-3 py-3">{toDateTimeLabel(row.startAt)}</td><td className="px-3 py-3">{toDateTimeLabel(getPreferredEndAt(row))}</td><td className="px-3 py-3">{row.place}</td><td className="px-3 py-3">{row.responsiblePerson}</td><td className="px-3 py-3">{row.returnMode === "forced" ? `${row.note || "-"} / ${row.returnNote || "관리자 강제 반납"}` : (row.note || "-")}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.status === "active" ? "bg-green-100 text-green-700" : row.status === "scheduled" ? "bg-blue-100 text-blue-700" : row.status === "forced_returned" ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600"}`}>{row.status === "active" ? "진행중" : row.status === "scheduled" ? "예정" : row.status === "forced_returned" ? "강제반납" : "종료"}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {screen === "schedule" && (
        <section className="space-y-4 p-4 md:p-6">
          <div className="flex gap-2 rounded-2xl border border-gray-100 bg-white p-2">
            <button onClick={() => setScheduleView("list")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${scheduleView === "list" ? "bg-indigo-600 text-white" : "text-gray-600"}`}>목록 보기</button>
            <button onClick={() => setScheduleView("calendar")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${scheduleView === "calendar" ? "bg-indigo-600 text-white" : "text-gray-600"}`}>월간 캘린더</button>
          </div>

          {scheduleView === "list" && (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
              <table className="min-w-[960px] text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-3 py-3">no</th><th className="px-3 py-3">물품명</th><th className="px-3 py-3">대여일자</th><th className="px-3 py-3">반납일자</th><th className="px-3 py-3">대여장소</th><th className="px-3 py-3">책임자</th><th className="px-3 py-3">비고</th><th className="px-3 py-3">상태</th></tr></thead>
                <tbody>
                  {reservationsWithStatus.map((row, idx) => (
                    <tr key={row.id} className={`border-t border-gray-100 align-top ${row.status === "active" ? "bg-green-50/60" : row.status === "scheduled" ? "bg-blue-50/60" : ""}`}><td className="px-3 py-3">{idx + 1}</td><td className="px-3 py-3 font-semibold">{row.itemNameSnapshot} ({row.quantity}개)</td><td className="px-3 py-3">{toDateTimeLabel(row.startAt)}</td><td className="px-3 py-3">{toDateTimeLabel(getPreferredEndAt(row))}</td><td className="px-3 py-3">{row.place}</td><td className="px-3 py-3">{row.responsiblePerson}</td><td className="px-3 py-3">{row.note || "-"}</td><td className="px-3 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{row.status}</span></td></tr>
                  ))}
                </tbody></table>
            </div>
          )}

          {scheduleView === "calendar" && (
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="rounded-lg border p-2"><ChevronLeft size={16} /></button>
                <p className="font-bold">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</p>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="rounded-lg border p-2"><ChevronRight size={16} /></button>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="font-semibold">{d}</div>)}
                {calendarCells.map((cell) => {
                  if (!cell.date) return <div key={cell.key} className="min-h-16 rounded-lg bg-gray-50" />;
                  const key = toInputDate(cell.date);
                  const dayRows = reservationsByDate.get(key) ?? [];
                  return (
                    <button key={cell.key} onClick={() => setSelectedCalendarDate(key)} className={`min-h-16 rounded-lg border p-1 text-left ${selectedCalendarDate === key ? "border-indigo-500 bg-indigo-50" : "border-gray-100"}`}>
                      <p className="text-xs font-semibold">{cell.date.getDate()}일</p>
                      <p className="text-[11px] text-indigo-700">예약 {dayRows.length}건</p>
                      {dayRows[0] && <p className="truncate text-[10px] text-gray-600">{dayRows[0].itemNameSnapshot}</p>}
                    </button>
                  );
                })}
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="mb-2 text-sm font-semibold">{selectedCalendarDate} 일정</p>
                {selectedDateRows.length === 0 && <p className="text-sm text-gray-500">선택한 날짜의 예약이 없습니다.</p>}
                {selectedDateRows.map((row) => <p key={row.id} className="text-sm text-gray-700">{toTimeLabel(row.startAt)} {row.itemNameSnapshot} ({row.quantity}개) · {row.place} · {row.responsiblePerson}</p>)}
              </div>
            </div>
          )}
        </section>
      )}

      {screen === "admin_auth" && (
        <section className="p-4 md:p-6">
          <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-bold">관리자 비밀번호 입력</h3>
            <input type="password" value={adminAuthInput} onChange={(e) => { setAdminAuthInput(e.target.value); setAdminAuthError(""); }} className="w-full rounded-xl border border-gray-200 p-3" placeholder="비밀번호" />
            {adminAuthError && <p className="mt-2 text-sm text-red-600">{adminAuthError}</p>}
            <button className="mt-4 w-full rounded-xl bg-gray-800 py-3 font-bold text-white" onClick={() => {
              if (adminAuthInput !== adminPassword) return setAdminAuthError("비밀번호가 올바르지 않습니다.");
              setAdminAuthInput("");
              setScreen("admin_home");
            }}>관리자 메뉴로 이동</button>
          </div>
        </section>
      )}

      {screen === "admin_home" && (
        <section className="space-y-4 p-4 md:p-6">
          <AdminCards onGo={(next) => setScreen(next as Screen)} />
          <AdminOperationsPanel />
        </section>
      )}

      {screen === "admin_items" && (
        <section className="space-y-4 p-4 md:p-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold">새 물품 추가</h3>
            <div className="grid gap-3 md:grid-cols-[120px_1fr_120px_auto]">
              <div className="relative"><select value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} className="w-full appearance-none rounded-xl border border-gray-200 p-3 text-center text-2xl">{ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={18} /></div>
              <input className="rounded-xl border border-gray-200 p-3" placeholder="물품명" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input type="number" min={1} className="rounded-xl border border-gray-200 p-3" value={newQuantity} onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value) || 1))} />
              <button className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white" onClick={() => {
                if (!newName.trim()) return;
                const next: EquipmentItem = { id: `eq-${Date.now()}`, name: newName.trim(), emoji: newEmoji, totalQuantity: newQuantity };
                void setItems([...items, next]);
                setNewName("");
                setNewQuantity(1);
                setNewEmoji("📦");
              }}>추가</button>
            </div>
          </div>
          {items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><p className="font-semibold"><IconBadge item={item} /> <span className="ml-2">{item.name} ({item.totalQuantity}개)</span></p><button className="rounded-lg p-2 text-red-500 hover:bg-red-50" onClick={() => void setItems(items.filter((row) => row.id !== item.id))}><Trash2 size={18} /></button></div>)}
        </section>
      )}

      {screen === "admin_settings" && (
        <section className="space-y-4 p-4 md:p-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold">관리자 비밀번호 변경</h3>
            <div className="grid gap-2">
              <input type="password" placeholder="현재 비밀번호" className="rounded-xl border border-gray-200 p-3" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <input type="password" placeholder="새 비밀번호" className="rounded-xl border border-gray-200 p-3" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <input type="password" placeholder="새 비밀번호 확인" className="rounded-xl border border-gray-200 p-3" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <button className="rounded-xl bg-gray-800 py-3 font-bold text-white" onClick={() => {
                if (currentPassword !== adminPassword) return alert("현재 비밀번호가 올바르지 않습니다.");
                if (!newPassword || newPassword !== confirmPassword) return alert("새 비밀번호를 확인해주세요.");
                void setAdminPassword(newPassword);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                alert("변경되었습니다.");
              }}>비밀번호 변경</button>
            </div>
          </div>

        </section>
      )}
    </Container>
  );
}
