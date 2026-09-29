import { BillingCycle, Category } from "@/constants/categories";
import { syncSubscriptionNotifications } from "@/lib/notifications";
import {
  getDaysUntilNextPayment,
  getNextPaymentDate,
  isBilling,
} from "@/lib/subscriptionDuration";
import {
  isLocalId,
  isRetryableStatus,
  type NewSubscription,
  type PendingOp,
  readPendingOps,
  remapOps,
  writePendingOps,
} from "@/lib/pendingOps";
import { getStoredSessionUser, supabase } from "@/lib/supabase";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency?: string; // YENİ: Sisteme para birimini tanıtıyoruz (Soru işareti eski verilerin hata vermemesi için)
  billing_cycle: BillingCycle;
  category: Category;
  next_billing_date: string;
  emoji: string;
  color: string;
  is_active: boolean;
  /** null: not temizlendi (Supabase'de undefined alan güncellenmez) */
  notes?: string | null;
  /** Kaç ay sürecek; null/undefined = süresiz */
  duration_months?: number | null;
  /** Taksitli alım mı (süreli olmak zorunda) */
  is_installment?: boolean;
  /** Süreli kayıtlarda ilk ödemenin tarihi; kalan ay bu tarihten hesaplanır */
  first_billing_date?: string | null;
  /** "Son eklenenler" sıralaması için; Supabase'de varsayılan now() */
  created_at?: string;
}

interface SubscriptionState {
  subscriptions: Subscription[];
  loading: boolean;
  initialized: boolean;
  /** Giriş yapmış kullanıcının sunucuya henüz gitmemiş değişiklik sayısı */
  pendingCount: number;
  /**
   * Çevrimdışı eklenen kaydın geçici kimliği → sunucudaki gerçek kimliği.
   * O kaydın detay/düzenleme sayfası açıkken kimlik değişirse sayfa kaydı bulabilsin.
   */
  idAliases: Record<string, string>;
  fetchSubscriptions: () => Promise<void>;
  /** Bekleyen değişiklikleri sunucuya göndermeyi dener (çevrimdışıysa sonra tekrar) */
  syncPendingChanges: () => Promise<void>;
  addSubscription: (sub: NewSubscription) => Promise<void>;
  /** Birden fazla aboneliği tek seferde ekler (toplu ekleme ekranı) */
  addSubscriptions: (subs: NewSubscription[]) => Promise<void>;
  updateSubscription: (
    id: string,
    updates: Partial<Subscription>,
  ) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  /** Toplu seçim: birden fazla aboneliği duraklatır / devam ettirir */
  setActiveMany: (ids: string[], isActive: boolean) => Promise<void>;
  /** Toplu seçim: birden fazla aboneliği siler */
  deleteMany: (ids: string[]) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  totalMonthly: () => number;
  upcomingPayments: () => Subscription[];
  byCategory: () => {
    category: Category;
    total: number;
    items: Subscription[];
  }[];
}

const normalizeToMonthly = (amount: number, cycle: BillingCycle): number => {
  switch (cycle) {
    case "weekly":
      return amount * 4.333;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
  }
};

export const LOCAL_SUBSCRIPTIONS_KEY = "guest_subscriptions";

// Kayıtlı tarih eskiyebilir; sıralama takvimden hesaplanan sonraki ödemeye göre.
// Biten süreli kayıtlar sona gider.
const nextPaymentTime = (s: Subscription) =>
  getNextPaymentDate(s)?.getTime() ?? Number.POSITIVE_INFINITY;

const sortByNextBillingDate = (subscriptions: Subscription[]) =>
  [...subscriptions].sort((a, b) => nextPaymentTime(a) - nextPaymentTime(b));

const readLocalSubscriptions = async (): Promise<Subscription[]> => {
  const raw = await AsyncStorage.getItem(LOCAL_SUBSCRIPTIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalSubscriptions = async (subscriptions: Subscription[]) => {
  await AsyncStorage.setItem(
    LOCAL_SUBSCRIPTIONS_KEY,
    JSON.stringify(subscriptions),
  );
};

// Giriş yapmış kullanıcının buluttan son alınan listesi; çevrimdışı açılışta
// liste boş görünmesin diye. Kullanıcıya özel anahtar: hesap değişince başkasının
// kayıtları görünmez.
const CLOUD_CACHE_KEY_PREFIX = "cloud_subscriptions_cache_";

const readCloudCache = async (userId: string): Promise<Subscription[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(CLOUD_CACHE_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

// Önbellek yazılamazsa asıl işlem (ekleme, silme…) başarısız sayılmasın
const writeCloudCache = (userId: string, subscriptions: Subscription[]) =>
  AsyncStorage.setItem(
    CLOUD_CACHE_KEY_PREFIX + userId,
    JSON.stringify(subscriptions),
  ).catch(() => {});

/** Çıkışta ve hesap silmede çağrılır; cihazda başka hesabın verisi kalmasın */
export const clearCloudCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CLOUD_CACHE_KEY_PREFIX));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // Temizlenemezse bir sonraki başarılı çekişte zaten üzerine yazılır
  }
};

const createLocalId = () =>
  `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

// Oturum cihazdaki kayıttan okunur. getUser() sunucuya sorar ve çevrimdışıyken
// null döner; bu durumda giriş yapmış kullanıcı misafir sanılır, bulut kayıtları
// yerele yazılır ve bağlantı gelince bir kez daha yüklenirdi. Token dolmuşken
// çevrimdışı getSession() da null döner; o zaman kayıtlı oturuma bakılır.
const getCurrentUser = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (session) return session.user;
  if (error && isAuthRetryableFetchError(error)) return getStoredSessionUser();
  return null;
};

const uploadLocalSubscriptions = async (userId: string) => {
  const localSubscriptions = await readLocalSubscriptions();
  if (localSubscriptions.length === 0) return;

  const payload = localSubscriptions.map((subscription) => ({
    user_id: userId,
    name: subscription.name,
    amount: subscription.amount,
    currency: subscription.currency ?? "₺",
    billing_cycle: subscription.billing_cycle,
    category: subscription.category,
    next_billing_date: subscription.next_billing_date,
    emoji: subscription.emoji,
    color: subscription.color,
    is_active: subscription.is_active,
    notes: subscription.notes ?? null,
    created_at: subscription.created_at,
    duration_months: subscription.duration_months ?? null,
    is_installment: subscription.is_installment ?? false,
    first_billing_date: subscription.first_billing_date ?? null,
  }));

  const { error } = await supabase.from("subscriptions").insert(payload);
  if (error) throw error;

  await AsyncStorage.removeItem(LOCAL_SUBSCRIPTIONS_KEY);
};

// ---------- çevrimdışı değişiklik kuyruğu (yalnızca giriş yapmış kullanıcı) ----------

// Bellekteki kuyruk tek doğruluk kaynağı; her değişiklikte diske de yazılır
let queue: PendingOp[] = [];
let queueUserId: string | null = null;
let flushPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const RETRY_DELAY_MS = 30_000;

const loadQueue = async (userId: string) => {
  if (queueUserId === userId) return;
  queue = await readPendingOps(userId);
  queueUserId = userId;
  useSubscriptionStore.setState({ pendingCount: queue.length });
};

const saveQueue = async (userId: string) => {
  useSubscriptionStore.setState({ pendingCount: queue.length });
  await writePendingOps(userId, queue);
};

const enqueue = async (userId: string, ops: PendingOp[]) => {
  await loadQueue(userId);
  queue = [...queue, ...ops];
  await saveQueue(userId);
};

const scheduleRetry = () => {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void useSubscriptionStore.getState().syncPendingChanges();
  }, RETRY_DELAY_MS);
};

type SendResult =
  | { status: "done"; row?: Subscription }
  | { status: "retry" }
  | { status: "rejected"; message: string };

/** Tek bir işlemi sunucuya gönderir; ağ hatasını kalıcı hatadan ayırır */
const sendOp = async (userId: string, op: PendingOp): Promise<SendResult> => {
  try {
    if (op.kind === "insert") {
      const { data, error, status } = await supabase
        .from("subscriptions")
        .insert({ ...op.payload, user_id: userId })
        .select()
        .single();
      if (!error) return { status: "done", row: data };
      return isRetryableStatus(status)
        ? { status: "retry" }
        : { status: "rejected", message: error.message };
    }

    // Hâlâ geçici olan kimlik: eklenmesi reddedilmiş kayıt; sunucuda karşılığı yok
    const ids = op.ids.filter((id) => !isLocalId(id));
    if (ids.length === 0) return { status: "done" };

    const request =
      op.kind === "update"
        ? supabase.from("subscriptions").update(op.updates).in("id", ids)
        : supabase.from("subscriptions").delete().in("id", ids);
    const { error, status } = await request;
    if (!error) return { status: "done" };
    return isRetryableStatus(status)
      ? { status: "retry" }
      : { status: "rejected", message: error.message };
  } catch {
    // fetch'in kendisi hata fırlattıysa ağ sorunudur
    return { status: "retry" };
  }
};

/** Kuyruğu baştan sona sırayla gönderir; ağ hatasında durur ve sonra tekrar dener */
const runFlush = async () => {
  const user = await getCurrentUser();
  if (!user) return;
  await loadQueue(user.id);

  while (queue.length > 0) {
    const op = queue[0];
    const result = await sendOp(user.id, op);

    if (result.status === "retry") {
      scheduleRetry();
      return;
    }

    queue = queue.slice(1);

    if (op.kind === "insert" && result.status === "done" && result.row) {
      const realId = result.row.id;
      const createdAt = result.row.created_at;
      queue = remapOps(queue, op.id, realId);
      useSubscriptionStore.setState((state) => ({
        subscriptions: state.subscriptions.map((s) =>
          s.id === op.id ? { ...s, id: realId, created_at: createdAt ?? s.created_at } : s,
        ),
        idAliases: { ...state.idAliases, [op.id]: realId },
      }));
    } else if (result.status === "rejected") {
      console.warn("Değişiklik sunucuda reddedildi, atlanıyor.", op.kind, result.message);
      // Eklenemeyen kayıt listede kalmasın; diğer reddedilenleri sonraki çekiş düzeltir
      if (op.kind === "insert") {
        useSubscriptionStore.setState((state) => ({
          subscriptions: state.subscriptions.filter((s) => s.id !== op.id),
        }));
      }
    }

    await saveQueue(user.id);
    await writeCloudCache(user.id, useSubscriptionStore.getState().subscriptions);
  }

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  await syncSubscriptionNotifications(useSubscriptionStore.getState().subscriptions);
};

const flushPendingOps = () => {
  if (!flushPromise) {
    flushPromise = runFlush()
      .catch((error) => console.warn("Bekleyen değişiklikler gönderilemedi.", error))
      .finally(() => {
        flushPromise = null;
      });
  }
  return flushPromise;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  /**
   * Değişikliği hemen cihazda uygular. Giriş yapmış kullanıcıda işlemleri
   * kuyruğa ekler ve göndermeyi arkada başlatır: ekran ağı beklemez, çevrimdışıyken
   * de çalışır. Misafirde yalnızca cihaza yazar.
   */
  const commit = async (
    next: (current: Subscription[]) => Subscription[],
    ops: PendingOp[],
  ) => {
    // Sunucuya sormadan: token dolmuşken çevrimdışı getSession() ~30 sn yenilemeye çalışır
    const user = await getStoredSessionUser();
    let nextSubscriptions: Subscription[] = [];
    set((state) => {
      nextSubscriptions = sortByNextBillingDate(next(state.subscriptions));
      return { subscriptions: nextSubscriptions };
    });

    if (!user) {
      await writeLocalSubscriptions(nextSubscriptions);
    } else {
      await writeCloudCache(user.id, nextSubscriptions);
      await enqueue(user.id, ops);
      void flushPendingOps();
    }
    await syncSubscriptionNotifications(nextSubscriptions);
  };

  const newRow = (sub: NewSubscription, createdAt: string): Subscription => ({
    ...sub,
    id: createLocalId(),
    created_at: createdAt,
  });

  return {
    subscriptions: [],
    loading: false,
    initialized: false,
    pendingCount: 0,
    idAliases: {},

    fetchSubscriptions: async () => {
      set({ loading: true });
      try {
        // İlk açılışta önbellek ağ beklenmeden gösterilir: token dolmuşken
        // çevrimdışı oturum yenileme ~30 sn tekrar dener, splash o kadar kalmasın.
        // Liste aşağıda sunucudan (ya da yine önbellekten) güncellenir.
        if (!get().initialized) {
          const storedUser = await getStoredSessionUser();
          const cached = storedUser ? await readCloudCache(storedUser.id) : null;
          if (cached) {
            set({ subscriptions: sortByNextBillingDate(cached), initialized: true });
          }
        }

        const user = await getCurrentUser();

        if (!user) {
          queue = [];
          queueUserId = null;
          const subscriptions = sortByNextBillingDate(
            await readLocalSubscriptions(),
          );
          set({ subscriptions, pendingCount: 0 });
          await syncSubscriptionNotifications(subscriptions);
          return;
        }

        // Önce bekleyen değişiklikleri gönder; sunucudaki liste onları içersin
        await flushPendingOps();

        const showCache = async () => {
          const cached = await readCloudCache(user.id);
          if (cached) set({ subscriptions: sortByNextBillingDate(cached) });
        };

        // Hâlâ bekleyen var: çevrimdışı. Cihazdaki (değişiklikler uygulanmış) liste geçerli
        if (queue.length > 0) {
          await showCache();
          return;
        }

        let data: Subscription[] | null;
        try {
          await uploadLocalSubscriptions(user.id);

          const result = await supabase
            .from("subscriptions")
            .select("*")
            .order("next_billing_date", { ascending: true });
          if (result.error) throw result.error;
          data = result.data;
        } catch (error) {
          // Çevrimdışı ya da sunucu hatası: son alınan liste varsa onu göster
          const cached = await readCloudCache(user.id);
          if (!cached) throw error;
          await showCache();
          return;
        }

        // Çekiş sürerken yeni değişiklik yapıldıysa sunucu listesi onu içermez;
        // üzerine yazma, önce gönder
        if (queue.length > 0) {
          void flushPendingOps();
          return;
        }

        const subscriptions = sortByNextBillingDate(data ?? []);
        set({ subscriptions });
        await writeCloudCache(user.id, subscriptions);
        await syncSubscriptionNotifications(subscriptions);
      } finally {
        set({ loading: false, initialized: true });
      }
    },

    syncPendingChanges: () => flushPendingOps(),

    addSubscription: async (sub) => {
      const row = newRow(sub, new Date().toISOString());
      await commit(
        (current) => [...current, row],
        [{ kind: "insert", id: row.id, payload: sub }],
      );
    },

    addSubscriptions: async (subs) => {
      if (subs.length === 0) return;
      const createdAt = new Date().toISOString();
      const rows = subs.map((sub) => newRow(sub, createdAt));
      await commit(
        (current) => [...current, ...rows],
        rows.map((row, i) => ({ kind: "insert", id: row.id, payload: subs[i] })),
      );
    },

    updateSubscription: async (id, updates) => {
      await commit(
        (current) => current.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        [{ kind: "update", ids: [id], updates }],
      );
    },

    deleteSubscription: async (id) => {
      await commit(
        (current) => current.filter((s) => s.id !== id),
        [{ kind: "delete", ids: [id] }],
      );
    },

    setActiveMany: async (ids, isActive) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      await commit(
        (current) =>
          current.map((s) => (idSet.has(s.id) ? { ...s, is_active: isActive } : s)),
        [{ kind: "update", ids, updates: { is_active: isActive } }],
      );
    },

    deleteMany: async (ids) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      await commit(
        (current) => current.filter((s) => !idSet.has(s.id)),
        [{ kind: "delete", ids }],
      );
    },

    toggleActive: async (id) => {
      const sub = get().subscriptions.find((s) => s.id === id);
      if (!sub) return;
      await get().updateSubscription(id, { is_active: !sub.is_active });
    },

  totalMonthly: () => {
    return get()
      .subscriptions.filter(isBilling)
      .reduce(
        (sum, s) => sum + normalizeToMonthly(s.amount, s.billing_cycle),
        0,
      );
  },

  upcomingPayments: () =>
    sortByNextBillingDate(
      get().subscriptions.filter((s) => {
        if (!isBilling(s)) return false;
        const days = getDaysUntilNextPayment(s);
        return days !== null && days <= 30;
      }),
    ),

  byCategory: () => {
    const subs = get().subscriptions.filter(isBilling);
    const map = new Map<Category, { total: number; items: Subscription[] }>();
    for (const s of subs) {
      const entry = map.get(s.category) ?? { total: 0, items: [] };
      entry.total += normalizeToMonthly(s.amount, s.billing_cycle);
      entry.items.push(s);
      map.set(s.category, entry);
    }
    return Array.from(map.entries())
      .map(([category, { total, items }]) => ({ category, total, items }))
      .sort((a, b) => b.total - a.total);
  },
  };
});
