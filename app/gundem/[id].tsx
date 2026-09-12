import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Card,
  ContentNotice,
  DottedRule,
  GradientHeader,
  PixelTxt,
  PrimaryButton,
  Segmented,
  Tag,
  Txt,
} from '../../src/components/ui';
import { bodyFor, hasSummary, segmentState, type Segment } from '../../src/gundem/article/segment';
import { ArticleBody } from '../../src/gundem/components/ArticleBody';
import {
  enrichmentStalledMessage,
  useArticle,
  useEnrichment,
} from '../../src/gundem/data-access/hooks';
import { useSavedArticles } from '../../src/gundem/user-state/hooks';
import { relativeTimeTr } from '../../src/gundem/format/relativeTime';
import { colors, gradients, radius } from '../../src/theme';

export default function GundemArticleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const articleId = id ?? '';
  const router = useRouter();

  const { isSaved, setArticleSaved } = useSavedArticles();
  const query = useArticle(articleId);
  const article = query.data;
  /*
    Özeti zaten olan bir haber için `request-enrichment` çağrılmıyor.

    Cihazda ölçüldü: çağrılıyordu, sunucu istemcinin tanımadığı bir gövde
    döndürüyordu, depo onu `queued` sayıyordu ve kanca sekiz kez yokluyordu —
    sekiz Edge isteği, hepsi cihazın günlük hız-sınırı kovasına yazan, hiçbiri
    verilecek bir cevabı olmayan. Sunucunun işi bitmişti; soracak bir şey yoktu.
  */
  const enrichment = useEnrichment(articleId, {
    enabled: Boolean(articleId) && query.isSuccess && !hasSummary(article?.summary),
  });

  const result = enrichment.data;
  const summary = result?.status === 'ready' ? result.summary : article?.summary;
  /* Elde gösterilecek üç madde var mı — uç nokta ne derse desin. */
  const summaryReady = hasSummary(summary);

  const segment = segmentState(article, summary);
  const [chosen, setChosen] = useState<Segment>('tr');
  // Çeviri hazır değilken seçim "orijinal"e sabitleniyor: kullanıcı olmayan bir
  // metne geçemesin ama düğme de kaybolmasın — neden kapalı olduğu görünsün.
  const active: Segment = segment.enabled ? chosen : 'en';

  if (query.isPending) {
    return (
      <View style={styles.center}>
        <PixelTxt size={9} style={{ color: colors.faint }}>
          YUKLENIYOR
        </PixelTxt>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.screen}>
        <GradientHeader gradient={gradients.form} style={{ paddingBottom: 16 }}>
          <Txt weight="extrabold" size={20} color="#fff">
            Haber bulunamadı
          </Txt>
        </GradientHeader>
        <ContentNotice onRetry={() => void query.refetch()} retrying={query.isFetching} />
        <PrimaryButton label="Geri dön" onPress={() => router.back()} style={styles.back} />
      </View>
    );
  }

  /*
    İkisi de `summaryReady` ile kapılı. Eskiden değildi ve kullanıcının gördüğü
    hata buydu: satırda üç madde dururken uç noktadan gelen `queued`, ekranı
    sonsuza kadar "Özet hazırlanıyor"a çeviriyordu. Bir cevap, elde olan veriyi
    silemez — en fazla ona ekleyebilir.
  */
  const pending = !summaryReady && (result?.status === 'queued' || !result);
  const unavailable = !summaryReady && result?.status === 'unavailable';
  /*
    `queued` iki farklı şey demek ve ayıran tek şey `reason`:

      reason yok  → iş gerçekten sırasını bekliyor; worker iki dakikada bir
                    koşuyor. Beklemek uzun sürebilir ama gelecek, o yüzden
                    "hazırlanıyor" doğru.
      reason var  → sunucu neden ilerlemediğini söylüyor: `previous_attempt_failed`
                    (denemeleri tükendi, kendiliğinden bir daha denenmeyecek) ya
                    da `no_api_key`. Burada dönen bir gösterge yalan.

    Sebep zaten taşınıyordu ve yalnızca `console.warn`'a yazılıyordu — bir
    release derlemesinin konsolu yok, yani kullanıcıya ulaşan tek şey sonsuza
    kadar dönen bir çarktı.

    Yoklamanın bitip bitmediğini saymayı denedim, yanlış yoldu: `dataUpdateCount`
    izlenen bir özellik değil (render tetiklemiyor), `isFetching` ise yoklamalar
    ARASINDA da false — onunla ekran, uygulama hâlâ sorarken "sonra tekrar
    deneyin" derdi. Sunucunun sebebi bunların ikisine de gerek bırakmıyor ve ilk
    cevapta geliyor.
  */
  const queuedReason = result?.status === 'queued' ? result.reason : null;
  const stalled = pending && Boolean(queuedReason);
  const body = bodyFor(article, summary, active);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <GradientHeader gradient={gradients.form} style={{ paddingBottom: 16 }}>
          <Txt size={12} color={colors.blue200}>
            {article.sourceName} · {relativeTimeTr(article.publishedAt)}
          </Txt>
          <Txt weight="extrabold" size={21} color="#fff" tracking={-0.4} style={{ marginTop: 6 }}>
            {article.title}
          </Txt>
          <DottedRule style={{ marginTop: 12 }} />
        </GradientHeader>

        <View style={styles.tagRow}>
          <Tag label={article.category} />
          {article.language !== 'tr' ? <Tag label="EN→TR" /> : null}
          <View style={{ flex: 1 }} />
          {/*
            Kaydetme ve kaldırma aynı düğme. Kaydedilenler listesinde ayrı bir
            silme düğmesi yok: kaydırırken yanlışlıkla basılan, geri alınamayan
            bir silme olurdu.
          */}
          <Pressable
            onPress={() => setArticleSaved(article.id, !isSaved(article.id))}
            accessibilityRole="button"
            accessibilityState={{ selected: isSaved(article.id) }}
            accessibilityLabel={isSaved(article.id) ? 'Kaydı kaldır' : 'Kaydet'}
            hitSlop={8}
            style={({ pressed }) => [
              styles.saveButton,
              isSaved(article.id) && styles.saveButtonOn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Txt weight="semibold" size={12} color={isSaved(article.id) ? '#fff' : colors.navy700}>
              {isSaved(article.id) ? 'Kaydedildi' : 'Kaydet'}
            </Txt>
          </Pressable>
        </View>

        <Card style={styles.summary}>
          <View style={styles.summaryHead}>
            <PixelTxt size={8}>AI TR OZET</PixelTxt>
            {pending || unavailable ? null : (
              <Txt size={11.5} color={colors.muted}>
                {summary?.bullets.length ?? 3} madde
              </Txt>
            )}
          </View>

          {unavailable ? (
            // Beklemekle değişmeyecek: bir kez söylüyor ve aşağıdaki "Kaynağa
            // git"i işaret ediyor. Dönen bir gösterge burada yalan olurdu.
            <Txt size={13.5} color={colors.textBody} style={{ marginTop: 10 }}>
              Bu haber için özet üretilemiyor; kaynağa gidebilirsiniz.
            </Txt>
          ) : pending ? (
            <View style={styles.pendingRow}>
              {/*
                Sunucu ilerlemediğini söylediyse gösterge dönmüyor: dönen bir
                çark orada "sürüyor" demek olurdu ve sürmüyor.
              */}
              {stalled ? null : <ActivityIndicator size="small" color={colors.blue500} />}
              <Txt size={13.5} color={colors.textBody} style={{ flex: 1 }}>
                {stalled ? enrichmentStalledMessage(queuedReason) : 'Özet hazırlanıyor'}
              </Txt>
              {/*
                Yoklama takvimi sunucunun iki dakikada bir çalışan cron'unun iki
                periyodunu kapsıyor ve sonra duruyor. Elle sorma yolu her zaman açık.
              */}
              <Pressable
                onPress={() => void enrichment.refetch()}
                accessibilityRole="button"
                accessibilityLabel="Özeti tekrar sor"
                hitSlop={8}
                disabled={enrichment.isFetching}
                style={({ pressed }) => [
                  styles.retryButton,
                  { opacity: pressed || enrichment.isFetching ? 0.6 : 1 },
                ]}
              >
                <Txt weight="semibold" size={12} color={colors.navy700}>
                  Tekrar dene
                </Txt>
              </Pressable>
            </View>
          ) : (
            summary?.bullets.map((bullet, index) => (
              <View key={`${index}-${bullet}`} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Txt size={13.5} color={colors.textBody} style={styles.bulletText}>
                  {bullet}
                </Txt>
              </View>
            ))
          )}
        </Card>

        {/*
          Dil seçici metnin kartının içinde: hangi metni değiştirdiği görünsün.
          Dışarıda asılıyken hangi bölüme ait olduğu okunmuyordu.
        */}
        <ArticleBody
          text={body.text}
          label={body.label}
          header={
            segment.visible ? (
              <>
                <Segmented
                  options={[
                    { label: 'Orijinal', value: 'en' },
                    { label: 'Çeviri', value: 'tr' },
                  ]}
                  value={active}
                  onChange={(value) => {
                    if (segment.enabled) setChosen(value as Segment);
                  }}
                />
                {segment.enabled ? null : (
                  <Txt size={11.5} color={colors.faint} style={{ marginTop: 6 }}>
                    Çeviri hazırlanıyor.
                  </Txt>
                )}
              </>
            ) : null
          }
        />

        <PrimaryButton
          label="Kaynağa git"
          onPress={() => {
            // Adres RSS'ten geliyor; `tel:`/`intent:` gibi bir şema tarayıcı yerine başka bir uygulamayı açar.
            if (/^https?:\/\//i.test(article.url)) void Linking.openURL(article.url);
          }}
          style={styles.cta}
        />

        <Txt size={11} color={colors.faint} style={styles.credit}>
          Özet ve çeviri yapay zekâ ile üretildi.
        </Txt>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.blue500,
  },
  saveButtonOn: { backgroundColor: colors.blue500, borderColor: colors.blue500 },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summary: { marginHorizontal: 16, marginTop: 14 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  bulletRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.blue500,
    marginTop: 7,
  },
  bulletText: { flex: 1, lineHeight: 20 },
  cta: { marginHorizontal: 16, marginTop: 20 },
  back: { marginHorizontal: 16, marginTop: 16 },
  credit: { textAlign: 'center', marginTop: 14, paddingHorizontal: 16 },
});
