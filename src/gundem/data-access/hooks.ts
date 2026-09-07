import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DataError } from '../domain/errors';
import type { Cursor, EnrichmentResult } from '../domain/types';
import { getRepositories } from './index';
import { queryKeys, type FeedFilter } from './queryKeys';
import type { Repositories } from './repositories';

/**
 * Query hooks over the seam. They call `getRepositories()`, so the same hook
 * serves mock and Supabase mode — screens (P7) never learn which is active.
 *
 * A repository returns `Result<T>`; a query needs a thrown error to enter its
 * error state, so `unwrap` converts one into the other at exactly one place.
 */

/** Thrown only inside a query function, so React Query can catch it. */
export class DataErrorThrown extends Error {
  readonly error: DataError;
  constructor(error: DataError) {
    super(error.message);
    this.name = 'DataErrorThrown';
    this.error = error;
  }
}

export const asDataError = (thrown: unknown): DataError | null =>
  thrown instanceof DataErrorThrown ? thrown.error : null;

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: DataError }): T {
  if (!result.ok) throw new DataErrorThrown(result.error);
  return result.data;
}

/** Retry only what the server said is worth retrying. */
const retryPolicy = (failureCount: number, thrown: unknown): boolean => {
  const error = asDataError(thrown);
  if (error && !error.retryable) return false;
  return failureCount < 2;
};

/**
 * No React Query retries on the PostgREST read path (P10 N2).
 *
 * postgrest-js already retries a GET itself — 503/520 and transport failures,
 * three attempts, 1 s/2 s/4 s — so by the time a `Result` comes back the request
 * has been tried four times over ~7 s. Layering this hook's two retries on top
 * (plus React Query's own 1 s/2 s backoff) pushed the worst case to ~24 s of
 * spinner before the offline banner appeared. With retries left to the one layer
 * that already does them, the worst case is a single ~7 s cycle.
 *
 * Measured with the fake PostgREST in `src/__tests__/integration.test.tsx`:
 * a failing refetch used to cost 4 repository calls, now 1.
 */
const READ_RETRY = 0;

export const useRepositories = (): Repositories => useMemo(() => getRepositories(), []);

export function useFeed(filter: FeedFilter = {}) {
  const repos = useRepositories();
  return useInfiniteQuery({
    queryKey: queryKeys.feed(filter),
    initialPageParam: null as Cursor | null,
    queryFn: ({ pageParam }) =>
      repos.feed
        .listArticles({
          cursor: pageParam,
          category: filter.category ?? null,
          ...(filter.sourceIds ? { sourceIds: filter.sourceIds } : {}),
        })
        .then(unwrap),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: READ_RETRY,
  });
}

export function useArticle(id: string | null | undefined) {
  const repos = useRepositories();
  return useQuery({
    queryKey: queryKeys.article(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => repos.feed.getArticle(id as string).then(unwrap),
    retry: retryPolicy,
  });
}

export function useSearch(query: string) {
  const repos = useRepositories();
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed),
    // A blank query is the "recent searches" state, not a request.
    enabled: trimmed.length > 0,
    queryFn: () => repos.feed.searchArticles({ query: trimmed }).then(unwrap),
    retry: READ_RETRY,
  });
}

export function useSources() {
  const repos = useRepositories();
  return useQuery({
    queryKey: queryKeys.sources(),
    queryFn: () => repos.sources.listSources().then(unwrap),
    // The catalog changes when someone adds a source, which is rare.
    staleTime: 30 * 60 * 1000,
    retry: retryPolicy,
  });
}

export function useDigest() {
  const repos = useRepositories();
  return useQuery({
    queryKey: queryKeys.digest(),
    queryFn: () => repos.digest.getLatestDigest().then(unwrap),
    retry: retryPolicy,
  });
}

/**
 * Yoklama takvimi (saniye). Sabit aralık yerine artan bir dizi, ve uzunluğu
 * keyfi değil.
 *
 * **Cihazda ölçüldü:** eski hâli 6 yoklamayı 5 saniye arayla yapıp 30 saniyede
 * pes ediyordu. Sunucudaki özetleme worker'ı ise iki dakikada bir çalışan bir cron'da
 * koşuyor (`every 2 minutes`) — yani istemci, işi alacak worker daha bir kez bile çalışmadan
 * vazgeçiyordu. Kullanıcının gördüğü şey "Özet hazırlanıyor" yazısının sonsuza
 * kadar orada kalmasıydı; logdaki satır da "still queued after 6 polls (no
 * reason given)" diyordu — çünkü söylenecek bir sebep yoktu, iş sırasını
 * bekliyordu.
 *
 * Yeni takvim iki cron periyodunu kapsıyor (290 saniye, ~4,8 dakika) ama bunu az
 * istekle yapıyor: 8 yoklama. Toplamı testin kendisi doğruluyor — ilk yazdığım
 * takvim 230 saniyeydi ve "iki periyot" iddiasını hesaplamadan yazmıştım; test
 * kırmızı verdi ve düzeltilen takvim oldu, iddia değil. Her yoklama sunucuda cihaz başına bir
 * hız-sınırı kovasına yazıyor, o yüzden pencereyi genişletmenin doğru yolu
 * sıklığı artırmak değil aralığı açmak.
 *
 * İlk iki yoklama yine hızlı: özet önbellekte olabilir ya da worker tam o an
 * çalışıyor olabilir.
 */
export const ENRICHMENT_POLL_SCHEDULE_SECONDS = [5, 10, 20, 30, 45, 60, 60, 60];

/**
 * `pollCount` kadar yoklama yapıldıktan sonraki bekleme (ms), ya da takvim
 * bittiyse `null`.
 *
 * Saf ve dışa açık: yoklama davranışı ekranı ya da ağı ayağa kaldırmadan
 * sınanabilecek tek şey, ve yanlış olduğunda kimse hata görmüyor — sadece özet
 * hiç gelmiyor.
 */
export function enrichmentPollDelayMs(pollCount: number): number | null {
  const seconds = ENRICHMENT_POLL_SCHEDULE_SECONDS[pollCount];
  return seconds === undefined ? null : seconds * 1000;
}

/** Toplam pencere, saniye — takvimin kendisinden türetiliyor. */
export const ENRICHMENT_POLL_WINDOW_SECONDS = ENRICHMENT_POLL_SCHEDULE_SECONDS.reduce(
  (total, seconds) => total + seconds,
  0,
);

/**
 * Yoklama bittiğinde ekranda yazacak cümle — sunucunun bildirdiği sebebe göre.
 *
 * **Neden saf bir fonksiyon:** teşhis zaten vardı ama yalnızca `console.warn`'a
 * gidiyordu, ve bu defterin kendi kuralı "bir release derlemesinin konsolu
 * yoktur". Yani sebep biliniyor, taşınıyor, loglanıyor ve ekrana hiç ulaşmıyordu
 * — `ContentNotice`'ın her sebebe "bağlantını kontrol et" demesiyle aynı sınıf.
 *
 * Sebepler sunucunun `QueuedReason`'ı: `no_api_key` ve `previous_attempt_failed`
 * (backend `_shared/enrichment.ts`). Üçüncü hâl `null`, ve o "sebep yok, iş
 * sırasını bekliyor" demek — kuyruk gerçekten uzun olabilir: worker iki
 * dakikada bir en fazla 3 iş alıyor (saatte 90) ve günlük tavan 200.
 */
export function enrichmentStalledMessage(reason: string | null | undefined): string {
  if (reason === 'previous_attempt_failed') {
    return 'Bu haberin özeti üretilemedi. Kaynağa gidebilir ya da tekrar deneyebilirsiniz.';
  }
  if (reason === 'no_api_key') {
    return 'Özet servisi şu an yapılandırılmamış. Daha sonra tekrar deneyin.';
  }
  return 'Özet sunucu sırasında bekliyor. Ekranı açık tutmak sırayı hızlandırmıyor; daha sonra tekrar deneyin.';
}

/**
 * Ask for an article's summary and keep asking while it is `queued`.
 *
 * Polling stops after `ENRICHMENT_MAX_POLLS` with a warning: with
 * no Anthropic key configured the job stays queued forever (addendum §E), and a hook that
 * polled forever would be an invisible battery drain rather than a visible
 * "Özet hazırlanıyor".
 */
export function useEnrichment(
  articleId: string | null | undefined,
  options: { enabled?: boolean; maxPolls?: number } = {},
) {
  const repos = useRepositories();
  const maxPolls = options.maxPolls ?? ENRICHMENT_POLL_SCHEDULE_SECONDS.length;

  const query = useQuery({
    queryKey: queryKeys.enrichment(articleId ?? ''),
    enabled: Boolean(articleId) && options.enabled !== false,
    queryFn: () => repos.enrichment.requestEnrichment(articleId as string).then(unwrap),
    retry: retryPolicy,
    /**
     * `ready` and `unavailable` are both terminal, so once one arrives the answer
     * is never stale: a remount or a screen focus must not re-ask. Only `queued`
     * stays fresh for zero milliseconds, because the poll below is what advances
     * it.
     */
    staleTime: (query) => {
      const data = query.state.data as EnrichmentResult | undefined;
      return data && data.status !== 'queued' ? Infinity : 0;
    },
    refetchInterval: (query) => {
      const data = query.state.data as EnrichmentResult | undefined;
      // Anything that is not `queued` — including `unavailable`, where the server
      // has already looked and found no body — stops the poll dead.
      if (!data || data.status !== 'queued') return false;
      const delay = query.state.dataUpdateCount >= maxPolls
        ? null
        : enrichmentPollDelayMs(query.state.dataUpdateCount);
      if (delay === null) {
        console.warn(
          `[enrichment] article ${articleId}: ${maxPolls} yoklama ve ` +
            `~${ENRICHMENT_POLL_WINDOW_SECONDS} saniye sonra hâlâ kuyrukta (${
              data.reason ?? 'sebep bildirilmedi'
            }). Bu süre sunucunun iki dakikada bir çalışan özetleme cron'unun iki periyodunu ` +
            'kapsıyor, yani beklemek artık yardımcı olmuyor: ya günlük tavan dolmuş, ' +
            'ya worker çalışmıyor, ya da sağlayıcı anahtarı reddediliyor. Ekrandaki ' +
            '"Tekrar dene" elle yeniden sorar.',
        );
        return false;
      }
      return delay;
    },
  });

  return query;
}
