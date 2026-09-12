/**
 * Etkinlik QR sayfası ve herkese açık "uygulamayı aç" sayfası.
 *
 * QR bir SVG olarak sunucuda üretiliyor (`qrcode` paketi): sayfanın dış bir
 * script'e ihtiyacı yok, yazdırıldığında da doğru çıkıyor. Canvas ya da
 * native bağımlılık yok.
 */
import { esc, page } from './views';
import type { QrTanimi, YoklamaSatiri } from './qr';

function saatMetni(iso: string): string {
  // Değer `2026-03-12T17:00:00+03:00` — makine okunur hâlinden okunur hâle
  // çevirmek için ayrıştırmaya gerek yok, alanlar zaten yerinde.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : '—';
}

function inputZaman(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso ?? '');
  return m ? `${m[1]}T${m[2]}` : '';
}

export function qrPage(input: {
  eventId: string;
  baslik: string;
  tanim: QrTanimi;
  payload: string;
  svg: string;
  yoklama: YoklamaSatiri[];
  gelmeyenler: { adSoyad: string; studentNo: string; hesapVar: boolean }[];
  notice?: string;
}): string {
  const { tanim, yoklama, gelmeyenler } = input;

  const yoklamaSatirlari = yoklama.length
    ? yoklama
        .map(
          (y) => `<tr>
            <td>${esc(y.adSoyad)}</td>
            <td><code>${esc(y.ogrenciNo || '—')}</code></td>
            <td>${y.kaynak === 'panel' ? '<span class="hint">elle</span>' : 'QR'}</td>
            <td>${esc(saatMetni(y.checkedInAt))}</td>
            <td>${y.sertifikaNo ? `<code>${esc(y.sertifikaNo)}</code>` : '<span class="hint">—</span>'}</td>
            <td>
              <form method="post" action="/events/${esc(input.eventId)}/yoklama" style="margin:0">
                <input type="hidden" name="uid" value="${esc(y.uid)}">
                <input type="hidden" name="islem" value="sil">
                <button class="btn-ghost" style="padding:4px 10px;font-size:12px">Kaldır</button>
              </form>
            </td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="6"><span class="hint">Henüz kimse okutmadı.</span></td></tr>';

  const gelmeyenSatirlari = gelmeyenler.length
    ? gelmeyenler
        .map(
          (g) => `<tr>
            <td>${esc(g.adSoyad)}</td>
            <td><code>${esc(g.studentNo)}</code></td>
            <td>${
              g.hesapVar
                ? '<span class="hint">hesabı var</span>'
                : '<b>hesabı yok</b> <span class="hint">— yoklamaya giremez, sertifika alamaz</span>'
            }</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="3"><span class="hint">Kaydolan herkes okuttu.</span></td></tr>';

  return page(
    `QR · ${input.baslik}`,
    `
    ${input.notice ? `<p class="notice">${esc(input.notice)}</p>` : ''}

    <h1>${esc(input.baslik)}</h1>
    <p class="hint"><a href="/events/${esc(input.eventId)}">← etkinliğe dön</a></p>

    <div class="card">
      <h2>Yoklama QR'ı</h2>
      <p class="hint">
        Bunu projeksiyona yansıt ya da çıktı alıp kapıya as. Öğrenci uygulamadan
        okutuyor. <b>Kodun paylaşılması engellenmiyor</b> — yoklama "bu hesap
        pencere açıkken okuttu" demek, "bu kişi salondaydı" demek değil.
      </p>
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
        <div style="background:#fff;padding:16px;border:1px solid var(--border);border-radius:12px;width:260px">
          ${input.svg}
        </div>
        <div style="flex:1;min-width:260px">
          <p style="margin:0 0 8px"><b>Kod</b><br><code style="font-size:18px;letter-spacing:2px">${esc(tanim.token)}</code></p>
          <p style="margin:0 0 8px"><b>Adres</b><br><code style="word-break:break-all">${esc(input.payload)}</code></p>
          <p style="margin:0 0 8px"><b>Açılış</b> ${esc(saatMetni(tanim.opensAt))}<br><b>Kapanış</b> ${esc(saatMetni(tanim.closesAt))}</p>
          <p class="hint">
            Pencere etkinliğin bir saat öncesinde açılıp <b>o günün sonunda</b>
            kapanıyor. Bitişte kapatmak, salonda interneti tutmayan telefonun
            akşam yaptığı yeniden denemeyi kalıcı olarak reddederdi.
          </p>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Pencereyi değiştir</h2>
      <form method="post" action="/events/${esc(input.eventId)}/qr/pencere">
        <label>Açılış <input type="datetime-local" name="opensAt" value="${esc(inputZaman(tanim.opensAt))}" required></label>
        <label>Kapanış <input type="datetime-local" name="closesAt" value="${esc(inputZaman(tanim.closesAt))}" required></label>
        <div class="actions"><button type="submit">Kaydet</button></div>
      </form>
      <p class="hint">Saatler kulüp saatine (+03:00) göre yazılıyor; sunucunun saat dilimi hesaba girmiyor.</p>
    </div>

    <div class="card">
      <h2>Kodu yenile</h2>
      <p class="hint">
        Yanlış basılmış afiş, yanlış etkinliğin QR'ı, ya da paylaşımdan
        vazgeçmek. <b>Eski kod anında ölür</b>, pencere korunur.
      </p>
      <form method="post" action="/events/${esc(input.eventId)}/qr/yenile">
        <div class="actions"><button class="btn-ghost" type="submit">Yeni kod üret</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Elle yoklama</h2>
      <p class="hint">
        Telefonu olmayan ya da okutamayan katılımcı için. <b>Hesap kimliği (uid)
        gerekiyor</b>; aşağıdaki listede hesabı olmayan kayıtlar işaretlenemez.
        Sertifika, elle işaretlenen katılımcıya da çıkıyor.
      </p>
      <form method="post" action="/events/${esc(input.eventId)}/yoklama">
        <input type="hidden" name="islem" value="ekle">
        <label>Kullanıcı kimliği (uid) <input type="text" name="uid" required maxlength="128" placeholder="Firebase uid"></label>
        <div class="actions"><button type="submit">Yoklamaya ekle</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Yoklama · ${yoklama.length} kişi</h2>
      <table>
        <thead><tr><th>Ad Soyad</th><th>Öğrenci no</th><th>Nasıl</th><th>Ne zaman</th><th>Sertifika</th><th></th></tr></thead>
        <tbody>${yoklamaSatirlari}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Kaydoldu ama okutmadı · ${gelmeyenler.length} kişi</h2>
      <table>
        <thead><tr><th>Ad Soyad</th><th>Öğrenci no</th><th>Durum</th></tr></thead>
        <tbody>${gelmeyenSatirlari}</tbody>
      </table>
    </div>
    `,
  );
}

/**
 * Telefonun kendi kamerası QR'ı okuduğunda açılan sayfa.
 *
 * Giriş duvarının ÖNÜNDE ve bilerek: okutan kişi öğrenci, yönetici parolası
 * yok. Sayfa hiçbir şey doğrulamıyor ve **jetonu tekrar etmiyor** — adres
 * çubuğunda zaten var, sayfanın da yazması gereksiz bir kopya olurdu.
 */
export function qrLandingPage(): string {
  return page(
    'Yoklama',
    `
    <div class="card" style="max-width:520px;margin:40px auto;text-align:center">
      <h1 style="margin-top:0">Yoklama için uygulamayı aç</h1>
      <p>
        Bu kodu <b>KOÜ Yazılım Kulübü</b> uygulamasından okutman gerekiyor.
        Uygulamayı aç, etkinlik ekranındaki <b>QR ile yoklama</b> düğmesine bas
        ve kodu tekrar okut.
      </p>
      <p class="hint">
        Uygulaman yoksa App Store ya da Google Play'den kurabilirsin. Yoklama
        yalnızca uygulamada kayıtlı bir hesapla çalışıyor.
      </p>
    </div>
    `,
    { nav: false },
  );
}
