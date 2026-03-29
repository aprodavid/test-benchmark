import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "교구 대여 매니저 (레퍼런스 구현)",
  description: "공개 관찰 기반으로 재구현한 교구 대여/반납 앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
