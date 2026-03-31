export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

/**
 * NOTE:
 * - 이번 배포는 즉시 동작을 위해 config를 코드에 직접 포함합니다.
 * - 추후 process.env 기반으로 교체하기 쉽게 파일 분리만 해둡니다.
 */
export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "AIzaSyCnSqpbdcaepyJw68u067P8UZ6TNdFeSRE",
  authDomain: "naerisup-tmmapp.firebaseapp.com",
  projectId: "naerisup-tmmapp",
  storageBucket: "naerisup-tmmapp.firebasestorage.app",
  messagingSenderId: "211486373404",
  appId: "1:211486373404:web:87da254fb21e71a32491d9",
  measurementId: "G-LSKNDFPYB4",
};
