"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { AdminCards, Container, Header, HomeCards } from "@/components/ui";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import {
  cleanupLegacyLoanData,
  DEFAULT_ADMIN_PASSWORD,
  forceReseedDefaultsToFirestore,
  getStorageDiagnostics,
  loadAppState,
  seedDefaultsIfFirestoreEmpty,
  setAdminPassword,
  setItems,
  setReservations,
  subscribeAppState,
} from "@/lib/storage";
import { EquipmentItem, LoanReservation, ReservationWithStatus, Screen } from "@/types/app";

const ICON_OPTIONS = ["📦", "🎹", "🪇", "🪵", "🥁", "🪘", "🎼", "🔔", "🛎️", "🎶"];
const MUSIC_ROOM = "음악교구실";

function toDateTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
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

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [items, setItemsState] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENTS);
  const [reservations, setReservationsState] = useState<LoanReservation[]>([]);
  const [adminPassword, setAdminPasswordState] = useState(DEFAULT_ADMIN_PASSWORD);
  const [storageStatus, setStorageStatus] = useState("Firestore 연결 확인 중...");
  const [storageErrorMessage, setStorageErrorMessage] = useState("");
  const [isFirestoreEmpty, setIsFirestoreEmpty] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date().getTime());

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
      } catch {
        if (!alive) return;
        setStorageStatus("Firebase 연결 오류");
        setStorageErrorMessage("Firestore 연결을 확인해주세요.");
      }
    })();

    const unsub = subscribeAppState({
      onData: (state) => {
        if (!alive) return;
        setItemsState(state.items);
        setReservationsState(state.reservations);
        setAdminPasswordState(state.adminSettings.password);
        setStorageStatus("저장 위치: Firestore");
      },
      onError: () => {
        if (!alive) return;
        setStorageStatus("Firebase 연결 오류");
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
        status: (new Date(row.endAt).getTime() > currentTime ? "active" : "completed") as "active" | "completed",
      }))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [reservations, currentTime]);

  const inventoryRows = useMemo(() => {
    return items.map((item) => {
      const activeRows = reservations.filter(
        (row) => row.itemId === item.id && new Date(row.startAt).getTime() <= currentTime && new Date(row.endAt).getTime() > currentTime,
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
    .filter((row) => row.itemId === selectedItemId && isOverlapped(startAt, endAt, row.startAt, row.endAt))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const maxOverlappedReserved = overlapRows.reduce((max, base) => {
    const concurrent = overlapRows
      .filter((row) => isOverlapped(base.startAt, base.endAt, row.startAt, row.endAt))
      .reduce((sum, row) => sum + row.quantity, 0);
    return Math.max(max, concurrent);
  }, 0);

  const availableForRequest = Math.max(0, totalForSelected - maxOverlappedReserved);

  async function handleCreateReservation() {
    if (!borrowForm.place.trim() || !borrowForm.responsiblePerson.trim()) {
      alert("대여장소와 대여책임자를 입력해주세요.");
      return;
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      alert("반납일시는 대여일시 이후여야 합니다.");
      return;
    }
    if (borrowForm.quantity > availableForRequest) {
      alert(`재고 부족: 해당 시간대에 최대 ${availableForRequest}개만 예약할 수 있습니다.`);
      return;
    }

    const item = items.find((row) => row.id === selectedItemId);
    if (!item) return;

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
  }

  return (
    <Container>
      <Header
        title={screen === "home" ? "악기 대여 스케줄 매니저" : screen === "borrow" ? "대여 등록" : screen === "ledger" ? "악기관리대장" : "관리자"}
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
                      <td className="px-3 py-3 font-semibold">{item.emoji} {item.name}</td>
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
                {items.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}
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
                  <li key={row.id}>{row.place} · {row.responsiblePerson} · {toDateTimeLabel(row.startAt)}~{toDateTimeLabel(row.endAt)} ({row.quantity}개)</li>
                ))}
              </ul>
            )}
          </div>

          <button onClick={() => void handleCreateReservation()} className="w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700">대여 스케줄 등록</button>
        </section>
      )}

      {screen === "ledger" && (
        <section className="p-4 md:p-6">
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="min-w-[960px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-3">no</th>
                  <th className="px-3 py-3">물품명</th>
                  <th className="px-3 py-3">대여일자</th>
                  <th className="px-3 py-3">반납일자</th>
                  <th className="px-3 py-3">대여장소</th>
                  <th className="px-3 py-3">책임자</th>
                  <th className="px-3 py-3">비고</th>
                </tr>
              </thead>
              <tbody>
                {reservationsWithStatus.map((row, idx) => (
                  <tr key={row.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-3">{idx + 1}</td>
                    <td className="px-3 py-3 font-semibold">{row.itemNameSnapshot} ({row.quantity}개)</td>
                    <td className="px-3 py-3">{toDateTimeLabel(row.startAt)}</td>
                    <td className="px-3 py-3">{toDateTimeLabel(row.endAt)}<div className={`mt-1 text-xs font-semibold ${row.status === "active" ? "text-green-600" : "text-gray-500"}`}>{row.status === "active" ? "진행중" : "종료"}</div></td>
                    <td className="px-3 py-3">{row.place}</td>
                    <td className="px-3 py-3">{row.responsiblePerson}</td>
                    <td className="px-3 py-3">{row.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {screen === "admin_home" && <AdminCards onGo={(next) => setScreen(next as Screen)} />}

      {screen === "admin_items" && (
        <section className="space-y-4 p-4 md:p-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold">새 물품 추가</h3>
            <div className="grid gap-3 md:grid-cols-[120px_1fr_120px_auto]">
              <div className="relative">
                <select value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} className="w-full appearance-none rounded-xl border border-gray-200 p-3 text-center text-2xl">
                  {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
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
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-semibold">{item.emoji} {item.name} ({item.totalQuantity}개)</p>
              <button className="rounded-lg p-2 text-red-500 hover:bg-red-50" onClick={() => void setItems(items.filter((row) => row.id !== item.id))}><Trash2 size={18} /></button>
            </div>
          ))}
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

          <button className="w-full rounded-xl border border-blue-200 bg-blue-50 py-3 font-semibold text-blue-700" onClick={() => void forceReseedDefaultsToFirestore()}>기본 악기 재시드</button>
          <button className="w-full rounded-xl border border-amber-200 bg-amber-50 py-3 font-semibold text-amber-700" onClick={() => void cleanupLegacyLoanData()}>구형 테스트 대여 데이터 정리</button>
          <button className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-3 font-semibold text-emerald-700" onClick={() => void seedDefaultsIfFirestoreEmpty()} disabled={!isFirestoreEmpty}>Firestore 비어있을 때 기본 데이터 시드</button>
        </section>
      )}
    </Container>
  );
}
