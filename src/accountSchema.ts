/**
 * Hesap alanlarının doğrulanması — saf, ekransız, Firebase'siz.
 *
 * Ekrandan ayrı durmasının sebebi bu depoda birkaç kez yaşandı: bir ekranın
 * içindeki koşul yalnızca o ekranla sınanabiliyor, ve o sınav genelde
 * "render oldu mu" sorusuna cevap veriyor. Buradaki fonksiyonlar bir girdi
 * alıp bir karar döndürüyor, dolayısıyla doğrudan çağrılabiliyorlar.
 */

/** Kayıt formunun ham hâli. Hepsi metin: `TextInput` başka bir şey vermiyor. */
export type SignupInput = {
  adSoyad: string;
  email: string;
  /** `YYYY-MM-DD` — `<input type=date>` değil, uygulamada seçici var. */
  dogumTarihi: string;
  telefon: string;
  parola: string;
  kvkkOnay: boolean;
  kosullarOnay: boolean;
};

export type FieldErrors = Partial<Record<keyof SignupInput, string>>;

/**
 * En küçük yaş.
 *
 * 13, App Store'un çocuklara yönelik uygulamalar için ayrı bir rejim
 * başlattığı sınır. Kulüp uygulaması o rejime girmek istemiyor; formda bir
 * sınır olmazsa girmediğini iddia edemeyiz.
 */
export const MIN_AGE = 13;

/** Parola en az bu kadar. Firebase varsayılanı 6; kısa parola bir tercih değil. */
export const MIN_PASSWORD = 8;

/**
 * Telefonu tek bir biçime indirger: `+90` + on hane.
 *
 * Neden gerekiyor: aynı numara `0555 123 45 67`, `+90 555 123 45 67` ve
 * `5551234567` olarak yazılabiliyor. Üçü de aynı kişi, ama ham hâlleriyle
 * saklanırsa üç farklı kayıt. Biçimlendirme kararı tek yerde duruyor ki
 * ekranla depo ayrışmasın.
 *
 * Yalnızca Türkiye numarası kabul ediliyor — kulüp Kocaeli'de ve yanlış
 * ülkeden bir numarayı sessizce kabul etmek, sonra ulaşamamak demek.
 * Geçersizse `null`; çağıran karar veriyor.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');

  // 5xxxxxxxxx | 05xxxxxxxxx | 905xxxxxxxxx — üçü de aynı on haneye iniyor.
  let local: string | null = null;
  if (/^5\d{9}$/.test(digits)) local = digits;
  else if (/^05\d{9}$/.test(digits)) local = digits.slice(1);
  else if (/^905\d{9}$/.test(digits)) local = digits.slice(2);

  return local ? `+90${local}` : null;
}

/** Ekranda gösterilen hâli: `+90 555 123 45 67`. */
export function formatPhone(e164: string): string {
  const m = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+90 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/**
 * E-posta normalleştirme.
 *
 * `toLocaleLowerCase('tr')` **kullanılmıyor**, ve bu bu depodaki genel kuralın
 * bilinçli istisnası: Türkçe küçültme `I` harfini `ı` yapıyor, e-posta yerel
 * kısmı ise ASCII. `ADMIN@…` adresini `admın@…` hâline getirmek adresi
 * bozardı. Aynı gerekçe `searchKey`'de de yazıyor: noktanın bir fark olmadığı
 * yerlerde düz katlama doğru olan.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Doğum tarihini gün cinsinden yaşa çevirir; okunamayan tarihte `null`.
 *
 * Karşılaştırma takvim alanlarıyla yapılıyor, geçen milisaniyeyle değil:
 * artık yıl ve yaz saati, "365 gün" aritmetiğini bir gün kaydırabiliyor ve
 * sınırdaki bir kullanıcı bir gün boyunca yanlış tarafta kalıyor.
 */
export function ageOn(dogumTarihi: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dogumTarihi);
  if (!m) return null;

  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // `new Date(2025, 1, 31)` sessizce 3 Mart oluyor; alanları geri okuyup
  // karşılaştırmak, var olmayan bir tarihi geçerli saymanın tek çaresi.
  const born = new Date(y, mo - 1, d);
  if (born.getFullYear() !== y || born.getMonth() !== mo - 1 || born.getDate() !== d) return null;

  let age = today.getFullYear() - y;
  const hadBirthday =
    today.getMonth() > mo - 1 || (today.getMonth() === mo - 1 && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/** Ad Soyad: en az iki parça. Sertifikaya basılacak olan bu alan. */
function nameProblem(raw: string): string | null {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return 'Ad ve soyadınızı birlikte yazın.';
  if (raw.trim().length < 5) return 'Ad soyad çok kısa görünüyor.';
  if (raw.trim().length > 80) return 'Ad soyad en fazla 80 karakter olabilir.';
  return null;
}

/**
 * Formun tamamı. Hatalar alan alan dönüyor ki ekran hangisini kırmızı
 * boyayacağını bilsin; tek bir "geçersiz" bayrağı kullanıcıya hiçbir şey
 * söylemiyor.
 *
 * `today` parametre çünkü yaş sınırı bir tarihe bağlı ve testin "bugün"ü
 * seçebilmesi gerekiyor.
 */
export function validateSignup(input: SignupInput, today: Date): FieldErrors {
  const errors: FieldErrors = {};

  const nameErr = nameProblem(input.adSoyad);
  if (nameErr) errors.adSoyad = nameErr;

  if (!EMAIL_RE.test(normalizeEmail(input.email))) {
    errors.email = 'Geçerli bir e-posta adresi yazın.';
  }

  const age = ageOn(input.dogumTarihi, today);
  if (age === null) errors.dogumTarihi = 'Doğum tarihinizi seçin.';
  else if (age < MIN_AGE) errors.dogumTarihi = `Hesap açmak için en az ${MIN_AGE} yaşında olmalısınız.`;
  else if (age > 120) errors.dogumTarihi = 'Doğum tarihi geçerli görünmüyor.';

  if (!normalizePhone(input.telefon)) {
    errors.telefon = 'Telefon numarasını 5xx xxx xx xx biçiminde yazın.';
  }

  if (input.parola.length < MIN_PASSWORD) {
    errors.parola = `Parola en az ${MIN_PASSWORD} karakter olmalı.`;
  }

  if (!input.kvkkOnay) errors.kvkkOnay = 'Aydınlatma metnini onaylamanız gerekiyor.';
  if (!input.kosullarOnay) errors.kosullarOnay = 'Kullanım koşullarını onaylamanız gerekiyor.';

  return errors;
}

export function isValidSignup(input: SignupInput, today: Date): boolean {
  return Object.keys(validateSignup(input, today)).length === 0;
}

/** Firestore'a yazılan profil. Formun ham hâli değil, normalleştirilmiş hâli. */
export type Profile = {
  adSoyad: string;
  email: string;
  dogumTarihi: string;
  telefon: string;
  /** Onayın kendisi değil, ne zaman verildiği: KVKK kanıt istiyor. */
  kvkkOnayAt: string;
  kosullarOnayAt: string;
};

/**
 * Formdan profile. Doğrulama **çağıranın işi** — burada tekrar edilmiyor,
 * çünkü aynı kararı iki yerde uygulamak ikisinin ayrışmasının tek sebebi
 * (bu defterde `pushRecentSearch` maddesi aynı hatanın kaydı).
 */
export function toProfile(input: SignupInput, now: Date): Profile {
  const at = now.toISOString();
  return {
    adSoyad: input.adSoyad.trim().replace(/\s+/g, ' '),
    email: normalizeEmail(input.email),
    dogumTarihi: input.dogumTarihi,
    telefon: normalizePhone(input.telefon)!,
    kvkkOnayAt: at,
    kosullarOnayAt: at,
  };
}
