/**
 * Teklik: bir telefon numarası ve bir öğrenci numarası tek hesaba ait.
 *
 * E-posta tekliği zaten Firebase Auth'un işi (`auth/email-already-in-use`),
 * yani burada yalnızca kalan ikisi var.
 *
 * **Neden kural değil de panel:** kurallarla da yazılabilirdi (değer doküman
 * kimliği olur, `allow create` var olan dokümanda düşer — `set()` bir update
 * sayıldığı için). İki sebeple yazılmadı:
 *
 * 1. **İkisi birden ya da hiçbiri.** İki ayrı istemci yazması atomik değil:
 *    telefon tutuyor, numara çakışıyor, ve geride kimsenin sahiplenmediği bir
 *    telefon kaydı kalıyor. Admin SDK'nın işlemi bunu tek adımda yapıyor.
 * 2. **Çakışan alanın adı söylenebiliyor.** Kural reddi istemciye tek bir
 *    `permission-denied` olarak dönüyor; kullanıcıya "telefon mu numara mı"
 *    denemezdi.
 *
 * **Zorlamadığı şey:** numaranın gerçekten o kişiye ait olduğu. Üniversiteye
 * soracak bir yer yok. Zorladığı tek şey aynı numaranın ikinci bir hesapta
 * kullanılamaması — sertifikanın dayandığı varsayım da yalnızca bu kadarı.
 */
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export const PHONE_CLAIMS = 'phoneClaims';
export const STUDENT_CLAIMS = 'studentClaims';

export type Kimlik = { telefon: string; ogrenciNo: string };

export type ClaimResult =
  | { ok: true }
  | { ok: false; alan: 'telefon' | 'ogrenciNo' };

/**
 * Tek bir sahiplenmeyi işlem içinde dener.
 *
 * `null` → boşta ya da zaten bizim. Aksi hâlde başkasının.
 */
async function sahiplen(
  tx: Transaction,
  db: Firestore,
  koleksiyon: string,
  deger: string,
  uid: string,
): Promise<boolean> {
  const ref = db.collection(koleksiyon).doc(deger);
  const snap = await tx.get(ref);
  if (snap.exists && snap.get('uid') !== uid) return false;
  return true;
}

/**
 * Telefon ve öğrenci numarasını bu hesaba bağlar.
 *
 * Eski değerler serbest bırakılıyor: çakışma yüzünden numarasını düzelten
 * kullanıcı, düzeltmeden önceki değeri sonsuza kadar kilitli bırakmasın.
 *
 * Firestore işlemi **bütün okumaları yazmalardan önce** istiyor, o yüzden iki
 * kontrol de baştan yapılıyor.
 */
export async function claimIdentity(
  db: Firestore,
  uid: string,
  yeni: Kimlik,
  eski: Partial<Kimlik> = {},
): Promise<ClaimResult> {
  return db.runTransaction(async (tx) => {
    if (!(await sahiplen(tx, db, PHONE_CLAIMS, yeni.telefon, uid))) {
      return { ok: false, alan: 'telefon' } as const;
    }
    if (!(await sahiplen(tx, db, STUDENT_CLAIMS, yeni.ogrenciNo, uid))) {
      return { ok: false, alan: 'ogrenciNo' } as const;
    }

    const now = new Date().toISOString();
    tx.set(db.collection(PHONE_CLAIMS).doc(yeni.telefon), { uid, claimedAt: now });
    tx.set(db.collection(STUDENT_CLAIMS).doc(yeni.ogrenciNo), { uid, claimedAt: now });

    if (eski.telefon && eski.telefon !== yeni.telefon) {
      tx.delete(db.collection(PHONE_CLAIMS).doc(eski.telefon));
    }
    if (eski.ogrenciNo && eski.ogrenciNo !== yeni.ogrenciNo) {
      tx.delete(db.collection(STUDENT_CLAIMS).doc(eski.ogrenciNo));
    }

    return { ok: true } as const;
  });
}

/**
 * Hesap silinirken sahiplenmeleri serbest bırakır.
 *
 * `admin/deletion.ts` koleksiyon listelerinden gidiyor ve bunlar o listelere
 * girmiyor: doküman kimliği `uid` değil, telefonun/numaranın kendisi. Silme
 * yoklayıcısı bu fonksiyonu çağırmazsa **silinen hesabın numarası sonsuza
 * kadar kilitli kalır** ve aynı kişi bir daha kayıt olamaz.
 */
export async function releaseIdentity(db: Firestore, kimlik: Partial<Kimlik>): Promise<void> {
  if (kimlik.telefon) await db.collection(PHONE_CLAIMS).doc(kimlik.telefon).delete();
  if (kimlik.ogrenciNo) await db.collection(STUDENT_CLAIMS).doc(kimlik.ogrenciNo).delete();
}
