/**
 * Panelin "Bildirimler" sayfası.
 *
 * Varlık sebebi tek bir cümle: **bu zincirin her halkası sessizce kopuyordu.**
 * Cihaz kaydı yazılmamış olabilir, panel eski kodu çalıştırıyor olabilir,
 * gönderim kimseye ulaşmamış olabilir — ve üçünün de tek belirtisi "bildirim
 * gelmedi" oluyordu. Sunucu günlüğü hepsini yazıyor ama operatör ona bakmıyor.
 *
 * Sayfa hiçbir şeye karar vermiyor, yalnızca gösteriyor.
 */
import { esc, page } from './views';

export type DeviceSummary = {
  total: number;
  byPlatform: Record<string, number>;
  masterOn: number;
  byCategory: Record<string, number>;
};

export type LogRow = {
  id: string;
  title?: string;
  category?: string;
  sent?: number;
  deferred?: number;
  failed?: number;
  registered?: number;
  sentAt?: string;
  claimedAt?: string;
  silent?: boolean;
};

export type PendingRow = { notBefore?: string; title?: string; tokens?: number };

const num = (value: unknown): string => (typeof value === 'number' ? String(value) : '—');

const when = (iso: unknown): string => {
  if (typeof iso !== 'string' || !iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return esc(iso);
  // Kulüp saatinde göster: panel UTC konteynerde koşuyor ve operatör Kocaeli'de.
  const club = new Date(parsed.getTime() + 3 * 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(club.getUTCDate())}.${pad(club.getUTCMonth() + 1)} ${pad(club.getUTCHours())}:${pad(club.getUTCMinutes())}`;
};

export type MailStatus = { ready: boolean; from: string | null; eksik: string[] };

export function notificationsPage(input: {
  autoPush: boolean;
  mail: MailStatus;
  devices: DeviceSummary;
  log: LogRow[];
  pending: PendingRow[];
  categories: readonly string[];
  notice?: string;
}): string {
  const { devices } = input;

  const platforms = Object.entries(devices.byPlatform)
    .map(([k, v]) => `${esc(k)}: ${v}`)
    .join(' · ');

  const categoryRows = input.categories
    .map(
      (c) =>
        `<tr><td>${esc(c)}</td><td class="num">${devices.byCategory[c] ?? 0}</td></tr>`,
    )
    .join('');

  const logRows = input.log.length
    ? input.log
        .map((row) => {
          const outcome = row.silent
            ? '<span class="hint">sessiz işaretlendi</span>'
            : `${num(row.sent)} gönderildi${row.deferred ? ` · ${row.deferred} ertelendi` : ''}${
                row.failed ? ` · <b>${row.failed} başarısız</b>` : ''
              }`;
          return `<tr>
            <td><code>${esc(row.id)}</code></td>
            <td>${esc(row.title ?? '—')}</td>
            <td>${esc(row.category ?? '—')}</td>
            <td>${outcome}</td>
            <td>${when(row.sentAt ?? row.claimedAt)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="5" class="hint">Henüz hiçbir bildirim gönderilmedi.</td></tr>';

  const pendingRows = input.pending.length
    ? input.pending
        .map(
          (row) =>
            `<tr><td>${esc(row.title ?? '—')}</td><td class="num">${row.tokens ?? 0}</td><td>${when(row.notBefore)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="hint">Kuyrukta bekleyen yok.</td></tr>';

  const categoryOptions = input.categories
    .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join('');

  return page(
    'Bildirimler',
    `
    ${input.notice ? `<div class="card"><p>${esc(input.notice)}</p></div>` : ''}

    <div class="card">
      <h2>Durum</h2>
      <p>
        Otomatik gönderim: <b>${input.autoPush ? 'AÇIK' : 'KAPALI'}</b>
        ${input.autoPush ? '' : '<span class="hint">(ADMIN_AUTO_PUSH=off)</span>'}
      </p>
      <p>
        Kayıtlı cihaz: <b>${devices.total}</b>
        ${platforms ? `<span class="hint">${platforms}</span>` : ''}
      </p>
      <p>
        Bildirimleri açık olan: <b>${devices.masterOn}</b>
        ${
          devices.total === 0
            ? '<span class="hint">Hiç cihaz yok. Uygulamayı bir kez açıp bildirim izni vermek gerekiyor; simülatörde ve Expo Go’da token üretilmez.</span>'
            : ''
        }
      </p>
      <table>
        <thead><tr><th>Kategori</th><th class="num">Açık cihaz</th></tr></thead>
        <tbody>${categoryRows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Posta</h2>
      <p class="hint">
        ${
          input.mail.ready
            ? `Gönderen: <code>${esc(input.mail.from ?? '')}</code>`
            : `<b>SMTP yapılandırılmamış</b> — eksik: <code>${esc(input.mail.eksik.join(', '))}</code>. ` +
              'Doğrulama kodu gönderilemez, yeni hesaplar doğrulanamaz.'
        }
      </p>
      <p class="hint">
        <b>Buradaki adres, postanın gerçekten geldiği adres değil.</b> Google'ın kendi
        belgesi <code>smtp.gmail.com</code> için “From adresi kimlik doğrulanan hesapla
        aynı olmalı” diyor: takma ad kabul edilmezse Google başlığı sessizce
        <code>SMTP_USER</code>'a çeviriyor. Tek kanıt gelen postanın gönderen satırı —
        test gönderip oraya bakın.
      </p>
      <form method="post" action="/bildirimler/posta-testi">
        <label>Adres
          <input type="email" name="to" placeholder="kendi adresin" required>
        </label>
        <div class="actions"><button type="submit">Test postası gönder</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Test bildirimi</h2>
      <p class="hint">
        Deftere yazılmaz, tekrar tekrar gönderilebilir. Kategorisi açık olan
        her cihaza gider — yani kendine gönderiyorsan o kategorinin açık olması
        gerekiyor.
      </p>
      <form method="post" action="/bildirimler/test">
        <label>Kategori
          <select name="category">${categoryOptions}</select>
        </label>
        <label>Başlık
          <input type="text" name="title" value="Test bildirimi" maxlength="80" required>
        </label>
        <label>Metin
          <input type="text" name="body" value="Panelden gönderildi." maxlength="160" required>
        </label>
        <div class="actions"><button type="submit">Gönder</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Son gönderimler</h2>
      <table>
        <thead><tr><th>Olay</th><th>Başlık</th><th>Kategori</th><th>Sonuç</th><th>Ne zaman</th></tr></thead>
        <tbody>${logRows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Sessiz saat kuyruğu</h2>
      <table>
        <thead><tr><th>Başlık</th><th class="num">Cihaz</th><th>Gönderilecek</th></tr></thead>
        <tbody>${pendingRows}</tbody>
      </table>
    </div>
    `,
  );
}
