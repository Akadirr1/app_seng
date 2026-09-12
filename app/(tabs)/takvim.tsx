import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import {
  Card,
  ContentNotice,
  DottedRule,
  EmptyState,
  GradientHeader,
  GroupLabel,
  PixelBadge,
  Segmented,
  Txt,
} from '../../src/components/ui';
import { useContent } from '../../src/content';
import { ClubEvent, WEEKDAYS } from '../../src/data';
import { monthGrids, monthOrder, type MonthGrid } from '../../src/eventSchema';
import { useAppStore } from '../../src/store';
import { colors, gradients, radius, shadow } from '../../src/theme';
import { useOpenEvent } from '../../src/useOpenEvent';

type View_ = 'list' | 'grid';

export default function TakvimRoute() {
  const [view, setView] = useState<View_>('list');
  const router = useRouter();
  const openEvent = useOpenEvent();
  const { events, error, loading, refresh } = useContent();
  const hasEvents = events.length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.blue500} />
      }
    >
      <GradientHeader gradient={gradients.calendar}>
        <Txt weight="extrabold" size={24} color="#fff" tracking={-0.5}>
          Etkinlik Takvimi
        </Txt>
        <Txt size={12.5} color={colors.blue200} style={{ marginTop: 4 }}>
          {/* The month range used to be hardcoded to "Mart – Nisan 2026" and was
              still on screen months after those events had passed. */}
          {hasEvents ? `${events.length} etkinlik` : 'Şu an planlanmış etkinlik yok'}
        </Txt>

        <DottedRule style={{ marginTop: 12 }} />

        {/* Nothing to switch between when the calendar is empty. */}
        {hasEvents ? (
          <Segmented
            onNavy
            value={view}
            onChange={(v) => setView(v as View_)}
            options={[
              { label: 'Liste', value: 'list' },
              { label: 'Takvim', value: 'grid' },
            ]}
            style={{ marginTop: 16 }}
          />
        ) : null}
      </GradientHeader>

      {error ? <ContentNotice onRetry={refresh} retrying={loading} /> : null}

      {!hasEvents ? (
        // An empty calendar and a failed fetch look the same on screen, so the
        // copy has to say which one it is — otherwise a connection problem reads
        // as "the club has nothing planned".
        error ? (
          <EmptyState
            title="Etkinlikler yüklenemedi"
            body="Bağlantı kurulduğunda program burada görünecek. Yukarıdan yenileyebilir ya da aşağı çekebilirsin."
          />
        ) : (
          <EmptyState
            title="Takvim henüz boş"
            body="Yeni dönemin etkinlikleri planlanıyor. Bildirimleri açarsan program açıklandığında ilk sen haberdar olursun."
            ctaLabel="Bildirimleri aç"
            onPress={() => router.push('/bildirim-ayarlari')}
          />
        )
      ) : view === 'list' ? (
        <ListView onOpen={openEvent} />
      ) : (
        <GridView onOpen={openEvent} />
      )}
    </ScrollView>
  );
}

function ListView({ onOpen }: { onOpen: (id: string) => void }) {
  const { events } = useContent();
  // Derived from the events themselves. A hand-maintained MONTH_ORDER meant an
  // event in a month nobody had listed simply never appeared.
  const months = useMemo(() => monthOrder(events), [events]);

  return (
    <View style={styles.list}>
      {months.map((month) => {
        const items = events.filter((e) => e.monthKey === month);
        if (!items.length) return null;
        return (
          <View key={month}>
            <GroupLabel style={{ marginBottom: 12 }}>{month}</GroupLabel>
            <View style={{ gap: 10 }}>
              {items.map((e) => (
                <EventRow key={e.id} event={e} onPress={() => onOpen(e.id)} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EventRow({ event, onPress }: { event: ClubEvent; onPress: () => void }) {
  const { registrationFor } = useAppStore();
  const registration = registrationFor(event.id);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.eventRow,
        pressed && { borderColor: colors.blue200, ...shadow.card },
      ]}
    >
      <View style={styles.dateColumn}>
        <Txt weight="extrabold" size={22} color={colors.navy900} style={{ lineHeight: 22 }}>
          {event.day}
        </Txt>
        <Txt weight="bold" size={9.5} color={colors.blue500} tracking={0.7} style={{ marginTop: 2 }}>
          {event.mon}
        </Txt>
        <Txt size={10} color={colors.faint} style={{ marginTop: 3 }}>
          {event.wd}
        </Txt>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="bold" size={15.5} leading={1.3} color={colors.text} tracking={-0.2}>
          {event.title}
        </Txt>
        <Txt size={12.5} color={colors.muted} style={{ marginTop: 5 }}>
          {event.time}
        </Txt>

        <View style={styles.rowTags}>
          <View style={styles.tagPill}>
            <Txt weight="bold" size={10.5} color={colors.navy700}>
              {event.tag}
            </Txt>
          </View>

          {event.soon ? (
            <PixelBadge icon="clock" label="SON GUN" bg={colors.blue500} fg="#fff" size={6} />
          ) : null}

          {registration ? (
            <View style={styles.registeredPill}>
              <Txt weight="bold" size={10.5} color={colors.blue500}>
                {registration.synced ? 'Kayıtlısın' : 'Gönderiliyor'}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function GridView({ onOpen }: { onOpen: (id: string) => void }) {
  const { events } = useContent();
  // One card per month that actually has events, instead of a constant pinned to
  // March 2026 that would have shown the wrong month the moment a real calendar
  // existed.
  const grids = useMemo(() => monthGrids(events), [events]);

  return (
    <View style={{ padding: 20, gap: 16 }}>
      {grids.map((grid) => (
        <MonthCard key={grid.key} grid={grid} onOpen={onOpen} />
      ))}

      <View style={{ marginTop: 16, gap: 10 }}>
        {events.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => onOpen(e.id)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.compactRow,
              pressed && { borderColor: colors.blue200 },
            ]}
          >
            <View style={styles.compactStripe} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="bold" size={14} color={colors.text} tracking={-0.2}>
                {e.title}
              </Txt>
              <Txt size={12} color={colors.muted} style={{ marginTop: 3 }}>
                {e.short}
              </Txt>
            </View>
            <Txt size={12} color={colors.blue200}>
              ›
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MonthCard({ grid, onOpen }: { grid: MonthGrid; onOpen: (id: string) => void }) {
  // Leading blanks push the 1st into the correct weekday column.
  const cells: (number | null)[] = [
    ...Array.from({ length: grid.leadingBlanks }, () => null),
    ...Array.from({ length: grid.days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // The month name without the year, for the day cell's accessibility label.
  const monthName = grid.label.split(' ')[0];

  return (
    <Card style={{ padding: 16 }}>
      <View style={styles.monthBar}>
        <Txt weight="extrabold" size={15} color={colors.navy900}>
          {grid.label}
        </Txt>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={styles.weekCell}>
            <Txt weight="bold" size={10} color={colors.faint}>
              {w}
            </Txt>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          const eventId = day ? grid.eventByDay[day] : undefined;
          return (
            <Pressable
              key={i}
              disabled={!eventId}
              onPress={() => eventId && onOpen(eventId)}
              accessibilityRole={eventId ? 'button' : undefined}
              accessibilityLabel={eventId ? `${day} ${monthName} etkinliği` : undefined}
              style={styles.dayCell}
            >
              <View style={[styles.dayInner, eventId ? { backgroundColor: colors.blue100 } : null]}>
                <Txt
                  weight={eventId ? 'extrabold' : 'medium'}
                  size={13}
                  color={day ? (eventId ? colors.navy900 : colors.muted) : 'transparent'}
                >
                  {day ?? ''}
                </Txt>
                {eventId ? <View style={styles.dayDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  list: { padding: 20, gap: 22 },
  eventRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  dateColumn: {
    width: 54,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingRight: 12,
  },
  rowTags: { marginTop: 9, flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  tagPill: {
    backgroundColor: colors.blue100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  registeredPill: {
    borderWidth: 1,
    borderColor: colors.blue200,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthNav: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 9,
  },
  dayDot: { width: 5, height: 5, backgroundColor: colors.blue500 },

  compactRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  compactStripe: { width: 4, height: 34, borderRadius: 3, backgroundColor: colors.blue500 },
});
