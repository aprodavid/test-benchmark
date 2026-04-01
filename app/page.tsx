"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, ChevronDown, Minus, Plus, Trash2, User } from "lucide-react";
import { AdminCards, Container, EmptyState, FixedCTA, Header, HomeCards } from "@/components/ui";
import { DEFAULT_EQUIPMENTS } from "@/data/defaultEquipments";
import {
  DEFAULT_ADMIN_PASSWORD,
  auditFirestoreState,
  clearAllLoans,
  clearTestLoans,
  forceReseedDefaultsToFirestore,
  getStorageDiagnostics,
  loadAppState,
  resetEquipmentsToDefault,
  seedDefaultsIfFirestoreEmpty,
  setAdminPassword,
  setEquipments,
  setTransactions,
  subscribeAppState,
} from "@/lib/storage";
import { BorrowTransaction, Equipment, BorrowerMode, Screen } from "@/types/app";

const ICON_OPTIONS = ["📦", "🏀", "⚽", "🏐", "🤸", "➰", "🎽", "🎹", "🎵", "🎶", "🥁", "🎸", "🎺", "🎻", "🎼"];

const GRADE_CLASS_OPTIONS: Record<string, number[]> = {
  "1": [1, 2, 3, 4, 5, 6],
  "2": [1, 2, 3, 4, 5, 6],
  "3": [1, 2, 3, 4, 5],
  "4": [1, 2, 3, 4, 5],
  "5": [1, 2, 3, 4],
  "6": [1, 2, 3, 4],
};

export default function Page() {
  type AuditState = Awaited<ReturnType<typeof auditFirestoreState>>;
  const [screen, setScreen] = useState<Screen>("home");
  const [equipments, setEquipmentsState] = useState<Equipment[]>(DEFAULT_EQUIPMENTS);
  const [transactions, setTransactionsState] = useState<BorrowTransaction[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [borrowerMode, setBorrowerMode] = useState<BorrowerMode>("select");
  const [grade, setGrade] = useState("1");
  const [classNum, setClassNum] = useState("1");
  const [manualName, setManualName] = useState("");
  const [borrowPinInput, setBorrowPinInput] = useState("");
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [returnPinInput, setReturnPinInput] = useState("");
  const [returnPinError, setReturnPinError] = useState("");
  const [adminAuthInput, setAdminAuthInput] = useState("");
  const [adminAuthError, setAdminAuthError] = useState("");
  const [adminPassword, setAdminPasswordState] = useState(DEFAULT_ADMIN_PASSWORD);
  const [hasCustomAdminPassword, setHasCustomAdminPassword] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState("Firestore 연결 확인 중...");
  const isFirestoreConnected = storageStatus === "저장 위치: Firestore";
  const [isFirestoreEmpty, setIsFirestoreEmpty] = useState(false);
  const [isAdminActionBusy, setIsAdminActionBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [storageErrorMessage, setStorageErrorMessage] = useState("");
  const [adminAudit, setAdminAudit] = useState<AuditState | null>(null);
  const [adminAuditMessage, setAdminAuditMessage] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📦");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newTracked, setNewTracked] = useState(true);

  const classOptions = GRADE_CLASS_OPTIONS[grade] ?? [];
  const borrowerName = borrowerMode === "manual" ? manualName.trim() : `${grade}학년 ${classNum}반`;
  const isBorrowPinValid = /^\d{4}$/.test(borrowPinInput);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const state = await loadAppState();
        if (!alive) return;

        setEquipmentsState(state.equipments);
        setTransactionsState(state.transactions);
        setAdminPasswordState(state.adminSettings.password);
        setHasCustomAdminPassword(state.adminSettings.isCustomized);
        setStorageStatus("저장 위치: Firestore");
        setStorageErrorMessage("");
        setIsStorageReady(true);
      } catch {
        if (!alive) return;
        setStorageStatus("Firebase 연결 오류");
        setStorageErrorMessage("Firestore 실시간 동기화 연결이 끊어졌습니다. 네트워크/권한을 확인해주세요.");
      }

      try {
        const diagnostics = await getStorageDiagnostics();
        if (!alive) return;
        setIsFirestoreEmpty(diagnostics.isFirestoreEmpty);
        if (!diagnostics.isConnected) {
          setStorageStatus("Firebase 연결 오류");
        setStorageErrorMessage("Firestore 실시간 동기화 연결이 끊어졌습니다. 네트워크/권한을 확인해주세요.");
        }
      } catch {
        if (!alive) return;
        setStorageStatus("Firebase 연결 오류");
        setStorageErrorMessage("Firestore 실시간 동기화 연결이 끊어졌습니다. 네트워크/권한을 확인해주세요.");
      }
    })();

    const unsubscribe = subscribeAppState({
      onData: (state) => {
        if (!alive) return;
        setEquipmentsState(state.equipments);
        setTransactionsState(state.transactions);
        setAdminPasswordState(state.adminSettings.password);
        setHasCustomAdminPassword(state.adminSettings.isCustomized);
        setStorageStatus("저장 위치: Firestore");
        setStorageErrorMessage("");
        setIsStorageReady(true);
        setIsFirestoreEmpty(false);
      },
      onEmpty: () => {
        if (!alive) return;
        setIsFirestoreEmpty(true);
      },
      onError: () => {
        if (!alive) return;
        setStorageStatus("Firebase 연결 오류");
        setStorageErrorMessage("Firestore 실시간 동기화 연결이 끊어졌습니다. 네트워크/권한을 확인해주세요.");
      },
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

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
    setBorrowPinInput("");
    setSelectedReturnIds([]);
    setReturnPinInput("");
    setReturnPinError("");
  };

  const moveHome = () => {
    resetFlow();
    setScreen("home");
  };

  const handleStorageWriteError = (error: unknown, fallbackMessage: string) => {
    const message = error instanceof Error ? error.message : fallbackMessage;
    setStorageStatus("Firebase 연결 오류");
    setStorageErrorMessage(message);
    alert(message);
  };

  const runAdminAction = async (action: () => Promise<void>, fallbackMessage: string) => {
    try {
      setIsAdminActionBusy(true);
      await action();
    } catch (error) {
      handleStorageWriteError(error, fallbackMessage);
    } finally {
      setIsAdminActionBusy(false);
    }
  };

  const completeBorrow = async () => {
    if (isBusy) return;
    if (!borrowerName) {
      alert("대여자 정보를 입력해주세요.");
      return;
    }
    if (!isBorrowPinValid) {
      alert("대여 비밀번호는 4자리 숫자로 입력해주세요.");
      return;
    }
    setIsBusy(true);
    try {
      const now = Date.now();
      const nextRows = Object.entries(selected).map(([equipmentId, qty], i) => {
        const equipment = equipments.find((e) => e.id === equipmentId);
        return {
          id: `tx-${now}-${i}`,
          equipmentId,
          equipmentName: equipment?.name ?? "알 수 없는 물품",
          borrowedQuantity: qty,
          borrowerName,
          borrowPin: borrowPinInput,
          status: "borrowed" as const,
          timestamp: now,
        };
      });
      const nextTransactions = [...nextRows, ...transactions];
      await setTransactions(nextTransactions);
      setSuccessMessage("대여가 완료되었습니다!");
    } catch (error) {
      handleStorageWriteError(error, "대여 데이터를 Firestore에 저장하지 못했습니다.");
      return;
    } finally {
      setIsBusy(false);
    }
    setTimeout(() => {
      setSuccessMessage("");
      moveHome();
    }, 1100);
  };

  const completeReturn = async () => {
    if (isBusy) return;
    if (selectedReturnIds.length === 0) {
      setReturnPinError("반납할 항목을 먼저 선택해주세요.");
      return;
    }
    const selectedRows = borrowedList.filter((tx) => selectedReturnIds.includes(tx.id));
    const hasPinProtectedRow = selectedRows.some((tx) => !!tx.borrowPin);
    if (hasPinProtectedRow && !/^\d{4}$/.test(returnPinInput)) {
      setReturnPinError("4자리 숫자 비밀번호를 입력해주세요.");
      return;
    }

    const mismatched = selectedRows.some((tx) => tx.borrowPin && tx.borrowPin !== returnPinInput);
    if (mismatched) {
      setReturnPinError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsBusy(true);
    try {
      const idSet = new Set(selectedReturnIds);
      const nextTransactions = transactions.map((tx) => (idSet.has(tx.id) ? { ...tx, status: "returned" as const } : tx));
      await setTransactions(nextTransactions);
      setReturnPinInput("");
      setReturnPinError("");
      setSuccessMessage("반납 처리가 완료되었습니다!");
    } catch (error) {
      handleStorageWriteError(error, "반납 데이터를 Firestore에 저장하지 못했습니다.");
      return;
    } finally {
      setIsBusy(false);
    }
    setTimeout(() => {
      setSuccessMessage("");
      moveHome();
    }, 1000);
  };

  const handleGradeChange = (nextGrade: string) => {
    setGrade(nextGrade);
    const nextClassOptions = GRADE_CLASS_OPTIONS[nextGrade] ?? [];
    if (!nextClassOptions.includes(Number(classNum)) && nextClassOptions[0]) {
      setClassNum(String(nextClassOptions[0]));
    }
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
        onBack={
          screen !== "home"
            ? () => {
              if (screen === "admin_home" || screen === "admin_auth") {
                setAdminAuthInput("");
                setAdminAuthError("");
                setScreen("home");
                return;
              }
              if (screen === "borrow_qty") {
                setScreen("borrow_select");
                return;
              }
              if (screen === "borrow_user") {
                setScreen("borrow_qty");
                return;
              }
              if (screen === "borrow_pin") {
                setScreen("borrow_user");
                return;
              }
              if (screen === "return_pin") {
                setScreen("return_select");
                return;
              }
              setScreen(screen.startsWith("admin") ? "admin_home" : "home");
            }
            : undefined
        }
      />
      <div className="px-4 pt-3 md:px-6">
        <p className={`rounded-xl border p-3 text-sm font-semibold ${isFirestoreConnected ? "border-green-100 bg-green-50 text-green-700" : "border-red-100 bg-red-50 text-red-700"}`}>
          {storageStatus}
        </p>
        {storageErrorMessage && (
          <p className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{storageErrorMessage}</p>
        )}
      </div>

      {screen === "home" && (
        <HomeCards
          onGo={(next) => {
            if (next === "admin_home") {
              setAdminAuthInput("");
              setAdminAuthError("");
              setScreen("admin_auth");
              return;
            }
            setScreen(next as Screen);
          }}
        />
      )}

      {screen === "admin_auth" && (
        <section className="p-4 md:p-6">
          <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-3 text-lg font-bold text-gray-800 md:text-xl">관리자 비밀번호 입력</h3>
            <p className="mb-4 text-sm text-gray-500">관리자 메뉴에 들어가려면 비밀번호를 입력하세요.</p>
            {!hasCustomAdminPassword && (
              <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-700">초기 관리자 비밀번호는 0000입니다.</p>
            )}
            <input
              type="password"
              value={adminAuthInput}
              onChange={(e) => {
                setAdminAuthInput(e.target.value);
                setAdminAuthError("");
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="비밀번호"
            />
            {adminAuthError && <p className="mt-3 text-sm font-medium text-red-500">{adminAuthError}</p>}
            <button
              onClick={() => {
                if (adminAuthInput !== adminPassword) {
                  setAdminAuthError("비밀번호가 올바르지 않습니다.");
                  return;
                }
                setAdminAuthInput("");
                setAdminAuthError("");
                setScreen("admin_home");
              }}
              className="mt-5 w-full rounded-xl bg-gray-800 py-4 text-lg font-bold text-white transition-transform hover:bg-gray-900 active:scale-95"
            >
              관리자 메뉴로 이동
            </button>
          </div>
        </section>
      )}

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
                    <select value={grade} onChange={(e) => handleGradeChange(e.target.value)} className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-green-500 md:p-5 md:text-xl">
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}학년</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500 md:text-sm">반 (Class)</label>
                  <div className="relative">
                    <select value={classNum} onChange={(e) => setClassNum(e.target.value)} className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-green-500 md:p-5 md:text-xl">
                      {classOptions.map((n) => <option key={n} value={n}>{n}반</option>)}
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
          <FixedCTA label="다음 단계로" color="green" disabled={!borrowerName} onClick={() => setScreen("borrow_pin")} />
        </section>
      )}

      {screen === "borrow_pin" && (
        <section className="space-y-6 p-4 md:p-6">
          <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-3 text-lg font-bold text-gray-800 md:text-xl">대여 비밀번호 입력</h3>
            <p className="mb-4 text-sm text-gray-600">4자리 숫자를 써주세요. 반납을 할 때 사용할 비밀번호입니다.</p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={borrowPinInput}
              onChange={(e) => setBorrowPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4자리 숫자"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="mt-3 text-sm text-gray-500">정확히 4자리 숫자를 입력해야 대여를 완료할 수 있습니다.</p>
          </div>
          <FixedCTA label="대여 완료하기" color="green" loading={isBusy} disabled={!isBorrowPinValid} onClick={() => { void completeBorrow(); }} />
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
          {borrowedList.length > 0 && <FixedCTA label={`선택한 ${selectedReturnIds.length}건 다음 단계`} color="red" disabled={selectedReturnIds.length === 0} onClick={() => {
            setReturnPinInput("");
            setReturnPinError("");
            setScreen("return_pin");
          }} />}
        </section>
      )}

      {screen === "return_pin" && (
        <section className="space-y-6 p-4 md:p-6">
          <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <h3 className="mb-3 text-lg font-bold text-gray-800 md:text-xl">반납 비밀번호 확인</h3>
            <p className="mb-4 text-sm text-gray-600">대여 시 입력한 4자리 숫자 비밀번호를 입력해주세요.</p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={returnPinInput}
              onChange={(e) => {
                setReturnPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                setReturnPinError("");
              }}
              placeholder="4자리 숫자"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-red-500"
            />
            {returnPinError && <p className="mt-3 text-sm font-medium text-red-500">{returnPinError}</p>}
            {borrowedList.filter((tx) => selectedReturnIds.includes(tx.id)).some((tx) => !tx.borrowPin) && (
              <p className="mt-3 text-xs text-gray-500">기존 데이터(비밀번호 미설정)는 입력값과 무관하게 반납됩니다.</p>
            )}
          </div>
          <FixedCTA label={`선택한 ${selectedReturnIds.length}건 반납 완료`} color="red" loading={isBusy} onClick={() => { void completeReturn(); }} />
        </section>
      )}

      {screen === "admin_home" && <AdminCards onGo={(next) => setScreen(next as Screen)} />}

      {screen === "admin_equipments" && (
        <section className="space-y-6 p-4 md:p-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-8">
            <h3 className="mb-4 text-lg font-bold text-gray-800 md:text-xl">새 물품 추가</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-28">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">아이콘</label>
                  <div className="relative">
                    <select value={newEmoji} onChange={(e) => setNewEmoji(e.target.value || "📦")} className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 p-4 pr-10 text-center text-3xl font-bold outline-none focus:ring-2 focus:ring-blue-500" aria-label="아이콘">
                      {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  </div>
                </div>
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
                <label className="mb-2 block text-sm font-bold text-gray-500">현재 비밀번호</label>
                <input type="password" inputMode="numeric" maxLength={4} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-gray-500" placeholder="현재 비밀번호 4자리" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-500">새 비밀번호</label>
                <input type="password" inputMode="numeric" maxLength={4} value={newPassword} onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-gray-500" placeholder="새 비밀번호 4자리" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-500">새 비밀번호 확인</label>
                <input type="password" inputMode="numeric" maxLength={4} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-gray-500" placeholder="새 비밀번호 다시 입력" />
              </div>
              <button
                onClick={() => {
                  if (!/^\d{4}$/.test(currentPassword)) return alert("현재 비밀번호는 4자리 숫자로 입력해주세요.");
                  if (currentPassword !== adminPassword) return alert("현재 비밀번호가 올바르지 않습니다.");
                  if (!/^\d{4}$/.test(newPassword)) return alert("새 비밀번호는 4자리 숫자로 입력해주세요.");
                  if (newPassword !== confirmPassword) return alert("새 비밀번호가 일치하지 않습니다.");
                  void (async () => {
                    try {
                      await setAdminPassword(newPassword);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      alert("비밀번호가 변경되었습니다!");
                    } catch (error) {
                      handleStorageWriteError(error, "비밀번호를 Firestore에 저장하지 못했습니다.");
                    }
                  })();
                }}
                className="mt-4 w-full rounded-xl bg-gray-800 py-4 text-lg font-bold text-white transition-transform hover:bg-gray-900 active:scale-95"
              >변경하기</button>
            </div>
            <button
              onClick={() => {
                if (!confirm("새 기본 교구 세트로 재설정할까요? 현재 등록된 교구 목록이 교체됩니다.")) return;
                void (async () => {
                  try {
                    await resetEquipmentsToDefault();
                    alert("기본 교구 세트로 재설정되었습니다. (모든 대여 기록도 초기화됨)");
                  } catch (error) {
                    handleStorageWriteError(error, "기본 교구 재설정에 실패했습니다.");
                  }
                })();
              }}
              className="mt-4 w-full rounded-xl border border-blue-200 bg-blue-50 py-3 text-base font-bold text-blue-700 transition-colors hover:bg-blue-100"
            >
              기본 교구 세트로 재설정
            </button>
            <p className="mt-4 text-xs text-gray-500">초기 비밀번호는 {DEFAULT_ADMIN_PASSWORD}이며, 사용자 지정 전까지 관리자 진입 화면에 안내됩니다.</p>
            {isFirestoreEmpty && (
              <button
                disabled={isAdminActionBusy}
                onClick={() => {
                  if (!confirm("Firestore가 비어 있을 때만 기본 교구 시드를 넣습니다. 지금 진행할까요?")) return;
                  void runAdminAction(async () => {
                    await seedDefaultsIfFirestoreEmpty();
                    alert("Firestore 초기 시드가 완료되었습니다.");
                  }, "초기 시드에 실패했습니다.");
                }}
                className="mt-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-base font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
              >
                Firestore 기본 데이터 시드
              </button>
            )}
            <button
              disabled={isAdminActionBusy}
              onClick={() => {
                const warningConfirmed = confirm(
                  "주의: 이 작업은 Firestore의 현재 교구/대여/관리자 비밀번호 데이터를 기본값으로 덮어씁니다. 계속할까요?",
                );
                if (!warningConfirmed) return;

                const finalConfirmed = prompt("정말 진행하려면 '기본값 재시드'를 입력하세요.");
                if (finalConfirmed !== "기본값 재시드") {
                  alert("확인 문구가 일치하지 않아 작업을 취소했습니다.");
                  return;
                }

                void runAdminAction(async () => {
                  await forceReseedDefaultsToFirestore();
                  alert("Firestore 기본 데이터 재시드가 완료되었습니다.");
                }, "기본 데이터 재시드에 실패했습니다.");
              }}
              className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 py-3 text-base font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              기본 교구를 Firestore에 다시 시드하기 (주의)
            </button>
            <button
              disabled={isAdminActionBusy}
              onClick={() => {
                if (!confirm("현재 대여/반납 기록(loans)을 모두 삭제하여 전체를 미대여 상태로 만들까요?")) return;
                void runAdminAction(async () => {
                  await clearAllLoans();
                  alert("모든 대여/반납 기록이 정리되었습니다.");
                }, "대여/반납 기록 정리에 실패했습니다.");
              }}
              className="mt-4 w-full rounded-xl border border-orange-200 bg-orange-50 py-3 text-base font-bold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-60"
            >
              대여/반납 기록 전체 정리 (미대여 초기화)
            </button>
            <button
              disabled={isAdminActionBusy}
              onClick={() => {
                void runAdminAction(async () => {
                  await clearTestLoans();
                  alert("테스트로 보이는 대여 기록을 정리했습니다.");
                }, "테스트 대여 기록 정리에 실패했습니다.");
              }}
              className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-50 py-3 text-base font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
            >
              테스트 대여 데이터 정리
            </button>
            <button
              disabled={isAdminActionBusy}
              onClick={() => {
                void runAdminAction(async () => {
                  const report = await auditFirestoreState();
                  setAdminAudit(report);
                  setAdminAuditMessage(`점검 완료: 대여중 ${report.borrowedCount}건 / 반납완료 ${report.returnedCount}건`);
                }, "Firestore 상태 점검에 실패했습니다.");
              }}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-base font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60"
            >
              Firestore 현재 상태 점검
            </button>
            {adminAuditMessage && (
              <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">{adminAuditMessage}</p>
            )}
            {adminAudit && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>schemaVersion: {adminAudit.schemaVersion}</p>
                <p>교구 수: {adminAudit.equipmentCount}개</p>
                <p>대여중: {adminAudit.borrowedCount}건</p>
                <p>반납완료: {adminAudit.returnedCount}건</p>
                <p>테스트 의심 데이터: {adminAudit.suspectedTestLoanCount}건</p>
                <p>깨진 이모지 감지: {adminAudit.hasBrokenEmoji ? "예" : "아니오"}</p>
                <div className="mt-2">
                  <p className="font-semibold">현재 대여 중 집계</p>
                  {adminAudit.activeBorrowByEquipment.length === 0 ? (
                    <p>없음 (전체 미대여 상태)</p>
                  ) : (
                    <ul className="list-disc pl-5">
                      {adminAudit.activeBorrowByEquipment.map((row) => (
                        <li key={row.equipmentId}>{row.name}: {row.borrowedQuantity}개</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
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
