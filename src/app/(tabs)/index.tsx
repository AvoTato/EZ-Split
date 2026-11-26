import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ShareBillModal from '../../components/ShareBillModal';
import { billSections, reminderSessionFor, type BillFriend, type BillSection } from '../../lib/debts';
import { money } from '../../lib/format';
import { getGroups } from '../../lib/groups';
import { setGroupSettlementSetup } from '../../lib/receiptSession';
import { getSettings } from '../../lib/settings';
import { useColors, useIsDark, type Colors } from '../../lib/theme';
import { useT } from '../../lib/i18n';

const AVATAR_COLORS = ['#C2185B', '#B45309', '#0F766E', '#4338CA', '#7C3AED', '#0369A1'];
const MAX_ATTENTION = 3;

type AttentionRow = {
  key: string;
  groupName: string;
  section: BillSection & { payer: { id: string; name: string } };
  friend: BillFriend;
};

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function loadAttention(): AttentionRow[] {
  const rows: (AttentionRow & { createdAt: number })[] = [];
  getGroups().forEach((group) => {
    billSections(group.settlements ?? []).forEach((section) => {
      const payer = section.payer;
      if (!payer) return;
      section.friends.forEach((friend) => {
        if (friend.paidBack) return;
        rows.push({
          key: `${group.id}:${section.id}:${friend.id}`,
          groupName: group.name,
          section: { ...section, payer },
          friend,
          createdAt: section.createdAt,
        });
      });
    });
  });
  return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ATTENTION);
}

export default function HomeScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK } = colors;
  const dark = useIsDark();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [attention, setAttention] = useState<AttentionRow[]>(loadAttention);
  const [remindFor, setRemindFor] = useState<AttentionRow | null>(null);
  const [nudge, setNudge] = useState(() => getSettings().nudge);

  useFocusEffect(
    useCallback(() => {
      setAttention(loadAttention());
      setNudge(getSettings().nudge);
    }, []),
  );

  const startInstant = () => {
    setGroupSettlementSetup(null);
    router.push('/upload-file');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Image
              source={dark ? require('../../../assets/images/ezsplit-logo-dark.png') : require('../../../assets/images/ezsplit-logo.png')}
              style={styles.logo}
              contentFit="contain"
              contentPosition="left"
            />
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Backup')}
              style={styles.cloudButton}
              onPress={() => router.push('/backup')}
            >
              <Ionicons name="cloud-outline" size={26} color={PURPLE_DARK} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Settings')}
              style={styles.cloudButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={26} color={PURPLE_DARK} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.title}>{t('Who are we splitting with?')}</Text>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="camera-outline" size={34} color={INK} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t('Scan a receipt')}</Text>
              <Text style={styles.heroSubtitle}>{t('We read the items so you only pick who had what.')}</Text>
            </View>
          </View>
          <Pressable style={styles.heroButton} onPress={startInstant}>
            <Text style={styles.heroButtonText}>{t('Take or upload photo')}</Text>
          </Pressable>
        </View>

        <View style={styles.cards}>
          <Pressable style={styles.card} onPress={startInstant}>
            <View style={styles.cardIcon}>
              <Ionicons name="flash-outline" size={26} color={PURPLE_DARK} />
            </View>
            <Text style={styles.cardTitle}>{t('Instant split')}</Text>
            <Text style={styles.cardSubtitle}>{t('One-off bill, no group needed')}</Text>
          </Pressable>
          <Pressable style={styles.card} onPress={() => router.push('/create-group-settlement')}>
            <View style={styles.cardIcon}>
              <Ionicons name="people-outline" size={26} color={PURPLE_DARK} />
            </View>
            <Text style={styles.cardTitle}>{t('Group split')}</Text>
            <Text style={styles.cardSubtitle}>{t('Track who has paid you back')}</Text>
          </Pressable>
        </View>

        {nudge && attention.length > 0 && (
          <View style={styles.attention}>
            <View style={styles.attentionHeader}>
              <Text style={styles.attentionTitle}>{t('Needs your attention')}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/groups')} hitSlop={8}>
                <Text style={styles.seeAll}>{t('See all')}</Text>
              </Pressable>
            </View>
            {attention.map((row) => (
              <View key={row.key} style={styles.attentionRow}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(row.friend.name) }]}>
                  <Text style={styles.avatarText}>{row.friend.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.attentionCopy}>
                  <Text style={styles.attentionOwes}>
                    {t('{name} owes {payer} {amount}', { name: row.friend.name, payer: row.section.payer.name, amount: money(row.friend.amount) })}
                  </Text>
                  <Text style={styles.attentionMeta} numberOfLines={1}>
                    {row.section.name} · {row.groupName}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Remind {name}', { name: row.friend.name })}
                  style={styles.remindButton}
                  onPress={() => setRemindFor(row)}
                >
                  <Text style={styles.remindText}>{t('Remind')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {remindFor && (
        <ShareBillModal
          remindOnly
          visible
          title={remindFor.section.name}
          session={reminderSessionFor({
            fromId: remindFor.friend.id,
            fromName: remindFor.friend.name,
            toId: remindFor.section.payer.id,
            toName: remindFor.section.payer.name,
            amount: remindFor.friend.amount,
          })}
          onClose={() => setRemindFor(null)}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  page: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  logo: {
    width: 150,
    height: 48,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    color: INK,
    letterSpacing: -1,
    marginTop: 20,
    marginBottom: 28,
  },
  hero: {
    backgroundColor: PURPLE,
    borderRadius: 32,
    padding: 22,
    gap: 22,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: ON_PURPLE,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: ON_PURPLE,
    marginTop: 2,
  },
  heroButton: {
    backgroundColor: SURFACE,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  cards: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
  },
  card: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: PURPLE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: MUTED,
    marginTop: 4,
  },
  attention: {
    marginTop: 32,
    gap: 14,
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attentionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.5,
  },
  seeAll: {
    fontSize: 17,
    fontWeight: '700',
    color: PURPLE_DARK,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  attentionCopy: {
    flex: 1,
  },
  attentionOwes: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  attentionMeta: {
    fontSize: 15,
    color: MUTED,
    marginTop: 2,
  },
  remindButton: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: PURPLE,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  remindText: {
    fontSize: 17,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
});
