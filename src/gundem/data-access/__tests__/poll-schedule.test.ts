import {
  ENRICHMENT_POLL_SCHEDULE_SECONDS,
  ENRICHMENT_POLL_WINDOW_SECONDS,
  enrichmentPollDelayMs,
  enrichmentStalledMessage,
} from '../hooks';

/**
 * Bu dosya bir cihaz ölçümünden doğdu.
 *
 * Eski hâl 6 yoklamayı 5 saniye arayla yapıp 30 saniyede pes ediyordu, ve
 * sunucudaki özetleme worker'ı iki dakikada bir çalışıyor. Yani istemci, işi
 * alacak worker daha bir kez bile çalışmadan vazgeçiyordu — kullanıcı sonsuza
 * kadar "Özet hazırlanıyor" görüyordu, log da "still queued after 6 polls (no
 * reason given)" diyordu. Söylenecek bir sebep yoktu; iş sırasını bekliyordu.
 *
 * Korunan şey tek bir eşitsizlik: **yoklama penceresi > sunucunun cron
 * periyodu.** Aşağıdaki ilk test o eşitsizliği yazıyor.
 */

/** Sunucunun özetleme cron'u iki dakikada bir koşuyor (RUNBOOK). */
const SERVER_CRON_PERIOD_SECONDS = 120;

describe('enrichment poll schedule', () => {
  /**
   * Asıl test. Pencere cron periyodundan kısaysa istemci hiçbir şey beklemiyor
   * demektir — ve bu, hiçbir hata üretmeden özetin hiç gelmemesi olarak görünür.
   */
  it('waits longer than the server needs to pick the job up', () => {
    expect(ENRICHMENT_POLL_WINDOW_SECONDS).toBeGreaterThan(SERVER_CRON_PERIOD_SECONDS);
  });

  it('covers two cron periods, so one missed run is not fatal', () => {
    expect(ENRICHMENT_POLL_WINDOW_SECONDS).toBeGreaterThanOrEqual(SERVER_CRON_PERIOD_SECONDS * 2);
  });

  /**
   * Pencereyi genişletmenin yanlış yolu sıklığı artırmak: her yoklama sunucuda
   * cihaz başına bir hız-sınırı kovasına yazıyor, yani sık yoklamak kullanıcının
   * günlük hakkını yakıyor.
   */
  it('widens the window without adding requests', () => {
    expect(ENRICHMENT_POLL_SCHEDULE_SECONDS.length).toBeLessThanOrEqual(8);
  });

  it('starts fast — the summary may already be cached', () => {
    expect(ENRICHMENT_POLL_SCHEDULE_SECONDS[0]).toBeLessThanOrEqual(5);
  });

  it('never gets faster as it goes', () => {
    for (let i = 1; i < ENRICHMENT_POLL_SCHEDULE_SECONDS.length; i += 1) {
      expect(ENRICHMENT_POLL_SCHEDULE_SECONDS[i]).toBeGreaterThanOrEqual(
        ENRICHMENT_POLL_SCHEDULE_SECONDS[i - 1],
      );
    }
  });
});

describe('enrichmentPollDelayMs', () => {
  it('returns each scheduled delay in milliseconds', () => {
    ENRICHMENT_POLL_SCHEDULE_SECONDS.forEach((seconds, index) => {
      expect(enrichmentPollDelayMs(index)).toBe(seconds * 1000);
    });
  });

  /**
   * `null` "durdur" demek. Bir sayı dönseydi — sıfır bile — TanStack Query onu
   * bir aralık sanıp yoklamayı sonsuza kadar sürdürürdü, ve bu görünmez bir pil
   * tüketimi olurdu.
   */
  it('returns null past the end of the schedule, not a number', () => {
    const end = ENRICHMENT_POLL_SCHEDULE_SECONDS.length;
    expect(enrichmentPollDelayMs(end)).toBeNull();
    expect(enrichmentPollDelayMs(end + 10)).toBeNull();
  });
});

/**
 * Sunucu neden beklediğini söylüyor; ekran da söylemeli.
 *
 * Sebep zaten taşınıyordu (`{status:'queued', reason}`) ve yalnızca
 * `console.warn`'a yazılıyordu — bir release derlemesinde konsol yok, yani
 * kullanıcıya ulaşan tek şey sonsuza kadar dönen bir göstergeydi. Bu, defterdeki
 * `ContentNotice` maddesiyle aynı sınıf: her sebebe aynı cümleyi söylemek.
 */
describe('enrichmentStalledMessage', () => {
  it('üç sebep için üç ayrı cümle veriyor', () => {
    const failed = enrichmentStalledMessage('previous_attempt_failed');
    const noKey = enrichmentStalledMessage('no_api_key');
    const queued = enrichmentStalledMessage(null);

    expect(new Set([failed, noKey, queued]).size).toBe(3);
  });

  it('hiçbir sebepte "hazırlanıyor" demiyor — yoklama durdu, hazırlanmıyor', () => {
    for (const reason of ['previous_attempt_failed', 'no_api_key', null, undefined]) {
      expect(enrichmentStalledMessage(reason)).not.toContain('hazırlanıyor');
    }
  });

  it('bilinmeyen ya da eksik sebepte de bir cümle veriyor', () => {
    for (const reason of [null, undefined, '', 'sunucudan_yeni_gelen_sebep']) {
      expect(enrichmentStalledMessage(reason).length).toBeGreaterThan(0);
    }
  });

  /**
   * Ölü bir iş için "bekleyin" demek yanlış yönlendirme: o iş denemelerini
   * tüketti ve kendiliğinden ilerlemeyecek.
   */
  it('previous_attempt_failed için üretilemediğini söylüyor', () => {
    expect(enrichmentStalledMessage('previous_attempt_failed')).toContain('üretilemedi');
  });
});
