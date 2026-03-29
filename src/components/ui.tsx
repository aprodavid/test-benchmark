import { ArrowLeft, ArrowRight, Check, History, Lock, Package, RefreshCw, Settings } from "lucide-react";
import { ReactNode } from "react";

export function Container({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-3xl pb-28">{children}</main>;
}

export function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur md:px-6 md:py-4">
      {onBack && (
        <button onClick={onBack} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-lg font-extrabold text-gray-800 md:text-xl">{title}</h1>
    </header>
  );
}

export function FixedCTA({
  label,
  color,
  disabled,
  onClick,
  loading,
}: {
  label: string;
  color: "green" | "red" | "blue" | "gray";
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  const colorMap = {
    green: "bg-green-500 hover:bg-green-600 disabled:bg-gray-300",
    red: "bg-red-500 hover:bg-red-600 disabled:bg-gray-300",
    blue: "bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300",
    gray: "bg-gray-800 hover:bg-black disabled:bg-gray-300",
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 mx-auto w-full max-w-3xl border-t border-gray-100 bg-white/90 p-4 backdrop-blur">
      <button
        disabled={disabled || loading}
        onClick={onClick}
        className={`flex w-full items-center justify-center rounded-xl py-4 text-lg font-bold text-white transition-transform active:scale-95 disabled:cursor-not-allowed ${colorMap[color]}`}
      >
        {loading ? "처리 중..." : label}
        {!loading && <ArrowRight size={18} className="ml-1" />}
      </button>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="mt-4 rounded-3xl border border-gray-100 bg-white py-20 text-center shadow-sm">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gray-50">
        <Check size={44} className="text-gray-300" />
      </div>
      <h3 className="text-2xl font-bold text-gray-800">모두 반납됨</h3>
      <p className="mt-2 text-gray-500 md:text-lg">현재 대여 중인 물품이 없습니다.</p>
    </div>
  );
}

export function HomeCards({ onGo }: { onGo: (screen: string) => void }) {
  const cards = [
    { id: "borrow_select", title: "대여하기", desc: "필요한 물품을 선택하고 대여해요", icon: <Package />, color: "text-green-600 bg-green-100" },
    { id: "return_select", title: "반납하기", desc: "대여 중인 물품을 반납 처리해요", icon: <RefreshCw />, color: "text-red-600 bg-red-100" },
    { id: "admin_home", title: "관리자", desc: "물품 관리 / 기록 조회 / 설정", icon: <Settings />, color: "text-gray-600 bg-gray-100" },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 p-4 md:p-6">
      {cards.map((card) => (
        <button
          key={card.id}
          onClick={() => onGo(card.id)}
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm transition-all hover:border-gray-300"
        >
          <div className={`rounded-full p-3 ${card.color}`}>{card.icon}</div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{card.title}</h3>
            <p className="text-sm text-gray-500 md:text-base">{card.desc}</p>
          </div>
        </button>
      ))}
      <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-yellow-800">
        참고 구현: 실제 서비스와 동일한 백엔드/브랜드 자산은 포함하지 않았습니다.
      </div>
    </section>
  );
}

export function AdminCards({ onGo }: { onGo: (screen: string) => void }) {
  const cards = [
    { id: "admin_equipments", title: "물품 마스터 관리", desc: "새 교구 추가 및 삭제", icon: <Package size={32} />, box: "bg-blue-100 text-blue-600" },
    { id: "admin_history", title: "전체 대여 기록", desc: "대여/반납 히스토리 조회", icon: <History size={32} />, box: "bg-purple-100 text-purple-600" },
    { id: "admin_settings", title: "관리자 설정", desc: "관리자 비밀번호 변경", icon: <Lock size={32} />, box: "bg-gray-100 text-gray-600" },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:gap-6 md:p-6">
      {cards.map((card, index) => (
        <button
          key={card.id}
          onClick={() => onGo(card.id)}
          className={`flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm transition-all hover:border-gray-300 ${index === 2 ? "md:col-span-2" : ""}`}
        >
          <div className={`rounded-full p-4 ${card.box}`}>{card.icon}</div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 md:text-2xl">{card.title}</h3>
            <p className="text-sm text-gray-500 md:text-base">{card.desc}</p>
          </div>
        </button>
      ))}
    </section>
  );
}
