import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoGallery } from '../../src/components/PhotoGallery';
import { RaffleNotice } from '../../src/components/RaffleNotice';
import { PhotoSlot } from '../../src/components/PhotoSlot';
import {
  Card,
  GlassButton,
  IconTile,
  MissingEvent,
  PixelBadge,
  PrimaryButton,
  Tag,
  Txt,
} from '../../src/components/ui';
import { useContent, useEvent } from '../../src/content';
import { isFull, isPast, seatsLabel, todayLocal } from '../../src/eventSchema';
import { entriesOpen } from '../../src/raffleSchema';
import { useAppStore } from '../../src/store';
import { colors, gradients, radius } from '../../src/theme';

export default function EventDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const event = useEvent(id);
  const { getRaffle, registeredCount } = useContent();
  const { registrationFor, raffleEntryFor, syncPending } = useAppStore();

  if (!event) return <MissingEvent onBack={() => router.replace('/(tabs)/takvim')} />;

  const registration = registrationFor(event.id);
  // Geçmiş etkinliğe kayıt olunamaz. Arşiv kartı buraya geldiği için bu ekran
  // artık olmuş etkinlikleri de gösteriyor ve "Kayıt Ol" düğmesi orada anlamsız.
  const past = isPast(event, todayLocal(new Date()));
  // Kaç kişi kaydolduğu Firestore'dan geliyor, kontenjan da etkinliğin kendi
  // alanı — yani yönetici kontenjanı yükselttiğinde kalan yer bir sonraki
  // okumada kendiliğinden artıyor. Eskiden burası elle yazılmış bir cümleydi.
  const registered = registeredCount(event.id);
  const full = isFull(event, registered);
  // A raffle is an ordinary event with a definition attached. The tag is only a
  // label; what decides whether this screen collects entries is the definition.
  const raffle = getRaffle(event.id);
  const raffleEntry = raffleEntryFor(event.id);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 132 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <PhotoSlot
          uri={event.photos?.[0]}
          label="Etkinlik görseli"
          gradient={gradients.hero}
          showLabel={false}
          style={styles.hero}
        >
          {/* Scrim so the title stays legible once a real photo is dropped in. */}
          <LinearGradient
            colors={['rgba(0,27,74,0.55)', 'rgba(0,27,74,0)', 'rgba(0,27,74,0.82)']}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={[styles.heroBack, { top: insets.top + 12 }]}>
            <GlassButton
              label="‹"
              accessibilityLabel="Geri"
              onPress={() => router.back()}
              bg="rgba(0,27,74,0.5)"
            />
          </View>

          <View style={styles.heroCaption} pointerEvents="none">
            <PixelBadge
              icon={event.soon ? 'clock' : 'star'}
              label={event.badge}
              bg={colors.blue500}
              fg="#fff"
            />
            <Txt
              weight="extrabold"
              size={25}
              leading={1.2}
              color="#fff"
              tracking={-0.5}
              style={{ marginTop: 12 }}
            >
              {event.title}
            </Txt>
          </View>
        </PhotoSlot>

        <View style={styles.facts}>
          {event.facts.map((fact) => (
            <View key={fact.label} style={styles.factRow}>
              <IconTile icon={fact.icon} />
              <View>
                <Txt weight="semibold" size={11} color={colors.faint} tracking={0.3}>
                  {fact.label}
                </Txt>
                <Txt weight="bold" size={14} color={colors.text} style={{ marginTop: 2 }}>
                  {fact.value}
                </Txt>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.block}>
          <Txt weight="extrabold" size={16} color={colors.navy900} style={{ marginBottom: 8 }}>
            Etkinlik hakkında
          </Txt>
          <Txt size={14.5} leading={1.68} color={colors.textBody}>
            {event.desc}
          </Txt>

          <View style={styles.tags}>
            {event.tags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Txt weight="extrabold" size={16} color={colors.navy900} style={{ marginBottom: 10 }}>
            Konuşmacı
          </Txt>
          <Card style={styles.speaker}>
            <LinearGradient
              colors={gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.speakerAvatar}
            >
              <Txt weight="extrabold" size={15} color="#fff">
                {initials(event.speaker)}
              </Txt>
            </LinearGradient>
            <View>
              <Txt weight="bold" size={14.5} color={colors.text}>
                {event.speaker}
              </Txt>
              <Txt size={12.5} color={colors.muted} style={{ marginTop: 2 }}>
                {event.speakerRole}
              </Txt>
            </View>
          </Card>

          {raffle?.winners.length ? (
            <Card style={{ padding: 18, marginTop: 14 }}>
              <Txt weight="extrabold" size={16} color={colors.navy900}>
                Kazananlar
              </Txt>
              <Txt size={12.5} leading={1.5} color={colors.muted} style={{ marginTop: 4 }}>
                {/* Names are masked: publishing them in full would expose the
                    winners to everyone who opens the app, and the shortened form
                    is enough for a winner to recognise themselves. */}
                İsimler kısaltılmış olarak yayınlanıyor. Kendini görüyorsan kulüple iletişime geç.
              </Txt>

              <View style={{ marginTop: 14, gap: 8 }}>
                {raffle.winners.map((winner, i) => (
                  <View key={`${winner}-${i}`} style={styles.winnerRow}>
                    <Txt weight="bold" size={12} color={colors.blue500}>
                      {i + 1}
                    </Txt>
                    <Txt weight="semibold" size={14.5} color={colors.text}>
                      {winner}
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Guideline 5.3.1: düzenleyen, ücretsizlik, rastgelelik ve Apple
              feragati çekiliş kartında görünmek zorunda. Bir kez tam olarak bu
              eksik olduğu için reddedildik. */}
          {raffle ? <RaffleNotice style={{ marginTop: 14 }} /> : null}

          {/* Yoklama kartı yalnızca ETKİNLİĞİN KENDİ GÜNÜNDE çiziliyor.
              Pencere zaten o gün açık (bir saat öncesinden gün sonuna), ve
              düğmeyi bir ay önceden göstermek kullanıcıya yapamayacağı bir şey
              teklif etmek olurdu. Karşılaştırma metin üzerinden: `startsAt`
              +03:00 damgalı ve `todayLocal` da aynı kaydırmayı kullanıyor,
              yani yurt dışındaki telefon günü kaydırmıyor. */}
          {!past && event.startsAt.slice(0, 10) === todayLocal(new Date()) ? (
            <View style={styles.yoklamaKarti}>
              <Txt weight="bold" size={14.5} color={colors.text}>
                Bugün bu etkinlik var
              </Txt>
              <Txt size={12.5} leading={1.55} color={colors.muted} style={{ marginTop: 5 }}>
                Etkinlikteki QR kodunu okutarak yoklamana katıl. Katılım sertifikan
                buradan çıkıyor.
              </Txt>
              <Pressable
                onPress={() => router.push(`/qr?eventId=${event.id}`)}
                style={{ paddingTop: 12 }}
              >
                <Txt weight="semibold" size={13} color={colors.blue500}>
                  QR ile yoklama
                </Txt>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Konuşmacı bloğunun dışında: şerit kenara kadar kayabilsin diye kendi
            yatay boşluğunu kendi veriyor. Kapak hero'da çiziliyor, galeri
            kalanları gösteriyor ve tek görsel varsa hiç çıkmıyor. */}
        <PhotoGallery photos={event.photos ?? []} />
      </ScrollView>

      <LinearGradient
        colors={['rgba(244,249,251,0)', colors.bg, colors.bg]}
        locations={[0, 0.24, 1]}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={11.5} color={colors.faint}>
            {past
              ? 'Tamamlandı'
              : raffle
                ? 'Çekiliş'
                : registration
                  ? registration.blocked && !registration.synced
                    ? 'Kayıt kabul edilmedi'
                    : 'Kayıt kodun'
                  : 'Kontenjan'}
          </Txt>
          <Txt weight="extrabold" size={14} color={colors.navy900}>
            {past
              ? event.attendance === undefined
                ? event.facts.find((f) => f.label === 'Tarih')?.value ?? 'Arşivde'
                : `${event.attendance} katılımcı`
              : raffle
                ? raffle.drawnAt
                  ? 'Sonuçlandı'
                  : `${raffle.winnerCount} kişi kazanacak`
                : registration
                  ? registration.blocked && !registration.synced
                    ? 'Bu numarayla zaten kayıt olunmuş olabilir'
                    : registration.code
                  : seatsLabel(event, registered)}
          </Txt>
        </View>

        {past ? (
          <View style={styles.registered}>
            <Txt weight="bold" size={15.5} color={colors.muted}>
              {registration ? `Katıldın · ${registration.code}` : 'Bu etkinlik geçti'}
            </Txt>
          </View>
        ) : raffle ? (
          raffleEntry ? (
            <View style={styles.registered}>
              <Txt weight="bold" size={15.5} color={colors.blue500}>
                {raffleEntry.synced ? 'Katıldın' : 'Gönderiliyor…'}
              </Txt>
            </View>
          ) : entriesOpen(raffle) ? (
            <PrimaryButton
              label="Çekilişe Katıl"
              onPress={() => router.push(`/cekilis/${event.id}`)}
              style={{ flex: 1.3 }}
            />
          ) : (
            <View style={styles.registered}>
              <Txt weight="bold" size={15.5} color={colors.muted}>
                Katılım kapandı
              </Txt>
            </View>
          )
        ) : registration ? (
          registration.blocked && !registration.synced ? (
            // Kural reddetti ve yeniden denemek bunu değiştirmiyor. En olası
            // sebep aynı numarayla zaten kayıt olunmuş olması — ama Firestore
            // sebebi söylemediği için iddia etmiyoruz, elle tekrar deneme
            // bırakıyoruz.
            <PrimaryButton
              label="Tekrar dene"
              onPress={syncPending}
              style={{ flex: 1.3 }}
            />
          ) : (
            <View style={styles.registered}>
              <Txt weight="bold" size={15.5} color={colors.blue500}>
                {registration.synced ? 'Kayıtlısın' : 'Gönderiliyor…'}
              </Txt>
            </View>
          )
        ) : full ? (
          // Kayıtlı olan öğrenci bu dala hiç düşmüyor: kontenjan dolduktan
          // sonra kendi kaydını görmeye devam ediyor.
          <View style={styles.registered}>
            <Txt weight="bold" size={15.5} color={colors.muted}>
              Kontenjan doldu
            </Txt>
          </View>
        ) : (
          <PrimaryButton
            label="Kayıt Ol"
            onPress={() => router.push(`/kayit/${event.id}`)}
            style={{ flex: 1.3 }}
          />
        )}
      </LinearGradient>
    </View>
  );
}

/** "Mert Aydın" → "MA"; single-word speakers such as "Panel" keep one letter. */
function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr');
}

const styles = StyleSheet.create({
  yoklamaKarti: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.blue200,
    borderRadius: radius.md,
    padding: 16,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.blue100,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  screen: { flex: 1, backgroundColor: colors.bg },

  hero: { height: 280 },
  heroBack: { position: 'absolute', left: 16 },
  heroCaption: { position: 'absolute', left: 20, right: 20, bottom: 18 },

  facts: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  block: { paddingHorizontal: 20, paddingTop: 22 },
  tags: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  speaker: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  speakerAvatar: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  registered: {
    flex: 1.3,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.blue200,
    backgroundColor: colors.blue100,
  },
});
