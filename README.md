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
이 앱은 Firestore를 **단일 저장소(single source of truth)** 로 사용합니다.  
일반 동작(읽기/쓰기/실시간 동기화)에서 localStorage는 사용하지 않습니다.

### 1) Firebase 프로젝트 설정
- Firebase 콘솔에서 Web App을 생성합니다.
- Firestore Database를 생성합니다(초기 모드: 테스트 또는 규칙 직접 적용).

### 2) 환경변수 설정
`.env.local`에 아래 값들을 설정합니다.

```env
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
- `meta/app`
  - `schemaVersion`
  - `source` (`app` | `seed` | `migration`)
  - `updatedAt`
- `items/master`
  - `items: Equipment[]`
  - `updatedAt`
- `reservations/records`
  - `items: BorrowTransaction[]`
  - `updatedAt`
- `loans/*` (레거시 정리 대상)
  - 과거 테스트 데이터. 관리자 메뉴에서 문서 단위로 정리 권장.
- `settings/adminSettings`
  - `password`
  - `isCustomized`
  - `updatedAt`

## 저장 동작 원칙
1. 앱 시작 시 Firestore에서 교구/대여/설정 문서를 읽습니다.
2. Firestore `onSnapshot`으로 실시간 구독하여 브라우저 간 변경사항을 즉시 반영합니다.
3. Firestore 연결 실패 시 localStorage로 자동 fallback하지 않습니다.
4. 연결 실패 시 UI에 **"Firebase 연결 오류"** 상태가 표시됩니다.
5. localStorage 마이그레이션/자동 fallback은 완전히 제거되어 Firestore만 사용합니다.

## Firestore 초기 시드 방식
1. Firestore 문서가 모두 비어 있을 때만 `기본 데이터 시드` 버튼이 노출됩니다.
2. 시드 데이터는 기본 교구 목록 + 빈 대여 기록 + 기본 관리자 설정으로 구성됩니다.
3. 기본 교구는 모두 미대여 상태(`transactions: []`)로 시작합니다.
4. 특히 **리듬악기세트(28개)** 는 시작 상태가 `대여 0 / 사용 가능 28`이 되도록 설계되어 있습니다.
5. 운영 중 강제 재시드가 필요한 경우, 관리자 메뉴의 **"기본 교구를 Firestore에 다시 시드하기 (주의)"** 버튼에서 경고/확인 단계를 거쳐 명시적으로 실행합니다.

## Firestore 보안 규칙 초안
`firestore.rules` 파일에 알파 테스트용/운영용 초안을 함께 제공합니다.

### 알파 테스트 환경 체크리스트 (중요)
- 이 앱은 Firebase Authentication 없이 Firestore 쓰기/삭제를 수행합니다.
- 따라서 Rules가 엄격하면 `permission-denied`로 대여 등록/관리자 액션이 실패합니다.
- 실패 시 UI에 에러가 표시되며, 콘솔에서도 상세 오류를 확인하세요.
- 배포/테스트 전 `firestore.rules`에서 아래 경로 권한을 반드시 확인하세요.
  - `meta/app`
  - `items/master`
  - `reservations/records`
  - `settings/adminSettings`

## 주요 구조
- `app/page.tsx`: 전체 화면 상태/흐름 제어
- `src/components/ui.tsx`: 재사용 UI 컴포넌트(헤더/CTA/카드 등)
- `src/lib/firebase.ts`: Firebase 앱/Firestore 초기화
- `src/lib/storage.ts`: 화면에서 사용하는 Firestore 저장 API
- `src/storage/service.ts`: Firestore 단일 저장소 서비스
- `src/config/security.ts`: 관리자 초기 비밀번호 설정 (`ADMIN_DEFAULT_PASSWORD`)

## 빌드
```bash
npm run build
```
