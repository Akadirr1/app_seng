/**
 * QR yoklaması — istemci tarafı.
 *
 * Yazma doğrudan Firestore'a gidiyor, panel uç noktasına değil: jetonu
 * doğrulayan şey Firestore kuralı ve o kural jetonu istemcinin okuyamadığı
 * `eventQr` dokümanından `get()` ile alıyor. Araya bir sunucu koymak hiçbir
 * şey eklemezdi.
 */
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { currentUser } from './auth';
import { COLLECTIONS, getDb } from './firebase';
import { attendanceId, type QrOkuma } from './qrSchema';

export type YoklamaSonucu =
  | 'kaydedildi'
  | 'zaten-kayitli'
  | 'oturum-yok'
  | 'pencere-kapali'
  | 'aglar';

export class YoklamaHatasi extends Error {
  constructor(readonly kod: YoklamaSonucu) {
    super(kod);
  }
}

/** Bu hesap bu etkinliğe daha önce yoklama verdi mi? */
export async function yoklamaVarMi(eventId: string): Promise<boolean> {
  const user = currentUser();
  if (!user) return false;
  const snap = await getDoc(doc(getDb(), COLLECTIONS.attendance, attendanceId(eventId, user.uid)));
  return snap.exists();
}

/**
 * Yoklamayı yazar.
 *
 * **Önce okuyor.** Sebebi bir kural ayrıntısı: panel elle yoklama
 * işaretlediğinde doküman `token` alanı OLMADAN doğuyor, ve o dokümana
 * sonradan yapılan bir okutma bir *update* oluyor — güncelleme dalı yalnızca
 * `checkedInAt` değişimine izin verdiği için reddedilirdi. Önce okumak, elle
 * işaretlenmiş katılımcının okutma denediğinde hata değil "zaten kayıtlı"
 * görmesini sağlıyor.
 */
export async function yoklamaVer(okuma: QrOkuma): Promise<YoklamaSonucu> {
  const user = currentUser();
  if (!user) throw new YoklamaHatasi('oturum-yok');

  const ref = doc(getDb(), COLLECTIONS.attendance, attendanceId(okuma.eventId, user.uid));

  try {
    const mevcut = await getDoc(ref);
    if (mevcut.exists()) return 'zaten-kayitli';
  } catch {
    // Okuma başarısızsa yazmayı yine de dene: en kötü ihtimalle aşağıdaki
    // yazma da başarısız olur ve hata oradan gelir.
  }

  try {
    await setDoc(ref, {
      eventId: okuma.eventId,
      uid: user.uid,
      token: okuma.token,
      checkedInAt: serverTimestamp(),
    });
    return 'kaydedildi';
  } catch (err) {
    // Kural reddi "yanlış jeton" ve "pencere kapalı" arasında ayrım yapmıyor —
    // ikisi de `permission-denied`. Kullanıcıya en olası sebebi söylüyoruz:
    // yanlış jeton pratikte ancak eski bir afişten gelir ve o da zaten
    // pencereyle aynı cümleye çıkar.
    const kod = (err as { code?: string } | null)?.code;
    if (kod === 'permission-denied') throw new YoklamaHatasi('pencere-kapali');
    throw new YoklamaHatasi('aglar');
  }
}

export function yoklamaMesaji(sonuc: YoklamaSonucu): string {
  switch (sonuc) {
    case 'kaydedildi':
      return 'Yoklaman alındı. Katılım sertifikan etkinlikten sonra Hesabım sekmesinde görünecek.';
    case 'zaten-kayitli':
      return 'Bu etkinlik için yoklaman zaten alınmış.';
    case 'oturum-yok':
      return 'Yoklama için giriş yapman gerekiyor.';
    case 'pencere-kapali':
      return 'Bu kod şu anda geçerli değil. Yoklama etkinliğin başlamasına bir saat kala açılıp gün sonunda kapanıyor; kod yenilenmiş de olabilir.';
    default:
      return 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.';
  }
}
