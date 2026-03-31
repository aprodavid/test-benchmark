# test-benchmark

공개적으로 관찰 가능한 UX를 바탕으로 재구현한 **교구 대여/반납/관리 레퍼런스 앱**입니다.

## 스택
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Firebase Cloud Firestore

## 로컬 실행 방법
1. 의존성 설치
   ```bash
   npm install
   ```
2. 환경변수 파일 준비
   ```bash
   cp .env.example .env.local
   ```
3. 개발 서버 실행
   ```bash
   npm run dev
   ```
4. 브라우저에서 `http://localhost:3000` 접속

## Firebase 연결 방법
이 앱은 Firestore를 **주 저장소**로 사용하고, localStorage를 **백업/마이그레이션 용도**로 유지합니다.

### 1) Firebase 프로젝트 설정
- Firebase 콘솔에서 Web App을 생성합니다.
- Firestore Database를 생성합니다(초기 모드: 테스트 또는 규칙 직접 적용).

### 2) 환경변수 설정
`.env.local`에 아래 값들을 설정합니다.

```env
NEXT_PUBLIC_STORAGE_PROVIDER=firestore
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

> Analytics는 현재 필수가 아니므로 `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`는 비워도 됩니다.

### 3) Firestore 컬렉션/문서 구조
- `app_meta/state`
  - `schemaVersion`
  - `updatedAt`
  - `migratedFromLocalStorage`
- `equipments/list`
  - `items: Equipment[]`
  - `updatedAt`
- `loans/transactions`
  - `items: BorrowTransaction[]`
  - `updatedAt`
- `settings/admin`
  - `password`
  - `isCustomized`
  - `updatedAt`

## localStorage → Firestore 마이그레이션 흐름
1. 앱 시작 시 Firestore 문서를 먼저 조회합니다.
2. Firestore 데이터가 없으면 localStorage(`tb.appState.v1`)를 조회합니다.
3. localStorage도 없으면 레거시 키(`tb.equipments`, `tb.transactions`, `tb.adminPassword`)에서 마이그레이션합니다.
4. 마이그레이션된 데이터는 localStorage 백업(`tb.firestoreMigrationBackup.v1`)과 Firestore에 동시에 저장합니다.
5. 이후 읽기 기준은 Firestore이며, localStorage는 오프라인/장애 시 안전망으로 사용됩니다.

## Firestore 보안 규칙 초안
`firestore.rules` 파일에 알파 테스트용/운영용 초안을 함께 제공합니다.

## 주요 구조
- `app/page.tsx`: 전체 화면 상태/흐름 제어
- `src/components/ui.tsx`: 재사용 UI 컴포넌트(헤더/CTA/카드 등)
- `src/lib/firebase.ts`: Firebase 앱/Firestore 초기화
- `src/lib/storage.ts`: 화면에서 사용하는 저장 API
- `src/storage/service.ts`: Firestore 우선 저장 + localStorage 백업/마이그레이션
- `src/storage/adapters/localStorageAdapter.ts`: localStorage 어댑터
- `src/storage/adapters/firebaseAdapter.ts`: Firestore 문서 입출력 유틸(호환용)
- `src/config/security.ts`: 관리자 초기 비밀번호 설정 (`ADMIN_DEFAULT_PASSWORD`)

## 빌드
```bash
npm run build
```
