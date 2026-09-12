/**
 * Etkinlik QR'ı ve yoklama — panel tarafı.
 *
 * Jeton `eventQr/{eventId}` dokümanında duruyor ve **istemciye kapalı**.
 * Firestore kuralı onu `get()` ile okuyup yazılan yoklamayla karşılaştırıyor;
 * kural değerlendirmesi istemcinin okuma izninden geçmediği için jeton hiç
 * kabloya çıkmıyor. Sunucu uç noktası, Cloud Function ve Blaze
 * gerektirmemesinin tek sebebi bu.
 */
import { randomBytes } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import { defaultWindow, makeQrToken, type Pencere } from '../src/qrSchema';

export const QR_COLLECTION = 'eventQr';
export const ATTENDANCE_COLLECTION = 'attendance';

export type QrTanimi = Pencere & { token: string; eventId: string };

function yeniJeton(): string {
  return makeQrToken((n) => Uint8Array.from(randomBytes(n)));
}

/**
 * Etkinliğin QR tanımını verir; yoksa etkinliğin saatinden türetip yazar.
 *
 * Kendiliğinden doğması gerekiyor: operatörün "QR oluştur" diye ayrı bir adım
 * hatırlaması, unutulduğunda etkinlik günü kimsenin okutamaması demek — ve o
 * an düzeltmenin en pahalı olduğu an.
 */
export async function ensureQr(db: Firestore, eventId: string, startsAt: string): Promise<QrTanimi> {
  const ref = db.collection(QR_COLLECTION).doc(eventId);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data() ?? {};
    return {
      eventId,
      token: String(d.token ?? ''),
      opensAt: String(d.opensAt ?? ''),
      closesAt: String(d.closesAt ?? ''),
    };
  }

  const pencere = defaultWindow(startsAt);
  if (!pencere) {
    throw new Error(`Etkinliğin başlangıç saati okunamadı, QR penceresi hesaplanamıyor: ${startsAt}`);
  }
  const tanim: QrTanimi = { eventId, token: yeniJeton(), ...pencere };
  await ref.set(tanim);
  return tanim;
}

/**
 * Jetonu yeniler. Eski jeton o anda ölüyor.
 *
 * Var olma sebebi: yanlış basılmış bir afiş, sızdığına pişman olunan bir kod,
 * ya da yanlış etkinliğin QR'ının projeksiyona düşmesi. Pencere korunuyor —
 * yenileme bir zaman kararı değil, bir kimlik kararı.
 */
export async function regenerateQr(db: Firestore, eventId: string): Promise<QrTanimi> {
  const ref = db.collection(QR_COLLECTION).doc(eventId);
  const snap = await ref.get();
  const d = snap.data() ?? {};
  const tanim: QrTanimi = {
    eventId,
    token: yeniJeton(),
    opensAt: String(d.opensAt ?? ''),
    closesAt: String(d.closesAt ?? ''),
  };
  await ref.set(tanim);
  return tanim;
}

/** Pencereyi elle değiştirir. Jeton korunuyor — basılmış afiş geçerli kalsın. */
export async function setQrWindow(db: Firestore, eventId: string, pencere: Pencere): Promise<void> {
  await db.collection(QR_COLLECTION).doc(eventId).set(pencere, { merge: true });
}

export type YoklamaSatiri = {
  uid: string;
  adSoyad: string;
  ogrenciNo: string;
  email: string;
  kaynak: 'qr' | 'panel';
  checkedInAt: string;
  sertifikaNo?: string;
};

/**
 * Bir etkinliğin yoklama listesi, profillerle birleştirilmiş.
 *
 * İsim `attendance` dokümanında DURMUYOR ve durmamalı: orası yoklama defteri,
 * kişisel veri kopyası değil. İki yerde tutmak, ikisinin ayrışmasının tek
 * sebebi olurdu — ad profilde değişince yoklama eski adı gösterirdi.
 */
export async function attendanceRows(db: Firestore, eventId: string): Promise<YoklamaSatiri[]> {
  const snap = await db.collection(ATTENDANCE_COLLECTION).where('eventId', '==', eventId).get();
  if (snap.empty) return [];

  const uidler = snap.docs.map((d) => String(d.get('uid') ?? '')).filter(Boolean);
  const profiller = new Map<string, Record<string, unknown>>();
  // `getAll` tek turda okuyor; uid başına ayrı `get()` yüz kişilik bir
  // etkinlikte yüz gidiş dönüş demekti.
  if (uidler.length) {
    const refs = uidler.map((u) => db.collection('users').doc(u));
    const docs = await db.getAll(...refs);
    docs.forEach((d, i) => profiller.set(uidler[i], d.data() ?? {}));
  }

  return snap.docs
    .map((d) => {
      const uid = String(d.get('uid') ?? '');
      const p = profiller.get(uid) ?? {};
      const sertifika = d.get('certificate') as { no?: string } | undefined;
      return {
        uid,
        adSoyad: String(p.adSoyad ?? '(profil yok)'),
        ogrenciNo: String(p.ogrenciNo ?? ''),
        email: String(p.email ?? ''),
        kaynak: (d.get('kaynak') === 'panel' ? 'panel' : 'qr') as 'qr' | 'panel',
        checkedInAt: zamanMetni(d.get('checkedInAt')),
        sertifikaNo: sertifika?.no,
      };
    })
    .sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, 'tr'));
}

function zamanMetni(v: unknown): string {
  if (v && typeof v === 'object' && 'toDate' in (v as object)) {
    try {
      return (v as { toDate(): Date }).toDate().toISOString();
    } catch {
      return '';
    }
  }
  return typeof v === 'string' ? v : '';
}

/**
 * Elle yoklama — QR okutamamış ya da telefonu olmayan katılımcı için.
 *
 * **Sertifika akışının QR'a bağımlı olmamasının sebebi bu.** QR henüz her
 * etkinlikte kullanılmıyor; yoklama kaydı panelden de doğabiliyor ve
 * sertifika ikisini ayırt etmiyor. `kaynak` alanı yalnızca panelde görünüyor,
 * sertifikaya girmiyor: belge "katıldı" diyor, "nasıl işaretlendi" demiyor.
 */
export async function markAttendance(db: Firestore, eventId: string, uid: string, now: Date): Promise<void> {
  await db
    .collection(ATTENDANCE_COLLECTION)
    .doc(`${eventId}__${uid}`)
    .set({ eventId, uid, kaynak: 'panel', checkedInAt: now }, { merge: true });
}

/**
 * Elle işaretlemeyi geri alır.
 *
 * Sertifikası yayınlanmış bir yoklama **silinmiyor**: belge dışarıda, adresi
 * paylaşılmış olabilir, ve dayanağını silmek onu doğrulanamaz hâle getirir.
 * Böyle bir satırı geri almak isteyen operatörün önce sertifikayı iptal
 * etmesi gerekiyor — o ayrı ve bilerek daha görünür bir işlem.
 */
export async function unmarkAttendance(db: Firestore, eventId: string, uid: string): Promise<'silindi' | 'sertifika-var'> {
  const ref = db.collection(ATTENDANCE_COLLECTION).doc(`${eventId}__${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return 'silindi';
  if (snap.get('certificate')) return 'sertifika-var';
  await ref.delete();
  return 'silindi';
}

/** Kaydolmuş ama yoklamada olmayanlar — kulübün en çok sorduğu liste. */
export async function registeredNotPresent(
  db: Firestore,
  eventId: string,
): Promise<{ adSoyad: string; studentNo: string; hesapVar: boolean }[]> {
  const [kayitlar, yoklama] = await Promise.all([
    db.collection('registrations').where('eventId', '==', eventId).get(),
    db.collection(ATTENDANCE_COLLECTION).where('eventId', '==', eventId).get(),
  ]);
  const gelenler = new Set(yoklama.docs.map((d) => String(d.get('uid') ?? '')));
  return kayitlar.docs
    .filter((d) => {
      const uid = String(d.get('uid') ?? '');
      return !uid || !gelenler.has(uid);
    })
    .map((d) => ({
      adSoyad: String(d.get('name') ?? ''),
      studentNo: String(d.get('studentNo') ?? ''),
      // Hesabı olmayan kayıt yoklamaya giremiyor ve sertifika alamıyor —
      // operatör bunu listede görmeli, yoksa "neden işaretleyemiyorum" diye
      // sorar ve cevabı hiçbir yerde yazmaz.
      hesapVar: Boolean(d.get('uid')),
    }))
    .sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, 'tr'));
}
