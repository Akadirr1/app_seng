/**
 * Doğrulama kodu istemcisinin **kabloya** bakışı.
 *
 * Buradaki asıl iddia bir kullanıcı raporundan geliyor: panel eski sürümde
 * kalmışken uygulama "Kodu e-postana gönderdik" yazıyordu ve hiç posta
 * gitmiyordu. Sebebi, uç noktayı tanımayan panelin isteği giriş duvarına
 * düşürüp `/login`'e yönlendirmesi — `fetch` yönlendirmeyi takip ediyor,
 * elimize 200 + HTML geliyor, ve gövdeye bakmayan istemci bunu başarı
 * sayıyordu.
 */
jest.mock('../data', () => ({ PANEL_BASE_URL: 'https://panel.example' }));
jest.mock('../auth', () => ({
  currentUser: () => ({ getIdToken: async () => 'sahte-jeton' }),
}));

import { OtpHata, kodIste, otpMesaj } from '../otp';

function cevapla(init: { ok: boolean; body: string; json: boolean }) {
  global.fetch = jest.fn(async () => ({
    ok: init.ok,
    json: async () => {
      if (!init.json) throw new SyntaxError('Unexpected token <');
      return JSON.parse(init.body) as unknown;
    },
  })) as unknown as typeof fetch;
}

describe('kodIste', () => {
  it('gerçek cevabı geçiriyor', async () => {
    cevapla({ ok: true, json: true, body: '{"durum":"gonderildi","saniye":600}' });
    await expect(kodIste()).resolves.toBe('gonderildi');
  });

  it('zaten doğrulanmış hesabı ayırıyor', async () => {
    cevapla({ ok: true, json: true, body: '{"durum":"zaten_dogrulandi"}' });
    await expect(kodIste()).resolves.toBe('zaten_dogrulandi');
  });

  // ESKİ HÂL BURADA 'gonderildi' DÖNÜYORDU.
  it('200 + HTML başarı sayılmıyor — panel eski', async () => {
    cevapla({ ok: true, json: false, body: '<!doctype html><title>Giriş</title>' });
    await expect(kodIste()).rejects.toMatchObject({ kod: 'panel_eski' });
  });

  // Gövde JSON ama bizim sözleşmemiz değil: yine başarı değil.
  it('tanımadığı JSON gövdeyi de başarı saymıyor', async () => {
    cevapla({ ok: true, json: true, body: '{"message":"ok"}' });
    await expect(kodIste()).rejects.toMatchObject({ kod: 'panel_eski' });
  });

  it('sunucunun hata kodunu taşıyor', async () => {
    cevapla({ ok: false, json: true, body: '{"hata":"bekle","saniye":42}' });
    await expect(kodIste()).rejects.toMatchObject({ kod: 'bekle', saniye: 42 });
  });

  // Hata kodu okunamıyorsa bile ekran bir cümle göstermeli.
  it('her hata bir cümleye çevriliyor', () => {
    expect(otpMesaj(new OtpHata('panel_eski'))).toContain('tanımadı');
    expect(otpMesaj(new OtpHata('bekle', 30))).toContain('30');
    expect(otpMesaj(new Error('alakasız'))).toBeTruthy();
  });
});
