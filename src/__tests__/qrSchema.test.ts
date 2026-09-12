import {
  QR_ALPHABET,
  QR_TOKEN_LENGTH,
  attendanceId,
  defaultWindow,
  isQrToken,
  makeQrToken,
  parseQrPayload,
  qrPayload,
  windowOpen,
} from '../qrSchema';

/** Sayaç gibi artan sahte rastgelelik — çıktı öngörülebilir olsun. */
function sayac(baslangic = 0) {
  let n = baslangic;
  return (adet: number) => Uint8Array.from({ length: adet }, () => n++ % 256);
}

describe('makeQrToken', () => {
  it('istenen uzunlukta ve yalnızca alfabeden', () => {
    const t = makeQrToken(sayac());
    expect(t).toHaveLength(QR_TOKEN_LENGTH);
    expect(isQrToken(t)).toBe(true);
    for (const c of t) expect(QR_ALPHABET).toContain(c);
  });

  // ASIL MESELE: 256, 31'e tam bölünmüyor. Aralık dışındaki baytlar atılmazsa
  // alfabenin ilk sekiz harfi diğerlerinden sık çıkar — jeton tahmin edilebilir
  // olmasa da entropi ilan edilenden düşük olurdu.
  it('modulo sapması için bayt atıyor', () => {
    // 248..255 aralığı (256 - 256%31 = 248) atılmalı; hepsi o aralıktaysa
    // üretici yeni bayt istemek zorunda.
    let cagri = 0;
    const hepsiYuksek = (adet: number) => {
      cagri += 1;
      // İlk havuz tamamen atılacak baytlardan, ikincisi kullanılabilir.
      return cagri === 1
        ? Uint8Array.from({ length: adet }, () => 250)
        : Uint8Array.from({ length: adet }, () => 0);
    };
    const t = makeQrToken(hepsiYuksek);
    expect(cagri).toBeGreaterThan(1);
    expect(t).toBe(QR_ALPHABET[0].repeat(QR_TOKEN_LENGTH));
  });

  it('farklı rastgelelik farklı jeton veriyor', () => {
    expect(makeQrToken(sayac(0))).not.toBe(makeQrToken(sayac(7)));
  });

  it('karıştırılabilir karakter içermiyor', () => {
    for (const c of 'ILO01') expect(QR_ALPHABET).not.toContain(c);
  });
});

describe('parseQrPayload', () => {
  const TOKEN = 'ABCDEFGHJKMN';
  const ADRES = qrPayload('https://mobil.kouseng.com', 'git-atolyesi', TOKEN);

  it('QR adresini çözüyor', () => {
    expect(parseQrPayload(ADRES)).toEqual({ eventId: 'git-atolyesi', token: TOKEN });
  });

  it('sondaki eğik çizgi, sorgu ve parça sorun değil', () => {
    expect(parseQrPayload(`${ADRES}/`)).toEqual({ eventId: 'git-atolyesi', token: TOKEN });
    expect(parseQrPayload(`${ADRES}?utm=afis`)).toEqual({ eventId: 'git-atolyesi', token: TOKEN });
    expect(parseQrPayload(`${ADRES}#x`)).toEqual({ eventId: 'git-atolyesi', token: TOKEN });
  });

  it('çıplak biçimi de kabul ediyor', () => {
    expect(parseQrPayload(`git-atolyesi.${TOKEN}`)).toEqual({ eventId: 'git-atolyesi', token: TOKEN });
  });

  // Tanımadığı hiçbir şeyi geçirmemeli: kamera her QR'ı okuyor, çoğu bize ait değil.
  it('alakasız QR içerikleri null', () => {
    for (const kotu of [
      '',
      '   ',
      'https://ornek.com',
      'WIFI:S:kouseng;T:WPA;P:parola;;',
      'javascript:alert(1)',
      'https://mobil.kouseng.com/qr/git-atolyesi/KISA',
      'https://mobil.kouseng.com/qr/GIT-ATOLYESI/' + TOKEN,
      'git-atolyesi.' + TOKEN.toLowerCase(),
      'https://mobil.kouseng.com/hesap-sil',
    ]) {
      expect(parseQrPayload(kotu)).toBeNull();
    }
  });

  // Alfabede olmayan harf içeren jeton, uzunluğu tutsa da geçmemeli.
  it('alfabe dışı karakterli jetonu reddediyor', () => {
    expect(parseQrPayload('git-atolyesi.ABCDEFGHJKM0')).toBeNull();
    expect(parseQrPayload('git-atolyesi.ABCDEFGHJKMI')).toBeNull();
  });
});

describe('defaultWindow', () => {
  it('bir saat önce açılıyor, günün sonunda kapanıyor', () => {
    expect(defaultWindow('2026-03-12T18:00:00+03:00')).toEqual({
      opensAt: '2026-03-12T17:00:00+03:00',
      closesAt: '2026-03-12T23:59:59+03:00',
    });
  });

  // ASIL MESELE: kapanış etkinliğin bitişi DEĞİL, günün sonu. Salonun interneti
  // en yoğun anda en kötü; pencere erken kapansaydı akşam bağlantıya kavuşan
  // telefonun yeniden denemesi kalıcı olarak reddedilirdi.
  it('kapanış etkinlik saatine değil güne bağlı', () => {
    const erken = defaultWindow('2026-03-12T09:00:00+03:00');
    const gec = defaultWindow('2026-03-12T21:30:00+03:00');
    expect(erken?.closesAt).toBe(gec?.closesAt);
  });

  it('gece yarısına yakın etkinlikte bir önceki güne taşmıyor', () => {
    expect(defaultWindow('2026-03-12T00:30:00+03:00')).toEqual({
      opensAt: '2026-03-12T00:00:00+03:00',
      closesAt: '2026-03-12T23:59:59+03:00',
    });
  });

  it('okunamayan tarihte null', () => {
    expect(defaultWindow('')).toBeNull();
    expect(defaultWindow('2026-03-12T18:00')).toBeNull();
  });
});

describe('windowOpen', () => {
  const p = { opensAt: '2026-03-12T17:00:00+03:00', closesAt: '2026-03-12T23:59:59+03:00' };

  it('pencerenin içi açık, dışı kapalı', () => {
    expect(windowOpen(new Date('2026-03-12T18:00:00+03:00'), p)).toBe(true);
    expect(windowOpen(new Date('2026-03-12T16:59:00+03:00'), p)).toBe(false);
    expect(windowOpen(new Date('2026-03-13T00:30:00+03:00'), p)).toBe(false);
  });

  it('sınırlar dâhil', () => {
    expect(windowOpen(new Date('2026-03-12T17:00:00+03:00'), p)).toBe(true);
    expect(windowOpen(new Date('2026-03-12T23:59:59+03:00'), p)).toBe(true);
  });

  // Eksik ya da bozuk pencerede KAPALI: burada hata yönü açık olmalı, çünkü
  // "açık" sanmak yoklamayı sonsuza kadar açık bırakır.
  it('eksik ya da bozuk pencerede kapalı', () => {
    expect(windowOpen(new Date('2026-03-12T18:00:00+03:00'), null)).toBe(false);
    expect(windowOpen(new Date('2026-03-12T18:00:00+03:00'), {})).toBe(false);
    expect(windowOpen(new Date('2026-03-12T18:00:00+03:00'), { opensAt: 'x', closesAt: 'y' })).toBe(false);
  });

  // Cihazın saat dilimi kararı DEĞİŞTİRMEMELİ: pencere +03:00 damgalı, Date.parse
  // mutlak anı okuyor.
  it('aynı anı farklı yazımlarda aynı sayıyor', () => {
    expect(windowOpen(new Date('2026-03-12T15:00:00Z'), p)).toBe(true);
  });
});

describe('attendanceId', () => {
  it('etkinlik ve kullanıcıyı birleştiriyor', () => {
    expect(attendanceId('git-atolyesi', 'uid123')).toBe('git-atolyesi__uid123');
  });
});
