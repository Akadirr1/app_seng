import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import GundemArticleRoute from '../../app/gundem/[id]';
import { FEED_VIEW } from '../gundem/data-access/supabase/client';
import type { FeedArticleRow } from '../gundem/data-access/supabase/mapper';
import {
  createSupabaseEnrichmentRepository,
  createSupabaseFeedRepository,
} from '../gundem/data-access/supabase/repositories';
import { QueryProvider, createQueryClient } from '../gundem/providers/QueryProvider';
import type { KvStore } from '../gundem/storage/kv';
import type { QueryClient } from '@tanstack/react-query';
import type { Repositories } from '../gundem/data-access/repositories';

/**
 * Cihazdan gelen hata: **"çeviri gelmiş ama özet oluşturamıyor."**
 *
 * Logdaki satır iki kez düşmüştü:
 *
 *     WARN [supabase] request-enrichment returned an unrecognised body for
 *          2e3c71ae-…; treating it as queued.
 *
 * Zincir şu: `request-enrichment` istemcinin tanımadığı bir gövde döndürüyor →
 * depo onu `queued`a çeviriyor → ekran `pending` hesaplarken **elindeki özete
 * hiç bakmadan** dönen göstergeyi çiziyor. Yani satırda üç madde de duruyor
 * (çevirinin ekranda görünmesi bunun kanıtı: çeviri ancak `summary_ready`
 * ile birlikte "ready" oluyordu) ve kullanıcı sonsuza kadar "Özet hazırlanıyor"
 * görüyor.
 *
 * Bu dosya o ekranı kurar: satır özetli, uç nokta tanınmayan gövde veriyor.
 */

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ARTICLE_ID = '2e3c71ae-bba2-4011-bacc-fd14b05c6953';

/** Özeti ve çevirisi **hazır** bir satır — sunucunun işi bitmiş. */
const enrichedRow = (): FeedArticleRow => ({
  article_id: ARTICLE_ID,
  source_id: 's1',
  source_slug: 'ornek',
  source_name: 'Örnek Kaynak',
  source_site_url: 'https://ornek.com',
  category: 'Araştırma',
  title: 'Modelin yeni sürümü',
  author: null,
  canonical_url: 'https://ornek.com/haber',
  published_at: '2026-08-20T06:41:00.000Z',
  fetched_at: '2026-08-20T06:41:00.000Z',
  language: 'en',
  excerpt: 'An excerpt.',
  content_text: 'The original English body.',
  content_quality: 'full',
  summary_tr: ['Birinci madde', 'İkinci madde', 'Üçüncü madde'],
  translation_tr: 'Türkçe çeviri metni.',
  translation_state: 'ready',
  summary_model: 'claude',
  summary_generated_at: '2026-08-20T07:00:00.000Z',
  summary_ready: true,
});

/** Gerçek bir gövde: üç paragraf, ikisi yumuşak sarma taşıyor. */
const LONG_BODY = [
  'Giris paragrafi burada duruyor ve haberin ne hakkinda oldugunu soyluyor.',
  'Ikinci paragraf bir\ncumlenin ortasindan kirilmis hâlde geliyor.',
  'Ucuncu paragraf da metnin sonunu getiriyor.',
].join('\n\n');

/** Özeti **bekleyen**, ama çevirisi biten satır. */
const translatedOnlyRow = (): FeedArticleRow => ({
  ...enrichedRow(),
  summary_tr: null,
  summary_ready: false,
  summary_model: null,
  summary_generated_at: null,
});

function fakePostgrest(holder: { rows: FeedArticleRow[] }) {
  return {
    from(table: string) {
      if (table !== FEED_VIEW) throw new Error(`unexpected table ${table}`);
      let out = [...holder.rows];
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        in: () => builder,
        or: () => builder,
        eq(column: string, value: unknown) {
          out = out.filter((r) => (r as unknown as Record<string, unknown>)[column] === value);
          return builder;
        },
        maybeSingle: async () => ({ data: out[0] ?? null, error: null }),
        single: async () => ({ data: out[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: out, error: null }).then(resolve),
      };
      return builder;
    },
  };
}

/** `request-enrichment`, cihazda ölçülen gövdeyi döndürüyor. */
function stubEdge(body: unknown, status = 200) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    const text = JSON.stringify(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const memoryKv = (): KvStore => {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
};

// `mock` öneki zorunlu: `jest.mock` fabrikası kapsam dışı bir değişkene ancak
// bu adla erişebiliyor.
let mockRepositories: Repositories | null = null;
jest.mock('../gundem/data-access/index', () => ({
  ...jest.requireActual('../gundem/data-access/index'),
  getRepositories: () => {
    if (!mockRepositories) throw new Error('test did not install repositories');
    return mockRepositories;
  },
}));

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => ({ id: '2e3c71ae-bba2-4011-bacc-fd14b05c6953' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  mockRepositories = null;
});

function mount(rows: FeedArticleRow[], edgeBody: unknown, edgeStatus = 200) {
  const edge = stubEdge(edgeBody, edgeStatus);
  const holder = { rows };
  mockRepositories = {
    version: 1,
    mode: 'supabase',
    feed: createSupabaseFeedRepository(fakePostgrest(holder) as never),
    enrichment: createSupabaseEnrichmentRepository({
      fetchImpl: edge.fetchImpl,
      config: { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon.key' },
    }),
  } as unknown as Repositories;

  const client = createQueryClient();
  clients.push(client);
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryProvider client={client} storage={memoryKv()} throttleMs={0}>
        <GundemArticleRoute />
      </QueryProvider>
    </SafeAreaProvider>,
  );
  return { view, edge, holder, client };
}

describe('article screen — a summary already in hand', () => {
  /**
   * Asıl regresyon. Uç nokta ne derse desin, elinde üç madde varken ekran
   * onları göstermeli: `queued` cevabı "özet yok" demek değil, "sunucuda iş
   * var" demek.
   */
  it('shows the bullets even when request-enrichment answers with a body we do not know', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view } = mount([enrichedRow()], { status: 'already_enriched' });
      await view;

      expect(await screen.findByText('Birinci madde')).toBeTruthy();
      expect(screen.getByText('İkinci madde')).toBeTruthy();
      expect(screen.getByText('Üçüncü madde')).toBeTruthy();
      // Ve dönen gösterge yok: özet ekranda, "hazırlanıyor" bir yalan olurdu.
      expect(screen.queryByText('Özet hazırlanıyor')).toBeNull();
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);

  /**
   * İkinci yarısı: hiç sormamalıydı. Satır zaten özetli, yani `request-enrichment`
   * çağrısının verecek bir cevabı yok — ama her çağrı cihazın günlük hız-sınırı
   * kovasına yazıyor. Logdaki uyarının **iki kez** düşmesinin sebebi de bu:
   * ilk istek, sonra bir yoklama.
   */
  it('does not call request-enrichment at all for an article that already has one', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view, edge } = mount([enrichedRow()], { status: 'already_enriched' });
      await view;
      expect(await screen.findByText('Birinci madde')).toBeTruthy();
      await waitFor(() => expect(screen.queryByText('Özet hazırlanıyor')).toBeNull());
      expect(edge.calls).toHaveLength(0);
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);

  /**
   * Özet gerçekten yokken davranış değişmiyor: sorulur ve "hazırlanıyor"
   * gösterilir. Yukarıdaki iki testin, beklemeyi tamamen kapatarak da geçmesi
   * mümkün olurdu; bunu engelleyen test bu.
   */
  it('still asks, and still says "hazırlanıyor", when there is no summary yet', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Sebepsiz `queued` — kanonik bekleme hâli: iş gerçekten sırasını
      // bekliyor. Bu fikstür eskiden `no_api_key` idi; sunucu bir sebep
      // söylediğinde ekran artık o sebebi yazıyor, ve bu testin koruduğu şey
      // sebep değil "özet yokken hâlâ sorar ve bekleme durumu gösterir".
      const { view, edge } = mount([translatedOnlyRow()], {
        status: 'queued',
        reason: null,
      });
      await view;
      expect(await screen.findByText('Özet hazırlanıyor')).toBeTruthy();
      await waitFor(() => expect(edge.calls.length).toBeGreaterThan(0));
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);

  /**
   * Sunucu neden ilerlemediğini söylediğinde ekran onu yazmalı.
   *
   * Sebep (`no_api_key`, `previous_attempt_failed`) kablodan geliyor ve
   * istemcide taşınıyordu, ama yalnızca `console.warn`'a yazılıyordu — bir
   * release derlemesinin konsolu yok, dolayısıyla kullanıcıya ulaşan tek şey
   * sonsuza kadar dönen bir göstergeydi. "hazırlanıyor" burada düpedüz yanlış:
   * anahtar yokken hiçbir şey hazırlanmıyor.
   */
  it('sunucu bir sebep bildirdiğinde "hazırlanıyor" demiyor, sebebi yazıyor', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view } = mount([translatedOnlyRow()], {
        status: 'queued',
        reason: 'no_api_key',
      });
      await view;

      expect(await screen.findByText(/yapılandırılmamış/)).toBeTruthy();
      expect(screen.queryByText('Özet hazırlanıyor')).toBeNull();
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);

  /**
   * `pending` düzeltmesinin kendi testi — ve yazılma sebebi ölçüm.
   *
   * Yukarıdaki iki test, "özeti olan haberde hiç sorma" düzeltmesi yüzünden
   * eski `pending` mantığıyla da yeşil kalıyordu: soru sorulmayınca `result`
   * hiç oluşmuyor ve eski ifade de yanlış cevabı veremiyor. Yani o düzeltmeyi
   * koruyan bir iddia yoktu. Bu, deponun kendi kuralına giren durum: kırmızı
   * veremeyen bir iddia, iddia değil.
   *
   * Kırmızı verebildiği sıra bu: kullanıcı haberi özet **yokken** açıyor
   * (dolayısıyla soruluyor), uç nokta tanınmayan bir gövdeyle `queued` diyor,
   * sonra arka planda satır tazeleniyor ve özet geliyor. Eski kod bu noktada
   * bayat `queued` cevabını tutup gelmiş özetin üstüne dönen göstergeyi
   * çiziyor — gerçek hayatta en olası sıra da bu.
   */
  it('drops the spinner when the row gains its summary while a queued answer is still cached', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view, holder, client } = mount([translatedOnlyRow()], { status: 'weird-body' });
      await view;
      expect(await screen.findByText('Özet hazırlanıyor')).toBeTruthy();

      // Sunucu özeti yazdı; uygulama satırı yeniden okuyor. Zenginleştirme
      // cevabı önbellekte hâlâ `queued`.
      holder.rows = [enrichedRow()];
      await act(async () => {
        await client.invalidateQueries({ queryKey: ['v1', 'article', ARTICLE_ID] });
      });

      expect(await screen.findByText('Birinci madde')).toBeTruthy();
      await waitFor(() => expect(screen.queryByText('Özet hazırlanıyor')).toBeNull());
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);

  /**
   * Aynı sınıfın diğer yarısı. `unavailable` terminal ve doğru olduğunda
   * beklemekten iyidir — ama elde özet varken "özet üretilemiyor" demek,
   * dönen bir göstergeden daha kötü bir yalan: kullanıcı vazgeçer.
   */
  it('never says "üretilemiyor" over a summary that is already on the row', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view, holder, client } = mount([translatedOnlyRow()], {
        status: 'unavailable',
        reason: 'no_content',
      });
      await view;
      expect(
        await screen.findByText('Bu haber için özet üretilemiyor; kaynağa gidebilirsiniz.'),
      ).toBeTruthy();

      holder.rows = [enrichedRow()];
      await act(async () => {
        await client.invalidateQueries({ queryKey: ['v1', 'article', ARTICLE_ID] });
      });

      expect(await screen.findByText('Birinci madde')).toBeTruthy();
      await waitFor(() =>
        expect(
          screen.queryByText('Bu haber için özet üretilemiyor; kaynağa gidebilirsiniz.'),
        ).toBeNull(),
      );
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);
});

describe('article screen — the reading surface', () => {
  /**
   * Duvarın çözümü: gövde tek bir metin düğümü değil, paragraflar. Ekranda
   * paragrafları ayrı ayrı bulabiliyorsak ayrılmışlar demektir.
   */
  it('renders the body as separate paragraphs, not one block', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view } = mount(
        [{ ...enrichedRow(), language: 'tr', content_text: LONG_BODY }],
        { status: 'already_enriched' },
      );
      await view;

      expect(
        await screen.findByText(
          'Giris paragrafi burada duruyor ve haberin ne hakkinda oldugunu soyluyor.',
        ),
      ).toBeTruthy();
      // Yumuşak sarma katlanmış: satır sonu boşluğa dönmüş hâliyle aranıyor.
      expect(
        screen.getByText('Ikinci paragraf bir cumlenin ortasindan kirilmis hâlde geliyor.'),
      ).toBeTruthy();
      expect(screen.getByText('Ucuncu paragraf da metnin sonunu getiriyor.')).toBeTruthy();
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);

  it('tells the reader how long it is, next to which text they are reading', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view } = mount([{ ...enrichedRow(), content_text: LONG_BODY }], {
        status: 'already_enriched',
      });
      await view;
      // Çeviri hazır olduğu için varsayılan seçim çeviri; etiket ve süre yan yana.
      expect(await screen.findByText(/Çeviri · Türkçe · \d+ dk okuma/)).toBeTruthy();
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);

  /** Gövdesi olmayan haber boş bir kart göstermemeli. */
  it('says so when there is no body text at all', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { view } = mount(
        // Çeviri de yok: aksi hâlde `bodyFor` çeviriyi gösterirdi ve gövde boş olmazdı.
        [{ ...enrichedRow(), language: 'tr', translation_tr: null, content_text: null, excerpt: null }],
        { status: 'already_enriched' },
      );
      await view;
      expect(
        await screen.findByText('Bu haberin metni alınamadı. Aşağıdan kaynağa gidebilirsiniz.'),
      ).toBeTruthy();
      await (await view).unmount();
    } finally {
      warn.mockRestore();
    }
  }, 30000);
});
