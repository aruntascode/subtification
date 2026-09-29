import type { Subscription } from "@/stores/subscriptionStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Giriş yapmış kullanıcının henüz sunucuya gitmemiş değişiklikleri.
 * Her değişiklik önce cihazda uygulanır, sonra bu kuyruktan sırayla gönderilir;
 * çevrimdışıyken kuyrukta bekler, bağlantı gelince aktarılır.
 */
export type NewSubscription = Omit<
  Subscription,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export type PendingOp =
  /** `id`: cihazda verilen geçici kimlik (local_…); sunucu gerçek kimliği döner */
  | { kind: "insert"; id: string; payload: NewSubscription }
  | { kind: "update"; ids: string[]; updates: Partial<Subscription> }
  | { kind: "delete"; ids: string[] };

const KEY_PREFIX = "pending_ops_";

export const isLocalId = (id: string) => id.startsWith("local_");

export async function readPendingOps(userId: string): Promise<PendingOp[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Yazmalar sırayla: eski bir kopyanın yenisinin üzerine yazılmasını önler
let writeChain: Promise<void> = Promise.resolve();

export function writePendingOps(userId: string, ops: PendingOp[]): Promise<void> {
  const snapshot = JSON.stringify(ops);
  writeChain = writeChain
    .then(() =>
      ops.length === 0
        ? AsyncStorage.removeItem(KEY_PREFIX + userId)
        : AsyncStorage.setItem(KEY_PREFIX + userId, snapshot),
    )
    .catch(() => {});
  return writeChain;
}

/** Hesap silinince: cihazda gönderilmeyi bekleyen hiçbir değişiklik kalmasın */
export async function clearAllPendingOps() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const opKeys = keys.filter((k) => k.startsWith(KEY_PREFIX));
    if (opKeys.length > 0) await AsyncStorage.multiRemove(opKeys);
  } catch {
    // Silinemezse sonraki gönderimde sunucu reddeder (hesap yok)
  }
}

/**
 * Tekrar denenmeli mi: ağ yok (postgrest `status: 0` döner), zaman aşımı,
 * istek sınırı ya da sunucu hatası. Diğer hatalar (doğrulama, yetki) kalıcıdır.
 */
export const isRetryableStatus = (status: number) =>
  status === 0 || status === 408 || status === 429 || status >= 500;

/** Geçici kimlik gerçeğiyle değişince kuyruktaki sonraki işlemleri de güncelle */
export const remapOps = (ops: PendingOp[], from: string, to: string): PendingOp[] =>
  ops.map((op) =>
    op.kind === "insert"
      ? op
      : { ...op, ids: op.ids.map((id) => (id === from ? to : id)) },
  );
