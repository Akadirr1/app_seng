import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Firestore,
  arrayUnion,
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import type { ClubEvent } from './data';
import { isRaffle, type Raffle } from './raffleSchema';

import { FIREBASE_SETUP_HINT, firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

/**
 * Firebase client.
 *
 * Nothing initialises at import time — the app still reads its content from
 * `src/data.ts`, so Firebase only spins up when something calls `getDb()`.
 *
 * Analytics is intentionally absent: `firebase/analytics` has no React Native
 * implementation, so `measurementId` is only useful to the web build.
 */

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error(FIREBASE_SETUP_HINT);
  if (!app) {
    // Fast Refresh re-runs this module, so reuse an existing instance.
    app = getApps().length ? getApp() : initializeApp(firebaseConfig as FirebaseOptions);
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

/** Firestore collection names, kept in one place so app code and rules agree. */
export const COLLECTIONS = {
  events: 'events',
  registrations: 'registrations',
  /**
   * Etkinlik başına koltuk jetonları. Kayıtların kendisi istemciye kapalı —
   * kim kaydolduğu kimseyi ilgilendirmiyor — ama kaç kişi kaydolduğu ekranda
   * gösteriliyor, dolayısıyla sayının okunabilir bir yerde durması gerekiyor.
   *
   * Jetonlar rastgele ve hiçbir şey söylemiyor. Kayıt dokümanının kimliği
   * kullanılamazdı: içinde öğrenci numarası geçiyor ve bu liste herkese açık.
   *
   * Sayaç yerine liste: `arrayUnion` aynı jetonu ikinci kez eklemez, yani
   * yeniden gönderim sayıyı şişirmez. Bir sayaç `increment(1)` ile artsaydı,
   * kayıt yazması idempotent olduktan sonra bile aynı çökme penceresinde iki
   * kez artabilirdi.
   */
  eventSeats: 'eventSeats',
  devices: 'devices',
  raffles: 'raffles',
  raffleEntries: 'raffleEntries',
  /** Hesap profilleri. Doküman kimliği Auth `uid`'i; okuma/yazma yalnızca sahibine. */
  users: 'users',
  /**
   * Hesap silme talepleri. İstemci yazıyor, panel işliyor.
   *
   * Ayrı bir koleksiyon çünkü temizliği istemci yapamıyor: kendi kaydını
   * silmek başkasının koltuk dokümanına dokunmayı gerektiriyor ve Cloud
   * Functions bu projede yok (Blaze istiyor).
   */
  deletionRequests: 'deletionRequests',
  /**
   * Yoklama. Doküman kimliği `eventId__uid` — aynı hesap aynı etkinliğe ikinci
   * kez yazamıyor ve bunu zorlayan şey bir sorgu değil, kimliğin kendisi.
   * Sahibi kendi satırını okuyabiliyor; başkasınınki kapalı.
   */
  attendance: 'attendance',
} as const;

/** Firestore retries an unreachable backend forever, so reads get a deadline. */
const TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: ${TIMEOUT_MS}ms içinde yanıt yok`)), TIMEOUT_MS),
    ),
  ]);
}

/**
 * Reads the club's content. Callers reach this through a dynamic import so the
 * Firestore SDK stays out of the startup bundle.
 */
export async function fetchContent(): Promise<{
  events: ClubEvent[];
  raffles: Raffle[];
  /** Etkinlik kimliği → kayıt sayısı. */
  registered: Record<string, number>;
}> {
  const db = getDb();

  // Arşiv ayrı bir koleksiyon değil: geçmiş etkinliklerin kendisi. Tek okuma,
  // tek sıralama; bölmeyi `splitByDate` yapıyor.
  //
  // Koltuklar da tek okumada geliyor — etkinlik başına ayrı bir sayım sorgusu
  // değil, küçük dokümanlardan oluşan tek bir koleksiyon.
  const [eventsSnap, rafflesSnap] = await Promise.all([
    withTimeout(getDocs(query(collection(db, COLLECTIONS.events), orderBy('startsAt'))), 'events'),
    withTimeout(getDocs(collection(db, COLLECTIONS.raffles)), 'raffles'),
  ]);

  // Koltuklar ayrı ve hatası yutuluyor — bilerek.
  //
  // `Promise.all` içindeyken bu okuma başarısız olduğunda etkinlikler ve
  // çekilişler de düşüyordu: `eventSeats` kuralı yayınlanmadan uygulama tamamen
  // boş açıldı ve ekranda "Missing or insufficient permissions" yazdı. Oysa
  // etkinlikler okunabiliyordu.
  //
  // Kalan yer bir zenginleştirme; takvim onsuz da doğru. Kontenjanı olan bir
  // etkinlik bu durumda "Sınırsız" değil, sadece kalan yeri bilinmiyor gibi
  // davranır ve kayıt açık kalır — dolu bir etkinliği kapatmamak, boş bir
  // uygulama göstermekten iyi.
  const registered: Record<string, number> = {};
  try {
    const seatsSnap = await withTimeout(getDocs(collection(db, COLLECTIONS.eventSeats)), 'eventSeats');
    for (const d of seatsSnap.docs) {
      const ids = (d.data() as { seatIds?: unknown }).seatIds;
      registered[d.id] = Array.isArray(ids) ? ids.length : 0;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[content] Koltuk sayıları okunamadı, kalan yer gösterilmeyecek: ${message}`);
  }

  return {
    events: eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubEvent),
    // İki şey birden: doküman kimliği HER ZAMAN kazanıyor (yayma sonda, yoksa
    // dokümanın içindeki bir `eventId` alanı onu ezerdi), ve geçerli olmayan
    // tanımlar düşüyor — var olan boş bir doküman normal bir etkinliği
    // çekilişe çevirmesin diye. Gerekçe `isRaffle`'ın başında.
    raffles: rafflesSnap.docs.map((d) => ({ ...d.data(), eventId: d.id })).filter(isRaffle),
    registered,
  };
}

/**
 * Bir çekiliş katılımını yazar.
 *
 * Doküman kimliği `entryId` — kayıtlardaki `addDoc` yerine `setDoc`, çünkü aynı
 * katılım iki kez gönderilirse (yazma başarılı olup bayrak diske yazılmadan
 * uygulama ölürse) ikinci yazma kopya üretmek yerine aynı dokümanın üzerine
 * gelir. Kayıtlarda bilinen açık olarak duran şey burada baştan kapalı.
 */
export async function pushRaffleEntry(entry: {
  entryId: string;
  eventId: string;
  values: Record<string, string>;
}): Promise<void> {
  const db = getDb();
  await withTimeout(
    setDoc(doc(db, COLLECTIONS.raffleEntries, entry.entryId), {
      ...entry,
      createdAt: serverTimestamp(),
    }),
    'raffleEntry',
  );
}

export type RegistrationPayload = {
  regId: string;
  seatId: string;
  eventId: string;
  code: string;
  name: string;
  studentNo: string;
  department: string;
  year: string;
};

/**
 * Writes one registration. Throws on failure so the caller can mark it unsynced.
 *
 * Doküman kimliği `${eventId}__${studentNo}` — `addDoc` değil `setDoc`. İki iş
 * birden yapıyor:
 *
 * 1. **Yeniden gönderim kopya üretmiyor.** `addDoc` her çağrıda yeni bir
 *    doküman açardı; yazma Firestore'a ulaşıp `synced` bayrağı diske
 *    yazılmadan uygulama ölürse öğrenci listede iki kez görünürdü.
 * 2. **Aynı öğrenci numarası aynı etkinliğe iki kez yazılamıyor.** İkinci
 *    cihazdan gelen kayıt var olan dokümana denk gelir ve kural onu reddeder.
 *    Sunucuda sayım yok, okuma yok — kimlik zaten benzersizliği taşıyor.
 *
 * Koltuk jetonu ayrı ve rastgele: `eventSeats` listesi herkese açık, oraya
 * içinde öğrenci numarası geçen bir kimlik konamaz.
 */
export async function pushRegistration(payload: RegistrationPayload): Promise<string> {
  const db = getDb();

  // Kayıt ve koltuk tek batch'te: Firestore batch'i atomik, yani ya ikisi de
  // yazılır ya hiçbiri. Ayrı yazsaydık kayıt gidip koltuk gitmeyebilir ve
  // etkinlik dolmadığı hâlde dolmuş görünmeyebilirdi.
  //
  // `arrayUnion` idempotent: aynı jeton ikinci kez eklenmez. Yeniden gönderim
  // ne kopya kayıt üretiyor (doküman kimliği `regId`) ne de sayıyı şişiriyor.
  // Kaydın sahibi: kural `uid`'i zorunlu kılmıyor (mağazada hesapsız bir
  // sürüm var ve zorunlu kılmak onu anında kırardı), ama yazabiliyorsak
  // yazıyoruz — kaydı cihazdan bağımsız okunabilir kılan tek alan bu.
  //
  // Auth modülü dinamik olarak içe aktarılıyor: hesabı olmayan bir kullanıcı
  // için Auth SDK'sını kayıt yoluna sokmanın anlamı yok.
  const { currentUser } = await import('./auth');
  const uid = currentUser()?.uid;

  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.registrations, payload.regId), {
    ...payload,
    ...(uid ? { uid } : {}),
    createdAt: serverTimestamp(),
  });
  batch.set(
    doc(db, COLLECTIONS.eventSeats, payload.eventId),
    { eventId: payload.eventId, seatIds: arrayUnion(payload.seatId) },
    { merge: true },
  );

  await withTimeout(batch.commit(), 'registration');
  return payload.regId;
}

export type DeviceRecord = {
  /** Expo push token. Also the document id — see the note below. */
  token: string;
  platform: string;
  master: boolean;
  categories: Record<string, boolean>;
  reminder: string;
  quietHours: boolean;
};

/**
 * Stores this device's push token and notification preferences so `npm run push`
 * knows who wants what.
 *
 * The token doubles as the document id, which is deliberate: there is no login,
 * so a rule cannot check "is this your document". An unguessable id is the
 * protection available — a device can only overwrite a token it already holds.
 * Reads stay closed to clients; the sender script uses the Admin SDK.
 */
export async function upsertDevice(record: DeviceRecord): Promise<void> {
  const db = getDb();
  await withTimeout(
    setDoc(doc(db, COLLECTIONS.devices, record.token), {
      ...record,
      updatedAt: serverTimestamp(),
    }),
    'device',
  );
}

export { isFirebaseConfigured };
