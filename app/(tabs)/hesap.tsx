import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatPhone } from '../../src/accountSchema';
import { signOut } from '../../src/auth';
import { useAuth } from '../../src/authStore';
import { PixelIcon } from '../../src/components/Pixel';
import {
  DottedRule,
  GradientHeader,
  GroupLabel,
  PrimaryButton,
  Txt,
} from '../../src/components/ui';
import { useContent } from '../../src/content';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../src/data';
import { useAppStore } from '../../src/store';
import { colors, gradients, radius } from '../../src/theme';
import type { IconName } from '../../src/icons';

/**
 * Hesabım — uygulamanın "benim tarafım" sekmesi.
 *
 * Neden bir sekme: hesapla ilgili her şey (kayıtlarım, bildirim ayarları,
 * yasal metinler, çıkış) tek bir yerden bulunabilmeli. Bunlar ekranlara
 * dağılmışken kullanıcı "kaydım nerede" sorusunu soramıyordu bile.
 *
 * **Sekme giriş istemiyor.** Guideline 5.1.1(v) hesap tabanlı olmayan içeriği
 * giriş duvarının arkasına koymayı yasaklıyor, ve buradaki şeylerin çoğu
 * gerçekten hesaba bağlı değil: kayıtlar cihazda duruyor, bildirim tercihleri
 * cihaza ait. Giriş yapmamış kullanıcı sekmeyi açtığında bir duvar değil,
 * neyi kazanacağını anlatan bir kart görüyor.
 */
export default function HesapRoute() {
  const router = useRouter();
  const { user, profile, loading, emailVerified } = useAuth();
  const { registrations } = useAppStore();
  // Geçmiş etkinlikler de gerekiyor: bir kayıt etkinlik olup bittikten sonra
  // da listede duruyor, ve yalnızca `events` (yaklaşanlar) okunursa kartta
  // etkinliğin adı yerine kimliği görünür.
  const { events, archive } = useContent();
  const tumEtkinlikler = React.useMemo(() => [...events, ...archive], [events, archive]);

  const baslik = profile?.adSoyad ?? user?.email ?? 'Hesabım';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
    >
      <GradientHeader gradient={gradients.section} style={{ paddingBottom: 20 }}>
        <Txt weight="extrabold" size={24} color="#fff" tracking={-0.5}>
          {user ? baslik : 'Hesabım'}
        </Txt>
        <Txt size={12.5} color={colors.blue200} style={{ marginTop: 4 }}>
          {user ? user.email : 'Kayıtların, bildirimlerin ve ayarların'}
        </Txt>
        <DottedRule style={{ marginTop: 12 }} />
      </GradientHeader>

      <View style={styles.body}>
        {loading ? null : user ? (
          <>
            {!emailVerified ? (
              <View style={[styles.card, { borderColor: colors.dangerBorder }]}>
                <Txt weight="bold" size={14.5} color={colors.text}>
                  E-postanı doğrula
                </Txt>
                <Txt size={12.5} leading={1.5} color={colors.muted} style={{ marginTop: 5 }}>
                  Etkinliklere katılabilmek için {user.email} adresine
                  göndereceğimiz altı haneli kodu girmen gerekiyor.
                </Txt>
                <Pressable onPress={() => router.push('/dogrula')} style={{ paddingTop: 12 }}>
                  <Txt weight="semibold" size={13} color={colors.blue500}>
                    E-postamı doğrula
                  </Txt>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.card}>
              <Bilgi label="Ad Soyad" value={profile?.adSoyad ?? '—'} />
              <Bilgi label="E-posta" value={user.email ?? '—'} />
              <Bilgi label="Telefon" value={profile ? formatPhone(profile.telefon) : '—'} />
              <Bilgi label="Doğum tarihi" value={profile?.dogumTarihi ?? '—'} />
            </View>
          </>
        ) : (
          // Duvar değil davet: neyin kazanılacağını söylüyor, gezinmeyi
          // engellemiyor.
          <View style={styles.card}>
            <Txt weight="extrabold" size={17} color={colors.text}>
              Giriş yap
            </Txt>
            <Txt size={13} leading={1.55} color={colors.muted} style={{ marginTop: 8 }}>
              Hesabın olduğunda etkinlik kayıtların telefonun değişse de durur,
              bilgilerini her kayıtta yeniden yazmazsın.
            </Txt>
            <View style={{ gap: 10, marginTop: 16 }}>
              <PrimaryButton label="Giriş yap" onPress={() => router.push('/giris')} />
              <Pressable onPress={() => router.push('/kayit-ol')} style={styles.ghostBtn}>
                <Txt weight="semibold" size={14} color={colors.blue500}>
                  Hesap oluştur
                </Txt>
              </Pressable>
            </View>
          </View>
        )}

        {/* Kayıtlar cihazda duruyor, yani girişten bağımsız gösteriliyor —
            hesabı olmayan kullanıcının da kaydı var ve onu görebilmeli. */}
        <GroupLabel style={styles.groupLabel}>KAYITLARIM</GroupLabel>
        {registrations.length ? (
          <View style={styles.card}>
            {registrations.map((r, i) => {
              const event = tumEtkinlikler.find((e) => e.id === r.eventId);
              return (
                <View key={r.regId}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    onPress={() => router.push(`/etkinlik/${encodeURIComponent(r.eventId)}`)}
                    style={styles.kayitRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt weight="bold" size={14} color={colors.text}>
                        {event?.title ?? r.eventId}
                      </Txt>
                      <Txt size={12} color={colors.muted} style={{ marginTop: 3 }}>
                        {event?.short ?? 'Etkinlik bilgisi yüklenemedi'} · kod {r.code}
                      </Txt>
                    </View>
                    <Txt size={16} color={colors.faint}>
                      ›
                    </Txt>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.card}>
            <Txt size={13} leading={1.5} color={colors.muted}>
              Henüz bir etkinliğe kaydolmadın. Takvimden bir etkinlik seçebilirsin.
            </Txt>
            <Pressable onPress={() => router.navigate('/(tabs)/takvim')} style={{ paddingTop: 12 }}>
              <Txt weight="semibold" size={13} color={colors.blue500}>
                Takvime git
              </Txt>
            </Pressable>
          </View>
        )}

        <GroupLabel style={styles.groupLabel}>AYARLAR</GroupLabel>
        <View style={styles.card}>
          <SatirLink
            icon="bell"
            label="Bildirim ayarları"
            hint="Neyin bildirimini alacağını seç"
            onPress={() => router.push('/bildirim-ayarlari')}
          />
        </View>

        <GroupLabel style={styles.groupLabel}>YASAL</GroupLabel>
        <View style={styles.card}>
          <SatirLink
            icon="lines"
            label="Gizlilik ve KVKK aydınlatma metni"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
          />
          {TERMS_URL ? (
            <>
              <View style={styles.divider} />
              <SatirLink
                icon="lines"
                label="Kullanım koşulları"
                onPress={() => void Linking.openURL(TERMS_URL).catch(() => {})}
              />
            </>
          ) : null}
          <View style={styles.divider} />
          <SatirLink
            icon="gift"
            label="Çekiliş kuralları"
            onPress={() => router.push('/cekilis-kurallari')}
          />
        </View>

        {user ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            <Pressable
              onPress={() => {
                signOut().catch(() => {});
              }}
              style={styles.ghostBtn}
            >
              <Txt weight="semibold" size={14} color={colors.textBody}>
                Çıkış yap
              </Txt>
            </Pressable>
            <Pressable onPress={() => router.push('/hesap-sil')} style={styles.ghostBtn}>
              <Txt weight="semibold" size={13} color={colors.danger}>
                Hesabımı sil
              </Txt>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Bilgi({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bilgiRow}>
      <Txt size={12.5} color={colors.muted}>
        {label}
      </Txt>
      <Txt weight="semibold" size={14} color={colors.text} style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

function SatirLink({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.linkIcon}>
        <PixelIcon name={icon} size={15} color={colors.blue500} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="semibold" size={14} color={colors.text}>
          {label}
        </Txt>
        {hint ? (
          <Txt size={12} color={colors.muted} style={{ marginTop: 2 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <Txt size={16} color={colors.faint}>
        ›
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  groupLabel: { marginTop: 22, marginBottom: 10 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
  },
  bilgiRow: { paddingVertical: 7 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  kayitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  linkIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.blue100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
