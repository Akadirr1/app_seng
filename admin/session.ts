import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Oturum çerezinin başlığını üretir.
 *
 * Ayrı bir dosyada çünkü `server.ts` içe aktarılınca `app.listen` çalışıyor —
 * yani sunucuyu ayağa kaldırmadan sınanamıyor. Buradaki fonksiyon saf: bir
 * nesne alıyor, bir metin döndürüyor, `check:panel` doğrudan çağırabiliyor.
 *
 * `Secure` neden koşullu: panel yerelde düz HTTP üzerinden çalışıyor ve
 * `Secure` çerezi tarayıcı orada hiç saklamıyor — sabit koymak yerel girişi
 * tamamen kırardı. Sunucuda ise HTTPS'i Coolify'ın önündeki proxy sonlandırıyor,
 * uygulamaya istek düz HTTP olarak geliyor; bu yüzden karar `req.secure`'a
 * bakılarak veriliyor (Express `trust proxy` açıkken `X-Forwarded-Proto`
 * başlığını okuyor).
 *
 * `Secure`siz bir oturum çerezi, panele bir kez düz HTTP ile ulaşılabildiği anda
 * ağdaki herkese açık demek — panel öğrenci kayıtlarını görüyor, isim ve
 * numaraları da.
 */
export function cookieHeader(opts: {
  name: string;
  value: string;
  secure: boolean;
  /** Saniye. 0 çerezi siler. */
  maxAge: number;
}): string {
  const parts = [
    `${opts.name}=${opts.value}`,
    'HttpOnly',
    // SameSite=Strict siteler arası POST'ların çerezi taşımasını engelliyor;
    // bu ölçekte CSRF için yeterli koruma.
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

/** Oturum ömrü, saniye. Çerezin Max-Age'i ile jetonun süresi aynı sayıdan geliyor. */
export const SESSION_SECONDS = 43200;

function sign(secret: Buffer, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Oturum jetonu: `<verilişZamanıMs>.<imza>`.
 *
 * Eskiden jeton sabit bir metnin imzasıydı — süreç ömrü boyunca herkese aynı
 * değer. Çerezin Max-Age'i tarayıcının verdiği söz; sunucu tarafında hiçbir
 * şey eskimiyordu, yani bir kez sızan çerez yeniden başlatmaya kadar
 * geçerliydi. Veriliş zamanı imzanın içinde: jeton kişiye özgü ve süreli,
 * sunucu yine hiçbir şey saklamıyor.
 */
export function issueToken(secret: Buffer, now = Date.now()): string {
  const issued = String(now);
  return `${issued}.${sign(secret, issued)}`;
}

export function verifyToken(secret: Buffer, token: string | null, now = Date.now()): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const issued = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(secret, issued));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  const age = now - Number(issued);
  return Number.isFinite(age) && age >= 0 && age < SESSION_SECONDS * 1000;
}

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

/**
 * Giriş denemesi sınırı, IP başına.
 *
 * Parola karşılaştırması zaman-sabiti ama deneme sayısını hiçbir şey
 * sınırlamıyordu; panel internete açık ve arkasında isim + öğrenci numarası
 * var. Pencere kayan: son hatadan itibaren 15 dakika içinde 10 hata kilitler.
 * `req.ip`, `trust proxy 1` ile proxy'nin yazdığı adres — istemcinin
 * uydurduğu başlık değil.
 */
export function loginLimiter(now: () => number = Date.now) {
  // ponytail: süreç içi Map, tek örnek; birden çok panel örneği olursa paylaşımlı depo.
  const failures = new Map<string, { count: number; until: number }>();
  return {
    /** Kilitliyse kalan milisaniye, değilse 0. */
    lockedFor(ip: string): number {
      const f = failures.get(ip);
      if (!f) return 0;
      const left = f.until - now();
      if (left <= 0) {
        failures.delete(ip);
        return 0;
      }
      return f.count >= LOGIN_MAX_FAILURES ? left : 0;
    },
    fail(ip: string): void {
      const t = now();
      // Süresi geçenler yalnızca okunurken siliniyor; bir tarama internetten
      // gelen IP sayısının Map'i büyütmesini önlüyor.
      if (failures.size > 10_000) {
        for (const [k, v] of failures) if (v.until <= t) failures.delete(k);
      }
      const f = failures.get(ip);
      const count = f && f.until > t ? f.count + 1 : 1;
      failures.set(ip, { count, until: t + LOGIN_LOCK_MS });
    },
    succeed(ip: string): void {
      failures.delete(ip);
    },
  };
}
