import { StorageAdapter } from "@/storage/types";

/**
 * Firebase/Firestore 연동 준비용 자리입니다.
 * 실제 구현 시 read/write를 Firestore 문서 CRUD로 교체하면 됩니다.
 */
export class FirebaseAdapter implements StorageAdapter {
  read<T>(_key: string, fallback: T): T {
    return fallback;
  }

  write<T>(_key: string, _value: T): void {
    // TODO: Firestore write 로직 연결
  }
}
