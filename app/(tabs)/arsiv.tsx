import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { PhotoSlot } from '../../src/components/PhotoSlot';
import {
  ContentNotice,
  DottedRule,
  EmptyState,
  FilterChip,
  GradientHeader,
  PixelTxt,
  Txt,
} from '../../src/components/ui';
import { useContent } from '../../src/content';
import { ARCHIVE_CATEGORIES, ClubEvent } from '../../src/data';
import { parseIso } from '../../src/eventSchema';
import { colors, gradients, radius } from '../../src/theme';

/*
 * Fotoğraf görüntüleyici buradaydı: her kayıt için dört fotoğraflık bir
 * lightbox, kartlarda da "24 foto" rozeti. Uygulamada fotoğraf deposu hiç yok
 * — dördü de aynı gradyan yer tutucuydu ve sayı hiçbir şeyi saymıyordu.
 *
 * Arşiv kaydı artık etkinliğin kendisi olduğu için karta dokunmak zaten var
 * olan etkinlik detayına gidiyor. Gerçek fotoğraflar geldiğinde `PhotoSlot`
 * `uri` alıyor, yer tutucu kendiliğinden düşüyor.
 */

export default function ArsivRoute() {
  const router = useRouter();
  const { archive, error, loading, refresh } = useContent();
  const [category, setCategory] = useState('Tümü');

  const entries = useMemo(
    () => archive.filter((e) => category === 'Tümü' || e.tag === category),
    [archive, category],
  );

  // "2023'ten bugüne" sabitti ve arşiv boşken bile öyle diyordu. Artık gerçekten
  // arşivdeki en eski etkinliğin yılı.
  const firstYear = useMemo(() => {
    const years = archive.map((e) => parseIso(e.startsAt ?? '')?.year).filter(Boolean) as number[];
    return years.length ? Math.min(...years) : null;
  }, [archive]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.blue500} />
        }
      >
        <GradientHeader gradient={gradients.section} style={{ paddingBottom: 16 }}>
          <Txt weight="extrabold" size={24} color="#fff" tracking={-0.5}>
            Etkinlik Arşivi
          </Txt>
          <Txt size={12.5} color={colors.blue200} style={{ marginTop: 4 }}>
            {archive.length === 0
              ? 'Geçmiş etkinlikler burada birikecek'
              : firstYear
                ? `${firstYear}'ten bugüne ${archive.length} etkinlik`
                : `${archive.length} etkinlik`}
          </Txt>
          <DottedRule style={{ marginTop: 12 }} />
        </GradientHeader>

        {error ? <ContentNotice onRetry={refresh} retrying={loading} /> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {ARCHIVE_CATEGORIES.map((c) => (
            <FilterChip key={c} label={c} active={c === category} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>

        {entries.length === 0 ? (
          <EmptyState
            title="Bu kategoride henüz arşiv yok"
            body={`İlk ${category.toLocaleLowerCase('tr')} etkinliğimiz bu dönem planlanıyor. Bildirimleri açarsan duyurulduğunda haber veririz.`}
            ctaLabel="Bildirimleri aç"
            onPress={() => router.push('/bildirim-ayarlari')}
          />
        ) : (
          <View style={styles.grid}>
            {entries.map((event) => (
              <ArchiveCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/etkinlik/${event.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ArchiveCard({ event, onPress }: { event: ClubEvent; onPress: () => void }) {
  const parsed = parseIso(event.startsAt ?? '');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title} — etkinlik detayı`}
      style={({ pressed }) => [styles.card, { transform: [{ translateY: pressed ? -2 : 0 }] }]}
    >
      <PhotoSlot uri={event.photos?.[0]} label="Foto" style={styles.cardPhoto}>
        {parsed ? (
          <View style={styles.yearBadge}>
            <PixelTxt size={6} color={colors.onNavy}>
              {String(parsed.year)}
            </PixelTxt>
          </View>
        ) : null}

        {/* Katılımcı sayısı ancak etkinlikten sonra biliniyor; girilmediyse
            rozet hiç çizilmiyor. Yerine bir sıfır koymak "kimse gelmedi"
            demek olurdu. */}
        {event.attendance === undefined ? null : (
          <View style={styles.countBadge}>
            <Txt weight="semibold" size={10} color="#fff">
              {event.attendance} katılımcı
            </Txt>
          </View>
        )}
      </PhotoSlot>

      <View style={styles.cardBody}>
        <Txt weight="bold" size={13.5} leading={1.3} color={colors.text} tracking={-0.2}>
          {event.title}
        </Txt>
        <Txt size={11.5} color={colors.muted} style={{ marginTop: 5 }}>
          {event.short} · {event.tag}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  chips: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, gap: 8 },

  grid: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  card: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#001B4A',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPhoto: { height: 112 },
  cardBody: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 13 },
  yearBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,27,74,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: radius.xs,
  },
  countBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,27,74,0.72)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },

});
