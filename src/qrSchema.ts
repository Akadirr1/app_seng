/**
 * QR yoklamasının saf yarısı — jeton biçimi, taşıyıcı dize ve zaman penceresi.
 *
 * Panel de uygulama da buradan okuyor. Ayrı durmasının sebebi bu deponun
 * defterinde birkaç kez yazılı: aynı kararı iki yerde uygulamak, ikisinin
 * ayrışmasının tek sebebi. Panel jetonu üretiyor, uygulama ayrıştırıyor;
 * ikisi de aynı alfabeyi ve aynı pencereyi kullanmak zorunda.
 *
 * Burada hiç Firebase, hiç ekran, hiç rastgelelik kaynağı yok — rastgelelik
 * parametre olarak geliyor, çünkü testin çıktıyı seçebilmesi gerekiyor.
 */
import { LOCAL_OFFSET, parseIso } from './eventSchema';

/**
 * Jeton alfabesi — karıştırılabilir karakterler YOK: `I`, `L`, `O`, `0`, `1`.
 *
 * Jeton ekrana basılıyor ve birinin elle yazması ihtimali var (afişteki kod
 * okunmazsa). `O` ile `0`ı ayırt etmeye çalışan bir öğrenci, bu alfabeyle
 * hiç o soruyu sormuyor.
 */
export const QR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Jeton uzunluğu. 12 hane × 31 harf ≈ 2^59 — kaba kuvvetle bulunamaz, ve
 * zaten pencere dışında işe yaramıyor.
 */
export const QR_TOKEN_LENGTH = 12;

const TOKEN_RE = new RegExp(`^[${QR_ALPHABET}]{${QR_TOKEN_LENGTH}}$`);
const EVENT_ID_RE = /^[a-z0-9-]{2,40}$/;

/**
 * Jeton üretir. Rastgelelik **çağırandan** geliyor: panelde `node:crypto`,
 * testte sabit bir dizi.
 *
 * Modulo sapması bilerek göz ardı edilmiyor — 256, 31'e tam bölünmediği için
 * alfabenin ilk sekiz harfi hafifçe daha sık çıkardı. Aralık dışındaki
 * baytlar atılıyor, o yüzden istenenden fazla bayt isteniyor.
 */
export function makeQrToken(randomBytes: (n: number) => Uint8Array): string {
  const sinir = 256 - (256 % QR_ALPHABET.length);
  let out = '';
  let havuz = randomBytes(QR_TOKEN_LENGTH * 2);
  let i = 0;
  while (out.length < QR_TOKEN_LENGTH) {
    if (i >= havuz.length) {
      havuz = randomBytes(QR_TOKEN_LENGTH * 2);
      i = 0;
    }
    const b = havuz[i];
    i += 1;
    if (b >= sinir) continue;
    out += QR_ALPHABET[b % QR_ALPHABET.length];
  }
  return out;
}

export function isQrToken(value: string): boolean {
  return TOKEN_RE.test(value);
}

export function isEventId(value: string): boolean {
  return EVENT_ID_RE.test(value);
}

/** QR'ın içine yazılan dize. */
export function qrPayload(panelBase: string, eventId: string, token: string): string {
  return `${panelBase.replace(/\/+$/, '')}/qr/${eventId}/${token}`;
}

export type QrOkuma = { eventId: string; token: string };

/**
 * Okunan QR'ı çözer. Tanımadığı her şeyde `null`.
 *
 * İki biçim kabul ediliyor:
 *   `https://panel/qr/<eventId>/<token>`  — QR'a yazılan hâli. Telefonun kendi
 *       kamerası okuduğunda da bir yere varsın diye adres; panel o adreste
 *       "uygulamayı aç" sayfası gösteriyor.
 *   `<eventId>.<token>`                    — çıplak hâl, elle girişe ve teste açık.
 *
 * **Ayrıştırma elle yapılıyor, `URL` ile değil.** Bu deponun defterinde ölçülmüş
 * bir madde var: React Native'in `URL`'i bir ayrıştırıcı değil, taban verilmeden
 * girdiyi hiç denetlemeden saklıyor ve hiçbir zaman fırlatmıyor. Aynı tuzağa
 * ikinci kez düşmemek için burada motor bilgisi hiç kullanılmıyor.
 *
 * Alan adı KASITLI olarak kontrol edilmiyor: panelin adresi bir ortam
 * değişkeninden geliyor ve derleme anında gömülüyor, yani adres değişen bir
 * sürümde eski QR'lar okunamaz hâle gelirdi. Jetonu doğrulayan şey adres değil,
 * Firestore kuralının `eventQr` dokümanıyla karşılaştırması.
 */
export function parseQrPayload(raw: string): QrOkuma | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  // `https://.../qr/<eventId>/<token>` — sorgu ve parça atılıyor.
  const yol = /\/qr\/([a-z0-9-]{2,40})\/([A-Z2-9]{6,32})(?:[/?#]|$)/.exec(s);
  if (yol && isEventId(yol[1]) && isQrToken(yol[2])) {
    return { eventId: yol[1], token: yol[2] };
  }

  // `<eventId>.<token>`
  const duz = /^([a-z0-9-]{2,40})\.([A-Z2-9]{6,32})$/.exec(s);
  if (duz && isEventId(duz[1]) && isQrToken(duz[2])) {
    return { eventId: duz[1], token: duz[2] };
  }

  return null;
}

export type Pencere = { opensAt: string; closesAt: string };

/** Yoklamanın kaç saat önce açıldığı. */
export const QR_ACILIS_SAAT = 1;

/**
 * Etkinliğin başlangıcından varsayılan pencere.
 *
 * **Kapanış etkinliğin bitişi değil, o günün sonu.** Sebebi defterde yazılı
 * bir sonuç: salonun interneti en yoğun anda en kötü ve gönderim yeniden
 * deneniyor; pencere etkinlik biter bitmez kapansaydı, akşam bağlantıya
 * kavuşan telefon kalıcı olarak reddedilirdi.
 *
 * Hesap +03:00'a göre — cihazın saat dilimine göre değil. Yurt dışındaki bir
 * telefon aynı etkinliği başka bir günde sanmasın.
 */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function defaultWindow(startsAt: string): Pencere | null {
  const p = parseIso(startsAt);
  if (!p) return null;

  const gun = `${p.year}-${pad(p.month)}-${pad(p.day)}`;

  // Etkinlik gecenin ilk saatlerinde başlıyorsa bir gün geriye gitmek yerine
  // günün başına çekiliyor: 00:30'da başlayan bir etkinliğin yoklaması o günün
  // 00:00'ında açılır, bir önceki günün 23:30'unda değil. Yoksa pencere iki
  // takvim gününe yayılır ve "etkinliğin kendi günü" kuralı bozulur.
  const acilisSaat = p.hour >= QR_ACILIS_SAAT ? p.hour - QR_ACILIS_SAAT : 0;
  const acilisDakika = p.hour >= QR_ACILIS_SAAT ? p.minute : 0;

  return {
    opensAt: `${gun}T${pad(acilisSaat)}:${pad(acilisDakika)}:00${LOCAL_OFFSET}`,
    closesAt: `${gun}T23:59:59${LOCAL_OFFSET}`,
  };
}

/** Şu an pencere açık mı? Okunamayan tarihte **kapalı** sayılıyor. */
export function windowOpen(now: Date, pencere: Partial<Pencere> | null | undefined): boolean {
  if (!pencere || !pencere.opensAt || !pencere.closesAt) return false;
  const a = Date.parse(pencere.opensAt);
  const k = Date.parse(pencere.closesAt);
  if (!Number.isFinite(a) || !Number.isFinite(k)) return false;
  const t = now.getTime();
  return t >= a && t <= k;
}

/** Yoklama dokümanının kimliği. Teklik doküman kimliğiyle zorlanıyor. */
export function attendanceId(eventId: string, uid: string): string {
  return `${eventId}__${uid}`;
}
