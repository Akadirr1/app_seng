/**
 * Kulüp yönetim paneli — etkinlik girme ve kayıtları görme.
 *
 *   ADMIN_PASSWORD=... npm run admin
 *
 * Neden var: etkinlik girmek Firebase Console'dan pratikte yapılamıyor. Bir
 * ClubEvent on yedi alan taşıyor ve bunların yarısı `startsAt` ile yerden
 * türeyen görüntü metinleri — konsolda elle girildiğinde ilk etkinlik
 * ertelendiğinde tarih bir alanda değişip diğer beşinde kalıyor.
 *
 * Bu panel hiçbir şeyi iki kez sormuyor: tarih, bitiş saati ve yer alınıyor,
 * gerisi `src/eventSchema.ts` içindeki `buildEvent` ile türetiliyor. Yani
 * Firestore'a ulaşan her etkinlik uygulamanın beklediği şekilde.
 *
 * `registrations` istemciye kapalı olduğu için (öyle kalmalı) panel Admin SDK
 * kullanıyor — `npm run push` ve `npm run export` ile aynı servis hesabı
 * anahtarı.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import '../scripts/load-env';
import express, { type NextFunction, type Request, type Response } from 'express';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { ClubEvent } from '../src/data';
import multer from 'multer';

import {
  MAX_PHOTOS,
  buildEvent,
  isPast,
  joinLocal,
  splitLocal,
  toInput,
  todayLocal,
  type EventInput,
} from '../src/eventSchema';
import {
  ACCEPTED_TYPES,
  MAX_UPLOAD_BYTES,
  PhotoUploadError,
  deleteEventPhotos,
  deletePhotos,
  uploadEventPhoto,
} from './photos';
import {
  csvColumns,
  DEFAULT_FIELDS,
  maskName,
  validateFields,
  type Raffle,
  type RaffleField,
  type RaffleFieldType,
} from '../src/raffleSchema';
import { parseServiceAccount } from './credentials';
import {
  alreadyAnnounced,
  announce,
  autoPushEnabled,
  pendingSummary,
  recentPushLog,
  sendTestPush,
  startAnnouncementPoller,
  startPushFlusher,
  summariseDevices,
} from './push';
import { notificationsPage, type LogRow } from './notificationsView';
import { NOTIFICATION_CATEGORIES } from '../src/data';
import {
  decideCancelledEvent,
  decideNewEvent,
  decideRaffleResult,
  pushLogId,
} from '../src/pushPolicy';
import { startDeletionSweeper } from './deletion';
import { registerAccountApi } from './accountApi';
import { initMail, mailFrom, mailReady, sendMail } from './mail';
import { otpMail } from './mailTemplate';
import { deleteAccountPage, privacyPage, termsPage } from './legal';
import { resolvePort } from './port';
import { verifyPassword } from './webAuth';
import { csvCell } from './csv';
import { SESSION_SECONDS, cookieHeader, issueToken, loginLimiter, verifyToken } from './session';
import { archiveList, esc, eventForm, loginPage, page, raffleForm, winnersForm } from './views';

const PORT = resolvePort(process.env);
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const COOKIE = 'kyk_admin';
/** Yeniden başlatınca herkes düşer — küçük bir panel için doğru varsayılan. */
const SECRET = randomBytes(32);

if (!PASSWORD) {
  console.error(
    'ADMIN_PASSWORD tanımlı değil.\n\n' +
      'Panel açık bir sunucuda çalışacak ve kayıtlara erişiyor; varsayılan parola\n' +
      'ile başlatmıyorum. .env dosyanıza uzun ve rastgele bir değer koyun:\n' +
      '  ADMIN_PASSWORD=...\n',
  );
  process.exit(1);
}

function loadServiceAccount() {
  try {
    return parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// Görseller Firebase'de değil Supabase'de duruyor (bkz. admin/photos.ts), o
// yüzden burada storageBucket yok. Firebase yalnızca Firestore için.
// `cert()` tip imzası camelCase (`projectId`) istiyor ama çalışma anında
// Firebase Console'dan indirilen snake_case JSON'u olduğu gibi kabul ediyor —
// dosyayı elle çevirmek gereksiz ve hataya açık olurdu.
initializeApp({ credential: cert(loadServiceAccount() as unknown as ServiceAccount) });
const db = getFirestore();

/** Açılışta hangi SMTP ayarının eksik olduğu — panelin posta kartı bunu yazıyor. */
let mailEksik: string[] = [];

const app = express();
// Coolify/Traefik gibi bir ters proxy arkasında HTTPS proxy'de sonlanıyor ve
// uygulamaya istek düz HTTP olarak geliyor. Bu ayar olmadan `req.secure`
// sunucuda da hep false döner ve oturum çerezi `Secure` almazdı.
// `1`: yalnızca en yakın proxy'ye güven — istemcinin uydurduğu başlığa değil.
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));
// Uygulamanın çağırdığı uç noktalar JSON konuşuyor. Sınır düşük: bu gövdeler
// yalnızca bir kod ve iki numara taşıyor.
app.use(express.json({ limit: '8kb' }));

/**
 * Görsel yükleme. Bellekte tutuluyor: dosyalar küçültülüp Storage'a gidiyor,
 * diskte hiç durmuyorlar.
 *
 * Sınırlar burada, `sharp`'tan önce: kabul edilmeyecek bir dosyayı çözmenin
 * anlamı yok ve bir sunucuyu 100 MB'lık bir yüklemeyle meşgul etmenin hiç yok.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_PHOTOS },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_TYPES.includes(file.mimetype)) return cb(null, true);
    // `cb(null, false)` dosyayı sessizce düşürürdü: etkinlik kaydedilir,
    // yönetici görselini yüklediğini sanır ve hiçbir yerde göremez.
    cb(new Error(`Desteklenmeyen dosya türü: ${file.mimetype}`));
  },
});

/**
 * Yükleme hatalarını okunur hâle getirir.
 *
 * Sarmalanmazsa multer'ın hatası genel hata yakalayıcıya düşüyor ve yönetici
 * "Bir şeyler ters gitti" görüyor — yedi görsel yüklediği için mi, dosya çok
 * büyük olduğu için mi, bilmiyor. Form yeniden çizilmiyor çünkü hata anında
 * gövdenin ne kadarının çözüldüğü belli değil; onun yerine ne olduğunu söyleyip
 * geri dönüş bırakıyoruz.
 */
function photoUpload(req: Request, res: Response, next: NextFunction): void {
  upload.array('photos', MAX_PHOTOS)(req, res, (err: unknown) => {
    if (!err) return next();

    const code = (err as { code?: string }).code;
    const message =
      code === 'LIMIT_FILE_COUNT'
        ? `Bir seferde en fazla ${MAX_PHOTOS} görsel yükleyebilirsiniz.`
        : code === 'LIMIT_FILE_SIZE'
          ? `Görsel çok büyük — en fazla ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`
          : err instanceof Error
            ? err.message
            : 'Görsel yüklenemedi.';

    console.error('[panel] görsel yükleme reddedildi:', err);
    res
      .status(400)
      .type('html')
      .send(
        page(
          'Görsel yüklenemedi',
          `<div class="card">
             <div class="banner">${esc(message)}</div>
             <p class="hint">Formdaki diğer bilgiler kaydedilmedi.</p>
             <div class="actions"><a class="btn btn-ghost" href="/">Etkinliklere dön</a></div>
           </div>`,
        ),
      );
  });
}

// ---------------------------------------------------------------- oturum

function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('hex');
}

/** Zaman sabiti karşılaştırma: uzunluk farkı da sızıntıdır, önce eşitliyoruz. */
function sameSecret(a: string, b: string): boolean {
  const ab = Buffer.from(sign(a));
  const bb = Buffer.from(sign(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function readCookie(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

function authed(req: Request): boolean {
  return verifyToken(SECRET, readCookie(req));
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (authed(req)) return next();
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  if (authed(req)) return res.redirect('/');
  res.type('html').send(loginPage());
});

/** Parola denemesi sınırı — bkz. `loginLimiter`. Süreç içi; yeniden başlatınca sıfırlanır. */
const attempts = loginLimiter();

app.post('/login', (req, res) => {
  const ip = req.ip ?? '';
  const locked = attempts.lockedFor(ip);
  if (locked > 0) {
    return res
      .status(429)
      .type('html')
      .send(loginPage(`Çok fazla yanlış deneme. ${Math.ceil(locked / 60_000)} dakika sonra tekrar deneyin.`));
  }
  const given = String(req.body.password ?? '');
  if (!sameSecret(given, PASSWORD)) {
    attempts.fail(ip);
    return res.status(401).type('html').send(loginPage('Parola yanlış.'));
  }
  attempts.succeed(ip);
  res.setHeader(
    'Set-Cookie',
    cookieHeader({ name: COOKIE, value: issueToken(SECRET), secure: req.secure, maxAge: SESSION_SECONDS }),
  );
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookieHeader({ name: COOKIE, value: '', secure: req.secure, maxAge: 0 }));
  res.redirect('/login');
});

// --------------------------------------------------- herkese açık sayfalar
//
// `app.use(requireAuth)`'tan ÖNCE: sonra kayıt edilselerdi yönetici parolası
// isterlerdi, ve Play'in şartı tam tersi — uygulamaya erişemeyen kullanıcı
// bu sayfadan hesabını silebilmeli. `check:release` sıranın korunduğunu
// doğruluyor.

app.get('/gizlilik', (_req, res) => res.type('html').send(privacyPage()));
app.get('/kosullar', (_req, res) => res.type('html').send(termsPage()));
app.get('/hesap-sil', (_req, res) => res.type('html').send(deleteAccountPage()));

app.post('/hesap-sil', async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  if (!email || !password) {
    return res.status(400).type('html').send(
      deleteAccountPage({ error: 'E-posta ve parolanızı girin.' }),
    );
  }

  // Kimlik Firebase'in kendi REST uç noktasıyla doğrulanıyor: Admin SDK
  // parola doğrulayamıyor (tasarımı gereği — parolayı hiç görmüyor).
  // Doğrulamadan talep kabul etmek, bir e-postayı bilen herkese başkasının
  // hesabını sildirmek olurdu.
  try {
    const uid = await verifyPassword(email, password);
    await db.collection('deletionRequests').doc(uid).set({
      uid,
      email,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      kaynak: 'web',
    });
    res.type('html').send(deleteAccountPage({ done: true }));
  } catch {
    // Tek cümle: "böyle bir hesap yok" ile "parola yanlış"ı ayırmak, bir
    // adresin kayıtlı olup olmadığını dışarıdan sorulabilir hâle getirir.
    res.status(401).type('html').send(
      deleteAccountPage({ error: 'E-posta veya parola hatalı.' }),
    );
  }
});

// Uygulamanın hesap uç noktaları. Kimliği yönetici parolası değil, çağıranın
// Firebase kimlik jetonu belirliyor — bu yüzden giriş duvarının önünde.
registerAccountApi(app, db);

app.use(requireAuth);

// ------------------------------------------------------------- etkinlikler

/**
 * Tarih ve saat formdan ayrı ayrı geliyor (`<input type="date">` +
 * `<input type="time">`). Saat dilimi hiç sorulmuyor; `joinLocal` +03:00 ile
 * ISO'yu kuruyor. Elle ISO yazılan hâlde en sık yapılan hata saat dilimini
 * unutmaktı ve o dizge her okuyanın kendi saat dilimine göre başka bir an
 * demek — artık yapılabilir bir hata değil.
 */
function formDateTime(body: Record<string, unknown>): { date: string; time: string } {
  return {
    date: String(body.startsAtDate ?? '').trim(),
    time: String(body.startsAtTime ?? '').trim(),
  };
}

/**
 * Formda duran görsellerden silinmek üzere işaretlenmeyenler.
 *
 * Var olanlar gizli alan olarak geri geliyor, silinecekler ayrı bir onay kutusu
 * listesiyle. Sıra korunuyor: ilk görsel kapak ve yönetici sıralamayı bilerek
 * kuruyor.
 */
function keptPhotos(body: Record<string, unknown>): string[] {
  const raw = body.photo;
  const all = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).map(String);
  const dropRaw = body.dropPhoto;
  const drop = new Set(
    (Array.isArray(dropRaw) ? dropRaw : dropRaw === undefined ? [] : [dropRaw]).map(String),
  );
  return all.filter((url) => url && !drop.has(url));
}

function formToInput(body: Record<string, unknown>): EventInput {
  const s = (k: string) => String(body[k] ?? '').trim();
  const { date, time } = formDateTime(body);
  return {
    id: s('id'),
    startsAt: joinLocal(date, time),
    endsAt: s('endsAt'),
    venue: s('venue'),
    venueShort: s('venueShort'),
    title: s('title'),
    tag: s('tag'),
    desc: s('desc'),
    capacity: s('capacity'),
    speaker: s('speaker'),
    speakerRole: s('speakerRole'),
    tags: s('tags').split(',').map((t) => t.trim()).filter(Boolean),
    soon: !!body.soon,
    badge: s('badge'),
    attendance: s('attendance'),
    photos: keptPhotos(body),
  };
}

/**
 * Formda gösterilecek hâli — `tags` dizisi virgüllü metne, `startsAt` tarih ve
 * saat seçicilerine ayrılır.
 *
 * `raw` doğrulama hatasından sonra veriliyor: kişi tarihi seçip saati boş
 * bıraktıysa `startsAt` boş kalır, dolayısıyla ondan türetilen tarih de boş
 * gelirdi ve form seçilmiş tarihi silerdi.
 */
function inputToForm(
  input: EventInput,
  raw?: { date: string; time: string },
): Record<string, unknown> {
  const split = splitLocal(input.startsAt);
  return {
    ...input,
    tags: input.tags.join(', '),
    startsAtDate: raw?.date || split.date,
    startsAtTime: raw?.time || split.time,
  };
}

app.get('/', async (_req, res) => {
  const snap = await db.collection('events').get();
  const events = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ClubEvent, 'id'>) }))
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));

  const rows = events
    .map(
      (e) => `<tr>
        <td><strong>${esc(e.title)}</strong><br><span class="hint">${esc(e.short)}</span></td>
        <td>${esc(e.tag)}</td>
        <td><code>${esc(e.id)}</code></td>
        <td style="white-space:nowrap">
          <a class="btn btn-ghost" style="padding:6px 12px;font-size:13px" href="/events/${encodeURIComponent(e.id)}">Düzenle</a>
          <form method="post" action="/events/${encodeURIComponent(e.id)}/delete" style="display:inline"
                onsubmit="return confirm('${esc(e.title)} silinsin mi? Geri alınamaz.')">
            <button class="btn-danger" style="padding:6px 12px;font-size:13px">Sil</button>
          </form>
        </td>
      </tr>`,
    )
    .join('');

  res.type('html').send(
    page(
      'Etkinlikler',
      `<div class="card">
         <div style="display:flex;align-items:center;margin-bottom:16px">
           <h2 style="margin:0">Etkinlikler</h2>
           <a class="btn" style="margin-left:auto" href="/events/new">Yeni etkinlik</a>
         </div>
         ${
           events.length
             ? `<table><thead><tr><th>Etkinlik</th><th>Kategori</th><th>Kimlik</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
             : `<p class="empty">Henüz etkinlik yok. Uygulamada takvim boş görünüyor.</p>`
         }
       </div>`,
    ),
  );
});

/**
 * Bir etkinliğin gerçek kayıt sayısı — `registrations` koleksiyonundan, Admin
 * SDK ile. Uygulamanın gördüğü sayı `eventSeats`'ten geliyor; ikisi ayrıştığı
 * an doğru olan bu.
 */
async function trueRegisteredCount(eventId: string): Promise<number> {
  const snap = await db.collection('registrations').where('eventId', '==', eventId).count().get();
  return snap.data().count;
}

/**
 * Koltuk dokümanını gerçek kayıtlardan yeniden kurar.
 *
 * Uygulama koltuğu kaydın kimliğiyle `arrayUnion` ediyor, yani normal şartlarda
 * ayrışmaz. Ayrışabileceği iki yol var: kuralları geçen ama kayıt yazmayan
 * elle atılmış bir istek, ve panelden silinen bir kayıt. İkisi de burada
 * düzeliyor.
 */
async function rebuildSeats(eventId: string): Promise<number> {
  const snap = await db.collection('registrations').where('eventId', '==', eventId).get();
  // Doküman kimliği değil, kaydın kendi koltuk jetonu: kimlikte öğrenci
  // numarası geçiyor ve bu liste herkese açık.
  const seatIds = snap.docs
    .map((d) => (d.data() as { seatId?: unknown }).seatId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  await db.collection('eventSeats').doc(eventId).set({ eventId, seatIds });
  return seatIds.length;
}

/**
 * Etkinliği kaydeder; gelen dosyaları yükler, silinenleri temizler.
 *
 * Sıra önemli: doğrulama önce, yükleme sonra. Ters olsaydı geçersiz bir formda
 * dosyalar Storage'a gider ve hiçbir etkinliğin işaret etmediği yetimler
 * kalırdı.
 */
async function saveEventWithPhotos(
  req: Request,
  res: Response,
  opts: { editing: boolean; id?: string; archive?: boolean },
): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const base = formToInput(req.body);
  const input = opts.id ? { ...base, id: opts.id } : base;
  const view = { editing: opts.editing, archive: opts.archive };
  const form = () => inputToForm(input, formDateTime(req.body));

  if (input.photos!.length + files.length > MAX_PHOTOS) {
    res
      .status(400)
      .type('html')
      .send(
        eventForm(
          form(),
          { photos: `En fazla ${MAX_PHOTOS} görsel olabilir; ${input.photos!.length} tanesi zaten yüklü.` },
          view,
        ),
      );
    return;
  }

  // Görseller olmadan doğrula. Hata varsa hiçbir dosya yüklenmemiş oluyor.
  const checked = buildEvent(input);
  if (!checked.ok) {
    res.status(400).type('html').send(eventForm(form(), checked.errors, view));
    return;
  }

  // Arşiv kaydı geçmişte olmalı. Gelecek tarihli bir kayıt takvimde görünür ve
  // kayıt kabul eder — arşiv formunda kontenjan sorulmadığı için de kontenjansız
  // bir etkinlik olurdu.
  if (opts.archive && !isPast(checked.event, today())) {
    res
      .status(400)
      .type('html')
      .send(
        eventForm(form(), { startsAt: 'Arşiv kaydının tarihi bugünden önce olmalı.' }, view),
      );
    return;
  }

  const ref = db.collection('events').doc(checked.event.id);
  const existing = await ref.get();
  if (!opts.editing && existing.exists) {
    res
      .status(409)
      .type('html')
      .send(eventForm(form(), { id: 'Bu kimlik zaten kullanılıyor.' }, view));
    return;
  }

  // Kayıttan *önce* okunuyor: `set()` dokümanı değiştirdikten sonra bakmak
  // hep yeni listeyi görür ve silinen hiçbir dosya temizlenmezdi.
  const before = ((existing.data()?.photos as string[] | undefined) ?? []).filter(Boolean);

  const uploaded: string[] = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadEventPhoto(checked.event.id, file.buffer));
    }
  } catch (err) {
    // Yükleme yarıda kaldı: etkinlik henüz kaydedilmedi, dolayısıyla ortada
    // yarım bir kayıt yok — ama gitmiş dosyalar varsa onları bırakmıyoruz.
    await deletePhotos(uploaded);
    if (!(err instanceof PhotoUploadError)) throw err;
    res
      .status(502)
      .type('html')
      .send(eventForm(form(), { photos: err.message }, view));
    return;
  }

  const built = buildEvent({ ...input, photos: [...input.photos!, ...uploaded] });
  if (!built.ok) {
    // Buraya ancak yüklemenin ürettiği adres beklenmedikse düşülür. Yüklenenleri
    // geri alıyoruz ki yetim dosya kalmasın.
    await deletePhotos(uploaded);
    res.status(400).type('html').send(eventForm(form(), built.errors, view));
    return;
  }

  const { id, ...rest } = built.event;
  await Promise.all([
    ref.set({ ...rest, published: true }),
    // Koltuk dokümanı etkinlikle birlikte doğuyor; düzenlemede zaten var.
    opts.editing
      ? Promise.resolve()
      : db.collection('eventSeats').doc(id).set({ eventId: id, seatIds: [] }),
  ]);

  // Formdan çıkarılan görsellerin dosyaları da gitsin.
  const removed = before.filter((url) => !built.event.photos?.includes(url));
  if (removed.length) await deletePhotos(removed);

  // Duyuru kayıttan **sonra**: bildirim gidip kayıt başarısız olsaydı,
  // kullanıcılar olmayan bir etkinliğe yönlendirilmiş olurdu. `announce` hiçbir
  // hatayı yukarı taşımıyor — bildirim gönderilememesi kaydı bozmamalı.
  await announce(db, decideNewEvent({ event: built.event, editing: opts.editing, now: new Date() }), {
    eventId: built.event.id,
  });

  res.redirect(opts.archive ? '/arsiv' : '/');
}

app.get('/events/new', (_req, res) => {
  res.type('html').send(eventForm({}, {}, { editing: false }));
});

app.post('/events/new', photoUpload, async (req, res) => {
  await saveEventWithPhotos(req, res, { editing: false });
});

app.get('/events/:id', async (req, res) => {
  const doc = await db.collection('events').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).type('html').send(page('Bulunamadı', '<div class="card">Etkinlik bulunamadı.</div>'));

  const event = { id: doc.id, ...(doc.data() as Omit<ClubEvent, 'id'>) } as ClubEvent;
  const seats = await db.collection('eventSeats').doc(req.params.id).get();
  const shown = (seats.data()?.seatIds as string[] | undefined)?.length ?? 0;

  res.type('html').send(
    eventForm(inputToForm(toInput(event)), {}, {
      editing: true,
      registered: await trueRegisteredCount(req.params.id),
      shown,
    }),
  );
});

app.post('/events/:id', photoUpload, async (req, res) => {
  // Kimlik dokümanın kendisi; formdan gelene güvenmiyoruz.
  await saveEventWithPhotos(req, res, { editing: true, id: String(req.params.id) });
});

app.post('/events/:id/delete', async (req, res) => {
  // Silmeden **önce** okunuyor: silinmiş bir dokümandan başlık ve tarih
  // çıkarılamaz, ve iptal bildirimi ikisini de söylemek zorunda.
  const doomed = await db.collection('events').doc(req.params.id).get();
  const event = doomed.exists
    ? ({ id: doomed.id, ...(doomed.data() as Omit<ClubEvent, 'id'>) } as ClubEvent)
    : null;
  const announced = event
    ? await alreadyAnnounced(db, pushLogId('event_created', event.id))
    : false;

  await Promise.all([
    db.collection('events').doc(req.params.id).delete(),
    // Görseller de gitsin, yoksa bucket'ta kimsenin işaret etmediği dosyalar
    // birikir ve kota onlara da ödeniyor.
    deleteEventPhotos(req.params.id),
    // Sahipsiz koltuk dokümanı bırakmıyoruz: aynı kimlikle yeni bir etkinlik
    // açılırsa eski kayıtların koltuklarıyla dolu başlardı.
    db.collection('eventSeats').doc(req.params.id).delete(),
  ]);

  if (event) {
    await announce(db, decideCancelledEvent({ event, announced, now: new Date() }));
  }

  res.redirect('/');
});

/** Uygulamanın gördüğü sayıyı gerçek kayıtlara eşitler. */
app.post('/events/:id/seats', async (req, res) => {
  await rebuildSeats(req.params.id);
  res.redirect(`/events/${encodeURIComponent(req.params.id)}`);
});

// ---------------------------------------------------------------- arşiv
//
// Arşiv ayrı bir koleksiyon değil — `events` listesinin tarihi geçmiş yarısı.
// Ayrı olan iş akışı: burada sorulan soru "hangi etkinliğin görseli eksik",
// takvimde sorulan "sırada ne var". Kontenjan ve son-gün rozeti olmuş bir
// etkinlikte anlamsız olduğu için form onları göstermiyor.

/** Bugün, +03:00'a göre. Her istekte yeniden okunuyor: sunucu gün boyu ayakta. */
const today = () => todayLocal(new Date());

async function allEvents(): Promise<ClubEvent[]> {
  const snap = await db.collection('events').get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClubEvent, 'id'>) }) as ClubEvent);
}

app.get('/arsiv', async (_req, res) => {
  const past = (await allEvents())
    .filter((e) => isPast(e, today()))
    .sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));

  res.type('html').send(
    archiveList(
      past.map((e) => ({
        id: e.id,
        title: e.title,
        short: e.short,
        tag: e.tag,
        photos: e.photos?.length ?? 0,
        attendance: e.attendance,
      })),
    ),
  );
});

app.get('/arsiv/yeni', async (req, res) => {
  const events = await allEvents();
  const sources = events
    .sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''))
    .map((e) => ({ id: e.id, label: `${e.title} — ${e.short}` }));

  // `?from=` var olan bir etkinliğin alanlarını kopyalıyor. Kimlik bilerek
  // boş bırakılıyor: aynı kimlikle kaydetmek yeni bir kayıt değil, var olanın
  // üzerine yazmak olurdu.
  const from = String(req.query.from ?? '');
  const source = from ? events.find((e) => e.id === from) : undefined;
  const values = source ? { ...inputToForm(toInput(source)), id: '' } : {};

  res.type('html').send(eventForm(values, {}, { editing: false, archive: true, sources }));
});

app.post('/arsiv/yeni', photoUpload, async (req, res) => {
  await saveEventWithPhotos(req, res, { editing: false, archive: true });
});

app.get('/arsiv/:id', async (req, res) => {
  const doc = await db.collection('events').doc(req.params.id).get();
  if (!doc.exists) {
    return res
      .status(404)
      .type('html')
      .send(page('Bulunamadı', '<div class="card">Etkinlik bulunamadı.</div>'));
  }

  const event = { id: doc.id, ...(doc.data() as Omit<ClubEvent, 'id'>) } as ClubEvent;
  // Yaklaşan bir etkinlik arşiv formunda düzenlenemez: kontenjan ve rozet
  // gizli olduğu için kaydetmek onları sessizce silerdi.
  if (!isPast(event, today())) {
    return res.redirect(`/events/${encodeURIComponent(event.id)}`);
  }

  res.type('html').send(eventForm(inputToForm(toInput(event)), {}, { editing: true, archive: true }));
});

app.post('/arsiv/:id', photoUpload, async (req, res) => {
  await saveEventWithPhotos(req, res, {
    editing: true,
    id: String(req.params.id),
    archive: true,
  });
});

// ---------------------------------------------------------------- kayıtlar

type RegistrationDoc = {
  eventId?: string;
  code?: string;
  name?: string;
  studentNo?: string;
  department?: string;
  year?: string;
  createdAt?: { toDate?: () => Date };
};

async function loadRegistrations(eventId?: string) {
  let query = db.collection('registrations') as FirebaseFirestore.Query;
  if (eventId) query = query.where('eventId', '==', eventId);
  const snap = await query.get();
  return snap.docs
    .map((d) => d.data() as RegistrationDoc)
    .sort((a, b) => String(a.studentNo).localeCompare(String(b.studentNo), 'tr'));
}

app.get('/registrations', async (req, res) => {
  const eventId = req.query.event ? String(req.query.event) : undefined;
  const [registrations, eventsSnap] = await Promise.all([
    loadRegistrations(eventId),
    db.collection('events').get(),
  ]);

  const options = eventsSnap.docs
    .map((d) => {
      const title = String((d.data() as { title?: unknown }).title ?? d.id);
      const selected = d.id === eventId ? ' selected' : '';
      return `<option value="${esc(d.id)}"${selected}>${esc(title)}</option>`;
    })
    .join('');

  const rows = registrations
    .map(
      (r) => `<tr>
        <td>${esc(r.studentNo)}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.department)}</td>
        <td>${esc(r.year)}</td>
        <td><code>${esc(r.code)}</code></td>
        <td>${esc(r.eventId)}</td>
      </tr>`,
    )
    .join('');

  const csvHref = `/registrations.csv${eventId ? `?event=${encodeURIComponent(eventId)}` : ''}`;

  res.type('html').send(
    page(
      'Kayıtlar',
      `<div class="card">
         <h2>Kayıtlar</h2>
         <form method="get" class="row" style="margin-bottom:18px">
           <label style="margin:0">Etkinlik
             <select name="event" onchange="this.form.submit()">
               <option value="">Tümü</option>
               ${options}
             </select>
           </label>
           <div style="flex:0 0 auto">
             <a class="btn btn-ghost" href="${esc(csvHref)}">CSV indir</a>
           </div>
         </form>

         ${
           registrations.length
             ? `<p class="hint">${registrations.length} kayıt, öğrenci numarasına göre sıralı.</p>
                <table><thead><tr><th>Öğrenci no</th><th>Ad</th><th>Bölüm</th><th>Sınıf</th><th>Kod</th><th>Etkinlik</th></tr></thead><tbody>${rows}</tbody></table>`
             : `<p class="empty">Bu seçimde kayıt yok.</p>`
         }
       </div>`,
    ),
  );
});

app.get('/registrations.csv', async (req, res) => {
  const eventId = req.query.event ? String(req.query.event) : undefined;
  const registrations = await loadRegistrations(eventId);

  const columns = ['eventId', 'code', 'name', 'studentNo', 'department', 'year', 'createdAt'];

  const body = registrations
    .map((r) =>
      columns
        .map((c) => {
          const value = (r as Record<string, unknown>)[c];
          if (c === 'createdAt' && value && typeof (value as any).toDate === 'function') {
            return (value as any).toDate().toISOString();
          }
          return csvCell(value);
        })
        .join(','),
    )
    .join('\r\n');

  const name = eventId ? `kayitlar-${eventId}.csv` : 'kayitlar.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  // BOM olmadan Excel UTF-8'i Windows-1254 sanıp Türkçe karakterleri bozuyor.
  res.send('﻿' + [columns.join(','), body].filter(Boolean).join('\r\n'));
});

// ---------------------------------------------------------------- çekilişler

/** Formdaki satırlardan alan tanımlarını toplar; anahtarı boş olan satır atlanır. */
function formToFields(body: Record<string, unknown>): RaffleField[] {
  const fields: RaffleField[] = [];
  for (let i = 0; i < 40; i += 1) {
    const key = String(body[`key_${i}`] ?? '').trim();
    if (!key) continue;
    const type = String(body[`type_${i}`] ?? 'text') as RaffleFieldType;
    const options = String(body[`options_${i}`] ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    fields.push({
      key,
      label: String(body[`label_${i}`] ?? '').trim(),
      type,
      required: !!body[`required_${i}`],
      ...(type === 'select' ? { options } : {}),
    });
  }
  return fields;
}

async function loadRaffle(eventId: string): Promise<Raffle | null> {
  const doc = await db.collection('raffles').doc(eventId).get();
  if (!doc.exists) return null;
  return { eventId: doc.id, ...(doc.data() as Omit<Raffle, 'eventId'>) };
}

async function loadEventTitle(eventId: string): Promise<string | null> {
  const doc = await db.collection('events').doc(eventId).get();
  if (!doc.exists) return null;
  return String((doc.data() as { title?: unknown }).title ?? eventId);
}

async function countEntries(eventId: string): Promise<number> {
  const snap = await db.collection('raffleEntries').where('eventId', '==', eventId).get();
  return snap.size;
}

/**
 * Bildirim zincirinin görünür hâli.
 *
 * Bu sayfanın varlık sebebi: zincirin her halkası sessizce kopuyordu — cihaz
 * kaydı yazılmamış olabilir, panel eski kodu çalıştırıyor olabilir, gönderim
 * kimseye ulaşmamış olabilir. Üçünün de tek belirtisi "bildirim gelmedi"ydi.
 */
app.get('/bildirimler', async (req, res) => {
  const categories = NOTIFICATION_CATEGORIES.map((c) => c.key);
  const [devices, log, pending] = await Promise.all([
    summariseDevices(db, categories),
    recentPushLog(db),
    pendingSummary(db),
  ]);

  res.type('html').send(
    notificationsPage({
      autoPush: autoPushEnabled(),
      devices,
      log: log as LogRow[],
      pending,
      categories,
      mail: { ready: mailReady(), from: mailFrom(), eksik: mailEksik },
      notice: typeof req.query.sonuc === 'string' ? req.query.sonuc : undefined,
    }),
  );
});

/**
 * Test postası.
 *
 * Var olma sebebi tek bir sessiz yanlış: kimlik doğrulaması `info@` ile
 * yapılıp `MAIL_FROM` `noreply@` yazıldığında Google başlığı kendisi
 * değiştirebiliyor, ve bunu hiçbir yerel kontrol göremez — yalnızca gelen
 * postanın gönderen satırı söyler. Bunu denemek için gerçek bir hesap açıp
 * kayıt akışını beklemek gerekiyordu.
 */
app.post('/bildirimler/posta-testi', async (req, res) => {
  const to = String(req.body.to ?? '').trim();
  if (!to) {
    return res.redirect('/bildirimler?sonuc=' + encodeURIComponent('Adres yazın.'));
  }
  if (!mailReady()) {
    return res.redirect(
      '/bildirimler?sonuc=' +
        encodeURIComponent('SMTP yapılandırılmamış — SMTP_HOST, SMTP_USER, SMTP_PASS gerekiyor.'),
    );
  }
  try {
    // Gerçek şablon gönderiliyor, ayrı bir "test" gövdesi değil: burada
    // ölçülmek istenen şey postanın kendisi — ayrı bir gövde başka bir postayı
    // sınardı ve spam kararı gövdeye de bakıyor.
    const sonuc = await sendMail({ to, ...otpMail('000000', 10) });
    res.redirect(
      '/bildirimler?sonuc=' +
        encodeURIComponent(
          `Gönderildi → ${sonuc.accepted.join(', ') || to}. ` +
            `Zarf göndereni: ${sonuc.envelopeFrom}. ` +
            'Gelen postayı açıp GÖNDEREN satırına bakın — Google başlığı değiştirmiş olabilir.',
        ),
    );
  } catch (err) {
    res.redirect(
      '/bildirimler?sonuc=' +
        encodeURIComponent(
          'Gönderilemedi: ' + (err instanceof Error ? err.message : String(err)),
        ),
    );
  }
});

app.post('/bildirimler/test', async (req, res) => {
  const category = String(req.body.category ?? '').trim();
  const title = String(req.body.title ?? '').trim();
  const body = String(req.body.body ?? '').trim();

  if (!category || !title || !body) {
    return res.redirect('/bildirimler?sonuc=' + encodeURIComponent('Alanların hepsi dolu olmalı.'));
  }

  const outcome = await sendTestPush(db, { category, title, body });
  const summary =
    `${outcome.registered} kayıtlı cihaz · ${outcome.sent} gönderildi` +
    (outcome.deferred ? ` · ${outcome.deferred} sessiz saate ertelendi` : '') +
    (outcome.failed ? ` · ${outcome.failed} başarısız` : '') +
    (outcome.sent === 0 && outcome.deferred === 0
      ? ` — kimseye ulaşmadı. Kategorisi kapalı: ${outcome.skipped.category}, ` +
        `bildirimleri kapalı: ${outcome.skipped.master}, token'ı yok: ${outcome.skipped.noToken}.`
      : '');

  res.redirect('/bildirimler?sonuc=' + encodeURIComponent(summary));
});

app.get('/raffles', async (_req, res) => {
  const [eventsSnap, rafflesSnap] = await Promise.all([
    db.collection('events').get(),
    db.collection('raffles').get(),
  ]);
  const hasRaffle = new Set(rafflesSnap.docs.map((d) => d.id));

  const rows = eventsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as { title?: unknown; tag?: unknown }) }))
    .map((e) => {
      const defined = hasRaffle.has(e.id);
      return `<tr>
        <td><strong>${esc(e.title)}</strong><br><span class="hint">${esc(e.tag)}</span></td>
        <td>${defined ? 'Tanımlı' : '<span class="hint">Tanımsız</span>'}</td>
        <td style="white-space:nowrap">
          <a class="btn btn-ghost" style="padding:6px 12px;font-size:13px" href="/raffles/${encodeURIComponent(e.id)}">
            ${defined ? 'Düzenle' : 'Çekiliş yap'}
          </a>
        </td>
      </tr>`;
    })
    .join('');

  res.type('html').send(
    page(
      'Çekilişler',
      `<div class="card">
         <h2>Çekilişler</h2>
         <p class="hint">
           Çekiliş ayrı bir kayıt değil, bir etkinliğin üstüne eklenen tanım.
           Aşağıdan bir etkinlik seçip hangi bilgilerin sorulacağını belirleyin.
         </p>
         ${
           eventsSnap.size
             ? `<table><thead><tr><th>Etkinlik</th><th>Durum</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
             : '<p class="empty">Önce bir etkinlik oluşturun.</p>'
         }
       </div>`,
    ),
  );
});

app.get('/raffles/:eventId', async (req, res) => {
  const eventId = req.params.eventId;
  const [title, raffle, entryCount] = await Promise.all([
    loadEventTitle(eventId),
    loadRaffle(eventId),
    countEntries(eventId),
  ]);
  if (!title) return res.status(404).type('html').send(page('Bulunamadı', '<div class="card">Etkinlik bulunamadı.</div>'));

  // Yeni çekiliş varsayılan alanlarla başlıyor; kulübün her seferinde sorduğu dörtlü.
  const closes = raffle?.entriesCloseAt ?? '';
  res.type('html').send(
    raffleForm(
      {
        eventId,
        eventTitle: title,
        winnerCount: raffle?.winnerCount ?? 1,
        entriesCloseDate: closes.slice(0, 10),
        entriesCloseTime: closes.slice(11, 16) || '23:59',
        fields: raffle?.fields ?? DEFAULT_FIELDS,
      },
      {},
      entryCount,
    ),
  );
});

app.post('/raffles/:eventId', async (req, res) => {
  const eventId = req.params.eventId;
  const title = (await loadEventTitle(eventId)) ?? eventId;
  const fields = formToFields(req.body);
  const errors = validateFields(fields);

  const winnerCount = Number(req.body.winnerCount);
  if (!Number.isInteger(winnerCount) || winnerCount < 1) {
    errors.winnerCount = 'En az 1 olmalı.';
  }

  const date = String(req.body.entriesCloseDate ?? '');
  const time = String(req.body.entriesCloseTime ?? '');
  // Saat dilimi kullanıcıdan istenmiyor; kulüp Türkiye'de ve Türkiye kalıcı
  // olarak UTC+3. Biçim hatası yapması imkânsız hâle geliyor.
  const entriesCloseAt = date && time ? `${date}T${time}:00+03:00` : '';
  if (!entriesCloseAt) errors.entriesCloseAt = 'Son katılım tarihi ve saati gerekli.';

  if (Object.keys(errors).length) {
    return res.status(400).type('html').send(
      raffleForm(
        { eventId, eventTitle: title, winnerCount, entriesCloseDate: date, entriesCloseTime: time, fields },
        errors,
        await countEntries(eventId),
      ),
    );
  }

  const existing = await loadRaffle(eventId);
  await db.collection('raffles').doc(eventId).set({
    fields,
    winnerCount,
    entriesCloseAt,
    // Kazananlar ayrı ekrandan giriliyor; tanımı kaydetmek onları silmemeli.
    winners: existing?.winners ?? [],
    drawnAt: existing?.drawnAt ?? '',
  });
  res.redirect('/raffles');
});

async function loadEntries(eventId: string) {
  const snap = await db.collection('raffleEntries').where('eventId', '==', eventId).get();
  return snap.docs
    .map((d) => d.data() as { entryId?: string; values?: Record<string, string>; createdAt?: { toDate?: () => Date } })
    .sort((a, b) => String(a.entryId).localeCompare(String(b.entryId)));
}

app.get('/raffles/:eventId/entries', async (req, res) => {
  const eventId = req.params.eventId;
  const [raffle, entries, title] = await Promise.all([
    loadRaffle(eventId),
    loadEntries(eventId),
    loadEventTitle(eventId),
  ]);
  if (!raffle) return res.redirect(`/raffles/${encodeURIComponent(eventId)}`);

  const head = raffle.fields.map((f) => `<th>${esc(f.label)}</th>`).join('');
  const rows = entries
    .map(
      (e) =>
        `<tr>${raffle.fields.map((f) => `<td>${esc(e.values?.[f.key] ?? '')}</td>`).join('')}</tr>`,
    )
    .join('');

  res.type('html').send(
    page(
      'Katılımlar',
      `<div class="card">
         <div style="display:flex;align-items:center;margin-bottom:16px">
           <h2 style="margin:0">${esc(title ?? eventId)} — katılımlar</h2>
           <a class="btn" style="margin-left:auto" href="/raffles/${encodeURIComponent(eventId)}/entries.csv">CSV indir</a>
         </div>
         ${
           entries.length
             ? `<p class="hint">${entries.length} katılım.</p><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`
             : '<p class="empty">Henüz katılım yok.</p>'
         }
       </div>`,
    ),
  );
});

app.get('/raffles/:eventId/entries.csv', async (req, res) => {
  const eventId = req.params.eventId;
  const [raffle, entries] = await Promise.all([loadRaffle(eventId), loadEntries(eventId)]);
  if (!raffle) return res.redirect(`/raffles/${encodeURIComponent(eventId)}`);

  const columns = csvColumns(raffle.fields);
  const body = entries
    .map((e) => {
      const created = e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : '';
      return [
        csvCell(e.entryId),
        csvCell(eventId),
        ...raffle.fields.map((f) => csvCell(e.values?.[f.key] ?? '')),
        csvCell(created),
      ].join(',');
    })
    .join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cekilis-${eventId}.csv"`);
  // BOM olmadan Excel UTF-8'i Windows-1254 sanıp Türkçe karakterleri bozuyor.
  res.send('\ufeff' + [columns.join(','), body].filter(Boolean).join('\r\n'));
});

app.get('/raffles/:eventId/winners', async (req, res) => {
  const eventId = req.params.eventId;
  const [raffle, title] = await Promise.all([loadRaffle(eventId), loadEventTitle(eventId)]);
  if (!raffle) return res.redirect(`/raffles/${encodeURIComponent(eventId)}`);
  res.type('html').send(winnersForm(eventId, title ?? eventId, raffle.winners ?? [], raffle.drawnAt ?? ''));
});

app.post('/raffles/:eventId/winners', async (req, res) => {
  const eventId = req.params.eventId;
  // Maskeleme burada, yazma anında yapılıyor: uygulamaya tam ad hiç ulaşmıyor,
  // dolayısıyla bir ekranın yanlışlıkla tam adı göstermesi mümkün değil.
  const winners = String(req.body.winners ?? '')
    .split('\n')
    .map((line) => maskName(line))
    .filter(Boolean);

  await db.collection('raffles').doc(eventId).set(
    { winners, drawnAt: winners.length ? new Date().toISOString() : '' },
    { merge: true },
  );

  const doc = await db.collection('events').doc(eventId).get();
  if (doc.exists) {
    const event = { id: doc.id, ...(doc.data() as Omit<ClubEvent, 'id'>) } as ClubEvent;
    await announce(db, decideRaffleResult({ event, winners }), { eventId });
  }

  res.redirect(`/raffles/${encodeURIComponent(eventId)}`);
});

/**
 * Son çare hata yakalayıcı.
 *
 * Bu olmadan express varsayılan davranışına düşüyor ve tarayıcıya tam yığın
 * izini basıyor: mutlak dosya yolları, paket sürümleri, Firestore hata
 * ayrıntıları. Panel açık bir sunucuda çalışacağı için bunların hepsi keşif
 * bilgisi. Ayrıntı sunucu günlüğüne gidiyor, kullanıcı sade bir sayfa görüyor.
 */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[panel] istek başarısız:', err);
  if (res.headersSent) return;
  res.status(500).type('html').send(
    page(
      'Hata',
      `<div class="card">
         <h2>Bir şeyler ters gitti</h2>
         <p class="hint">
           İstek tamamlanamadı. Ayrıntı sunucu günlüğünde; genellikle sebebi
           Firestore'a ulaşılamaması ya da servis hesabı anahtarının geçersiz
           olması oluyor.
         </p>
         <div class="actions"><a class="btn btn-ghost" href="/">Etkinliklere dön</a></div>
       </div>`,
    ),
  );
});

app.listen(PORT, () => {
  console.log(`Yönetim paneli: http://localhost:${PORT}`);
  // Hangi modda olduğu açılışta yazılıyor: sessizce çalışmayan bir bildirim
  // otomasyonu, bu deponun iki kez yaşadığı hatanın aynısı olurdu.
  console.log(
    autoPushEnabled()
      ? '[push] otomatik bildirim AÇIK. Kapatmak için ADMIN_AUTO_PUSH=off.'
      : '[push] otomatik bildirim KAPALI (ADMIN_AUTO_PUSH=off).',
  );
  // Posta da açılışta söyleniyor, aynı gerekçeyle: yapılandırılmamış SMTP'nin
  // tek belirtisi "kod gelmiyor" olurdu ve o, operatörün bakmadığı yerde kalır.
  const posta = initMail(process.env);
  mailEksik = posta.ok ? [] : posta.eksik;
  console.log(
    posta.ok
      ? `[posta] SMTP hazır — gönderen: ${mailFrom()}`
      : `[posta] SMTP YAPILANDIRILMAMIŞ (eksik: ${posta.eksik.join(', ')}). ` +
        'Doğrulama kodu gönderilemez, hesaplar doğrulanamaz.',
  );
  // Sessiz saatlerde biriken bildirimleri sabah gönderen zamanlayıcı.
  startPushFlusher(db);
  // Duyurular panelde yazılmıyor — kulübün sitesinde yazılıyor, o yüzden tek
  // yol yoklamak. İlk tur hiçbir şey göndermiyor, mevcut listeyi işaretliyor.
  startAnnouncementPoller(db);
  // Hesap silme temizliği. Cloud Functions olmadığı için (Blaze istiyor) bu
  // iş panelin üçüncü yoklayıcısı; Apple silmenin tamamlanmasını istiyor.
  startDeletionSweeper(db);
});
