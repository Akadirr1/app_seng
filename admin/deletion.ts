/**
 * Hesap silme temizliği.
 *
 * Bu iş normalde Auth `onDelete` tetikleyicisinin: kullanıcı silinir,
 * fonksiyon verisini toplar. Cloud Functions bu projede **yok** — Firebase'in
 * kendi belgesi net, dağıtmak için Blaze planı gerekiyor ve bu proje Spark'ta
 * (Storage'ın Blaze istemesiyle aynı sebep). Dolayısıyla temizlik panelin
 * üçüncü yoklayıcısı; `startPushFlusher` ve `startAnnouncementPoller` ile
 * aynı desen.
 *
 * Sıra: önce veri, **en son** Auth kaydı. Ters olsaydı istemci kendi
 * talebinin bittiğini okuyamaz ve Apple'ın istediği "tamamlandı" onayı
 * verilemezdi.
 */
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

import { releaseIdentity } from './claims';

/** Yoklama aralığı. Kullanıcı ekranda bekliyor olabilir; sık ama bedava değil. */
const INTERVAL_MS = 60_000;

/**
 * İstemci Auth kaydını kendisi siliyor (ekranda onayı gördükten sonra).
 * Uygulamayı kapatırsa bu süre sonunda panel siliyor — Apple silmenin
 * tamamlanmasını istiyor, kullanıcının ekranda kalmasını değil.
 */
const AUTH_GRACE_MS = 10 * 60_000;

/**
 * Bir kullanıcının verisinin durduğu yerler.
 *
 * İki liste çünkü iki farklı şekilde bulunuyorlar: profilin doküman kimliği
 * `uid`'in kendisi, kayıtların kimliği ise öğrenci numarasından türüyor ve
 * yalnızca `uid` alanıyla sorgulanabiliyor.
 *
 * `processDeletion` bu listeleri **dolaşıyor**, elle yazılmış bir sırayı
 * değil. Listeye eklenip döngüye eklenmeyen bir koleksiyon, silindiğini sanan
 * bir kullanıcının geride kalan verisi olurdu ve bunu kimse fark etmez —
 * listeyi tek doğru kaynak yapmak o ihtimali ortadan kaldırıyor.
 */
export const USER_DOC_COLLECTIONS = ['users', 'emailOtp'] as const;
export const USER_QUERY_COLLECTIONS = ['registrations', 'raffleEntries'] as const;

export type DeletionOutcome = { uid: string; silinen: number };

/**
 * Tek bir talebi işler.
 *
 * `registrations` ve `raffleEntries` `uid` alanına göre sorgulanıyor —
 * doküman kimliğinden bulunamıyorlar, çünkü kimlik öğrenci numarasından
 * türüyor ve panel kullanıcının numarasını bilmiyor.
 *
 * Koltuk jetonu (`eventSeats`) bilerek **silinmiyor**: jeton rastgele ve
 * kişisel veri taşımıyor, ama listeden çıkarmak kontenjanı geriye açar ve
 * etkinliğe fazladan kişi alınmasına yol açar. Kayıt silindiği için panel
 * "sayacı gerçek kayıtlara eşitle" ile zaten düzeltebiliyor.
 */
export async function processDeletion(
  db: Firestore,
  uid: string,
  now = Date.now(),
): Promise<DeletionOutcome> {
  let silinen = 0;

  // Teklik kayıtları iki listeye de giremiyor: doküman kimlikleri `uid` değil,
  // telefonun ve öğrenci numarasının kendisi, ve `uid` alanıyla sorgulanabilseler
  // bile profil silindikten sonra hangi değerler olduğu okunamaz. Bu yüzden
  // profil OKUNDUKTAN SONRA ama silinmeden önce serbest bırakılıyorlar —
  // atlanırsa silinen hesabın numarası sonsuza kadar kilitli kalır ve aynı
  // kişi bir daha kayıt olamaz.
  const profil = (await db.collection('users').doc(uid).get()).data() ?? {};
  await releaseIdentity(db, {
    telefon: typeof profil.telefon === 'string' ? profil.telefon : undefined,
    ogrenciNo: typeof profil.ogrenciNo === 'string' ? profil.ogrenciNo : undefined,
  });

  for (const name of USER_DOC_COLLECTIONS) {
    await db.collection(name).doc(uid).delete();
    silinen += 1;
  }

  for (const name of USER_QUERY_COLLECTIONS) {
    const snap = await db.collection(name).where('uid', '==', uid).get();
    for (const d of snap.docs) {
      await d.ref.delete();
      silinen += 1;
    }
  }

  // Cihaz kaydının kimliği push jetonu, kullanıcı değil. Kullanıcıya bağlı
  // olmadığı için burada silinemiyor — cihazdan çıkış yapmak onu zaten
  // bırakıyor ve jeton kişiyi tanımlamıyor.

  await db.collection('deletionRequests').doc(uid).set(
    { status: 'done', completedAt: new Date(now).toISOString(), silinen },
    { merge: true },
  );

  return { uid, silinen };
}

/** Auth kaydını siler; istemci kendisi sildiyse zaten yok. */
async function deleteAuthUser(uid: string): Promise<void> {
  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    // `user-not-found` beklenen durum: istemci onayı görüp kendi kaydını
    // silmiş. Hata saymak, temiz biten bir akışı kırmızı gösterirdi.
    const code = (err as { code?: string })?.code;
    if (code !== 'auth/user-not-found') {
      console.error(`[silme] ${uid} Auth kaydı silinemedi:`, err);
    }
  }
}

/** Bir turda bekleyen talepleri işler. Testten de çağrılabilsin diye ayrı. */
export async function runDeletionSweep(db: Firestore, now = Date.now()): Promise<DeletionOutcome[]> {
  const sonuc: DeletionOutcome[] = [];

  const bekleyen = await db.collection('deletionRequests').where('status', '==', 'pending').get();
  for (const doc of bekleyen.docs) {
    const uid = doc.id;
    try {
      sonuc.push(await processDeletion(db, uid, now));
      console.log(`[silme] ${uid} verisi silindi.`);
    } catch (err) {
      console.error(`[silme] ${uid} işlenemedi:`, err);
    }
  }

  // Verisi silinmiş ama Auth kaydı hâlâ duranlar: istemci ekranı kapatmış.
  const bitmis = await db.collection('deletionRequests').where('status', '==', 'done').get();
  for (const doc of bitmis.docs) {
    const data = doc.data() as { completedAt?: string; authSilindi?: boolean };
    if (data.authSilindi) continue;
    const bittiAt = Date.parse(String(data.completedAt ?? ''));
    // Okunamayan tarihte bekleniyor, silinmiyor: buradaki iki hatadan biri
    // geç silinen bir hesap, öteki yanlış zamanda silinen bir hesap.
    if (!Number.isFinite(bittiAt) || now - bittiAt < AUTH_GRACE_MS) continue;
    await deleteAuthUser(doc.id);
    await doc.ref.set({ authSilindi: true }, { merge: true });
  }

  return sonuc;
}

export function startDeletionSweeper(db: Firestore): void {
  const tick = () => {
    runDeletionSweep(db).catch((err) => console.error('[silme] tur başarısız:', err));
  };
  tick();
  // Tipler DOM'un `setInterval`'ını görüyor (bu depoda `lib` DOM içeriyor),
  // çalışma zamanı Node. `unref` orada var ve süreci açık tutmamasını
  // sağlıyor; tipin görmemesi varlığını değiştirmiyor.
  (setInterval(tick, INTERVAL_MS) as unknown as { unref?: () => void }).unref?.();
}
