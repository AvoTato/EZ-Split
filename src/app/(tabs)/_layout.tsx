import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { setGroupSettlementSetup } from '../../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_DARK = '#5B3FD8';
const PURPLE_TINT = '#F0ECFD';
const INK = '#1A1530';
const MUTED = '#6B6880';
const BORDER = '#E6E3F0';

type TabItem = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const LEFT: TabItem = { route: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' };
const RIGHT: TabItem = { route: 'groups', label: 'Groups', icon: 'people-outline', iconActive: 'people' };

function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const router = useRouter();
  const activeRoute = state.routes[state.index]?.name;

  const goTo = (route: string) => {
    const target = state.routes.find((item) => item.name === route);
    if (!target) return;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (activeRoute !== route && !event.defaultPrevented) navigation.navigate(route);
  };

  const startInstant = () => {
    setGroupSettlementSetup(null);
    router.push('/upload-file');
  };

  const renderTab = (item: TabItem) => {
    const focused = activeRoute === item.route;
    return (
      <Pressable
        key={item.route}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: focused }}
        onPress={() => goTo(item.route)}
        style={styles.tabSlot}
      >
        <View style={[styles.tabPill, focused && styles.tabPillActive]}>
          <Ionicons
            name={focused ? item.iconActive : item.icon}
            size={24}
            color={focused ? PURPLE_DARK : MUTED}
          />
          <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{item.label}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.inner}>
        {renderTab(LEFT)}
        <View style={styles.centerSlot} />
        {renderTab(RIGHT)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start instant split"
          onPress={startInstant}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Ionicons name="add" size={36} color={INK} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
  },
  centerSlot: {
    width: 70,
  },
  tabPill: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  tabPillActive: {
    backgroundColor: PURPLE_TINT,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: MUTED,
    marginTop: 2,
  },
  tabLabelActive: {
    color: PURPLE_DARK,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -32,
    top: -30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PURPLE,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: {
    opacity: 0.85,
  },
});
