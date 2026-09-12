/**
 * Tek kullanımlık doğrulama kodu — üretim, saklama biçimi ve kararlar.
 *
 * Neden Firebase'in kendi doğrulama bağlantısı değil:
 *
 * 1. **Teklik kontrolünün bir sunucu anı olmak zorunda.** Telefon ve öğrenci
 *    numarasının tek olması Admin SDK'lı bir işlem istiyor (bkz. `claims.ts`);
 *    Firebase'in bağlantısında kancalanacak bir an yok, o yüzden nasıl olsa
 *    bir uç nokta yazılacaktı. Kod doğrulaması o uç noktanın kendisi.
 * 2. **Bağlantı kullanıcıyı uygulamadan çıkarıyor.** Tarayıcıda açılıyor,
 *    uygulama olup bittiğini bilmiyor ve kullanıcı geri dönüp elle tazelemek
 *    zorunda (`refreshVerification` tam olarak bu yüzden var). Altı hane
 *    kullanıcıyı ekrandan hiç çıkarmıyor.
 * 3. Gönderen `noreply@<proje>.firebaseapp.com` — kulübün sahip olmadığı bir
 *    alan adı, dolayısıyla SPF/DKIM hizalaması yok ve posta spam'e düşüyor.
 *    Bu bildirildi ve sebebi de bu.
 *
 * Buradaki fonksiyonlar saf: girdi bir kayıt, çıktı bir karar. Zaman parametre,
 * çünkü süre dolmasını sınayan testin "şimdi"yi seçebilmesi gerekiyor.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/** Kodun ömrü. Kısa olması gerekiyor; postanın gelmesi için yeterli olması da. */
export const OTP_TTL_MS = 10 * 60_000;

/** Yanlış deneme tavanı. Altı hane 10^6 ihtimal; beş deneme onu anlamsız kılıyor. */
export const OTP_MAX_ATTEMPTS = 5;

/** İki posta arasındaki en kısa süre. */
export const OTP_RESEND_MS = 60_000;

/** Bir saatte gönderilebilecek posta sayısı — kutuyu doldurmayı engelliyor. */
export const OTP_MAX_SENDS = 5;
export const OTP_SEND_WINDOW_MS = 60 * 60_000;

/** `emailOtp/{uid}` dokümanının şekli. İstemciye tamamen kapalı. */
export type OtpRecord = {
  /** Kodun kendisi değil: `sha256(uid.kod)`. Doküman sızsa bile kod okunmuyor. */
  hash: string;
  createdAt: number;
  /** Bu penceredeki gönderim sayısı ve pencerenin başlangıcı. */
  sendCount: number;
  windowStart: number;
  attempts: number;
};

/** Altı hane, kriptografik kaynaktan. Baştaki sıfırlar korunuyor. */
export function makeCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Kodu saklanabilir hâle getirir.
 *
 * `uid` karışıma giriyor: aynı kodu alan iki kullanıcının kaydı aynı
 * görünmesin, ve bir kaydın hash'i başka bir kullanıcıda kullanılamasın.
 */
export function hashCode(uid: string, code: string): string {
  return createHash('sha256').update(`${uid}.${code}`).digest('hex');
}

/** Sabit zamanlı karşılaştırma. Uzunluk farkı `timingSafeEqual`'ı fırlatıyor. */
function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

export type SendDecision =
  | { ok: true; record: OtpRecord; code: string }
  | { ok: false; reason: 'bekle' | 'cok_fazla'; saniye: number };

/**
 * Yeni kod gönderilsin mi?
 *
 * İki ayrı sınır var ve ikisi de gerekiyor: `bekle` düğmeye üst üste basmayı,
 * `cok_fazla` birinin posta kutusunu doldurmayı engelliyor. Tek sınır olsaydı
 * biri diğerinin işini görmezdi — 60 saniyelik bekleme saatte 60 posta demek.
 */
export function decideSend(record: OtpRecord | null, now: number): SendDecision {
  const code = makeCode();

  if (!record) {
    return { ok: true, code, record: kayit(code, now, 1, now) };
  }

  const gecen = now - record.createdAt;
  if (gecen < OTP_RESEND_MS) {
    return { ok: false, reason: 'bekle', saniye: Math.ceil((OTP_RESEND_MS - gecen) / 1000) };
  }

  // Pencere dolduysa sayaç sıfırlanıyor; dolmadıysa tavan kontrol ediliyor.
  const pencereBitti = now - record.windowStart >= OTP_SEND_WINDOW_MS;
  if (!pencereBitti && record.sendCount >= OTP_MAX_SENDS) {
    const kalan = OTP_SEND_WINDOW_MS - (now - record.windowStart);
    return { ok: false, reason: 'cok_fazla', saniye: Math.ceil(kalan / 1000) };
  }

  return {
    ok: true,
    code,
    record: pencereBitti
      ? kayit(code, now, 1, now)
      : kayit(code, now, record.sendCount + 1, record.windowStart),
  };
}

function kayit(code: string, now: number, sendCount: number, windowStart: number): OtpRecord {
  // `hash` burada kodun kendisiyle dolduruluyor gibi görünüyor ama dolmuyor:
  // çağıran `hashCode(uid, code)` ile değiştiriyor. Uid bu modülde yok çünkü
  // saf fonksiyonların kimlik bilmesi gerekmiyor.
  return { hash: code, createdAt: now, sendCount, windowStart, attempts: 0 };
}

export type VerifyDecision =
  | { ok: true }
  | { ok: false; reason: 'kod_yok' | 'suresi_doldu' | 'kilitli' | 'yanlis'; kalan?: number };

/**
 * Girilen kod doğru mu?
 *
 * Sıra önemli: kilit ve süre, yanlış koddan **önce** bakılıyor. Tersi olsaydı
 * süresi dolmuş bir kodu deneyen kullanıcı "kod yanlış" görür ve doğru kodu
 * aramaya başlardı — oysa yapması gereken yeni kod istemek.
 */
export function decideVerify(
  record: OtpRecord | null,
  uid: string,
  code: string,
  now: number,
): VerifyDecision {
  if (!record) return { ok: false, reason: 'kod_yok' };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'kilitli' };
  if (now - record.createdAt > OTP_TTL_MS) return { ok: false, reason: 'suresi_doldu' };

  if (!sameHash(record.hash, hashCode(uid, code))) {
    const kalan = OTP_MAX_ATTEMPTS - (record.attempts + 1);
    return { ok: false, reason: 'yanlis', kalan: Math.max(0, kalan) };
  }
  return { ok: true };
}
