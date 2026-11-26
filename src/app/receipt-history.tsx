import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { payBackStatus } from '../lib/debts';
import { money } from '../lib/format';
import { getGroup, removeSettlement, type GroupSettlement } from '../lib/groups';
import { billTotal, computeInsights } from '../lib/insights';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup, setSettlementSummarySession } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT, localeTag } from '../lib/i18n';

const BAR_AREA_HEIGHT = 72;

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });
}

export default function ReceiptHistoryScreen() {
  const t = useT();
  const colors = useColors();
  const { INK, MUTED, PANEL, GREEN_TINT, GREEN, AMBER_TINT, AMBER, RED } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [groupName, setGroupName] = useState('');
  const [settlements, setSettlements] = useState<GroupSettlement[]>([]);

  const load = useCallback(() => {
    const group = groupId ? getGroup(groupId) : undefined;
    setGroupName(group?.name ?? '');
    setSettlements(group?.settlements ?? []);
  }, [groupId]);

  useFocusEffect(load);

  const insights = computeInsights(settlements);
  const maxMonth = Math.max(...insights.months.map((month) => month.total), 0);
  const recent = [...settlements].sort((a, b) => b.createdAt - a.createdAt);

  const viewSettlement = (settlement: GroupSettlement) => {
    setGroupSettlementSetup(null);
    setSettlementSummarySession(settlement.summary);
    router.push({
      pathname: '/settlement-summary',
      params: { groupId, settlementId: settlement.id },
    });
  };

  const deleteSettlement = (settlement: GroupSettlement) => {
    if (!groupId) return;
    Alert.alert(t('Delete settlement'), t('Delete "{name}"?', { name: settlement.name }), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: () => {
          removeSettlement(groupId, settlement.id);
          load();
        },
      },
    ]);
  };

  const renderPill = (settlement: GroupSettlement) => {
    const status = payBackStatus(settlement.summary);
    if (!status.payer) {
      return (
        <View style={[styles.pill, { backgroundColor: PANEL }]}>
          <Text style={[styles.pillText, { color: MUTED }]}>{t('No payer set')}</Text>
        </View>
      );
    }
    const allPaid = status.remaining === 0;
    return (
      <View style={[styles.pill, { backgroundColor: allPaid ? GREEN_TINT : AMBER_TINT }]}>
        <Text style={[styles.pillText, { color: allPaid ? GREEN : AMBER }]}>
          {allPaid ? t('All paid back') : t('{n} of {total} paid', { n: status.paidBackCount, total: status.friends.length })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Go back')}
            onPress={() => goBack(router, '/(tabs)/groups')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View style={styles.headerText}>
            {groupName.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {groupName}
              </Text>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>{t('Settlements')}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {settlements.length === 0 && <Text style={styles.emptyText}>{t('No settlements yet.')}</Text>}

          {settlements.length > 0 && (
            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>{t('Insights')}</Text>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>{t('Average bill')}</Text>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                    {money(insights.averageBill)}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>{t('Total spent')}</Text>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                    {money(insights.totalSpent)}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>{t('Biggest bill')}</Text>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                    {money(insights.biggestBill?.total ?? 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.bars} accessibilityLabel={t('Spending over the last 6 months')}>
                {insights.months.map((month, index) => {
                  const isCurrent = index === insights.months.length - 1;
                  const height =
                    month.total > 0 && maxMonth > 0
                      ? Math.max(6, (month.total / maxMonth) * BAR_AREA_HEIGHT)
                      : 3;
                  return (
                    <View key={month.key} style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            { height },
                            isCurrent ? styles.barCurrent : styles.barPast,
                            month.total === 0 && styles.barEmpty,
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{month.label}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.caption}>{t('Spending, last 6 months')}</Text>
            </View>
          )}

          {recent.length > 0 && <Text style={styles.sectionLabel}>{t('RECENT')}</Text>}
          {recent.map((settlement) => {
            const payer = payBackStatus(settlement.summary).payer;
            return (
              <View key={settlement.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {settlement.name}
                  </Text>
                  <Text style={styles.cardTotal}>{money(billTotal(settlement.summary))}</Text>
                </View>
                <Text style={styles.cardSub}>
                  {formatDate(settlement.createdAt)}
                  {payer ? ` · ${t('{name} paid upfront', { name: payer.name })}` : ''}
                </Text>
                <View style={styles.cardBottom}>
                  {renderPill(settlement)}
                  <View style={styles.spacer} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('View {name}', { name: settlement.name })}
                    onPress={() => viewSettlement(settlement)}
                    style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.viewText}>{t('View')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('Delete {name}', { name: settlement.name })}
                    onPress={() => deleteSettlement(settlement)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="trash-outline" size={22} color={RED} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  headerText: { flex: 1, minWidth: 0 },
  headerSubtitle: { fontSize: 14, fontWeight: '700', color: MUTED },
  headerTitle: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 14 },
  insightsCard: { gap: 14, padding: 20, borderRadius: 26, backgroundColor: PURPLE },
  insightsTitle: { fontSize: 16, fontWeight: '800', color: ON_PURPLE },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, minWidth: 0 },
  statLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(26, 21, 48, 0.55)' },
  statValue: { fontSize: 20, fontWeight: '800', color: ON_PURPLE, letterSpacing: -0.4 },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: BAR_AREA_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barCurrent: { backgroundColor: ON_PURPLE },
  barPast: { backgroundColor: 'rgba(255, 255, 255, 0.65)' },
  barEmpty: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  barLabel: { fontSize: 12, fontWeight: '700', color: ON_PURPLE },
  caption: { fontSize: 12, color: 'rgba(26, 21, 48, 0.55)' },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: MUTED, letterSpacing: 0.4, marginTop: 6 },
  card: { padding: 18, borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  cardTotal: { fontSize: 20, fontWeight: '800', color: INK },
  cardSub: { fontSize: 14, color: MUTED },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  pill: { flexShrink: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  spacer: { flex: 1 },
  pillText: { fontSize: 15, fontWeight: '800' },
  viewButton: { height: 44, paddingHorizontal: 28, borderRadius: 18, backgroundColor: PURPLE_TINT, alignItems: 'center', justifyContent: 'center' },
  viewText: { fontSize: 16, fontWeight: '800', color: PURPLE_DARK },
  deleteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: 24, color: MUTED, fontSize: 16 },
  pressed: { opacity: 0.65 },
});
