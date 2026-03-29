"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, ChevronDown, Minus, Plus, Trash2, User } from "lucide-react";
import { AdminCards, Container, EmptyState, FixedCTA, Header, HomeCards } from "@/components/ui";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import { DEFAULT_ADMIN_PASSWORD, getAdminPassword, getEquipments, getTransactions, setAdminPassword, setEquipments, setTransactions } from "@/lib/storage";
import { BorrowTransaction, Equipment, BorrowerMode, Screen } from "@/types/app";

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [equipments, setEquipmentsState] = useState<Equipment[]>(() => getEquipments(DEFAULT_EQUIPMENTS));
  const [transactions, setTransactionsState] = useState<BorrowTransaction[]>(() => getTransactions());
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [borrowerMode, setBorrowerMode] = useState<BorrowerMode>("select");
  const [grade, setGrade] = useState("1");
  const [classNum, setClassNum] = useState("1");
  const [manualName, setManualName] = useState("");
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [adminPassword, setAdminPasswordState] = useState(() => getAdminPassword());
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newTracked, setNewTracked] = useState(true);

  useEffect(() => setEquipments(equipments), [equipments]);
  useEffect(() => setTransactions(transactions), [transactions]);

  const borrowedList = useMemo(
    () => transactions.filter((t) => t.status === "borrowed").sort((a, b) => b.timestamp - a.timestamp),
    [transactions],
  );

  const remain = (equipmentId: string) => {
    const item = equipments.find((e) => e.id === equipmentId);
    if (!item) return 0;
    const used = borrowedList.filter((it) => it.equipmentId === equipmentId).reduce((sum, row) => sum + row.borrowedQuantity, 0);
    return Math.max(0, item.totalQuantity - used);
  };

  const resetFlow = () => {
    setSelected({});
    setBorrowerMode("select");
    setManualName("");
    setSelectedReturnIds([]);
  };

  const moveHome = () => {
    resetFlow();
    setScreen("home");
  };

  const borrowerName = borrowerMode === "manual" ? manualName.trim() : `${grade}학년 ${classNum}반`;

  const completeBorrow = () => {
    if (!borrowerName) {
      alert("대여자 정보를 입력해주세요.");
      return;
    }
    setIsBusy(true);
    const now = Date.now();
    const nextRows = Object.entries(selected).map(([equipmentId, qty], i) => {
      const equipment = equipments.find((e) => e.id === equipmentId);
      return {
        id: `tx-${now}-${i}`,
        equipmentId,
        equipmentName: equipment?.name ?? "알 수 없는 물품",
        borrowedQuantity: qty,
        borrowerName,
        status: "borrowed" as const,
        timestamp: now,
      };
    });
    setTransactionsState((prev) => [...nextRows, ...prev]);
    setIsBusy(false);
    setSuccessMessage("대여가 완료되었습니다!");
    setTimeout(() => {
      setSuccessMessage("");
      moveHome();
    }, 1100);
  };

  const completeReturn = () => {
    setIsBusy(true);
    const idSet = new Set(selectedReturnIds);
    setTransactionsState((prev) => prev.map((tx) => (idSet.has(tx.id) ? { ...tx, status: "returned" as const } : tx)));
    setIsBusy(false);
    setSuccessMessage("반납 처리가 완료되었습니다!");
    setTimeout(() => {
      setSuccessMessage("");
      moveHome();
    }, 1000);
  };

  return (
    <Container>
      <Header
        title={
          screen === "home"
            ? "교구 대여 매니저"
            : screen.startsWith("admin")
              ? "관리자 메뉴"
              : screen.startsWith("borrow")
                ? "대여하기"
                : "반납하기"
        }
        onBack={screen !== "home" ? () => setScreen(screen.startsWith("admin") ? "admin_home" : "home") : undefined}
      />

      {screen === "home" && <HomeCards onGo={(next) => setScreen(next as Screen)} />}

      {screen === "borrow_select" && (
        <section className="space-y-4 p-4 md:p-6">
          <p className="px-1 text-sm font-medium text-gray-500 md:text-base">대여할 물품을 선택해주세요</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
            {equipments.map((item) => {
              const left = remain(item.id);
              const disabled = left <= 0;
              const active = selected[item.id] > 0;
              return (
                <button
                  key={item.id}
                  disabled={disabled}
                  onClick={() => setSelected((prev) => {
                    const next = { ...prev };
                    if (next[item.id]) delete next[item.id];
                    else next[item.id] = 1;
                    return next;
                  })}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border-2 p-4 transition-all md:p-6 ${disabled ? "cursor-not-allowed border-gray-200 bg-gray-200 opacity-60" : active ? "border-green-500 bg-green-50 shadow-md" : "border-transparent bg-white shadow-sm hover:shadow-md"}`}
                >
                  {active && (
                    <div className="absolute right-3 top-3 rounded-full bg-green-500 p-1.5 text-white">
                      <Check size={18} />
                    </div>
                  )}
                  <div className="mb-4 text-7xl md:text-8xl">{item.emoji}</div>
                  <h3 className={`text-center text-lg font-bold md:text-xl ${disabled ? "text-gray-500" : "text-gray-800"}`}>{item.name}</h3>
                  <p className={`mt-1 text-sm md:text-base ${disabled ? "text-gray-400" : "font-medium text-green-600"}`}>{disabled ? "대여 불가" : `남은 수량: ${left}개`}</p>
                </button>
              );
            })}
          </div>
          <FixedCTA label="다음 단계로" color="green" disabled={Object.keys(selected).length === 0} onClick={() => setScreen("borrow_qty")} />
        </section>
      )}

      {screen === "borrow_qty" && (
        <section className="space-y-4 p-4 md:space-y-6 md:p-6">
          <p className="mb-4 px-1 text-sm font-medium text-gray-500 md:text-base">대여할 수량을 확인 및 조정해주세요</p>
          {Object.keys(selected).map((id) => {
            const item = equipments.find((eq) => eq.id === id);
            if (!item) return null;
            const max = remain(id);
            const current = selected[id];
            return (
              <div key={id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
                <div className="flex items-center space-x-4 md:space-x-6">
                  <div className="text-5xl md:text-6xl">{item.emoji}</div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 md:text-xl">{item.name}</h4>
                    <p className="mt-1 text-sm text-gray-500">최대 {max}개 가능</p>
                  </div>
                </div>
                {item.isQuantityTracked ? (
                  <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
                    <button className="rounded-lg p-3 text-gray-600 hover:bg-white" onClick={() => setSelected((p) => ({ ...p, [id]: Math.max(1, current - 1) }))}><Minus size={20} /></button>
                    <span className="w-12 text-center text-xl font-bold">{current}</span>
                    <button className="rounded-lg p-3 text-gray-600 hover:bg-white" onClick={() => setSelected((p) => ({ ...p, [id]: Math.min(max, current + 1) }))}><Plus size={20} /></button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-2 text-sm font-bold text-green-700">수량 입력 없음 (1)</div>
                )}
              </div>
            );
          })}
          <FixedCTA label="다음 단계로" color="green" onClick={() => setScreen("borrow_user")} />
        </section>
      )}

      {screen === "borrow_user" && (
        <section className="space-y-6 p-4 md:p-6">
          <p className="px-1 text-sm font-medium text-gray-500 md:text-base">누가 빌리는지 알려주세요</p>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex rounded-xl bg-gray-100 p-1">
              <button onClick={() => setBorrowerMode("select")} className={`flex-1 rounded-lg py-3 text-sm font-bold md:text-base ${borrowerMode === "select" ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}>학년 / 반 선택</button>
              <button onClick={() => setBorrowerMode("manual")} className={`flex-1 rounded-lg py-3 text-sm font-bold md:text-base ${borrowerMode === "manual" ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}>직접 입력</button>
            </div>

            {borrowerMode === "select" ? (
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500 md:text-sm">학년 (Grade)</label>
                  <div className="relative">
                    <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-green-500 md:p-5 md:text-xl">
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}학년</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500 md:text-sm">반 (Class)</label>
                  <div className="relative">
                    <select value={classNum} onChange={(e) => setClassNum(e.target.value)} className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-green-500 md:p-5 md:text-xl">
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}반</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500 md:text-sm">이름 또는 부서 입력</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                  <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="예) 홍길동 선생님, 학생회" className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 pl-12 text-lg font-bold outline-none focus:ring-2 focus:ring-green-500 md:p-5 md:pl-14 md:text-xl" />
                </div>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-green-100 bg-green-50 p-4 md:p-6">
              <h4 className="mb-3 text-sm font-bold text-green-800 md:text-base">대여 요약</h4>
              <ul className="space-y-2 text-sm text-green-700 md:text-base">
                {Object.entries(selected).map(([id, qty]) => {
                  const item = equipments.find((eq) => eq.id === id);
                  return <li key={id}>• {item?.name} <span className="ml-2 font-bold">{qty}개</span></li>;
                })}
              </ul>
            </div>
          </div>
          <FixedCTA label="대여 완료하기" color="green" loading={isBusy} disabled={!borrowerName} onClick={completeBorrow} />
        </section>
      )}

      {screen === "return_select" && (
        <section className="p-4 md:p-6">
          <p className="mb-4 px-1 text-sm font-medium text-gray-500 md:text-base">현재 대여 중인 항목입니다. 반납할 항목을 선택하세요.</p>
          {borrowedList.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {borrowedList.map((tx) => {
                const active = selectedReturnIds.includes(tx.id);
                return (
                  <button key={tx.id} onClick={() => setSelectedReturnIds((prev) => prev.includes(tx.id) ? prev.filter((id) => id !== tx.id) : [...prev, tx.id])} className={`flex w-full items-center rounded-2xl border-2 p-4 text-left transition-all md:p-6 ${active ? "border-red-500 bg-red-50 shadow-md" : "border-gray-100 bg-white shadow-sm hover:border-red-200"}`}>
                    <div className={`mr-4 flex h-8 w-8 items-center justify-center rounded-full border-2 ${active ? "border-red-500 bg-red-500" : "border-gray-300"}`}>{active && <Check className="text-white" size={16} />}</div>
                    <div className="mr-4 text-5xl">{equipments.find((e) => e.id === tx.equipmentId)?.emoji ?? "📦"}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-gray-800 md:text-xl">{tx.equipmentName} <span className="ml-1 text-red-500">{tx.borrowedQuantity}개</span></h3>
                      <p className="text-sm text-gray-500 md:text-base">{tx.borrowerName} • {new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(tx.timestamp))}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {borrowedList.length > 0 && <FixedCTA label={`선택한 ${selectedReturnIds.length}건 반납 완료`} color="red" loading={isBusy} disabled={selectedReturnIds.length === 0} onClick={completeReturn} />}
        </section>
      )}

      {screen === "admin_home" && <AdminCards onGo={(next) => setScreen(next as Screen)} />}

      {screen === "admin_equipments" && (
        <section className="space-y-6 p-4 md:p-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-bold text-gray-800 md:text-xl">새 물품 추가</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value || "📦")} className="w-24 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-2xl font-bold" aria-label="아이콘" />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="물품명 (예: 배드민턴 채)" className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex-1 text-sm font-medium text-gray-600 md:text-base">총 보유 수량</label>
                <input type="number" min={1} value={newQuantity} onChange={(e) => setNewQuantity(Math.max(1, Number(e.target.value)))} className="w-28 rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-3 pt-2 text-sm text-gray-600 md:text-base">
                <input type="checkbox" checked={newTracked} onChange={(e) => setNewTracked(e.target.checked)} className="h-6 w-6 rounded text-blue-500" />
                <span>수량 선택 기능 켜기 (체크 해제 시 1개 고정)</span>
              </label>
              <button
                onClick={() => {
                  if (!newName.trim()) return;
                  const next: Equipment = { id: `eq-${Date.now()}`, name: newName.trim(), emoji: newEmoji.trim() || "📦", totalQuantity: newQuantity, isQuantityTracked: newTracked };
                  setEquipmentsState((prev) => [...prev, next]);
                  setNewName("");
                  setNewEmoji("📦");
                  setNewQuantity(1);
                  setNewTracked(true);
                }}
                className="w-full rounded-xl bg-blue-500 py-4 text-lg font-bold text-white transition-transform hover:bg-blue-600 active:scale-95"
              >추가하기</button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="px-1 text-lg font-bold text-gray-800">등록된 물품 목록</h3>
            {equipments.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-6">
                <div className="flex items-center gap-4">
                  <div className="text-5xl md:text-6xl">{item.emoji}</div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-800">{item.name}</h4>
                    <p className="text-sm text-gray-500">총 {item.totalQuantity}개 {item.isQuantityTracked ? "" : "(수량 입력 없음)"}</p>
                  </div>
                </div>
                <button onClick={() => setEquipmentsState((prev) => prev.filter((eq) => eq.id !== item.id))} className="rounded-lg p-3 text-red-400 transition-colors hover:bg-red-50"><Trash2 size={22} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {screen === "admin_history" && (
        <section className="space-y-3 p-4 md:space-y-4 md:p-6">
          <p className="mb-4 px-1 text-sm font-medium text-gray-500 md:text-base">모든 대여 및 반납 기록입니다.</p>
          {transactions.slice().sort((a, b) => b.timestamp - a.timestamp).map((tx) => {
            const returned = tx.status === "returned";
            return (
              <div key={tx.id} className={`rounded-2xl border p-4 md:p-6 ${returned ? "border-gray-200 bg-gray-50 opacity-70" : "border-green-200 bg-white shadow-sm"}`}>
                <div className="mb-3 flex items-start justify-between">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold md:text-sm ${returned ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-700"}`}>{returned ? "반납완료" : "대여중"}</span>
                  <span className="text-sm text-gray-400">{new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(tx.timestamp))}</span>
                </div>
                <h4 className="text-lg font-bold text-gray-800 md:text-xl">{tx.equipmentName} <span className="font-normal text-gray-500">x{tx.borrowedQuantity}</span></h4>
                <p className="mt-1 text-sm text-gray-600 md:text-base">{tx.borrowerName}</p>
              </div>
            );
          })}
        </section>
      )}

      {screen === "admin_settings" && (
        <section className="space-y-6 p-4 md:p-6">
          <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <h3 className="mb-6 text-lg font-bold text-gray-800 md:text-xl">관리자 비밀번호 변경</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-500">새 비밀번호</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-gray-500" placeholder="새 비밀번호 입력" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-500">새 비밀번호 확인</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-gray-500" placeholder="새 비밀번호 다시 입력" />
              </div>
              <button
                onClick={() => {
                  if (!newPassword) return alert("변경할 비밀번호를 입력해주세요.");
                  if (newPassword !== confirmPassword) return alert("새 비밀번호가 일치하지 않습니다.");
                  setAdminPassword(newPassword);
                  setAdminPasswordState(newPassword);
                  setNewPassword("");
                  setConfirmPassword("");
                  alert("비밀번호가 변경되었습니다!");
                }}
                className="mt-4 w-full rounded-xl bg-gray-800 py-4 text-lg font-bold text-white transition-transform hover:bg-gray-900 active:scale-95"
              >변경하기</button>
            </div>
            <p className="mt-4 text-xs text-gray-500">현재 저장된 비밀번호: {adminPassword}</p>
          </div>
        </section>
      )}

      {successMessage && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white animate-in fade-in duration-300">
          <div className="mb-6 rounded-full bg-green-100 p-6"><Check size={70} className="text-green-500" /></div>
          <h2 className="text-3xl font-extrabold text-gray-800">{successMessage}</h2>
          <p className="mt-2 font-medium text-gray-500">메인 화면으로 돌아갑니다...</p>
        </div>
      )}
    </Container>
  );
}
