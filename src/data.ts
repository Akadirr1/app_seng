import { EVENT_CATEGORIES } from './eventSchema';
import { IconName } from './icons';

export type EventFact = { icon: IconName; label: string; value: string };

export type ClubEvent = {
  id: string;
  /**
   * ISO start time. The `day`/`mon`/`time` strings below are what the design
   * displays; this is the machine-readable value Firestore sorts and filters on.
   */
  startsAt: string;
  day: string;
  mon: string;
  /** Short weekday label used in the calendar list rows. */
  wd: string;
  monthKey: string;
  title: string;
  time: string;
  short: string;
  tag: string;
  /** Registration deadline is imminent — drives the "SON GUN" badge. */
  soon: boolean;
  badge: string;
  /**
   * Kontenjan. Tanımsız ya da 0 ise sınırsız.
   *
   * Eskiden `spots` diye serbest metindi ("12 / 60 yer kaldı") — elle yazılan,
   * hiçbir şeyden türemeyen ve kimse kayıt oldukça güncellenmeyen bir cümle.
   * Kalan yer artık gerçekten kayıt sayısından çıkıyor; bkz. `seatsLeft`.
   */
  capacity?: number;
  desc: string;
  tags: string[];
  speaker: string;
  speakerRole: string;
  facts: EventFact[];
  /**
   * Etkinlik görselleri, sıralı. İlki kapak: arşiv kartı ve detay hero'su onu
   * gösteriyor. Kalanı detaydaki galeri.
   *
   * Panelden yükleniyor ve Firebase Storage'da duruyor; buradaki değerler indirme
   * adresleri. Boşsa `PhotoSlot` kendi gradyan yer tutucusunu çiziyor.
   */
  photos?: string[];
  /**
   * Kaç kişi katıldı. Etkinlik olmadan bilinemeyeceği için isteğe bağlı —
   * arşiv kartındaki rozeti bu besliyor ve boşsa rozet çizilmiyor.
   */
  attendance?: number;
};

/**
 * Upcoming events.
 *
 * Empty on purpose: the club has no confirmed calendar right now. This used to
 * hold four March–April 2026 events which, months later, were still being shown
 * as "upcoming" — a stale calendar is worse than an honest empty one, and it also
 * meant no reminder could ever be scheduled.
 *
 * Fill this in (or seed Firestore, which takes precedence) when the real
 * calendar exists. Build entries with `buildEvent` from src/eventSchema.ts
 * rather than by hand — half these fields are derived from `startsAt` and drift
 * the moment they are typed twice.
 */
export const EVENTS: ClubEvent[] = [];

/** Undefined when the id matches nothing — callers must handle a missing event. */
export const getEvent = (id?: string | string[]): ClubEvent | undefined => {
  const key = Array.isArray(id) ? id[0] : id;
  return EVENTS.find((e) => e.id === key);
};

/*
 * FEATURED and FEED used to live here: editorial cards for the home carousel and
 * feed. They were removed with the home screen that rendered them — it now shows
 * real upcoming events and announcements from the club's site instead of a
 * hand-curated list that nobody had maintained since the design was adapted.
 */

/*
 * ARCHIVE, ARCHIVE_TOTALS, ArchiveEntry ve sortArchive buradaydı: altı uydurma
 * etkinlik ve "2023'ten bugüne 38 etkinlik · 412 fotoğraf" diye iki uydurma
 * sayı. İkincisi daha kötüydü — uygulamada fotoğraf deposu hiç yok, yani 412
 * hiçbir şeyi saymıyordu.
 *
 * Arşiv artık ayrı bir veri değil: tarihi geçmiş etkinlik. `ArchiveEntry`
 * alanlarının (title, date, cat, year) hepsi zaten `ClubEvent`'te vardı; tek
 * eksik katılımcı sayısıydı, o da artık `ClubEvent.attendance`. Ayrı tutmak,
 * aynı gerçek etkinliği iki kez girmek demekti.
 *
 * Bölme `splitByDate` içinde — src/eventSchema.ts.
 */

/**
 * Arşiv filtre çipleri, panelin sunduğu kategorilerden türüyor. Elle yazılmış
 * hâlinde 'Çekiliş' ve 'Duyuru' yoktu — o kategorideki geçmiş bir etkinlik
 * arşive düşer ama hiçbir çip onu göstermezdi.
 */
export const ARCHIVE_CATEGORIES = ['Tümü', ...EVENT_CATEGORIES];

export const DEPARTMENTS = ['Yazılım Müh.', 'Bilgisayar Müh.', 'Elektronik', 'Diğer'];
export const YEARS = ['Haz.', '1', '2', '3', '4'];
export const REMINDER_OPTIONS = ['1 saat önce', '1 gün önce', '3 gün önce'];

/**
 * AI Gündem bülteninin seçilebilir saatleri.
 *
 * Hepsi 07:00 ve sonrası, keyfi değil: bülten sunucuda her sabah hazırlanıyor ve
 * İstanbul saatiyle 06:30–06:50 arasında bitiyor. Daha erken bir saat sunmak,
 * kullanıcıya henüz var olmayan bir bülten için bildirim göndermek olurdu.
 */
export const DIGEST_HOURS = [7, 8, 9];

/**
 * Yasal sayfaların tabanı — yönetim panelinin herkese açık kökü.
 *
 * Panel bu üç sayfayı kendi rotaları olarak sunuyor (`admin/legal.ts`), çünkü
 * hesap sistemi olan bir uygulamanın gizlilik ve kullanım koşullarını web'de
 * yayınlaması gerekiyor; Play ayrıca **uygulamaya erişemeyen** biri için
 * web'den çalışan bir hesap silme adresi istiyor.
 *
 * `process.env.EXPO_PUBLIC_*` burada bilerek statik üye erişimiyle yazılıyor:
 * Expo'nun babel eklentisi değeri ancak bu biçimde GÖRÜRSE pakete gömüyor.
 * Hesaplanan bir anahtar üretim derlemesinde `undefined` verir ve sonuç
 * "yapılandırma yok" gibi görünür, "kod yanlış" gibi değil.
 */
const LEGAL_BASE = (process.env.EXPO_PUBLIC_LEGAL_BASE_URL ?? '').replace(/\/+$/, '');

/**
 * Gizlilik politikası ve KVKK aydınlatma metni. Kayıt formundaki onay satırının
 * altından açılır, ve iki mağazanın gizlilik alanına da bu adres yazılır.
 *
 * Taban tanımlı değilse eski barındırma adresi kullanılıyor: gizlilik metni
 * mağazalarda zaten ilan edilmiş durumda ve çalışan bir adres, çalışmayan bir
 * adresten iyi.
 */
export const PRIVACY_POLICY_URL = LEGAL_BASE
  ? `${LEGAL_BASE}/gizlilik`
  : 'https://kou-yazilim-kulubu-gizlilik.akadirr41.chatgpt.site';

/**
 * Kullanım koşulları. Tabanı yoksa **boş** — ve bu bilinçli: gizlilik metnine
 * "kullanım koşulları" diye bağlantı vermek, olmayan bir belgeyi varmış gibi
 * göstermek olurdu. Boşken ekran bağlantıyı hiç çizmiyor.
 */
export const TERMS_URL = LEGAL_BASE ? `${LEGAL_BASE}/kosullar` : '';

/**
 * Panelin herkese açık kökü.
 *
 * `LEGAL_BASE` ile aynı değer ve bu bir tesadüf değil: yasal sayfalar da hesap
 * uç noktaları da aynı panelde duruyor. İkinci bir değişken tanımlamak, ikisinin
 * ayrışmasının tek sebebi olurdu (bu defterde `pushRecentSearch` maddesi aynı
 * hatanın kaydı).
 */
export const PANEL_BASE_URL = LEGAL_BASE;

/** Play'in şart koştuğu web'den hesap silme adresi. */
export const ACCOUNT_DELETE_URL = LEGAL_BASE ? `${LEGAL_BASE}/hesap-sil` : '';

export type OnboardingPage = {
  kicker: string;
  title: string;
  body: string;
  cta: string;
  /** `logo` shows the club wordmark; the others use pixel scene art. */
  art: 'logo' | 'form' | 'bell';
};

export const ONBOARDING: OnboardingPage[] = [
  {
    kicker: '01 / 03',
    art: 'logo',
    title: 'Kulüpten hiçbir şey kaçmasın',
    body: 'Atölyeler, söyleşiler ve çekilişler tek akışta. Öne çıkanlar en üstte, gerisi zaman sırasıyla.',
    cta: 'Devam',
  },
  {
    kicker: '02 / 03',
    art: 'form',
    title: 'Tek dokunuşla kayıt ol',
    body: 'Ad soyad, öğrenci no ve bölüm — 20 saniyede kaydın tamam. Kontenjan dolmadan yerini ayır.',
    cta: 'Devam',
  },
  {
    kicker: '03 / 03',
    art: 'bell',
    title: 'Sadece istediğin bildirim',
    body: 'Atölye, söyleşi, çekiliş — kategori kategori aç kapa. Sessiz saatlerde rahatsız etmeyiz.',
    cta: 'Başla',
  },
];

export type NotificationCategory = {
  key: string;
  icon: IconName;
  tint: string;
  desc: string;
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  // Açıklamalar kodun gerçekten yaptığı şeyi anlatıyor. Eskiden "kontenjan
  // güncellendiğinde" ve "başvuru dönemleri" yazıyordu; ikisini de tetikleyen
  // hiçbir şey yoktu — ayar ekranında kurgu.
  { key: 'Atölye', icon: 'code', tint: '#D2E7EC', desc: 'Yeni atölye açıldığında ve iptal edildiğinde' },
  { key: 'Söyleşi', icon: 'chat', tint: '#E4EEF3', desc: 'Yeni söyleşi ya da panel duyurulduğunda' },
  { key: 'Çekiliş', icon: 'gift', tint: '#D2E7EC', desc: 'Çekiliş açıldığında ve sonuç açıklandığında' },
  { key: 'Duyuru', icon: 'star', tint: '#E4EEF3', desc: 'Teknik gezi, yarışma ve genel kulüp duyuruları' },
  { key: 'Hatırlatma', icon: 'clock', tint: '#D2E7EC', desc: 'Kayıtlı olduğun etkinlikler için hatırlatma' },
  { key: 'AI Gündem', icon: 'lines', tint: '#E4EEF3', desc: 'Günün yapay zekâ bülteni, seçtiğin saatte' },
];

export const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

