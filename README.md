# test-benchmark

공개적으로 관찰 가능한 UX를 바탕으로 재구현한 **교구 대여/반납/관리 레퍼런스 앱**입니다.

## 스택
- Next.js (App Router)
- TypeScript
- Tailwind CSS

## 로컬 실행 방법
1. 의존성 설치
   ```bash
   npm install
   ```
2. 개발 서버 실행
   ```bash
   npm run dev
   ```
3. 브라우저에서 `http://localhost:3000` 접속

## 배포 방법
이 프로젝트는 `next.config.ts`에서 `output: "export"`를 사용해 정적 배포가 가능하도록 구성되어 있습니다.

1. 빌드
   ```bash
   npm run build
   ```
2. 생성된 `out/` 디렉터리를 정적 호스팅에 배포
   - GitHub Pages
   - Netlify
   - Vercel(정적 호스팅 모드)

### GitHub Pages 예시
- `npm run build` 후 `out/`를 `gh-pages` 브랜치에 배포
- GitHub 저장소 Settings → Pages에서 `gh-pages` 브랜치를 서비스 대상으로 지정

## 참고 사이트와의 차이점
- 본 구현은 백엔드(Firebase 등) 연동 대신 `localStorage`를 사용합니다.
- 관리자 인증/권한은 단순화했습니다(학습/검토 목적).
- 화면/흐름은 공개 관찰 기반으로 맞췄지만, 내부 로직과 코드 구조는 독자 구현입니다.

## 대체한 자산/문구 목록
- 원본 이미지 업로드/외부 이미지 자산 대신 기본적으로 이모지(예: 🏀, ⚽)를 사용합니다.
- 고유 상표/브랜드 자산은 포함하지 않았습니다.
- 일부 안내 문구는 의미를 유지하면서 재작성했습니다.

## 기본 예시 데이터 위치
기본 예시 물품(농구공 포함)은 아래 파일에 정의되어 있습니다.
- `src/data/defaultEquipments.ts`

초기 로드 시(`localStorage`에 데이터가 없을 때) 해당 목록으로 시작합니다.

## 주요 구조
- `app/page.tsx`: 전체 화면 상태/흐름 제어
- `src/components/ui.tsx`: 재사용 UI 컴포넌트(헤더/CTA/카드 등)
- `src/lib/storage.ts`: 로컬 저장소 접근
- `PLAN.md`, `docs/reference-audit.md`: 관찰 기반 명세 문서
