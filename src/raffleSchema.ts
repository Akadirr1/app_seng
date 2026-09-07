/**
 * Çekiliş tanımı ve katılım doğrulaması.
 *
 * Çekiliş ayrı bir varlık değil: `tag: 'Çekiliş'` taşıyan bir etkinliğin üstüne
 * eklenen bir tanım. Çekilişin kendisi uygulamada yapılmıyor — kulüp katılımları
 * CSV olarak indirip kendi çekiliş sitesine yüklüyor, sonra kazananları buraya
 * geri yazıyor. Yani burada rastgele seçim, tohum, durum makinesi yok; olan şey
 * **hangi soruların sorulacağı** ve **verilen cevapların geçerli olup olmadığı**.
 *
 * Alanların sabit olmaması bilinçli: ekibin bir çekilişte telefon, ötekinde
 * Instagram kullanıcı adı isteyeceği belli olmuyor. Sabit sütunlu bir tablo her
 * yeni istekte şema değişikliği demek olurdu; burada alanlar veri, kod değil.
 */

export type RaffleFieldType = 'text' | 'studentNo' | 'email' | 'phone' | 'select';

export type RaffleField = {
  /** CSV sütun adı ve Firestore map anahtarı. */
  key: string;
  label: string;
  type: RaffleFieldType;
  required: boolean;
  /** Yalnızca `select` için. */
  options?: string[];
};

export type Raffle = {
  /** Bağlı olduğu etkinliğin kimliği — doküman kimliği de bu. */
  eventId: string;
  fields: RaffleField[];
  /** Kaç kişi kazanacak. Sadece bilgi amaçlı gösteriliyor. */
  winnerCount: number;
  /**
   * Bundan sonra katılım kabul edilmiyor. ISO 8601, saat dilimi zorunlu —
   * `eventSchema` ile aynı sebep: dilimsiz değer okunduğu yere göre kayıyor.
   */
  entriesCloseAt: string;
  /**
   * Kazananlar, çekiliş yapıldıktan sonra elle giriliyor. Maskeli isim
   * ("Elif Y.") — tam ad yayınlamak KVKK açısından gereksiz risk ve maskeli
   * hâli kazananın kendini tanıması için yeterli.
   */
  winners: string[];
  /** Kazananların açıklandığı an. Boşsa çekiliş henüz yapılmamış. */
  drawnAt: string;
};

/**
 * Okunan bir dokümanın kullanılabilir bir çekiliş tanımı olup olmadığı.
 *
 * **Neden var:** uygulama bir etkinliği "çekiliş" saymak için yalnızca
 * `raffles/{eventId}` dokümanının VAR OLMASINA bakıyordu. Yani içi boş ya da
 * yarım kalmış bir doküman — bir deneme, yarıda bırakılmış bir kayıt, elle
 * açılmış bir satır — normal bir etkinliği çekilişe çeviriyor: 5.3.1 beyanı,
 * "Çekilişe Katıl" düğmesi ve `undefined kişi kazanacak` satırı çıkıyor.
 * Kullanıcı bunu "normal etkinliklerde bile çekiliş ibaresi çıkıyor" olarak
 * bildirdi.
 *
 * Kapı, panelin kendi kabul ettiği üç alanla aynı: panel `winnerCount` ve
 * `entriesCloseAt` olmadan kaydetmiyor (`admin/server.ts`, POST /raffles/:id),
 * ve alan listesi boş olamıyor. Dolayısıyla bu üçünü taşımayan bir doküman
 * panelin çekiliş formundan çıkmamıştır.
 *
 * `winners`/`drawnAt` kapıya dâhil değil: ikisi de çekiliş çekildikten sonra
 * doluyor ve yokluğu "henüz çekilmedi" demek, "çekiliş değil" değil.
 */
export function isRaffle(value: unknown): value is Raffle {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.eventId === 'string' &&
    r.eventId !== '' &&
    Array.isArray(r.fields) &&
    r.fields.length > 0 &&
    typeof r.winnerCount === 'number' &&
    Number.isInteger(r.winnerCount) &&
    r.winnerCount >= 1 &&
    typeof r.entriesCloseAt === 'string' &&
    r.entriesCloseAt !== ''
  );
}

/**
 * Yeni bir çekilişin başladığı alan kümesi. Kulübün her çekilişte sorduğu
 * dördü; telefon, e-posta ve Instagram admin panelden tek tıkla ekleniyor.
 */
export const DEFAULT_FIELDS: RaffleField[] = [
  { key: 'full_name', label: 'Ad Soyad', type: 'text', required: true },
  { key: 'student_number', label: 'Öğrenci Numarası', type: 'studentNo', required: true },
  {
    key: 'department',
    label: 'Bölüm',
    type: 'select',
    required: true,
    options: ['Yazılım Müh.', 'Bilgisayar Müh.', 'Elektronik', 'Diğer'],
  },
  {
    key: 'class',
    label: 'Sınıf',
    type: 'select',
    required: true,
    options: ['Haz.', '1', '2', '3', '4'],
  },
];

/** Panelde "ekle" ile gelen hazır alanlar. */
export const OPTIONAL_FIELDS: RaffleField[] = [
  { key: 'phone', label: 'Telefon', type: 'phone', required: false },
  { key: 'email', label: 'E-posta', type: 'email', required: false },
  { key: 'instagram', label: 'Instagram Kullanıcı Adı', type: 'text', required: false },
];

/** CSV başlığı ve Firestore anahtarı olacağı için dar tutuluyor. */
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,30}$/;
const STUDENT_NO = /^[0-9]{9}$/;
/** Kasıtlı olarak gevşek: e-posta doğrulamak için tek güvenilir yol e-posta göndermek. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** 05xxxxxxxxx, +905xxxxxxxxx, boşluk ve tire serbest. */
const PHONE = /^(\+?90)?0?5[0-9]{9}$/;

export const MAX_FIELDS = 12;
export const MAX_TEXT_LENGTH = 120;

export type FieldErrors = Record<string, string>;

/**
 * Alan tanımlarını doğrular. Panelde çekiliş kaydedilirken çalışıyor, çünkü
 * bozuk bir tanım uygulamada çizilemeyen bir form demek.
 */
export function validateFields(fields: RaffleField[]): FieldErrors {
  const errors: FieldErrors = {};

  if (!fields.length) errors.fields = 'En az bir alan olmalı.';
  if (fields.length > MAX_FIELDS) errors.fields = `En fazla ${MAX_FIELDS} alan olabilir.`;

  const seen = new Set<string>();
  for (const field of fields) {
    const key = (field.key ?? '').trim();
    if (!KEY_PATTERN.test(key)) {
      errors[key || '(boş)'] =
        'Alan anahtarı küçük harfle başlamalı; küçük harf, rakam ve alt çizgi içerebilir.';
      continue;
    }
    if (seen.has(key)) {
      errors[key] = 'Aynı anahtar iki kez kullanılamaz.';
      continue;
    }
    seen.add(key);

    if (!(field.label ?? '').trim()) errors[key] = 'Bu alanın etiketi boş olamaz.';
    if (field.type === 'select' && !(field.options ?? []).filter(Boolean).length) {
      errors[key] = 'Seçim listesi en az bir seçenek içermeli.';
    }
  }

  return errors;
}

/**
 * Bir katılımı tanıma göre doğrular.
 *
 * Aynı fonksiyon hem uygulamada (gönder düğmesini açmak için) hem panelde
 * çalışıyor. Firestore kuralları da şekli ayrıca kontrol ediyor — istemci
 * doğrulaması kolaylık, koruma değil.
 */
export function validateEntry(fields: RaffleField[], values: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};

  for (const field of fields) {
    const raw = (values[field.key] ?? '').trim();

    if (!raw) {
      if (field.required) errors[field.key] = `${field.label} boş olamaz.`;
      continue;
    }
    if (raw.length > MAX_TEXT_LENGTH) {
      errors[field.key] = `${field.label} en fazla ${MAX_TEXT_LENGTH} karakter olabilir.`;
      continue;
    }

    if (field.type === 'studentNo' && !STUDENT_NO.test(raw)) {
      errors[field.key] = 'Öğrenci numarası 9 haneli olmalı.';
    } else if (field.type === 'email' && !EMAIL.test(raw)) {
      errors[field.key] = 'Geçerli bir e-posta adresi girin.';
    } else if (field.type === 'phone' && !PHONE.test(raw.replace(/[\s-]/g, ''))) {
      errors[field.key] = 'Telefon 05xxxxxxxxx biçiminde olmalı.';
    } else if (field.type === 'select' && !(field.options ?? []).includes(raw)) {
      errors[field.key] = 'Listeden bir seçenek seçin.';
    }
  }

  // Tanımda olmayan bir anahtar gelirse forma ait değildir; sessizce atmak
  // yerine söylüyoruz, çünkü tek sebebi tanımın değişmiş olması.
  for (const key of Object.keys(values)) {
    if (!fields.some((f) => f.key === key)) errors[key] = 'Bu alan çekiliş tanımında yok.';
  }

  return errors;
}

/** Yalnızca tanımlı alanları, tanım sırasında bırakır. */
export function pickDefinedValues(
  fields: RaffleField[],
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim();
    if (value) out[field.key] = value;
  }
  return out;
}

/**
 * CSV sütunları. Sabit üçlü önce, sonra çekilişin kendi alanları — böylece
 * her çekilişin dosyası kendi tanımına göre şekilleniyor.
 */
export function csvColumns(fields: RaffleField[]): string[] {
  return ['entry_id', 'event_id', ...fields.map((f) => f.key), 'created_at'];
}

/**
 * "Elif Yılmaz" → "Elif Y."
 *
 * Kazananlar herkese görünüyor. Tam ad yayınlamak KVKK açısından gereksiz risk;
 * maskeli hâli kazananın kendini tanıması için fazlasıyla yeterli.
 */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(' ')} ${last[0].toLocaleUpperCase('tr')}.`;
}

/** Katılım hâlâ açık mı. Tarih okunamıyorsa açık sayılıyor — kapalı saymak, bozuk bir tanım yüzünden kimsenin katılamaması demek olurdu. */
export function entriesOpen(raffle: Raffle, now: Date = new Date()): boolean {
  if (raffle.drawnAt) return false;
  const closes = new Date(raffle.entriesCloseAt);
  if (Number.isNaN(closes.getTime())) return true;
  return closes.getTime() > now.getTime();
}
