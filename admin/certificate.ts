/**
 * Katılım sertifikasının görsel tanımı — **tek kaynak**.
 *
 * Hem herkese açık doğrulama sayfası hem de postaya eklenen PDF buradan
 * çıkıyor. İki ayrı tanım yazmak, ikisinin ayrışmasının tek sebebi olurdu:
 * bir gün biri PDF'te düzeltilir, sayfada kalır, ve kimse fark etmez.
 *
 * Değişen yalnızca iki şey var — katılımcının adı ve etkinliğin adı. Tarih ve
 * belge numarası da yer tutucu, ama onlar tasarımın küçük yazısı; kompozisyon
 * o iki değişkenin üstüne kurulu.
 *
 * **Tipografi kulübün kendi dili:** gövde Plus Jakarta Sans, ve Press Start 2P
 * YALNIZCA tek bir küçük etikette. Deponun kuralı bu: piksel font rozet
 * etiketi, grup başlığı ve boş durum metni için — gövde metni, form ve düğme
 * için asla. Sertifikanın tamamını piksel fontla yazmak "oyuncak gibi"
 * görünmesinin en kısa yolu olurdu.
 */
import { ICON } from '../src/icons';
import { esc } from './views';

export type SertifikaVerisi = {
  adSoyad: string;
  etkinlik: string;
  /** `12 Mart 2026` — okunur hâl; makine okunur tarih belgeye girmiyor. */
  tarih: string;
  belgeNo: string;
  /** Belgenin herkese açık adresi; altta küçük yazıyla ve QR olarak duruyor. */
  dogrulamaUrl: string;
  /** Font dosyalarının kökü. PDF üretiminde gömülü, sayfada statik yol. */
  fontBase: string;
  /** Doğrulama karekodunun SVG'si. Boşsa o alan hiç çizilmiyor. */
  qrSvg?: string;
};

const RENK = {
  lacivert: '#001B4A',
  lacivert700: '#014576',
  mavi: '#0389BC',
  mavi200: '#93CBDC',
  mavi100: '#D2E7EC',
  metin: '#0B1F3A',
  soluk: '#5B7185',
  kagit: '#FFFFFF',
};

/**
 * Kulüp mührü.
 *
 * Uygulamanın kendi `star` glifi — yolu `src/icons.ts`'ten geliyor, burada
 * KOPYALANMIYOR. İkonu iki yerde tanımlamak, ikisinin ayrışmasının tek sebebi
 * olurdu; üstelik o glif bu depoda bir kez elle düzeltildi ve düzeltmenin
 * buraya yansımaması kimsenin fark etmeyeceği bir fark üretirdi.
 *
 * Sertifikanın ortasında bir mühür olmasının sebebi boşluk doldurmak değil:
 * belgenin dikey ekseninde bir çapa yok ve kompozisyon dağılıyordu.
 */
function muhur(boyMm: number): string {
  return `<svg viewBox="0 0 8 8" width="${boyMm}mm" height="${boyMm}mm" aria-hidden="true">
    <rect x="0" y="0" width="8" height="8" rx="1.4" fill="${RENK.lacivert}"/>
    <g transform="translate(1.15 1.15) scale(0.72)">
      <path d="${ICON.star}" fill="${RENK.mavi200}"/>
    </g>
  </svg>`;
}

/** Uygulamanın başlıklarındaki kare dizisi — aynı görsel dil. */
function kareSiraso(adet: number, renk: string, boy = 4): string {
  return Array.from({ length: adet }, () => `<i style="background:${renk};width:${boy}px;height:${boy}px"></i>`).join('');
}

export function certificateHtml(v: SertifikaVerisi): string {
  const f = v.fontBase.replace(/\/+$/, '');

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Katılım Belgesi · ${esc(v.adSoyad)}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  @font-face {
    font-family: 'Jakarta';
    src: url('${f}/PlusJakartaSans_400Regular.ttf') format('truetype');
    font-weight: 400; font-style: normal; font-display: block;
  }
  @font-face {
    font-family: 'Jakarta';
    src: url('${f}/PlusJakartaSans_600SemiBold.ttf') format('truetype');
    font-weight: 600; font-style: normal; font-display: block;
  }
  @font-face {
    font-family: 'Jakarta';
    src: url('${f}/PlusJakartaSans_800ExtraBold.ttf') format('truetype');
    font-weight: 800; font-style: normal; font-display: block;
  }
  @font-face {
    font-family: 'Pixel';
    src: url('${f}/PressStart2P_400Regular.ttf') format('truetype');
    font-weight: 400; font-style: normal; font-display: block;
  }

  /* A4 yatay. Yazdırmada da PDF'e basmada da aynı ölçü. */
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 297mm; height: 210mm;
    background: ${RENK.kagit};
    font-family: 'Jakarta', system-ui, sans-serif;
    color: ${RENK.metin};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sayfa { position: relative; width: 297mm; height: 210mm; overflow: hidden; }

  /* Sol kenardaki lacivert bant — belgeyi ciltli bir evrak gibi tutuyor ve
     kompozisyona asimetri veriyor. Ortalanmış klasik sertifikadan ayıran şey. */
  .bant { position: absolute; left: 0; top: 0; bottom: 0; width: 22mm; background: ${RENK.lacivert}; }
  .bant .kareler { position: absolute; left: 8mm; top: 14mm; display: flex; flex-direction: column; gap: 4px; }
  .bant .kareler i { display: block; border-radius: 1px; }
  .bant .marka {
    position: absolute; left: 0; right: 0; top: 0; bottom: 0;
    display: flex; align-items: center; justify-content: center;
    transform: rotate(180deg); writing-mode: vertical-rl;
    font-size: 8.5pt; font-weight: 600; letter-spacing: 3.2px;
    color: ${RENK.mavi200}; text-transform: uppercase;
  }

  /* Çift çerçeve: kalın lacivert + ince açık mavi. Sertifika geleneğinin
     tek gerçekten işe yarayan öğesi — sayfayı belge yapan şey. */
  .cerceve {
    position: absolute; left: 30mm; right: 14mm; top: 14mm; bottom: 14mm;
    border: 1.2pt solid ${RENK.lacivert};
  }
  .cerceve::after {
    content: ''; position: absolute; left: 2.2mm; right: 2.2mm; top: 2.2mm; bottom: 2.2mm;
    border: 0.5pt solid ${RENK.mavi200};
  }

  /* Köşe vurguları: dört köşede küçük lacivert kare. Çerçeveyi tek bir ince
     dikdörtgen olmaktan çıkarıp belge gibi gösteren şey — ve piksel diliyle
     tutarlı, çünkü kulübün bütün ikonları kare. */
  .kose { position: absolute; width: 3.4mm; height: 3.4mm; background: ${RENK.lacivert}; }
  .kose.sü { left: -0.6pt; top: -0.6pt; }
  .kose.sa { right: -0.6pt; top: -0.6pt; }
  .kose.al { left: -0.6pt; bottom: -0.6pt; }
  .kose.ar { right: -0.6pt; bottom: -0.6pt; }

  /* Kâğıt dokusu: 10px adımlı çok açık nokta ızgarası. Bakınca görünmüyor,
     yokken sayfa boş kâğıt gibi duruyor. Piksel kimliğini gürültü yapmadan
     taşımanın tek yolu bu ölçekte. */
  .doku {
    position: absolute; left: 3mm; right: 3mm; top: 3mm; bottom: 3mm;
    background-image: radial-gradient(${RENK.mavi200} 0.9px, transparent 0.9px);
    background-size: 11px 11px;
    opacity: 0.32;
  }

  .icerik {
    position: absolute; left: 38mm; right: 22mm; top: 20mm; bottom: 20mm;
    display: flex; flex-direction: column;
  }

  .ust { display: flex; align-items: flex-start; justify-content: space-between; }
  .kulup { font-size: 10pt; font-weight: 800; letter-spacing: 1.6px; color: ${RENK.lacivert}; text-transform: uppercase; }
  .kulup span { display: block; font-size: 7.5pt; font-weight: 400; letter-spacing: 2.4px; color: ${RENK.soluk}; margin-top: 3px; }
  .belgeNo { text-align: right; font-size: 7.5pt; letter-spacing: 1px; color: ${RENK.soluk}; }
  .belgeNo b { display: block; font-size: 9pt; font-weight: 600; letter-spacing: 1.4px; color: ${RENK.lacivert700}; margin-top: 2px; }

  /* Optik merkez: matematiksel ortanın biraz ÜSTÜ. Tam ortalanmış blok göze
     aşağı kaymış görünüyor; bütün klasik belge düzenleri bu yüzden yukarı
     kaçırıyor. Basıp bakmadan fark edilmiyor. */
  .orta {
    flex: 1;
    display: grid; grid-template-columns: 1fr auto; gap: 18mm;
    align-items: center; padding: 0 0 6mm;
  }
  .ortaMetin { min-width: 0; }

  /* Mühür SAĞDA ve büyük. İlk denemede küçük ve solda duruyordu: sayfanın sağ
     yarısı tamamen boş kalıyor ve belge bitmemiş görünüyordu. Basıp bakmadan
     görülmeyen cinsten bir denge sorunu. */
  .muhurSutun { display: flex; align-items: center; justify-content: center; }

  .etiket {
    font-family: 'Pixel', monospace;
    font-size: 7.5pt; letter-spacing: 2px; color: ${RENK.mavi};
    margin-bottom: 11mm;
  }

  .giris { font-size: 12pt; color: ${RENK.soluk}; letter-spacing: 0.2px; }

  /* Ad: belgenin tek gerçek kahramanı. Uzun adlarda küçülüyor ama satırı
     asla taşırmıyor — clamp() yerine iki basamak, çünkü yazdırma motorları
     viewport birimlerine güvenilmez cevap veriyor. */
  .ad {
    font-size: 46pt; font-weight: 800; letter-spacing: -1.6px; line-height: 1.06;
    color: ${RENK.lacivert}; margin: 6mm 0 0;
    word-break: break-word;
  }
  .ad.uzun { font-size: 34pt; letter-spacing: -1px; }
  .ad.cokUzun { font-size: 26pt; letter-spacing: -0.6px; }

  .altCizgi { width: 74mm; height: 1.6pt; background: ${RENK.mavi}; margin: 9mm 0 10mm; }

  .aciklama { font-size: 13pt; line-height: 1.85; color: ${RENK.metin}; max-width: 158mm; }
  .aciklama .etkinlik { font-weight: 800; color: ${RENK.lacivert700}; }
  .aciklama .tarih { font-weight: 600; }

  .altAyrac { height: 0.5pt; background: ${RENK.mavi200}; margin-bottom: 7mm; }
  .alt { display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; }
  .imza { min-width: 66mm; }
  .imza .cizgi { height: 0.8pt; background: ${RENK.lacivert}; margin-bottom: 3mm; }
  .imza .kim { font-size: 9.5pt; font-weight: 600; color: ${RENK.lacivert}; }
  .imza .rol { font-size: 8pt; color: ${RENK.soluk}; margin-top: 2px; letter-spacing: 0.3px; }

  .dogrula { display: flex; align-items: flex-end; gap: 5mm; }
  .dogrula .yazi { text-align: right; font-size: 7.5pt; line-height: 1.6; color: ${RENK.soluk}; max-width: 62mm; }
  .dogrula .yazi b { display: block; color: ${RENK.lacivert700}; font-weight: 600; font-size: 8pt; }
  .dogrula .kod { width: 20mm; height: 20mm; }
  .dogrula .kod svg { width: 100%; height: 100%; display: block; }

  .kareSeridi { display: flex; gap: 3px; margin-bottom: 5mm; }
  .kareSeridi i { display: block; border-radius: 1px; }
</style>
</head>
<body>
  <div class="sayfa">
    <div class="bant">
      <div class="kareler">${kareSiraso(9, RENK.mavi, 5)}</div>
      <div class="marka">Kocaeli Üniversitesi</div>
    </div>

    <div class="cerceve">
      <div class="doku"></div>
      <i class="kose sü"></i><i class="kose sa"></i><i class="kose al"></i><i class="kose ar"></i>
    </div>

    <div class="icerik">
      <div class="ust">
        <div class="kulup">
          KOÜ Yazılım Kulübü
          <span>Kocaeli Üniversitesi</span>
        </div>
        <div class="belgeNo">
          BELGE NO
          <b>${esc(v.belgeNo)}</b>
        </div>
      </div>

      <div class="orta">
        <div class="ortaMetin">
          <div class="etiket">KATILIM BELGESİ</div>
          <div class="giris">Bu belge</div>
          <h1 class="${adSinifi(v.adSoyad)}">${esc(v.adSoyad)}</h1>
          <div class="altCizgi"></div>
          <p class="aciklama">
            adlı katılımcının <span class="etkinlik">${esc(v.etkinlik)}</span> etkinliğine
            <span class="tarih">${esc(v.tarih)}</span> tarihinde katıldığını belgeler.
          </p>
        </div>
        <div class="muhurSutun">${muhur(34)}</div>
      </div>

      <div class="altAyrac"></div>
      <div class="alt">
        <div class="imza">
          <div class="kareSeridi">${kareSiraso(14, RENK.mavi200, 4)}</div>
          <div class="cizgi"></div>
          <div class="kim">KOÜ Yazılım Kulübü</div>
          <div class="rol">Etkinlik düzenleyicisi</div>
        </div>
        <div class="dogrula">
          <div class="yazi">
            <b>Belgeyi doğrulayın</b>
            ${esc(v.dogrulamaUrl)}
          </div>
          ${v.qrSvg ? `<div class="kod">${v.qrSvg}</div>` : ''}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Ada göre punto sınıfı.
 *
 * Uzun ad çerçeveyi taşırırsa belge bozuk görünür ve bunu ancak o adın sahibi
 * fark eder — yani hiç fark edilmez. İki basamak, `clamp()` ya da viewport
 * birimi değil: yazdırma motorlarının viewport birimlerine verdiği cevap
 * güvenilir değil ve PDF'te sayfa dışına taşan bir satır geri alınamıyor.
 */
export function adSinifi(ad: string): 'ad' | 'ad uzun' | 'ad cokUzun' {
  const n = (ad ?? '').trim().length;
  if (n <= 22) return 'ad';
  if (n <= 34) return 'ad uzun';
  return 'ad cokUzun';
}
