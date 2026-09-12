/**
 * `npm run check:panel`
 *
 * Panelin ürettiği HTML'i çalıştırmadan sınar. Bu dosyalar Firestore'a
 * dokunmadığı için doğrudan çağrılabiliyorlar — paneli ayağa kaldırıp gerçek bir
 * veritabanı bağlamaya gerek yok.
 *
 * Buradaki kontroller iki şeyi koruyor: arşiv kipinin **gizlediği alanların
 * veriyi silmemesi** (gizlenen alan formdan da düşerse kaydetmek onu sessizce
 * temizler), ve her enterpolasyonun kaçırılmış olması.
 */
import { parseServiceAccount } from '../admin/credentials';
import { csvCell } from '../admin/csv';
import {
  LOGIN_LOCK_MS,
  LOGIN_MAX_FAILURES,
  SESSION_SECONDS,
  cookieHeader,
  issueToken,
  loginLimiter,
  verifyToken,
} from '../admin/session';
import { isBucketMissing, keyProblem } from '../admin/photos';
import { resolvePort } from '../admin/port';
import { announce } from '../admin/push';
import {
  USER_DOC_COLLECTIONS,
  USER_QUERY_COLLECTIONS,
  processDeletion,
} from '../admin/deletion';
import { archiveList, eventForm } from '../admin/views';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_RESEND_MS,
  OTP_SEND_WINDOW_MS,
  OTP_TTL_MS,
  decideSend,
  decideVerify,
  hashCode,
  makeCode,
  type OtpRecord,
} from '../admin/otp';
import { readMailConfig } from '../admin/mail';
import { otpMail } from '../admin/mailTemplate';
import { claimIdentity } from '../admin/claims';

let failed = 0;
function assert(name: string, condition: boolean, detail = '') {
  console.log(`${condition ? '✓' : '✗'} ${name}${condition ? '' : `\n    ${detail}`}`);
  if (!condition) failed += 1;
}

const VALUES = {
  id: 'git-atolyesi',
  title: 'Git Atölyesi',
  tag: 'Atölye',
  capacity: '60',
  badge: 'SON GUN',
  soon: true,
  attendance: '42',
  startsAtDate: '2025-11-12',
  startsAtTime: '18:00',
  endsAt: '20:30',
  photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
};

// 1. Normal form: kontenjan ve rozet görünür alanlar.
const normal = eventForm(VALUES, {}, { editing: true, registered: 3, shown: 3 });
assert('normal formda kontenjan görünür', /<input type="number" name="capacity"/.test(normal));
assert('normal formda rozet görünür', /<input type="text" name="badge"/.test(normal));
assert('normal formda kayıt kartı var', /Sayacı gerçek kayıtlara eşitle/.test(normal));
assert('normal formda vazgeç köke gider', /href="\/">Vazgeç/.test(normal));

// 2. Arşiv kipi: olmuş bir etkinlikte kontenjan ve son-gün rozeti anlamsız.
const archive = eventForm(VALUES, {}, { editing: true, archive: true });
assert('arşivde kontenjan alanı yok', !/<input type="number" name="capacity"/.test(archive));
assert('arşivde rozet alanı yok', !/<input type="text" name="badge"/.test(archive));
assert('arşivde kayıt kartı yok', !/Sayacı gerçek kayıtlara eşitle/.test(archive));
assert('arşivde vazgeç arşive döner', /href="\/arsiv">Vazgeç/.test(archive));

// 3. Asıl mesele: gizlenen alan **formdan düşmemeli**. Düşerse arşivden
//    kaydetmek var olan kontenjanı ve rozeti sessizce siler — ekranda hiçbir
//    şey olmaz, veri gider.
assert(
  'gizlenen kontenjan gizli alanda korunuyor',
  /<input type="hidden" name="capacity" value="60">/.test(archive),
);
assert(
  'gizlenen rozet gizli alanda korunuyor',
  /<input type="hidden" name="badge" value="SON GUN">/.test(archive),
);
assert('gizlenen son-gün korunuyor', /<input type="hidden" name="soon" value="1">/.test(archive));

// `soon` kapalıysa gizli alan hiç basılmamalı, yoksa kapalı bir bayrak
// kaydettikçe açılırdı.
const notSoon = eventForm({ ...VALUES, soon: false }, {}, { editing: true, archive: true });
assert('son-gün kapalıyken gizli alan yok', !/name="soon"/.test(notSoon));

// 4. Yeni arşiv kaydı kendi rotasına gönderiyor; düzenleme kendi adresine.
const fresh = eventForm({}, {}, {
  editing: false,
  archive: true,
  sources: [{ id: 'ev1', label: 'Git Atölyesi — 12 Kasım' }],
});
// `method="post"` ile birlikte aranıyor: aynı sayfadaki doldurma formu da
// /arsiv/yeni'ye gidiyor ve yalnızca adrese bakan bir kontrol, POST formu
// bozulsa bile onu bulup yeşil veriyordu.
assert(
  'yeni arşiv formu /arsiv/yeni’ye POST ediyor',
  /<form method="post" action="\/arsiv\/yeni"/.test(fresh),
);
// Düzenleme formu kendi adresine gönderiyor: `action` hiç basılmıyor.
// Sayfadaki her POST formunu aramak işe yaramaz — nav'daki çıkış formu da
// `action` taşıyor ve doğru kodda kırmızı verirdi.
assert(
  'düzenleme kendi adresine gönderiyor',
  /<form method="post" enctype="multipart\/form-data">/.test(archive),
);
assert('düzenleme /arsiv/yeni’ye gönderilmiyor', !/<form method="post" action="\/arsiv/.test(archive));
assert('doldurma listesi yeni formda', /name="from"/.test(fresh));
assert('doldurma listesi düzenlemede yok', !/name="from"/.test(archive));

// 5. Arşiv listesi: görseli olmayan kayıt göze çarpmalı — sayfanın işi bu.
const list = archiveList([
  { id: 'a', title: 'Kış Kampı', short: '12 Aralık · B Blok', tag: 'Atölye', photos: 0 },
  { id: 'b', title: 'Teknoloji Gecesi', short: '3 Kasım · Konferans', tag: 'Söyleşi', photos: 3, attendance: 63 },
]);
assert('görselsiz kayıt işaretleniyor', /görsel yok/.test(list));
assert('görsel sayısı yazıyor', /3 görsel/.test(list));
assert('katılım yazıyor', /63 kişi/.test(list));
assert('katılım girilmemişse tire', /<span class="hint">—<\/span>/.test(list));
assert('boş arşiv kendi metnini veriyor', /Arşivde etkinlik yok/.test(archiveList([])));

// 6. Kaçış. Etkinlik başlıkları serbest metin ve panel açık bir sunucuda
//    çalışıyor; kaçırılmayan tek enterpolasyon paneli kendi kendine XSS taşır.
const nasty = '"><img src=x onerror=alert(1)>';
const escaped = eventForm({ ...VALUES, title: nasty }, {}, { editing: true, archive: true });
assert('başlık kaçırılıyor', !/<img src=x/.test(escaped), 'ham <img çıktıya girdi');
const escapedList = archiveList([
  { id: nasty, title: nasty, short: nasty, tag: nasty, photos: 1 },
]);
assert('liste kaçırılıyor', !/<img src=x/.test(escapedList), 'ham <img çıktıya girdi');

// Hata mesajları da kaçırılmalı: bazıları dosya adı gibi dışarıdan gelen
// parçalar taşıyor.
const withError = eventForm(VALUES, { photos: nasty }, { editing: true, archive: true });
assert('hata mesajı kaçırılıyor', !/<img src=x/.test(withError));

// 7. Yükleme hatasının tanınması.
//
// Bu kontrol var çünkü tam olarak burası bir kez kaçırıldı: Firebase yolunda
// `err.code === 404` diye bakılıyordu, gaxios ise `status` yazıyordu. Dal hiç
// çalışmadı ve yöneticiye üç kez üst üste "Bir şeyler ters gitti" gösterildi.
//
// Supabase'in hata nesnesi başka bir şekle sahip ve `statusCode` **metin**
// olarak geliyor. Aynı hatayı ikinci kez yapmamak için üç alan da sınanıyor.
const SUPABASE_NO_BUCKET = {
  statusCode: '404',
  error: 'Bucket not found',
  message: 'Bucket not found',
};
assert('supabase "Bucket not found" tanınıyor', isBucketMissing(SUPABASE_NO_BUCKET));
assert(
  'metin statusCode sayıya çevriliyor',
  isBucketMissing({ statusCode: '404', message: 'başka bir şey' }),
);
assert('yalnızca mesajdan da tanınıyor', isBucketMissing({ message: 'Bucket not found' }));

// Nesne bulunamadı: bucket **var**, dosya yok. Kuruluma dair bir şey söylemek
// yanlış yönlendirme olurdu — ama ikisi de 404 döndüğü için ayırt edilemiyor.
// Yükleme yolunda bu hata hiç oluşmadığı için sorun değil; yine de not düşülüyor.
assert(
  'yükleme hatası olmayanlar sayılmıyor',
  !isBucketMissing({ statusCode: '400', message: 'Duplicate' }) &&
    !isBucketMissing({ message: 'row-level security policy' }) &&
    !isBucketMissing(new Error('fetch failed')),
);

// 8. Anahtar türü. Panel bir kez yanlış anahtarla denendi ve Supabase
//    "row-level security policy" dedi — yani asıl sorunu (publishable anahtar
//    yazamaz) hiç söylemedi. Önek kontrolü ağa çıkmadan cevap veriyor.
assert(
  'publishable önek yakalanıyor',
  keyProblem('sb_publishable_FR-7VBv8Y_A6q3FlFzQfug_6u7IVEdY') === 'publishable',
);
assert('secret önek geçiyor', keyProblem('sb_secret_ornek123') === null);

// Eski sistem: rol JWT payload'ında.
assert('eski anon JWT yakalanıyor', keyProblem('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiAic3VwYWJhc2UiLCAicm9sZSI6ICJhbm9uIn0.imza') === 'anon');
assert('eski service_role JWT geçiyor', keyProblem('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiAic3VwYWJhc2UiLCAicm9sZSI6ICJzZXJ2aWNlX3JvbGUifQ.imza') === null);

// Çözülemeyen bir şey için karar vermiyoruz; isteğin kendisi konuşsun.
assert('anlamsız değer engellenmiyor', keyProblem('bir-sey') === null);

// 9. Servis hesabı anahtarı. Yerelde dosya, sunucuda ortam değişkeni —
//    PaaS'te diske dosya koymak ya mümkün değil ya da her deploy'da kayboluyor.
const SA = { type: 'service_account', project_id: 'x', private_key: '-----BEGIN\nabc\n-----' };
const json = JSON.stringify(SA);

/**
 * Fırlatan bir çağrı `assert`'e hiç ulaşmıyor: script çöküyor, ne ✓ ne ✗
 * yazılıyor. base64 desteğini kaldırıp denediğimde tam olarak bu oldu — kontrol
 * "geçti" de demedi, "kaldı" da; sadece sustu.
 */
function parsed(value: string) {
  try {
    return parseServiceAccount(value);
  } catch {
    return null;
  }
}

assert('düz JSON çözülüyor', parsed(json)?.project_id === 'x');
// base64 gerekiyor çünkü private_key gerçek satır sonları taşıyor ve çok
// satırlı değerler panolarda/panellerde bozuluyor.
const b64 = Buffer.from(json).toString('base64');
assert('base64 JSON çözülüyor', parsed(b64)?.project_id === 'x');
// Satır sonlarının base64 turunda sağ kalması asıl mesele.
assert('private_key satır sonları korunuyor', parsed(b64)?.private_key === SA.private_key);

// Yol gibi görünen bir değer base64 sanılmamalı, yoksa hata mesajı yanlış yeri
// gösterir.
let pathError = '';
try {
  parseServiceAccount('./olmayan-dosya.json');
} catch (err) {
  pathError = err instanceof Error ? err.message : String(err);
}
assert('olmayan dosya yol olarak raporlanıyor', /olmayan-dosya\.json/.test(pathError), pathError);
assert('hata üç biçimi de anlatıyor', /base64/.test(pathError) && /JSON/.test(pathError));

// 10. Oturum çerezi. Panel açık bir sunucuda, öğrenci kayıtlarının önünde
//     duruyor: `Secure` taşımayan bir oturum çerezi, panele bir kez düz HTTP ile
//     ulaşılabildiği anda ağdaki herkese açık demek.
const prod = cookieHeader({ name: 'kyk_admin', value: 'abc', secure: true, maxAge: 43200 });
assert('HTTPS’te Secure var', /; Secure$/.test(prod), prod);
assert('HttpOnly her zaman var', /HttpOnly/.test(prod));
assert('SameSite=Strict her zaman var', /SameSite=Strict/.test(prod));

// Yerelde panel düz HTTP: `Secure` çerezi tarayıcı hiç saklamaz, yani sabit
// koymak yerel girişi tamamen kırardı.
const local = cookieHeader({ name: 'kyk_admin', value: 'abc', secure: false, maxAge: 43200 });
assert('HTTP’te Secure yok', !/Secure/.test(local), local);
assert('HTTP’te de HttpOnly var', /HttpOnly/.test(local));

// Çıkış çerezi de aynı bayrakları taşımalı: tarayıcı bayrakları uymayan bir
// çerezi silmek yerine ikincisini yazabiliyor.
const out = cookieHeader({ name: 'kyk_admin', value: '', secure: true, maxAge: 0 });
assert('çıkış çerezi süresi sıfır', /Max-Age=0/.test(out));
assert('çıkış çerezi de Secure', /Secure/.test(out));

// 11. Dinlenen port. Yanlış çözülürse hata çıkmıyor: `listen(0)` rastgele bir
//     port açıyor, konteyner sağlıklı görünüyor ve ters proxy hiç ulaşamıyor.
assert('ADMIN_PORT okunuyor', resolvePort({ ADMIN_PORT: '4100' }) === 4100);
assert('PORT geri düşüşü çalışıyor', resolvePort({ PORT: '3000' }) === 3000);
assert('ADMIN_PORT PORT’u yeniyor', resolvePort({ ADMIN_PORT: '4100', PORT: '3000' }) === 4100);
assert('hiçbiri yoksa 4000', resolvePort({}) === 4000);

// Asıl mesele: `??` boş metni yakalamıyor ve `.env.example` ADMIN_PORT'u boş
// gönderiyor — yani varsayılan yoldan kurulan her panel bu satıra çarpıyor.
assert('boş ADMIN_PORT PORT’a düşüyor', resolvePort({ ADMIN_PORT: '', PORT: '3000' }) === 3000);
assert('ikisi de boşken 4000', resolvePort({ ADMIN_PORT: '', PORT: '' }) === 4000);
assert('yalnızca boşluk da boş sayılıyor', resolvePort({ ADMIN_PORT: '   ' }) === 4000);
assert('boşluklu sayı okunuyor', resolvePort({ ADMIN_PORT: ' 4000 ' }) === 4000);

// `Number('abc')` NaN, `Number('0')` sıfır: ikisi de `listen`'e gidince aynı
// sessiz sonucu veriyor, o yüzden ikisi de geçersiz sayılıyor.
assert('sayı olmayan değer 4000’e düşüyor', resolvePort({ ADMIN_PORT: 'abc' }) === 4000);
assert('sıfır kabul edilmiyor', resolvePort({ ADMIN_PORT: '0' }) === 4000);
assert('aralık dışı kabul edilmiyor', resolvePort({ ADMIN_PORT: '70000' }) === 4000);
assert('ondalık kabul edilmiyor', resolvePort({ ADMIN_PORT: '40.5' }) === 4000);

// 12. CSV formül etkisizleştirme. Adı öğrenci yazıyor ve kural yalnızca
//     uzunluğa bakıyor; `=`/`+`/`-`/`@` ile başlayan bir ad Excel'de formül
//     olarak çalışır — dosyayı açan yöneticinin makinesinde. Tırnaklamak
//     yetmiyor: tırnak içindeki `=` de formül sayılıyor.
assert(
  'formül başlangıcı etkisizleştiriliyor',
  csvCell('=HYPERLINK("http://x")') === `"'=HYPERLINK(""http://x"")"`,
  csvCell('=HYPERLINK("http://x")'),
);
assert('artı ile başlayan da', csvCell('+90 555').startsWith("'+"));
assert('eksi ile başlayan da', csvCell('-2+3+cmd').startsWith("'-"));
assert('@ ile başlayan da', csvCell('@SUM(A1)').startsWith("'@"));
assert('düz metne dokunulmuyor', csvCell('Elif Yılmaz') === 'Elif Yılmaz');
assert('virgül tırnaklanıyor', csvCell('a,b') === '"a,b"');
assert('boş değer boş hücre', csvCell(undefined) === '' && csvCell(null) === '');

// 13. Oturum jetonu: imzalı ve süreli. Eski jeton süreç ömrü boyunca sabitti,
//     yani bir kez sızan çerez yeniden başlatmaya kadar geçerliydi.
const secret = Buffer.from('x'.repeat(32));
const t0 = 1_700_000_000_000;
const token = issueToken(secret, t0);
assert('taze jeton geçiyor', verifyToken(secret, token, t0 + 1000));
assert('süresi dolan jeton düşüyor', !verifyToken(secret, token, t0 + SESSION_SECONDS * 1000 + 1));
assert(
  'imzası bozuk jeton düşüyor',
  !verifyToken(secret, token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'), t0 + 1000),
);
assert('başka gizle üretilen jeton düşüyor', !verifyToken(Buffer.from('y'.repeat(32)), token, t0 + 1000));
assert('eski sabit jeton düşüyor', !verifyToken(secret, 'ok', t0));
assert('boş jeton düşüyor', !verifyToken(secret, null, t0) && !verifyToken(secret, '', t0));
assert('gelecek tarihli jeton düşüyor', !verifyToken(secret, issueToken(secret, t0 + 5000), t0));

// 14. Giriş denemesi sınırı. Zaman-sabiti karşılaştırma deneme sayısını
//     sınırlamaz; panel internete açık ve arkasında öğrenci numaraları var.
let clock = t0;
const limiter = loginLimiter(() => clock);
for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i += 1) limiter.fail('1.2.3.4');
assert('sınırın altında kilit yok', limiter.lockedFor('1.2.3.4') === 0);
limiter.fail('1.2.3.4');
assert('sınırda kilitleniyor', limiter.lockedFor('1.2.3.4') > 0);
assert('başka IP etkilenmiyor', limiter.lockedFor('5.6.7.8') === 0);
clock += LOGIN_LOCK_MS + 1;
assert('süre dolunca açılıyor', limiter.lockedFor('1.2.3.4') === 0);
// Başarılı giriş sayacı sıfırlamalı: 9 hata + giriş + 1 hata kilit değil.
for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i += 1) limiter.fail('1.2.3.4');
limiter.succeed('1.2.3.4');
limiter.fail('1.2.3.4');
assert('başarılı giriş sayacı sıfırlıyor', limiter.lockedFor('1.2.3.4') === 0);



// ---------------------------------------------------------------------------
// Bildirim kilidi — gönderim başarısızsa geri veriliyor mu
// ---------------------------------------------------------------------------
//
// Kilit gönderimden **önce** alınıyor, çünkü yinelenen bildirim eksik
// bildirimden çok daha fazla zarar veriyor. Bedeli şu: gönderim patlarsa kilit
// kalır ve o olay bir daha asla duyurulamaz — hata yutulduğu için de kimse fark
// etmez. Aşağısı o dalın gerçekten geri aldığını gösteriyor.

/** Yalnızca `announce`/`deliver`'ın dokunduğu yüzeyi taklit eden Firestore. */
function fakeDb(devices: { id: string; data: Record<string, unknown> }[]) {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  store.set('devices', new Map(devices.map((d) => [d.id, d.data])));

  const col = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };

  const api = {
    collection(name: string) {
      const c = col(name);
      return {
        doc(id: string) {
          return {
            async create(data: Record<string, unknown>) {
              if (c.has(id)) throw new Error('ALREADY_EXISTS');
              c.set(id, data);
            },
            async get() {
              return { exists: c.has(id), data: () => c.get(id) };
            },
            async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
              c.set(id, opts?.merge ? { ...(c.get(id) ?? {}), ...data } : data);
            },
            async delete() {
              c.delete(id);
            },
          };
        },
        async add(data: Record<string, unknown>) {
          c.set(`auto${c.size}`, data);
        },
        async get() {
          const docs = [...c.entries()].map(([id, data]) => ({ id, data: () => data }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      };
    },
    batch() {
      const ops: (() => void)[] = [];
      return {
        delete(ref: { _name: string; _id: string }) {
          ops.push(() => col(ref._name).delete(ref._id));
        },
        async commit() {
          ops.forEach((op) => op());
        },
      };
    },
    _peek: (name: string, id: string) => col(name).get(id),
  };
  return api as unknown as Parameters<typeof announce>[0] & { _peek: typeof api._peek };
}

const okDevice = {
  id: 'dev1',
  data: { token: 'ExponentPushToken[x]', master: true, categories: {}, quietHours: false },
};

const decision = {
  send: true as const,
  logId: 'event_created__test',
  payload: { category: 'Atölye', title: 'Yeni atölye', body: 'Test', data: {} },
};

/** Expo'nun cevabını taklit eden fetch. */
const fakeFetch = (status: string) =>
  (async () =>
    ({
      ok: true,
      status: 200,
      async json() {
        return { data: [{ status }] };
      },
      async text() {
        return '';
      },
    }) as unknown as Response) as unknown as typeof fetch;

const NOW = new Date('2026-09-10T12:00:00+03:00');

void (async () => {
  // 1. Kayıtlı cihaz yok → kimseye ulaşmadı → kilit geri veriliyor.
  const empty = fakeDb([]);
  await announce(empty, decision, { now: NOW, fetchImpl: fakeFetch('ok') });
  assert(
    'kimseye ulaşmayan gönderim kilidi geri veriyor',
    empty._peek('pushLog', decision.logId) === undefined,
    'kilit kaldı — o etkinlik bir daha asla duyurulamaz',
  );

  // 2. Gönderim fırlıyor → kilit geri veriliyor.
  const throwing = fakeDb([okDevice]);
  const boom = (async () => {
    throw new Error('ağ yok');
  }) as unknown as typeof fetch;
  await announce(throwing, decision, { now: NOW, fetchImpl: boom });
  assert(
    'gönderim fırlarsa kilit geri veriliyor',
    throwing._peek('pushLog', decision.logId) === undefined,
    'kilit kaldı',
  );

  // 3. Başarılı gönderim: kilit duruyor ve sonuç deftere yazılıyor.
  const good = fakeDb([okDevice]);
  await announce(good, decision, { now: NOW, fetchImpl: fakeFetch('ok') });
  const row = good._peek('pushLog', decision.logId) as { sent?: number } | undefined;
  assert('başarılı gönderimde kilit duruyor', row !== undefined);
  assert('sonuç deftere yazılıyor', row?.sent === 1, JSON.stringify(row));

  // 4. İkinci çağrı hiçbir şey göndermiyor.
  let calls = 0;
  const counting = (async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: [{ status: 'ok' }] };
      },
      async text() {
        return '';
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  await announce(good, decision, { now: NOW, fetchImpl: counting });
  assert('aynı olay ikinci kez gönderilmiyor', calls === 0, `${calls} istek çıktı`);

  // -------------------------------------------------------------------------
  // Hesap silme — listedeki her koleksiyon gerçekten siliniyor mu
  // -------------------------------------------------------------------------
  //
  // Bu iddianın sebebi: silinmeyen bir koleksiyon hiçbir belirti vermiyor.
  // Kullanıcı "hesabım silindi" onayını görüyor, verisi duruyor, ve kimse
  // fark etmiyor. Liste ile döngünün ayrışmasını kod zaten imkânsız kılıyor
  // (`processDeletion` listeleri dolaşıyor); burada ölçülen, listenin
  // KENDİSİNİN eksik olmaması.

  /** `where(...).get()` ve `doc().delete()` destekleyen küçük bir Firestore. */
  function silmeDb() {
    const store = new Map<string, Map<string, Record<string, unknown>>>();
    const col = (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      return store.get(name)!;
    };
    const api = {
      collection(name: string) {
        const c = col(name);
        return {
          doc(id: string) {
            return {
              async get() {
                const data = c.get(id);
                return { exists: data !== undefined, data: () => data };
              },
              async delete() {
                c.delete(id);
              },
              async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
                c.set(id, opts?.merge ? { ...(c.get(id) ?? {}), ...data } : data);
              },
            };
          },
          where(field: string, _op: string, value: unknown) {
            return {
              async get() {
                const docs = [...c.entries()]
                  .filter(([, d]) => d[field] === value)
                  .map(([id]) => ({ id, ref: { delete: async () => void c.delete(id) } }));
                return { docs };
              },
            };
          },
        };
      },
      _count: (name: string) => col(name).size,
      _seed: (name: string, id: string, data: Record<string, unknown>) => col(name).set(id, data),
    };
    return api;
  }

  const UID = 'kullanici-1';
  const TELEFON = '+905551234567';
  const OGRENCI_NO = '210201045';
  const silme = silmeDb();
  // Her listelenen koleksiyona bu kullanıcıya ait birer kayıt.
  for (const name of USER_DOC_COLLECTIONS) silme._seed(name, UID, { uid: UID });
  // Profil, teklik kayıtlarının hangi değerlere yazıldığını taşıyan tek yer.
  silme._seed('users', UID, { uid: UID, telefon: TELEFON, ogrenciNo: OGRENCI_NO });
  silme._seed('phoneClaims', TELEFON, { uid: UID });
  silme._seed('studentClaims', OGRENCI_NO, { uid: UID });
  for (const name of USER_QUERY_COLLECTIONS) silme._seed(name, `${name}-1`, { uid: UID });
  // Ve başkasına ait birer kayıt: silme yalnızca kendi verisine dokunmalı.
  for (const name of USER_QUERY_COLLECTIONS) silme._seed(name, `${name}-2`, { uid: 'baskasi' });

  await processDeletion(silme as never, UID);

  for (const name of [...USER_DOC_COLLECTIONS, ...USER_QUERY_COLLECTIONS]) {
    const kalan = silme._count(name);
    const beklenen = (USER_QUERY_COLLECTIONS as readonly string[]).includes(name) ? 1 : 0;
    assert(
      `silme ${name} koleksiyonuna dokunuyor`,
      kalan === beklenen,
      `${name}: ${kalan} kayıt kaldı, ${beklenen} bekleniyordu`,
    );
  }

  // ASIL MESELE: teklik kayıtlarının doküman kimliği `uid` değil, telefonun ve
  // öğrenci numarasının kendisi — yani iki listeye de giremiyorlar ve ayrıca
  // serbest bırakılmaları gerekiyor. Atlanırsa belirti sessiz: hesap silinmiş
  // görünür, ama aynı kişi bir daha kayıt olamaz çünkü numarası hâlâ kilitli.
  assert(
    'silme teklik kayıtlarını serbest bırakıyor',
    silme._count('phoneClaims') === 0 && silme._count('studentClaims') === 0,
    `phoneClaims: ${silme._count('phoneClaims')}, studentClaims: ${silme._count('studentClaims')}`,
  );

  // Profil ad, telefon ve doğum tarihi taşıyor: listeden düşerse KVKK ihlali.
  assert(
    'profil koleksiyonu listede',
    (USER_DOC_COLLECTIONS as readonly string[]).includes('users'),
  );
  assert(
    'kayıt ve çekiliş katılımı listede',
    ['registrations', 'raffleEntries'].every((n) =>
      (USER_QUERY_COLLECTIONS as readonly string[]).includes(n),
    ),
  );

  // Talep "bitti" işaretleniyor — istemci onayı buradan okuyor.
  assert('talep bitti olarak işaretleniyor', silme._count('deletionRequests') === 1);

  // ----------------------------------------------- doğrulama kodu (OTP)

  const T0 = 1_700_000_000_000;
  const kayitYap = (over: Partial<OtpRecord> = {}): OtpRecord => ({
    hash: hashCode('u1', '123456'),
    createdAt: T0,
    sendCount: 1,
    windowStart: T0,
    attempts: 0,
    ...over,
  });

  assert('kod altı hane ve baştaki sıfırı koruyor',
    Array.from({ length: 200 }, makeCode).every((k) => /^[0-9]{6}$/.test(k)));

  // Aynı kod iki kullanıcıda aynı hash'i vermemeli: kayıt sızsa bile bir
  // kullanıcının hash'i diğerinde kullanılamasın.
  assert('hash kullanıcıya bağlı', hashCode('u1', '123456') !== hashCode('u2', '123456'));

  {
    const ilk = decideSend(null, T0);
    assert('ilk kod her zaman gönderiliyor', ilk.ok);

    const hemen = decideSend(kayitYap(), T0 + 1_000);
    assert('üst üste basmak bekletiliyor',
      !hemen.ok && hemen.reason === 'bekle' && hemen.saniye > 0);

    const sonra = decideSend(kayitYap(), T0 + OTP_RESEND_MS);
    assert('bekleme dolunca yeni kod veriliyor', sonra.ok);

    // İKİ SINIR DA GEREKİYOR: 60 saniyelik bekleme tek başına saatte 60 posta
    // demek. Tavan olmadan biri başkasının kutusunu doldurabilirdi.
    const tavan = decideSend(
      kayitYap({ sendCount: OTP_MAX_SENDS, createdAt: T0 }),
      T0 + OTP_RESEND_MS,
    );
    assert('saatlik tavan posta kutusunu koruyor',
      !tavan.ok && tavan.reason === 'cok_fazla');

    const pencereSonrasi = decideSend(
      kayitYap({ sendCount: OTP_MAX_SENDS, windowStart: T0 }),
      T0 + OTP_SEND_WINDOW_MS + 1,
    );
    assert('pencere dolunca sayaç sıfırlanıyor',
      pencereSonrasi.ok && pencereSonrasi.record.sendCount === 1);
  }

  {
    assert('kod yoksa söyleniyor',
      !decideVerify(null, 'u1', '123456', T0).ok);

    const dogru = decideVerify(kayitYap(), 'u1', '123456', T0 + 1000);
    assert('doğru kod geçiyor', dogru.ok);

    const yanlis = decideVerify(kayitYap(), 'u1', '000000', T0 + 1000);
    assert('yanlış kod kalan denemeyi söylüyor',
      !yanlis.ok && yanlis.reason === 'yanlis' && yanlis.kalan === OTP_MAX_ATTEMPTS - 1);

    const baskasi = decideVerify(kayitYap(), 'u2', '123456', T0 + 1000);
    assert('başka kullanıcının kodu geçmiyor', !baskasi.ok);

    // ASIL MESELE: süre ve kilit, yanlış koddan ÖNCE bakılmak zorunda. Tersi
    // olsaydı süresi dolmuş kodu giren kullanıcı "kod yanlış" görür ve doğru
    // kodu aramaya başlardı — oysa yapması gereken yeni kod istemek.
    const dolmus = decideVerify(kayitYap(), 'u1', '123456', T0 + OTP_TTL_MS + 1);
    assert('süresi dolmuş kod doğru olsa da geçmiyor',
      !dolmus.ok && dolmus.reason === 'suresi_doldu');
    const dolmusYanlis = decideVerify(kayitYap(), 'u1', '000000', T0 + OTP_TTL_MS + 1);
    assert('süresi dolmuşta cevap "yanlış" değil "süresi doldu"',
      !dolmusYanlis.ok && dolmusYanlis.reason === 'suresi_doldu');

    const kilitli = decideVerify(kayitYap({ attempts: OTP_MAX_ATTEMPTS }), 'u1', '123456', T0);
    assert('deneme hakkı bitince doğru kod da geçmiyor',
      !kilitli.ok && kilitli.reason === 'kilitli');
  }

  {
    // ASIL MESELE: hesap başına sınır, hesap açmayı bedava bir kaçış yolu
    // bırakıyor. IP sayacı onu kapatıyor — parametreli `loginLimiter` aynı
    // kod, farklı tavan.
    let simdi = T0;
    const limit = loginLimiter(() => simdi, 3, 60_000);
    assert('temiz IP kilitli değil', limit.lockedFor('1.2.3.4') === 0);

    limit.fail('1.2.3.4');
    limit.fail('1.2.3.4');
    assert('tavanın altında geçiyor', limit.lockedFor('1.2.3.4') === 0);

    limit.fail('1.2.3.4');
    assert('tavana gelince kilitleniyor', limit.lockedFor('1.2.3.4') > 0);
    assert('başka IP etkilenmiyor', limit.lockedFor('5.6.7.8') === 0);

    simdi += 60_001;
    assert('pencere dolunca açılıyor', limit.lockedFor('1.2.3.4') === 0);
  }

  // ----------------------------------------------- posta yapılandırması

  {
    const eksik = readMailConfig({});
    assert('eksik SMTP ayarı adıyla söyleniyor',
      'eksik' in eksik && eksik.eksik.join(',') === 'SMTP_HOST,SMTP_USER,SMTP_PASS');

    // `??` boş dizeyi yakalamıyor — bu depoda `ADMIN_PORT` ile bir kez yaşandı
    // ve `listen(0)` üretmişti. Boş SMTP_HOST "yapılandırılmış ama bağlanamıyor"
    // gibi görünürdü.
    const bos = readMailConfig({ SMTP_HOST: '  ', SMTP_USER: 'a@b.c', SMTP_PASS: 'x' });
    assert('boş SMTP_HOST eksik sayılıyor', 'eksik' in bos && bos.eksik.includes('SMTP_HOST'));

    const tam = readMailConfig({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'noreply@kouseng.com', SMTP_PASS: 'x' });
    assert('port varsayılanı 587', 'config' in tam && tam.config.port === 587);
    // Görünen adı olmayan gönderen gelen kutusunda çıplak bir adres olarak
    // duruyor; hem güven vermiyor hem spam puanı alıyor.
    assert('gönderen görünen ad taşıyor',
      'config' in tam && tam.config.from.includes('<noreply@kouseng.com>'));

    const kotuPort = readMailConfig({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: 'abc' });
    assert('anlamsız port varsayılana düşüyor', 'config' in kotuPort && kotuPort.config.port === 587);

    // ASIL MESELE: giriş `info@` ile yapılıyor ama posta `noreply@`'dan
    // görünmeli. MAIL_FROM, SMTP_USER'ı EZMEK zorunda — ezmezse kimse fark
    // etmeden bütün postalar info@'dan gider.
    const takma = readMailConfig({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'info@kouseng.com',
      SMTP_PASS: 'x',
      MAIL_FROM: 'KOÜ Yazılım Kulübü <noreply@kouseng.com>',
    });
    assert(
      'MAIL_FROM giriş hesabını eziyor',
      'config' in takma && takma.config.from.includes('noreply@kouseng.com')
        && !takma.config.from.includes('info@kouseng.com'),
      'config' in takma ? takma.config.from : 'yapılandırma okunamadı',
    );
    // Boş MAIL_FROM'un SMTP_USER'a düşmesi belgelenmiş davranış; sessiz
    // olmaması için panel açılışta ve /bildirimler sayfasında adresi yazıyor.
    const bosFrom = readMailConfig({
      SMTP_HOST: 'h', SMTP_USER: 'info@kouseng.com', SMTP_PASS: 'x', MAIL_FROM: '   ',
    });
    assert('boş MAIL_FROM giriş hesabına düşüyor',
      'config' in bosFrom && bosFrom.config.from.includes('info@kouseng.com'));
  }

  {
    const mail = otpMail('048213', 10);
    // Yalnızca HTML gönderen posta spam puanı alıyor, ve metin okuyucularda
    // gövde tamamen boş görünüyor.
    assert('postanın düz metin karşılığı var', mail.text.includes('048213'));
    assert('kod gövdede geçiyor', mail.html.includes('048213'));
    assert('konu kodu taşıyor', mail.subject.includes('048213'));
    // Görsel engellenince boş çerçeve kalırdı; bağlantı hem itibar hem de
    // "bu tür postalardaki bağlantıya basma" tavsiyesiyle çelişirdi.
    assert('postada görsel yok', !/<img/i.test(mail.html));
    assert('postada http bağlantısı yok', !/href="https?:/i.test(mail.html));
  }

  // ----------------------------------------------- teklik (claims)

  {
    /** `runTransaction` + `tx.get/set/delete` destekleyen küçük bir Firestore. */
    function claimDb() {
      const store = new Map<string, Map<string, Record<string, unknown>>>();
      const col = (n: string) => {
        if (!store.has(n)) store.set(n, new Map());
        return store.get(n)!;
      };
      const ref = (n: string, id: string) => ({ _n: n, _id: id });
      const api = {
        collection: (n: string) => ({ doc: (id: string) => ref(n, id) }),
        async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
          const tx = {
            async get(r: { _n: string; _id: string }) {
              const d = col(r._n).get(r._id);
              return { exists: d !== undefined, get: (k: string) => d?.[k] };
            },
            set(r: { _n: string; _id: string }, data: Record<string, unknown>) {
              col(r._n).set(r._id, data);
            },
            delete(r: { _n: string; _id: string }) {
              col(r._n).delete(r._id);
            },
          };
          return fn(tx);
        },
        _get: (n: string, id: string) => col(n).get(id),
        _count: (n: string) => col(n).size,
      };
      return api;
    }

    const TEL = '+905551234567';
    const NO = '210201045';
    const db2 = claimDb();

    const ilk = await claimIdentity(db2 as never, 'u1', { telefon: TEL, ogrenciNo: NO });
    assert('ilk sahiplenme geçiyor', ilk.ok);

    const ikinci = await claimIdentity(db2 as never, 'u2', { telefon: TEL, ogrenciNo: '999999999' });
    assert('aynı telefon ikinci hesaba geçmiyor',
      !ikinci.ok && ikinci.alan === 'telefon');
    // ÇAKIŞMA HİÇBİR ŞEY YAZMAMALI: telefon tutup numara çakışsaydı geride
    // kimsenin sahiplenmediği bir kayıt kalırdı. İşlemin varlık sebebi bu.
    assert('çakışan istek yarım kayıt bırakmıyor', db2._count('studentClaims') === 1);

    const ucuncu = await claimIdentity(db2 as never, 'u3', { telefon: '+905550000000', ogrenciNo: NO });
    assert('aynı öğrenci numarası ikinci hesaba geçmiyor',
      !ucuncu.ok && ucuncu.alan === 'ogrenciNo');
    assert('reddedilen telefon boşta kalıyor', db2._count('phoneClaims') === 1);

    // Kendi kaydını tazelemek çakışma değil — çakışma yüzünden numarasını
    // düzelten kullanıcı, eski değerini sonsuza kadar kilitli bırakmamalı.
    const duzeltme = await claimIdentity(
      db2 as never,
      'u1',
      { telefon: '+905559998877', ogrenciNo: NO },
      { telefon: TEL, ogrenciNo: NO },
    );
    assert('kendi kaydını güncelleyebiliyor', duzeltme.ok);
    assert('eski telefon serbest bırakılıyor', db2._get('phoneClaims', TEL) === undefined);
    assert('yeni telefon sahiplenildi', db2._get('phoneClaims', '+905559998877') !== undefined);
  }
})().then(() => {
  // Çıkış burada: yukarıdaki blok asenkron, dosyanın sonunda çağrılsaydı
  // iddialar sayılmadan önce koşardı.
  console.log(failed ? `\n${failed} kontrol başarısız.` : '\nTüm kontroller geçti.');
  process.exit(failed ? 1 : 0);
});
