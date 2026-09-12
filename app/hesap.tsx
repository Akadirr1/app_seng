import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPhone } from '../src/accountSchema';
import {
  authErrorMessage,
  deletionDone,
  finishAccountDeletion,
  refreshVerification,
  requestAccountDeletion,
  resendVerification,
  signOut,
} from '../src/auth';
import { useAuth } from '../src/authStore';
import { ErrorBanner, Field, Input } from '../src/components/AuthForm';
import { GlassButton, GradientHeader, PrimaryButton, Txt } from '../src/components/ui';
import { colors, gradients, radius } from '../src/theme';

/** Panel yoklayıcısı iki dakikada bir koşuyor; ekran ondan sık sormasın. */
const SILME_YOKLAMA_MS = 5000;

export default function AccountRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, loading, reloadProfile } = useAuth();
  const { yeni } = useLocalSearchParams<{ yeni?: string }>();

  const [dogrulandi, setDogrulandi] = useState(!!user?.emailVerified);
  const [hata, setHata] = useState<string | null>(null);
  const [silmeAcik, setSilmeAcik] = useState(false);
  const [silmeParola, setSilmeParola] = useState('');
  const [siliniyor, setSiliniyor] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/giris');
  }, [loading, user, router]);

  const dogrulamayiTazele = async () => {
    setHata(null);
    try {
      const ok = await refreshVerification();
      setDogrulandi(ok);
      if (!ok) setHata('E-posta henüz doğrulanmamış görünüyor. Bağlantıya bastıysanız birkaç saniye sonra tekrar deneyin.');
    } catch (err) {
      setHata(authErrorMessage(err));
    }
  };

  /**
   * Silme: talep yazılır, panel temizler, **en son** Auth kaydı silinir.
   *
   * Sıra tersine dönerse istemci kendi talebinin bittiğini okuyamaz ve
   * Apple'ın istediği "tamamlandı" onayı verilemez.
   */
  const hesabiSil = async () => {
    if (!user) return;
    setSiliniyor(true);
    setHata(null);
    try {
      await requestAccountDeletion(silmeParola);

      // Temizlik sunucuda; ekran bitmesini bekliyor ki onay gösterilebilsin.
      const bekle = async (kalanDeneme: number): Promise<boolean> => {
        if (kalanDeneme <= 0) return false;
        if (await deletionDone(user.uid).catch(() => false)) return true;
        await new Promise((r) => setTimeout(r, SILME_YOKLAMA_MS));
        return bekle(kalanDeneme - 1);
      };

      const bitti = await bekle(24); // ~2 dakika: panel yoklayıcısının periyodu
      await finishAccountDeletion().catch(() => {
        // Auth kaydı silinemezse panel zaman aşımıyla siliyor. Kullanıcıya
        // "silinmedi" demek yanlış olurdu: verisi gitti.
      });

      Alert.alert(
        'Hesabınız silindi',
        bitti
          ? 'Hesabınız ve verileriniz silindi.'
          : 'Talebiniz alındı. Verileriniz kısa süre içinde tamamen silinecek.',
      );
      router.replace('/(tabs)/takvim');
    } catch (err) {
      setHata(authErrorMessage(err));
    } finally {
      setSiliniyor(false);
    }
  };

  if (loading || !user) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <GradientHeader gradient={gradients.section}>
        <View style={styles.headerRow}>
          <GlassButton label="‹" accessibilityLabel="Geri" onPress={() => router.back()} size={36} />
          <Txt weight="extrabold" size={20} color="#fff" style={{ marginLeft: 12 }}>
            Hesabım
          </Txt>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}>
        <ErrorBanner message={hata} />

        {yeni ? (
          <View style={styles.card}>
            <Txt weight="bold" size={15} color={colors.text}>
              Hoş geldin!
            </Txt>
            <Txt size={13} leading={1.5} color={colors.muted} style={{ marginTop: 6 }}>
              Hesabın oluşturuldu. Etkinliklere katılabilmek için e-posta adresini
              doğrulaman gerekiyor.
            </Txt>
          </View>
        ) : null}

        {!dogrulandi ? (
          <View style={styles.card}>
            <Txt weight="bold" size={15} color={colors.text}>
              E-postanı doğrula
            </Txt>
            <Txt size={13} leading={1.5} color={colors.muted} style={{ marginTop: 6 }}>
              {user.email} adresine bir bağlantı gönderdik. Bağlantıya bastıktan
              sonra aşağıdaki düğmeye dokun.
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={dogrulamayiTazele} style={styles.smallBtn}>
                <Txt weight="semibold" size={13} color={colors.blue500}>
                  Doğruladım
                </Txt>
              </Pressable>
              <Pressable
                onPress={() => {
                  resendVerification().catch(() => {});
                  setHata(null);
                }}
                style={styles.smallBtn}
              >
                <Txt weight="semibold" size={13} color={colors.muted}>
                  Tekrar gönder
                </Txt>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Row label="Ad Soyad" value={profile?.adSoyad ?? '—'} />
          <Row label="E-posta" value={user.email ?? '—'} />
          <Row label="Telefon" value={profile ? formatPhone(profile.telefon) : '—'} />
          <Row label="Doğum tarihi" value={profile?.dogumTarihi ?? '—'} />
          {!profile ? (
            <Pressable onPress={() => void reloadProfile()} style={{ paddingTop: 8 }}>
              <Txt weight="semibold" size={13} color={colors.blue500}>
                Bilgileri yeniden yükle
              </Txt>
            </Pressable>
          ) : null}
        </View>

        <PrimaryButton
          label="Çıkış yap"
          onPress={() => {
            signOut()
              .then(() => router.replace('/(tabs)/takvim'))
              .catch(() => setHata('Çıkış yapılamadı.'));
          }}
        />

        {/* Apple 5.1.1(v): hesap oluşturmayı destekleyen uygulama, silmeyi de
            uygulama içinden başlatılabilir hâlde sunmak zorunda. */}
        <View style={styles.dangerZone}>
          <Txt weight="bold" size={15} color={colors.text}>
            Hesabımı sil
          </Txt>
          <Txt size={12.5} leading={1.5} color={colors.muted} style={{ marginTop: 6 }}>
            Hesabın, profil bilgilerin, etkinlik kayıtların ve çekiliş
            katılımların kalıcı olarak silinir. Bu işlem geri alınamaz.
          </Txt>

          {silmeAcik ? (
            <View style={{ gap: 14, marginTop: 14 }}>
              <Field label="Parolanı yaz">
                <Input
                  value={silmeParola}
                  onChangeText={setSilmeParola}
                  placeholder="Parolanız"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </Field>
              <PrimaryButton
                label={siliniyor ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}
                onPress={() => {
                  Alert.alert('Emin misiniz?', 'Hesabınız ve tüm verileriniz silinecek.', [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: () => void hesabiSil() },
                  ]);
                }}
                disabled={siliniyor || silmeParola.length === 0}
              />
            </View>
          ) : (
            <Pressable onPress={() => setSilmeAcik(true)} style={{ paddingTop: 12 }}>
              <Txt weight="semibold" size={13} color={colors.danger}>
                Hesabımı silmek istiyorum
              </Txt>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Txt size={12.5} color={colors.muted}>
        {label}
      </Txt>
      <Txt weight="semibold" size={14} color={colors.text} style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 22, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
  },
  row: { paddingVertical: 7 },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  dangerZone: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 8,
  },
});
