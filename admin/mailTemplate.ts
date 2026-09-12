/**
 * Doğrulama kodu postasının gövdesi.
 *
 * Tasarım kısıtları, tercih değil: e-posta istemcileri 2000'lerin HTML'ini
 * çalıştırıyor. Flexbox, grid, `<style>` bloğunda sınıf, web fontu — hiçbiri
 * güvenilir değil. Bu yüzden tablo, satır içi stil ve 600 piksel.
 *
 * Spam kutusuna düşmemek için burada olan/olmayan şeyler:
 *
 * - **Düz metin karşılığı var.** Yalnızca HTML gönderen posta spam puanı
 *   alıyor; `text` alanı boş bırakılırsa filtre bunu görüyor.
 * - **Hiç görsel yok.** Logo bir `<img>` olsaydı çoğu istemci onu
 *   engelleyeceği için posta boş bir çerçeve olarak açılırdı, üstelik
 *   "yalnızca görsel" gövdeler spam sinyali. Kelime markası metin.
 * - **Hiç bağlantı yok.** Kod postası tıklanacak bir şey içermiyor: hem
 *   bağlantı itibarına takılmıyor hem de kullanıcıya "bu tür postalardaki
 *   bağlantıya basma" demeyi mümkün kılıyor.
 * - Gönderen alan adı kulübün kendi alan adı olmak zorunda (SPF/DKIM
 *   hizalaması); `admin/mail.ts` başlığındaki nota bakın.
 */

/** Uygulamanın paletinden — `src/theme.ts` ile aynı değerler. */
const RENK = {
  zemin: '#F4F9FB',
  kart: '#FFFFFF',
  kenar: '#E4EEF3',
  lacivert: '#001B4A',
  mavi: '#0389BC',
  acikMavi: '#D2E7EC',
  metin: '#0B1F3A',
  govde: '#41586B',
  soluk: '#5B7185',
} as const;

/** Her istemcide bulunan yığın. Press Start 2P postaya giremiyor (web fontu). */
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";

export type OtpMail = { subject: string; html: string; text: string };

export function otpMail(code: string, dakika: number): OtpMail {
  const subject = `KOÜ Yazılım Kulübü doğrulama kodun: ${code}`;

  const text = [
    'KOÜ YAZILIM KULÜBÜ',
    '',
    'Doğrulama kodun:',
    code,
    '',
    `Kod ${dakika} dakika geçerli. Uygulamadaki doğrulama ekranına yaz.`,
    '',
    'Bu kodu sen istemediysen hiçbir şey yapmana gerek yok — kod',
    'kullanılmadan geçersiz olacak. Bir sorun olduğunu düşünüyorsan',
    'info@kouseng.com adresine yazabilirsin.',
    '',
    'Bu posta otomatik gönderildi, yanıtlanmıyor.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:${RENK.zemin}; font-family:${FONT}; -webkit-font-smoothing:antialiased;">

<!-- Önizleme satırı: gelen kutusunda konunun yanında görünen metin. Gizli
     olmasının sebebi, gövdede ikinci kez tekrarlanmaması. -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">Kodun ${code} — ${dakika} dakika geçerli.</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${RENK.zemin};">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;">

    <tr><td style="padding:0 0 20px 0; text-align:center;">
      <span style="font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:2.5px; color:${RENK.soluk}; text-transform:uppercase;">KOÜ Yazılım Kulübü</span>
    </td></tr>

    <tr><td style="background:${RENK.kart}; border:1px solid ${RENK.kenar}; border-radius:16px; overflow:hidden;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

        <tr><td style="background:${RENK.lacivert}; padding:26px 32px;">
          <div style="font-family:${FONT}; font-size:19px; font-weight:700; color:#ffffff; line-height:1.35;">E-postanı doğrula</div>
          <div style="font-family:${FONT}; font-size:13px; color:${RENK.acikMavi}; line-height:1.5; padding-top:6px;">Etkinliklere katılabilmen için tek adım kaldı.</div>
        </td></tr>

        <tr><td style="padding:30px 32px 8px 32px;">
          <div style="font-family:${FONT}; font-size:14px; line-height:1.6; color:${RENK.govde};">Uygulamadaki doğrulama ekranına bu kodu yaz:</div>
        </td></tr>

        <tr><td style="padding:14px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="background:${RENK.acikMavi}; border-radius:12px; padding:22px 12px;">
              <span style="font-family:${MONO}; font-size:34px; font-weight:700; letter-spacing:10px; color:${RENK.lacivert}; line-height:1;">${code}</span>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:16px 32px 30px 32px;">
          <div style="font-family:${FONT}; font-size:13px; line-height:1.6; color:${RENK.soluk};">Kod <strong style="color:${RENK.metin};">${dakika} dakika</strong> geçerli. Süresi dolarsa uygulamadan yeni kod isteyebilirsin.</div>
        </td></tr>

        <tr><td style="padding:0 32px 30px 32px;">
          <div style="border-top:1px solid ${RENK.kenar}; padding-top:18px; font-family:${FONT}; font-size:12.5px; line-height:1.6; color:${RENK.soluk};">
            Bu kodu sen istemediysen bir şey yapmana gerek yok; kod kullanılmadan geçersiz olacak. Bir sorun olduğunu düşünüyorsan <a href="mailto:info@kouseng.com" style="color:${RENK.mavi}; text-decoration:none; font-weight:600;">info@kouseng.com</a> adresine yazabilirsin.
          </div>
        </td></tr>

      </table>

    </td></tr>

    <tr><td style="padding:18px 8px 0 8px; text-align:center;">
      <div style="font-family:${FONT}; font-size:11.5px; line-height:1.6; color:${RENK.soluk};">Bu posta otomatik gönderildi, yanıtlanmıyor.<br>Kocaeli Üniversitesi Yazılım Kulübü</div>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
