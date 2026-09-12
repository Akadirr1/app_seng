/**
 * Hesap isteyen bir eylemin önündeki ekran.
 *
 * Kendi bileşeni çünkü iki farklı sebeple çiziliyor (oturum yok / e-posta
 * doğrulanmamış) ve ileride çekiliş katılımı da aynı kapıyı kullanacak.
 * Kapının **yalnızca eylemin** önünde durması Apple 5.1.1(v)'in şartı: hesap
 * tabanlı olmayan içerik giriş duvarının arkasına konulamıyor.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, GradientHeader, PrimaryButton, Txt } from './ui';
import { colors, gradients, radius } from '../theme';

export function AuthGate({
  title,
  body,
  primary,
  onPrimary,
  secondary,
  onSecondary,
  onBack,
}: {
  title: string;
  body: string;
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <GradientHeader gradient={gradients.section}>
        <View style={styles.headerRow}>
          <GlassButton label="‹" accessibilityLabel="Geri" onPress={onBack} size={36} />
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.card}>
          <Txt weight="extrabold" size={19} color={colors.text}>
            {title}
          </Txt>
          <Txt size={13.5} leading={1.55} color={colors.muted} style={{ marginTop: 10 }}>
            {body}
          </Txt>
        </View>

        <PrimaryButton label={primary} onPress={onPrimary} />
        {secondary && onSecondary ? (
          <Pressable onPress={onSecondary} style={styles.secondary}>
            <Txt weight="semibold" size={14} color={colors.blue500}>
              {secondary}
            </Txt>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 26, gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 18,
  },
  secondary: { paddingVertical: 14, alignItems: 'center' },
});
