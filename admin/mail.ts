/**
 * SMTP gönderimi — kulübün kendi alan adından.
 *
 * **Neden Firebase'in postası değil:** Firebase Auth doğrulama postasını
 * `noreply@<proje>.firebaseapp.com` adresinden gönderiyor. O alan adı kulübün
 * değil, dolayısıyla `kouseng.com` için yayımlanan SPF/DKIM kayıtlarıyla
 * hizalanmıyor ve alıcı taraf postayı spam'e atıyor. Ölçülmüş belirti buydu.
 *
 * **Buradan gönderince kendiliğinden düzelmiyor.** Alan adının DNS'inde şunlar
 * olmadan aynı yere düşer, ve bunlar bu depodan doğrulanamaz — operatörün işi:
 *
 *   SPF    TXT @        v=spf1 include:_spf.google.com ~all
 *   DKIM   Workspace Admin → Apps → Gmail → Authenticate email → anahtar üret,
 *          verdiği TXT kaydını ekle, sonra "Start authentication"
 *   DMARC  TXT _dmarc   v=DMARC1; p=none; rua=mailto:info@kouseng.com
 *
 * DMARC `p=none` ile başlıyor: doğrudan `p=reject` yazmak, hizalaması eksik
 * kalan bir kaynak varsa postanın tamamını sessizce yok eder.
 *
 * Gönderim hesabı `noreply@kouseng.com` bir Workspace kutusu; parola olarak
 * hesabın **uygulama parolası** kullanılıyor (iki adımlı doğrulama açık olmak
 * zorunda). Workspace kullanıcı başına günlük gönderim sınırı bir kulüp için
 * fazlasıyla yeterli.
 */
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Okunan ortam değişkenleri. İndeks imzası `process.env`'in doğrudan
 * verilebilmesi için: adlandırılmış alanlar belgelendirme, imza uyum.
 */
export type MailEnv = {
  [key: string]: string | undefined;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM?: string;
  MAIL_REPLY_TO?: string;
};

export type MailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
};

/**
 * Ortamdan yapılandırma — eksikse `null`, ve **eksik olanın adıyla** birlikte.
 *
 * `resolvePort` ile aynı gerekçe: boş bir ortam değişkeni `??` ile
 * yakalanmıyor, `''` nullish değil. Boş `SMTP_HOST`, "yapılandırılmış ama
 * bağlanamıyor" gibi görünürdü.
 */
export function readMailConfig(env: MailEnv): { config: MailConfig } | { eksik: string[] } {
  const zorunlu = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const;
  const eksik = zorunlu.filter((ad) => !(env[ad] ?? '').trim());
  if (eksik.length) return { eksik: [...eksik] };

  const portRaw = (env.SMTP_PORT ?? '').trim();
  const port = portRaw ? Number(portRaw) : 587;

  return {
    config: {
      host: (env.SMTP_HOST ?? '').trim(),
      port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
      user: (env.SMTP_USER ?? '').trim(),
      pass: env.SMTP_PASS ?? '',
      // Görünen ad olmadan gönderilen posta gelen kutusunda çıplak bir adres
      // olarak duruyor; hem güven vermiyor hem de spam puanı alıyor.
      from: (env.MAIL_FROM ?? '').trim() || `KOÜ Yazılım Kulübü <${(env.SMTP_USER ?? '').trim()}>`,
      replyTo: (env.MAIL_REPLY_TO ?? '').trim() || undefined,
    },
  };
}

let transporter: Transporter | null = null;
let config: MailConfig | null = null;

/** Posta gönderilebilir durumda mı? Panel açılışta bunu yazıyor. */
export function mailReady(): boolean {
  return config !== null;
}

export function initMail(env: MailEnv): { ok: true } | { ok: false; eksik: string[] } {
  const okunan = readMailConfig(env);
  if ('eksik' in okunan) return { ok: false, eksik: okunan.eksik };

  config = okunan.config;
  transporter = nodemailer.createTransport({
    host: config.host,
    // 465 örtük TLS, 587 STARTTLS. Portu bilip `secure`'u yanlış vermek
    // bağlantının hiç kurulmaması demek.
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
  return { ok: true };
}

export type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Postayı gönderir. Yapılandırma yoksa **fırlatıyor**, sessizce başarılı
 * olmuyor: "gönderildi" deyip göndermemek, bu defterde birkaç kez yazılmış
 * hatanın aynısı olurdu.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!transporter || !config) {
    throw new Error('SMTP yapılandırılmamış — SMTP_HOST, SMTP_USER, SMTP_PASS gerekiyor.');
  }
  await transporter.sendMail({
    from: config.from,
    to: mail.to,
    replyTo: config.replyTo,
    subject: mail.subject,
    // İkisi birden: yalnızca HTML gönderen posta spam puanı alıyor ve metin
    // okuyucularda gövde tamamen boş görünüyor.
    text: mail.text,
    html: mail.html,
  });
}
