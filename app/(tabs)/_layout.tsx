import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PixelIcon } from '../../src/components/Pixel';
import { Txt } from '../../src/components/ui';
import { IconName } from '../../src/icons';
import { colors } from '../../src/theme';

/**
 * expo-router vendors its own copy of react-navigation, so the tab bar props are
 * derived from the `Tabs` component rather than imported from a separate package.
 */
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Ana Sayfa', icon: 'home' },
  { name: 'takvim', label: 'Takvim', icon: 'cal' },
  { name: 'arsiv', label: 'Arşiv', icon: 'grid' },
  { name: 'gundem', label: 'AI Gündem', icon: 'lines' },
  { name: 'hesap', label: 'Hesabım', icon: 'user' },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PixelTabBar {...props} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

/**
 * Custom bar so the active tab can carry the three pixel dots from the design —
 * the stock tab bar has no slot for an indicator like that.
 */
function PixelTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;

        const focused = state.index === i;
        const color = focused ? colors.blue500 : colors.faint;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <PixelIcon name={tab.icon} size={21} color={color} />
            <Txt weight={focused ? 'bold' : 'medium'} size={10.5} color={color} tracking={0.1}>
              {tab.label}
            </Txt>
            <View style={[styles.dots, { opacity: focused ? 1 : 0 }]}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 6 },
  dots: { flexDirection: 'row', gap: 3, height: 4 },
  dot: { width: 4, height: 4, backgroundColor: colors.blue500 },
});
