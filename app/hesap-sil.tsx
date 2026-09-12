import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  authErrorMessage,
  deletionDone,
  finishAccountDeletion,
  requestAccountDeletion,
} from '../src/auth';
import { useAuth } from '../src/authStore';
import { ErrorBanner, Field, Input } from '../src/components/AuthForm';
import { GlassButton, GradientHeader, PrimaryButton, Txt } from '../src/components/ui';
import { colors, gradients, radius } from '../src/theme';

/**
 * Hesap silme.
 *
 * Kendi ekranı, hesap sekmesinin dibindeki bir bölüm değil: geri alınamayan
 * bir işlem, yanlışlıkla dokunulabilecek bir yerde durmamalı. Apple da
 * "gereksiz yere zorlaştırmayın" derken adım sayısını değil, engelleri
 * kastediyor — ayrı bir ekran + parola + onay, izin verilen doğrulama.
 */

/** Panel yoklayıcısı bir dakikada bir koşuyor; ekran ondan sık sormasın. */
const SILME_YOKLAMA_MS = 5000;
const SILME_DENEME = 24; // ~2 dakika

export default function HesapSilRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();

  const [parola, setParola] = useState('');
  const [siliniyor, setSiliniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/giris');
  }, [loading, user, router]);

  /**
   * Talep yazılır, panel temizler, **en son** Auth kaydı silinir.
   *
   * Sıra tersine dönerse istemci kendi talebinin bittiğini okuyamaz ve
   * Apple'ın istediği "tamamlandı" onayı verilemez.
   */
  const sil = async () => {
    if (!user) return;
    setSiliniyor(true);
    setHata(null);
    try {
      await requestAccountDeletion(parola);

      const bekle = async (kalan: number): Promise<boolean> => {
        if (kalan <= 0) return false;
        if (await deletionDone(user.uid).catch(() => false)) return true;
        await new Promise((r) => setTimeout(r, SILME_YOKLAMA_MS));
        return bekle(kalan - 1);
      };

      const bitti = await bekle(SILME_DENEME);
      await finishAccountDeletion().catch(() => {
        // Auth kaydı silinemezse panel zaman aşımıyla siliyor. Kullanıcıya
        // "silinmedi" demek yanlış olurdu: verisi gitti.
      });

      Alert.alert(
        'Hesabınız silindi',
        bitti
          ? 'Hesabınız ve verileriniz kalıcı olarak silindi.'
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
            Hesabımı sil
          </Txt>
        </View>
      </GradientHeader>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorBanner message={hata} />

        <View style={styles.card}>
          <Txt weight="bold" size={15} color={colors.text}>
            Silinecek olanlar
          </Txt>
          {[
            'Hesabın ve giriş bilgilerin',
            'Ad soyad, e-posta, doğum tarihi, telefon',
            'Etkinlik kayıtların ve çekiliş katılımların',
          ].map((satir) => (
            <Txt key={satir} size={13} leading={1.55} color={colors.muted} style={{ marginTop: 8 }}>
              • {satir}
            </Txt>
          ))}
          <Txt size={13} leading={1.55} color={colors.danger} style={{ marginTop: 14 }}>
            Bu işlem geri alınamaz.
          </Txt>
        </View>

        <Field label="Parolanı yaz">
          <Input
            value={parola}
            onChangeText={setParola}
            placeholder="Parolanız"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
        </Field>

        <PrimaryButton
          label={siliniyor ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}
          onPress={() => {
            Alert.alert('Emin misiniz?', 'Hesabınız ve tüm verileriniz silinecek.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: () => void sil() },
            ]);
          }}
          disabled={siliniyor || parola.length === 0}
        />

        <Txt size={12} leading={1.5} color={colors.faint} style={{ marginTop: 4 }}>
          Uygulamaya giriş yapamıyorsan aynı işlemi web sitemizdeki hesap silme
          sayfasından da yapabilirsin.
        </Txt>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 22, gap: 18 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 16,
  },
});
