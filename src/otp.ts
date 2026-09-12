/**
 * E-posta doğrulama — panelin uç noktalarına giden istemci.
 *
 * **Neden Firebase'in doğrulama postası kullanılmıyor:** gönderen
 * `noreply@<proje>.firebaseapp.com`, yani kulübün sahip olmadığı bir alan adı.
 * `kouseng.com` için yayımlanan SPF/DKIM ile hizalanmadığı için posta spam'e
 * düşüyor — cihazda böyle gözlendi. Panel aynı postayı kulübün kendi
 * adresinden gönderiyor (`admin/mail.ts`).
 *
 * İkinci sebep bağlantı yerine kod kullanılması: bağlantı kullanıcıyı
 * tarayıcıya çıkarıyor ve uygulama olup bittiğini bilmiyor (`refreshVerification`
 * tam olarak bu yüzden var). Altı hane kullanıcıyı ekrandan hiç çıkarmıyor.
 */
import { currentUser } from './auth';
import { PANEL_BASE_URL } from './data';

/** Sunucunun döndürdüğü hata kodları. Ekran bunlara göre ne soracağına karar veriyor. */
export type OtpError =
  | 'oturum_yok'
  | 'eposta_yok'
  | 'posta_yapilandirilmamis'
  | 'posta_gonderilemedi'
  | 'bekle'
  | 'cok_fazla'
  | 'kod_yok'
  | 'suresi_doldu'
  | 'kilitli'
  | 'yanlis'
  | 'telefon_gecersiz'
  | 'numara_gecersiz'
  | 'telefon_kullanimda'
  | 'numara_kullanimda'
  | 'panel_yok'
  | 'aglar';

export class OtpHata extends Error {
  constructor(
    readonly kod: OtpError,
    readonly saniye?: number,
    readonly kalan?: number,
  ) {
    super(kod);
  }
}

async function cagir(yol: string, govde: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Taban adres yoksa istek atmanın anlamı yok: `fetch('/api/…')` React
  // Native'de göreli adresi çözemiyor ve hata "Network request failed" olarak
  // görünür, ki bu yapılandırma eksikliğini bağlantı sorunu gibi gösterir.
  if (!PANEL_BASE_URL) throw new OtpHata('panel_yok');

  const user = currentUser();
  if (!user) throw new OtpHata('oturum_yok');

  let res: Response;
  try {
    res = await fetch(`${PANEL_BASE_URL}${yol}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify(govde),
    });
  } catch {
    throw new OtpHata('aglar');
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new OtpHata(
      (data.hata as OtpError) ?? 'aglar',
      typeof data.saniye === 'number' ? data.saniye : undefined,
      typeof data.kalan === 'number' ? data.kalan : undefined,
    );
  }
  return data;
}

/** Yeni kod ister. `zaten_dogrulandi` bir hata değil — ekran ilerliyor. */
export async function kodIste(): Promise<'gonderildi' | 'zaten_dogrulandi'> {
  const data = await cagir('/api/hesap/kod', {});
  return data.durum === 'zaten_dogrulandi' ? 'zaten_dogrulandi' : 'gonderildi';
}

/**
 * Kodu doğrular ve aynı çağrıda telefon/öğrenci numarasını sahiplenir.
 *
 * `duzeltme` çakışma sonrası veriliyor: numarası başkasında olan kullanıcının
 * onu değiştirebileceği başka bir ekran yok, ve olmayan bir ekrana
 * yönlendirmek hesabı kalıcı olarak doğrulanamaz bırakırdı.
 */
export async function kodDogrula(
  code: string,
  duzeltme?: { telefon?: string; ogrenciNo?: string },
): Promise<void> {
  await cagir('/api/hesap/dogrula', { code, ...duzeltme });
}

/** Kullanıcıya gösterilecek cümle. Sunucu kodu asla ekrana çıkmıyor. */
export function otpMesaj(err: unknown): string {
  const kod = err instanceof OtpHata ? err.kod : 'aglar';
  const saniye = err instanceof OtpHata ? err.saniye : undefined;
  const kalan = err instanceof OtpHata ? err.kalan : undefined;

  switch (kod) {
    case 'bekle':
      return `Yeni kod istemek için ${saniye ?? 60} saniye bekle.`;
    case 'cok_fazla':
      return 'Çok fazla kod istendi. Bir saat sonra tekrar dene.';
    case 'yanlis':
      return kalan && kalan > 0
        ? `Kod hatalı. ${kalan} deneme hakkın kaldı.`
        : 'Kod hatalı.';
    case 'suresi_doldu':
      return 'Kodun süresi doldu. Yeni kod iste.';
    case 'kilitli':
      return 'Çok fazla yanlış deneme yapıldı. Yeni kod iste.';
    case 'kod_yok':
      return 'Önce kod iste.';
    case 'telefon_kullanimda':
      return 'Bu telefon numarası başka bir hesapta kayıtlı.';
    case 'numara_kullanimda':
      return 'Bu öğrenci numarası başka bir hesapta kayıtlı.';
    case 'telefon_gecersiz':
      return 'Telefon numarasını 5xx xxx xx xx biçiminde yaz.';
    case 'numara_gecersiz':
      return 'Öğrenci numaran dokuz haneli olmalı.';
    case 'posta_yapilandirilmamis':
    case 'posta_gonderilemedi':
      return 'Posta gönderilemedi. Kulüple iletişime geçebilirsin: info@kouseng.com';
    case 'panel_yok':
      return 'Uygulama yapılandırması eksik; bu sürümde doğrulama yapılamıyor.';
    case 'oturum_yok':
      return 'Oturumun düşmüş görünüyor. Tekrar giriş yap.';
    case 'eposta_yok':
      return 'Hesabında e-posta adresi yok.';
    default:
      return 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.';
  }
}
