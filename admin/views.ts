/**
 * HTML üretimi. Şablon motoru yok — sayfa sayısı bir avuç ve tek bağımlılık
 * eklemek, her çıktının nereden geldiğini görmekten daha değerli değil.
 *
 * Buradaki tek kritik kural: **kullanıcıdan gelen hiçbir metin `esc` olmadan
 * HTML'e girmez.** Etkinlik başlıkları ve öğrenci adları serbest metin; kaçış
 * atlanırsa panel kendi kendine XSS taşır.
 */
import { EVENT_CATEGORIES, MAX_PHOTOS } from '../src/eventSchema';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Her enterpolasyon buradan geçer. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const STYLE = `
:root {
  --navy: #001B4A; --navy700: #014576; --blue: #0389BC; --blue200: #93CBDC;
  --blue100: #D2E7EC; --bg: #F4F7F9; --surface: #fff; --text: #12263F;
  --muted: #5A6B82; --danger: #B3261E; --border: #DCE5EC;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
header {
  background: linear-gradient(120deg, var(--navy), var(--navy700));
  color: #fff; padding: 18px 24px; display: flex; align-items: center; gap: 18px;
}
header h1 { font-size: 17px; margin: 0; font-weight: 800; }
header nav { display: flex; gap: 16px; margin-left: auto; align-items: center; }
header a { color: var(--blue200); text-decoration: none; font-weight: 600; font-size: 14px; }
header a:hover { color: #fff; }
main { max-width: 920px; margin: 28px auto; padding: 0 20px; }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px; margin-bottom: 16px;
}
h2 { font-size: 19px; margin: 0 0 16px; }
label { display: block; margin-bottom: 14px; font-weight: 600; font-size: 13.5px; }
/* Tip tip saymak yerine onay kutusunu dışarıda bırakmak: date, time ve number
   alanları listede yoktu ve tarayıcı varsayılan boyutunda, diğerlerinden ayrı
   duruyorlardı. */
input:not([type=checkbox]), textarea, select {
  width: 100%; margin-top: 6px; padding: 10px 12px; font: inherit;
  border: 1.5px solid var(--border); border-radius: 8px; background: #fff;
}
textarea { min-height: 96px; resize: vertical; }
input:focus, textarea:focus, select:focus { outline: none; border-color: var(--blue); }
.hint { font-weight: 400; color: var(--muted); font-size: 12.5px; }
.prefill { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 6px; }
.photos { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
.photo { position: relative; width: 118px; }
.photo img {
  width: 100%; height: 84px; object-fit: cover;
  border-radius: 8px; border: 1.5px solid var(--border); display: block;
}
.photo-drop {
  display: flex; align-items: center; gap: 5px; margin: 6px 0 0;
  font-size: 12px; font-weight: 600; color: var(--danger);
}
.photo-tag {
  position: absolute; top: 6px; left: 6px; background: rgba(0,27,74,0.78);
  color: #fff; font-size: 10px; font-weight: 700; padding: 3px 6px; border-radius: 4px;
}
/* pre-line: kurulum hataları çok satırlı ve tek satıra sıkışınca okunmuyor. */
.err {
  color: var(--danger); font-size: 12.5px; font-weight: 600;
  margin-top: 5px; white-space: pre-line;
}
.banner {
  background: #FDECEA; border: 1px solid #F5C6C2; color: var(--danger);
  padding: 12px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
}
.ok { background: #E8F5EC; border-color: #BFE3CB; color: #1E6B36; }
button, .btn {
  font: inherit; font-weight: 700; cursor: pointer; border-radius: 8px;
  padding: 10px 16px; border: none; background: var(--blue); color: #fff;
  text-decoration: none; display: inline-block;
}
button:hover, .btn:hover { filter: brightness(1.07); }
.btn-ghost { background: transparent; color: var(--blue); border: 1.5px solid var(--blue); }
.btn-danger { background: transparent; color: var(--danger); border: 1.5px solid var(--danger); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); }
th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
tr:last-child td { border-bottom: none; }
.row { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end; }
.row > * { flex: 1; min-width: 190px; }
.actions { display: flex; gap: 10px; margin-top: 8px; }
.empty { color: var(--muted); padding: 20px 0; }
`;

export function page(title: string, body: string, opts: { nav?: boolean } = {}): string {
  const nav = opts.nav === false
    ? ''
    : `<nav>
         <a href="/">Etkinlikler</a>
         <a href="/arsiv">Arşiv</a>
         <a href="/raffles">Çekilişler</a>
         <a href="/registrations">Kayıtlar</a>
         <a href="/bildirimler">Bildirimler</a>
         <form method="post" action="/logout" style="margin:0">
           <button class="btn-ghost" style="padding:6px 12px;font-size:13px">Çıkış</button>
         </form>
       </nav>`;

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · KOÜ Yazılım Kulübü</title>
<style>${STYLE}</style>
</head>
<body>
<header><h1>KOÜ Yazılım Kulübü — Yönetim</h1>${nav}</header>
<main>${body}</main>
</body>
</html>`;
}

export function loginPage(error?: string): string {
  return page(
    'Giriş',
    `<div class="card" style="max-width:400px;margin:60px auto">
       <h2>Giriş</h2>
       ${error ? `<div class="banner">${esc(error)}</div>` : ''}
       <form method="post" action="/login">
         <label>Parola
           <input type="password" name="password" autofocus required autocomplete="current-password">
         </label>
         <button type="submit">Gir</button>
       </form>
     </div>`,
    { nav: false },
  );
}

export type FieldError = Record<string, string>;

/** Etkinlik formu. `values` düzenlemede dolu, yeni kayıtta boş gelir. */
const FIELD_TYPES: [string, string][] = [
  ['text', 'Metin'],
  ['studentNo', 'Öğrenci No (9 hane)'],
  ['email', 'E-posta'],
  ['phone', 'Telefon'],
  ['select', 'Seçim listesi'],
];

/**
 * Çekiliş tanımı formu.
 *
 * Alan satırları istemci JS'i olmadan yönetiliyor: var olanlar + üç boş satır
 * basılıyor, kaydedince yeniden üç boş satır geliyor. Anahtarı boş bırakılan
 * satır yok sayılıyor, dolayısıyla silmek de anahtarı temizlemek demek.
 */
export function raffleForm(
  values: {
    eventId: string;
    eventTitle: string;
    winnerCount?: unknown;
    entriesCloseDate?: unknown;
    entriesCloseTime?: unknown;
    fields?: { key: string; label: string; type: string; required: boolean; options?: string[] }[];
  },
  errors: FieldError,
  entryCount: number,
): string {
  const rows = [...(values.fields ?? []), ...Array.from({ length: 3 }, () => null)];

  const fieldRows = rows
    .map((field, i) => {
      const v = (k: 'key' | 'label') => esc(field ? (field as never)[k] : '');
      const type = field?.type ?? 'text';
      const options = esc(field?.options?.join(', ') ?? '');
      const err = field?.key && errors[field.key] ? `<div class="err">${esc(errors[field.key])}</div>` : '';

      return `<tr>
        <td><input type="text" name="key_${i}" value="${v('key')}" placeholder="phone"></td>
        <td><input type="text" name="label_${i}" value="${v('label')}" placeholder="Telefon"></td>
        <td>
          <select name="type_${i}">
            ${FIELD_TYPES.map(
              ([value, label]) =>
                `<option value="${value}"${value === type ? ' selected' : ''}>${label}</option>`,
            ).join('')}
          </select>
        </td>
        <td style="text-align:center">
          <input type="checkbox" name="required_${i}" value="1"${field?.required ? ' checked' : ''} style="width:auto">
        </td>
        <td><input type="text" name="options_${i}" value="${options}" placeholder="virgülle"></td>
        <td>${err}</td>
      </tr>`;
    })
    .join('');

  return page(
    'Çekiliş',
    `<div class="card">
      <h2>Çekiliş — ${esc(values.eventTitle)}</h2>
      ${errors.fields ? `<div class="banner">${esc(errors.fields)}</div>` : ''}
      ${
        Object.keys(errors).length && !errors.fields
          ? '<div class="banner">Kaydedilmedi — alan tanımlarını düzeltin.</div>'
          : ''
      }

      <form method="post">
        <div class="row">
          <label>Kaç kişi kazanacak
            <input type="number" name="winnerCount" min="1" max="999" value="${esc(values.winnerCount ?? 1)}" required>
            ${errors.winnerCount ? `<div class="err">${esc(errors.winnerCount)}</div>` : ''}
          </label>
          <label>Son katılım tarihi
            <input type="date" name="entriesCloseDate" value="${esc(values.entriesCloseDate ?? '')}" required>
          </label>
          <label>Son katılım saati
            <input type="time" name="entriesCloseTime" value="${esc(values.entriesCloseTime ?? '23:59')}" required>
          </label>
        </div>
        ${errors.entriesCloseAt ? `<div class="err" style="margin-bottom:12px">${esc(errors.entriesCloseAt)}</div>` : ''}

        <h2 style="font-size:15px;margin-top:22px">Sorulacak alanlar</h2>
        <p class="hint" style="margin:0 0 12px">
          Anahtar CSV sütun adı olur — küçük harf, rakam, alt çizgi. Anahtarı boş
          bırakılan satır yok sayılır; silmek için anahtarı temizleyin.
        </p>

        <table>
          <thead><tr><th>Anahtar</th><th>Etiket</th><th>Tip</th><th>Zorunlu</th><th>Seçenekler</th><th></th></tr></thead>
          <tbody>${fieldRows}</tbody>
        </table>

        <div class="actions">
          <button type="submit">Kaydet</button>
          <a class="btn btn-ghost" href="/raffles">Vazgeç</a>
        </div>
      </form>
    </div>

    <div class="card">
      <h2 style="font-size:15px">Katılımlar</h2>
      <p class="hint">${entryCount} katılım kayıtlı.</p>
      <div class="actions">
        <a class="btn btn-ghost" href="/raffles/${esc(values.eventId)}/entries">Katılımları gör</a>
        <a class="btn btn-ghost" href="/raffles/${esc(values.eventId)}/entries.csv">CSV indir</a>
        <a class="btn btn-ghost" href="/raffles/${esc(values.eventId)}/winners">Kazananları gir</a>
      </div>
    </div>`,
  );
}

/** Kazanan girme formu — çekiliş dışarıda yapıldıktan sonra. */
export function winnersForm(
  eventId: string,
  eventTitle: string,
  winners: string[],
  drawnAt: string,
): string {
  return page(
    'Kazananlar',
    `<div class="card">
      <h2>Kazananlar — ${esc(eventTitle)}</h2>
      <p class="hint" style="margin-top:0">
        Her satıra bir ad soyad yazın. Uygulamada <strong>kısaltılmış</strong> olarak
        görünecekler ("Elif Yılmaz" → "Elif Y."), böylece kazanan kendini tanır ama
        tam ad herkese açılmaz. Kaydettiğiniz anda uygulamada yayınlanır.
      </p>
      ${drawnAt ? `<div class="banner ok">Sonuçlar ${esc(drawnAt.slice(0, 10))} tarihinde yayınlandı.</div>` : ''}

      <form method="post">
        <label>Kazananlar
          <textarea name="winners" rows="8" placeholder="Elif Yılmaz&#10;Ahmet Demir">${esc(winners.join('\n'))}</textarea>
        </label>
        <div class="actions">
          <button type="submit">Yayınla</button>
          <a class="btn btn-ghost" href="/raffles/${esc(eventId)}">Geri</a>
        </div>
      </form>
    </div>`,
  );
}

/**
 * Arşiv listesi — yalnızca tarihi geçmiş etkinlikler.
 *
 * Ayrı bir sayfa olmasının sebebi ayrı bir veri olması değil: arşiv, `events`
 * listesinin geçmiş yarısı. Ama iş akışı ayrı — burada bakılan şey "hangi
 * etkinliğin görseli eksik", takvimde bakılan şey "sırada ne var". Bir arada
 * oldukları sürece ikisi de zor okunuyordu.
 */
export function archiveList(
  rows: { id: string; title: string; short: string; tag: string; photos: number; attendance?: number }[],
): string {
  const body = rows
    .map(
      (r) => `<tr>
        <td><strong>${esc(r.title)}</strong><br><span class="hint">${esc(r.short)}</span></td>
        <td>${esc(r.tag)}</td>
        <td>${
          r.photos
            ? `${r.photos} görsel`
            : '<span class="hint" style="color:var(--danger)">görsel yok</span>'
        }</td>
        <td>${r.attendance === undefined ? '<span class="hint">—</span>' : `${r.attendance} kişi`}</td>
        <td style="white-space:nowrap">
          <a class="btn btn-ghost" style="padding:6px 12px;font-size:13px"
             href="/arsiv/${encodeURIComponent(r.id)}">Düzenle</a>
        </td>
      </tr>`,
    )
    .join('');

  return page(
    'Arşiv',
    `<div class="card">
       <div style="display:flex;align-items:center;margin-bottom:16px">
         <h2 style="margin:0">Arşiv</h2>
         <a class="btn" style="margin-left:auto" href="/arsiv/yeni">Yeni arşiv kaydı</a>
       </div>
       <p class="hint" style="margin-top:0">
         Tarihi geçmiş etkinlikler. Bir etkinlik kendi gününün ertesi sabahı buraya
         geçiyor — ayrıca bir şey yapmak gerekmiyor. Uygulamada kayıt düğmesi
         çıkmıyor, takvimde de görünmüyor.
       </p>
       ${
         rows.length
           ? `<table><thead><tr><th>Etkinlik</th><th>Kategori</th><th>Görsel</th><th>Katılım</th><th></th></tr></thead><tbody>${body}</tbody></table>`
           : `<p class="empty">Arşivde etkinlik yok. Geçmiş bir etkinlik eklemek için
              <strong>Yeni arşiv kaydı</strong> deyin.</p>`
       }
     </div>`,
  );
}

/**
 * Yüklü görseller: küçük önizleme + silme kutusu.
 *
 * Var olanlar gizli alan olarak geri gönderiliyor — form gönderilince sunucu
 * neyin kaldığını ancak böyle biliyor. Silme ayrı bir kutu: bir görseli
 * kaldırmak, kalanların sırasını bozmadan olmalı.
 */
function photoRows(photos: unknown): string {
  const list = Array.isArray(photos) ? photos.map(String).filter(Boolean) : [];
  if (!list.length) return '<p class="hint" style="margin:0 0 16px">Henüz görsel yok.</p>';

  return `<div class="photos">${list
    .map(
      (url, i) => `<div class="photo">
        <img src="${esc(url)}" alt="">
        <input type="hidden" name="photo" value="${esc(url)}">
        <label class="photo-drop">
          <input type="checkbox" name="dropPhoto" value="${esc(url)}" style="width:auto">
          Sil
        </label>
        ${i === 0 ? '<span class="photo-tag">Kapak</span>' : ''}
      </div>`,
    )
    .join('')}</div>`;
}

/**
 * Kategori seçenekleri. Kayıtlı değer listede yoksa başa ekleniyor: panelin
 * menüsü değişti diye var olan bir etkinliğin kategorisi sessizce başka bir şeye
 * dönmemeli.
 */
function categoryOptions(current: string): string {
  const list =
    !current || EVENT_CATEGORIES.includes(current)
      ? EVENT_CATEGORIES
      : [current, ...EVENT_CATEGORIES];

  return [
    `<option value="" disabled${current ? '' : ' selected'}>Seçin…</option>`,
    ...list.map(
      (c) => `<option value="${esc(c)}"${c === current ? ' selected' : ''}>${esc(c)}</option>`,
    ),
  ].join('');
}

export function eventForm(
  values: Record<string, unknown>,
  errors: FieldError,
  opts: {
    editing: boolean;
    /** Gerçek kayıt sayısı — `registrations` koleksiyonundan. */
    registered?: number;
    /** Uygulamanın gördüğü sayı — `eventSeats` dokümanından. */
    shown?: number;
    /**
     * Arşiv kipi. Aynı form, çünkü arşiv kaydı ayrı bir varlık değil: tarihi
     * geçmiş etkinliğin kendisi. Olmuş bir etkinlikte kontenjan ve "son gün"
     * rozeti anlamsız, katılımcı sayısı ve görseller ise asıl mesele —
     * dolayısıyla gösterilen alanlar değişiyor, veri modeli değil.
     */
    archive?: boolean;
    /** Arşiv formunda "var olan etkinlikten doldur" listesi. */
    sources?: { id: string; label: string }[];
  },
): string {
  const v = (k: string) => esc(values[k] ?? '');
  const e = (k: string) => (errors[k] ? `<div class="err">${esc(errors[k])}</div>` : '');
  const archive = !!opts.archive;
  const action = archive ? (opts.editing ? '' : '/arsiv/yeni') : '';

  const title = archive
    ? opts.editing
      ? 'Arşiv kaydını düzenle'
      : 'Yeni arşiv kaydı'
    : opts.editing
      ? 'Etkinliği düzenle'
      : 'Yeni etkinlik';

  return page(
    title,
    `<div class="card">
      <h2>${title}</h2>
      ${Object.keys(errors).length ? '<div class="banner">Form kaydedilmedi — aşağıdaki alanları düzeltin.</div>' : ''}
      ${
        archive && !opts.editing && opts.sources?.length
          ? `<form method="get" action="/arsiv/yeni" class="prefill">
               <label style="flex:1;margin:0">Var olan etkinlikten doldur
                 <select name="from">
                   <option value="">Seçin…</option>
                   ${opts.sources
                     .map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`)
                     .join('')}
                 </select>
               </label>
               <button class="btn-ghost" type="submit">Doldur</button>
             </form>
             <p class="hint" style="margin:0 0 18px">
               Alanları kopyalar; <strong>yeni bir kayıt</strong> oluşturur. Kimliği
               değiştirmeyi unutmayın — aynı kimlik var olan etkinliğin üzerine yazar.
             </p>`
          : ''
      }

      <form method="post"${action ? ` action="${action}"` : ''} enctype="multipart/form-data">
        <div class="row">
          <label>Kimlik <span class="hint">(URL'de görünür, sonradan değiştirilemez)</span>
            <input type="text" name="id" value="${v('id')}" ${opts.editing ? 'readonly' : ''} placeholder="git-atolyesi" required>
            ${e('id')}
          </label>
          <label>Kategori
            <select name="tag" required>${categoryOptions(String(values.tag ?? ''))}</select>
            ${e('tag')}
          </label>
        </div>

        <label>Başlık
          <input type="text" name="title" value="${v('title')}" placeholder="Git &amp; GitHub Atölyesi" required>
          ${e('title')}
        </label>

        <div class="row">
          <label>Tarih
            <input type="date" name="startsAtDate" value="${v('startsAtDate')}" required>
            ${e('startsAt')}
          </label>
          <label>Başlangıç saati
            <input type="time" name="startsAtTime" value="${v('startsAtTime')}" required>
          </label>
          <label>Bitiş saati
            <input type="time" name="endsAt" value="${v('endsAt')}" required>
            ${e('endsAt')}
          </label>
        </div>
        <p class="hint" style="margin:-6px 0 16px">
          Saat dilimi sorulmuyor — hepsi Türkiye saati (UTC+03:00) olarak kaydedilir.
        </p>

        <div class="row">
          <label>Yer <span class="hint">(künyede tam hâli)</span>
            <input type="text" name="venue" value="${v('venue')}" placeholder="Müh. Fak. B Blok 204" required>
            ${e('venue')}
          </label>
          <label>Yer — kısa <span class="hint">(liste satırlarında; boşsa tam hâli)</span>
            <input type="text" name="venueShort" value="${v('venueShort')}" placeholder="B Blok 204">
          </label>
        </div>

        <label>Açıklama
          <textarea name="desc" required>${v('desc')}</textarea>
          ${e('desc')}
        </label>

        <div class="row">
          <label>Konuşmacı
            <input type="text" name="speaker" value="${v('speaker')}">
          </label>
          <label>Konuşmacı rolü
            <input type="text" name="speakerRole" value="${v('speakerRole')}" placeholder="3. sınıf · Kulüp teknik ekip">
          </label>
        </div>

        <div class="row">
          ${
            archive
              ? `<input type="hidden" name="capacity" value="${v('capacity')}">`
              : `<label>Kontenjan <span class="hint">(boş = sınırsız)</span>
                   <input type="number" name="capacity" min="0" max="999999" value="${v('capacity')}">
                   ${e('capacity')}
                 </label>`
          }
          <label>Etiketler <span class="hint">(virgülle)</span>
            <input type="text" name="tags" value="${v('tags')}" placeholder="Başlangıç seviye, Laptop getir">
          </label>
          <label>Katılımcı sayısı <span class="hint">(etkinlikten sonra)</span>
            <input type="number" name="attendance" min="0" max="999999" value="${v('attendance')}">
            ${e('attendance')}
          </label>
        </div>

        <label>Görseller <span class="hint">(ilki kapak — en fazla ${MAX_PHOTOS})</span>
          <input type="file" name="photos" accept="image/*" multiple>
        </label>
        <p class="hint" style="margin:-8px 0 14px">
          Yüklenen görseller 1600 px'e küçültülüp JPEG'e çevriliyor; telefondan
          çıktığı gibi atabilirsiniz. Kapak arşiv kartında ve etkinlik detayının
          üstünde, kalanı detaydaki galeride görünür.
        </p>
        ${e('photos')}
        ${photoRows(values.photos)}

        ${
          archive
            ? `<input type="hidden" name="badge" value="${v('badge')}">
               ${values.soon ? '<input type="hidden" name="soon" value="1">' : ''}`
            : `<div class="row">
                 <label>Rozet metni <span class="hint">(boşsa rozet çıkmaz)</span>
                   <input type="text" name="badge" value="${v('badge')}" placeholder="SON GUN">
                 </label>
                 <label style="flex:0 0 auto">
                   <input type="checkbox" name="soon" value="1" ${values.soon ? 'checked' : ''}
                          style="width:auto;margin-right:8px">
                   Son gün rozetini göster
                 </label>
               </div>`
        }

        <div class="actions">
          <button type="submit">${opts.editing ? 'Kaydet' : 'Oluştur'}</button>
          <a class="btn btn-ghost" href="${archive ? '/arsiv' : '/'}">Vazgeç</a>
        </div>
      </form>
    </div>

    ${
      opts.editing
        ? `<div class="card">
             <h2 style="font-size:15px">Yoklama</h2>
             <p class="hint" style="margin-top:0">
               Etkinliğin QR kodu, yoklama penceresi ve katılım listesi.
               ${archive ? 'Geçmiş etkinlikte de açılabiliyor: sertifika yoklamadan çıkıyor ve katılımcı elle işaretlenebiliyor.' : ''}
             </p>
             <a class="btn" href="/events/${esc(values.id ?? '')}/qr">QR ve yoklama</a>
           </div>`
        : ''
    }

    ${
      archive || opts.registered === undefined
        ? ''
        : `<div class="card">
             <h2 style="font-size:15px">Kayıtlar</h2>
             <p class="hint" style="margin-top:0">
               Gerçek kayıt sayısı <strong>${opts.registered}</strong>.
               Uygulamanın gördüğü sayı <strong>${opts.shown ?? 0}</strong>.
               Kalan yer bu ikinciden hesaplanıyor.
             </p>
             ${
               opts.registered === (opts.shown ?? 0)
                 ? '<p class="hint">İkisi aynı — yapılacak bir şey yok.</p>'
                 : `<div class="banner">Sayılar ayrışmış. Uygulama ${
                     (opts.shown ?? 0) > opts.registered ? 'olduğundan az' : 'olduğundan çok'
                   } yer gösteriyor.</div>`
             }
             <form method="post" action="/events/${esc(values.id ?? '')}/seats">
               <button class="btn-ghost" type="submit">Sayacı gerçek kayıtlara eşitle</button>
             </form>
           </div>`
    }

    <div class="card">
      <h2 style="font-size:15px">Türetilen alanlar</h2>
      <p class="hint" style="margin:0">
        Tarih tilesi, hafta günü, ay başlığı, saat–yer satırı ve künye satırları
        yukarıdaki tarihten ve yerden otomatik üretilir. Elle girilmez, dolayısıyla
        birbirinden sapamaz.
      </p>
    </div>`,
  );
}
