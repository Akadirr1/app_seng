import { DEFAULT_FIELDS, isRaffle } from '../raffleSchema';

/**
 * Bu dosya cihazdan gelen bir rapordan doğdu: **"normal etkinliklerde bile
 * çekiliş ibaresi çıkıyor."**
 *
 * Sebep ekran değildi — etkinlik detayı beyanı zaten `getRaffle(event.id)` ile
 * kapılıyor. Sebep kapının neye baktığıydı: `raffles/{eventId}` dokümanının
 * yalnızca VAR OLMASI yetiyordu, içeriğine bakılmıyordu. İçi boş ya da yarım
 * kalmış bir doküman normal bir etkinliği çekilişe çeviriyordu.
 *
 * Kapı artık panelin kabul ettiği üç alanla aynı hizada.
 */

const gecerli = () => ({
  eventId: 'ev1',
  fields: DEFAULT_FIELDS,
  winnerCount: 3,
  entriesCloseAt: '2026-10-01T18:00:00+03:00',
  winners: [],
  drawnAt: '',
});

describe('isRaffle', () => {
  it('panelin kaydettiği tam tanımı kabul ediyor', () => {
    expect(isRaffle(gecerli())).toBe(true);
  });

  /**
   * Asıl regresyon: bu doküman var, ama çekiliş değil. Eskiden `getRaffle`
   * onu döndürüyor ve ekran 5.3.1 beyanını çiziyordu.
   */
  it('boş dokümanı çekiliş saymıyor', () => {
    expect(isRaffle({})).toBe(false);
    expect(isRaffle({ eventId: 'ev1' })).toBe(false);
  });

  it('panelin zorunlu tuttuğu üç alandan biri eksikse reddediyor', () => {
    for (const eksik of ['fields', 'winnerCount', 'entriesCloseAt'] as const) {
      const doc: Record<string, unknown> = gecerli();
      delete doc[eksik];
      expect(isRaffle(doc)).toBe(false);
    }
  });

  it('boş alan listesini reddediyor — sorulacak bir şey yoksa form da yok', () => {
    expect(isRaffle({ ...gecerli(), fields: [] })).toBe(false);
  });

  it('kazanan sayısı tam ve en az 1 olmalı', () => {
    for (const sayi of [0, -1, 1.5, '3']) {
      expect(isRaffle({ ...gecerli(), winnerCount: sayi })).toBe(false);
    }
  });

  it('boş son katılım tarihini reddediyor', () => {
    expect(isRaffle({ ...gecerli(), entriesCloseAt: '' })).toBe(false);
  });

  /**
   * `winners` ve `drawnAt` kapıya dâhil DEĞİL: ikisi de çekiliş çekildikten
   * sonra doluyor. Yoklukları "henüz çekilmedi" demek, "çekiliş değil" değil —
   * kapıya alınsalardı hiç çekilmemiş bir çekiliş uygulamada görünmezdi.
   */
  it('henüz çekilmemiş bir çekilişi düşürmüyor', () => {
    const doc: Record<string, unknown> = gecerli();
    delete doc.winners;
    delete doc.drawnAt;
    expect(isRaffle(doc)).toBe(true);
  });

  it('nesne olmayan değerlerde patlamıyor', () => {
    for (const deger of [null, undefined, 'x', 3, [], true]) {
      expect(isRaffle(deger)).toBe(false);
    }
  });
});
