import {
  MIN_AGE,
  MIN_PASSWORD,
  ageOn,
  digits,
  joinDate,
  splitDate,
  formatPhone,
  isValidSignup,
  normalizeEmail,
  normalizePhone,
  toProfile,
  validateSignup,
  type SignupInput,
} from '../accountSchema';

const TODAY = new Date(2026, 8, 12); // 12 Eylül 2026

const gecerli: SignupInput = {
  adSoyad: 'Elif Yılmaz',
  email: 'Elif.Yilmaz@Example.com',
  dogumTarihi: '2004-05-20',
  telefon: '0555 123 45 67',
  ogrenciNo: '210201045',
  parola: 'cokgizliparola',
  kvkkOnay: true,
  kosullarOnay: true,
};

describe('normalizePhone', () => {
  // Asıl mesele bu: aynı numaranın üç yazımı tek kayda inmeli, yoksa aynı
  // kişi üç farklı hesap gibi görünür.
  it('üç yazımı da aynı numaraya indirger', () => {
    const beklenen = '+905551234567';
    expect(normalizePhone('5551234567')).toBe(beklenen);
    expect(normalizePhone('0555 123 45 67')).toBe(beklenen);
    expect(normalizePhone('+90 555 123 45 67')).toBe(beklenen);
    expect(normalizePhone('(0555) 123-45-67')).toBe(beklenen);
  });

  it('Türkiye cep numarası olmayanı reddeder', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('555123456')).toBeNull(); // bir hane eksik
    expect(normalizePhone('55512345678')).toBeNull(); // bir hane fazla
    expect(normalizePhone('0212 123 45 67')).toBeNull(); // sabit hat
    expect(normalizePhone('+1 555 123 4567')).toBeNull(); // başka ülke
    expect(normalizePhone('abc')).toBeNull();
  });

  it('formatPhone normalleştirilmiş numarayı okunur yazar', () => {
    expect(formatPhone('+905551234567')).toBe('+90 555 123 45 67');
  });
});

describe('normalizeEmail', () => {
  it('kırpıp küçültür', () => {
    expect(normalizeEmail('  Elif@Example.COM ')).toBe('elif@example.com');
  });

  // Bu deponun genel kuralı Türkçe küçültme; burada bilerek uygulanmıyor.
  // `toLocaleLowerCase('tr')` olsaydı `I` harfi `ı` olur ve adres bozulurdu.
  it('I harfini Türkçe küçültmez — adres ASCII', () => {
    expect(normalizeEmail('ADMIN@KOUSENG.COM')).toBe('admin@kouseng.com');
    expect(normalizeEmail('ADMIN@KOUSENG.COM')).not.toContain('ı');
  });
});

describe('ageOn', () => {
  it('doğum gününden önce bir yaş küçük sayar', () => {
    // 13 Eylül doğumlu, bugün 12 Eylül: daha doğum günü gelmedi.
    expect(ageOn('2013-09-13', TODAY)).toBe(12);
    expect(ageOn('2013-09-12', TODAY)).toBe(13);
    expect(ageOn('2013-09-11', TODAY)).toBe(13);
  });

  // `new Date(2025, 1, 31)` sessizce 3 Mart oluyor. Alanları geri okumadan
  // var olmayan bir tarih geçerli sayılırdı.
  it('var olmayan tarihi reddeder', () => {
    expect(ageOn('2025-02-31', TODAY)).toBeNull();
    expect(ageOn('2025-13-01', TODAY)).toBeNull();
    expect(ageOn('2025-00-10', TODAY)).toBeNull();
    expect(ageOn('20250210', TODAY)).toBeNull();
    expect(ageOn('', TODAY)).toBeNull();
  });

  it('artık yılın 29 Şubat’ını kabul eder', () => {
    expect(ageOn('2024-02-29', TODAY)).toBe(2);
    expect(ageOn('2025-02-29', TODAY)).toBeNull();
  });
});

describe('validateSignup', () => {
  it('geçerli form hiç hata üretmiyor', () => {
    expect(validateSignup(gecerli, TODAY)).toEqual({});
    expect(isValidSignup(gecerli, TODAY)).toBe(true);
  });

  it('ad soyad tek parçaysa reddediyor', () => {
    // Sertifikaya basılan alan bu; tek kelime "Elif" bir sertifikada eksik.
    expect(validateSignup({ ...gecerli, adSoyad: 'Elif' }, TODAY).adSoyad).toBeDefined();
    expect(validateSignup({ ...gecerli, adSoyad: '   ' }, TODAY).adSoyad).toBeDefined();
    expect(validateSignup({ ...gecerli, adSoyad: 'Ali Öz' }, TODAY).adSoyad).toBeUndefined();
  });

  it('yaş sınırının iki tarafını da ayırıyor', () => {
    const dogumGunuBugun = `${TODAY.getFullYear() - MIN_AGE}-09-12`;
    const birGunSonra = `${TODAY.getFullYear() - MIN_AGE}-09-13`;
    expect(validateSignup({ ...gecerli, dogumTarihi: dogumGunuBugun }, TODAY).dogumTarihi)
      .toBeUndefined();
    expect(validateSignup({ ...gecerli, dogumTarihi: birGunSonra }, TODAY).dogumTarihi)
      .toBeDefined();
  });

  // Numara sertifikaya yazılıyor ve tek hesaba bağlanıyor; biçimi tutmayan
  // bir değer ikisini de anlamsız kılar.
  it('öğrenci numarası tam dokuz hane', () => {
    for (const yanlis of ['', '12345678', '1234567890', '21020104a', '21020 1045']) {
      expect(validateSignup({ ...gecerli, ogrenciNo: yanlis }, TODAY).ogrenciNo).toBeDefined();
    }
    expect(validateSignup({ ...gecerli, ogrenciNo: '210201045' }, TODAY).ogrenciNo).toBeUndefined();
    // Yapıştırılan değerin başına/sonuna kaçan boşluk hata değil: telefonla
    // aynı karar — girdide hoşgörülü, saklamada tek biçim.
    expect(validateSignup({ ...gecerli, ogrenciNo: ' 210201045 ' }, TODAY).ogrenciNo).toBeUndefined();
    expect(toProfile({ ...gecerli, ogrenciNo: ' 210201045 ' }, TODAY).ogrenciNo).toBe('210201045');
  });

  it('kısa parolayı reddediyor', () => {
    expect(validateSignup({ ...gecerli, parola: 'a'.repeat(MIN_PASSWORD - 1) }, TODAY).parola)
      .toBeDefined();
    expect(validateSignup({ ...gecerli, parola: 'a'.repeat(MIN_PASSWORD) }, TODAY).parola)
      .toBeUndefined();
  });

  // Onay kutuları KVKK ve mağaza tarafının istediği şey; işaretlenmeden
  // hesap açılabiliyorsa onay diye bir şey yok demektir.
  it('iki onay da ayrı ayrı zorunlu', () => {
    expect(validateSignup({ ...gecerli, kvkkOnay: false }, TODAY).kvkkOnay).toBeDefined();
    expect(validateSignup({ ...gecerli, kosullarOnay: false }, TODAY).kosullarOnay).toBeDefined();
    expect(isValidSignup({ ...gecerli, kvkkOnay: false }, TODAY)).toBe(false);
  });

  it('her alan kendi hatasını veriyor', () => {
    const hepsiBozuk = validateSignup(
      {
        adSoyad: '',
        email: 'x',
        dogumTarihi: '',
        telefon: '',
        ogrenciNo: '',
        parola: '',
        kvkkOnay: false,
        kosullarOnay: false,
      },
      TODAY,
    );
    // Tek bir "geçersiz" bayrağı kullanıcıya hangi alanı düzelteceğini söylemiyor.
    expect(Object.keys(hepsiBozuk).sort()).toEqual(
      ['adSoyad', 'dogumTarihi', 'email', 'kosullarOnay', 'kvkkOnay', 'ogrenciNo', 'parola', 'telefon'].sort(),
    );
  });
});

describe('doğum tarihi kutuları', () => {
  // ASIL MESELE: eski hâl her tuş vuruşunda sıfırla tamamlıyordu. Yıla `2`
  // yazınca değer `0002` oluyor, dört hane kutuya geri basılıyor ve
  // `maxLength={4}` dolduğu için klavye beşinci haneyi kabul etmiyordu —
  // alan kullanılamaz hâle geliyordu. Yarım girdi boş dönmek ZORUNDA.
  it('yarım girdide boş dönüyor — hiçbir hane kendiliğinden belirmiyor', () => {
    expect(joinDate({ gun: '', ay: '', yil: '2' })).toBe('');
    expect(joinDate({ gun: '2', ay: '', yil: '' })).toBe('');
    expect(joinDate({ gun: '20', ay: '05', yil: '' })).toBe('');
    expect(joinDate({ gun: '', ay: '', yil: '' })).toBe('');
  });

  // Yarım girdi boş döndüğü için geri okuma da boş: kutulara `0002` yazılamaz.
  it('yarım girdi kutulara geri yazılamıyor', () => {
    const yarim = joinDate({ gun: '', ay: '', yil: '2' });
    expect(splitDate(yarim)).toEqual({ gun: '', ay: '', yil: '' });
    // Eski hâlde burası `{ yil: '0002', ay: '00', gun: '00' }` dönüyordu ve
    // kutu dolu göründüğü için kullanıcı yazmaya devam edemiyordu.
    expect(splitDate(yarim).yil).not.toBe('0002');
  });

  it('üçü de doluyken tamamlıyor', () => {
    expect(joinDate({ gun: '20', ay: '05', yil: '2005' })).toBe('2005-05-20');
    // Tek haneli gün/ay elle yazılabilmeli: 1 Mayıs için `01` yazmak şart değil.
    expect(joinDate({ gun: '1', ay: '5', yil: '2005' })).toBe('2005-05-01');
  });

  it('tam tarih kutulara ham hâliyle geri dönüyor', () => {
    expect(splitDate('2005-05-20')).toEqual({ gun: '20', ay: '05', yil: '2005' });
  });

  it('gidiş dönüş kayıpsız', () => {
    const parts = { gun: '20', ay: '05', yil: '2005' };
    expect(splitDate(joinDate(parts))).toEqual(parts);
  });

  it('digits yalnızca rakam alıyor ve kesiyor', () => {
    expect(digits('2a0', 2)).toBe('20');
    expect(digits('20055', 4)).toBe('2005');
    expect(digits('--', 2)).toBe('');
  });

  // Tamamlanan tarih doğrulamadan da geçmeli, yoksa kullanıcı doğru yazıp
  // yine de "doğum tarihinizi seçin" görür.
  it('tamamlanan tarih doğrulamadan geçiyor', () => {
    const tarih = joinDate({ gun: '20', ay: '5', yil: '2005' });
    expect(validateSignup({ ...gecerli, dogumTarihi: tarih }, TODAY).dogumTarihi).toBeUndefined();
  });
});

describe('toProfile', () => {
  const now = new Date('2026-09-12T10:00:00.000Z');

  it('ham formu değil normalleştirilmiş hâli yazıyor', () => {
    const p = toProfile(gecerli, now);
    expect(p.email).toBe('elif.yilmaz@example.com');
    expect(p.telefon).toBe('+905551234567');
    expect(p.adSoyad).toBe('Elif Yılmaz');
  });

  it('öğrenci numarasını profile taşıyor', () => {
    expect(toProfile(gecerli, now).ogrenciNo).toBe('210201045');
  });

  it('araya kaçmış boşlukları tekleştiriyor', () => {
    expect(toProfile({ ...gecerli, adSoyad: '  Elif   Nur  Yılmaz ' }, now).adSoyad)
      .toBe('Elif Nur Yılmaz');
  });

  it('onay zamanlarını kaydediyor — KVKK kanıt istiyor', () => {
    const p = toProfile(gecerli, now);
    expect(p.kvkkOnayAt).toBe('2026-09-12T10:00:00.000Z');
    expect(p.kosullarOnayAt).toBe('2026-09-12T10:00:00.000Z');
  });
});
