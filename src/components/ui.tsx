import { ArrowLeft, CalendarClock, Lock, NotebookPen, Package, Settings } from "lucide-react";
import { ReactNode } from "react";

export function Container({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-5xl pb-16">{children}</main>;
}

export function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
      {onBack && (
        <button onClick={onBack} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-lg font-extrabold text-gray-800 md:text-xl">{title}</h1>
    </header>
  );
}

export function HomeCards({ onGo }: { onGo: (screen: string) => void }) {
  const cards = [
    { id: "borrow", title: "대여", desc: "악기 대여 스케줄 등록", icon: <Package />, color: "text-green-600 bg-green-100" },
    { id: "ledger", title: "물품대장", desc: "예약/대여 이력 전체 보기", icon: <NotebookPen />, color: "text-blue-600 bg-blue-100" },
    { id: "schedule", title: "예약스케줄", desc: "날짜순 운영 일정표", icon: <CalendarClock />, color: "text-indigo-600 bg-indigo-100" },
    { id: "admin_home", title: "관리자", desc: "마스터/점검/재시드", icon: <Settings />, color: "text-gray-600 bg-gray-100" },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-6">
      {cards.map((card) => (
        <button key={card.id} onClick={() => onGo(card.id)} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm hover:border-gray-300">
          <div className={`rounded-full p-3 ${card.color}`}>{card.icon}</div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">{card.title}</h3>
            <p className="text-sm text-gray-500">{card.desc}</p>
          </div>
        </button>
      ))}
    </section>
  );
}

export function AdminCards({ onGo }: { onGo: (screen: string) => void }) {
  const cards = [
    { id: "admin_items", title: "물품 마스터 관리", desc: "아이템/수량 관리", icon: <Package size={30} />, box: "bg-blue-100 text-blue-600" },
    { id: "admin_settings", title: "관리자 설정", desc: "비밀번호/데이터 정리", icon: <Lock size={30} />, box: "bg-gray-100 text-gray-600" },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-6">
      {cards.map((card) => (
        <button key={card.id} onClick={() => onGo(card.id)} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm hover:border-gray-300">
          <div className={`rounded-full p-4 ${card.box}`}>{card.icon}</div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{card.title}</h3>
            <p className="text-sm text-gray-500">{card.desc}</p>
          </div>
        </button>
      ))}
    </section>
  );
}
