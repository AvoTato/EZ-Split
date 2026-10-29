import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { money } from '../lib/format';
import { getGroup, removeSettlement, type GroupSettlement } from '../lib/groups';
import { computeInsights } from '../lib/insights';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup, setSettlementSummarySession } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_TINT = '#E4DCFB';
const MUTED = '#8A8A8A';
const BAR_AREA_HEIGHT = 72;

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function ReceiptHistoryScreen() {
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
    Alert.alert('Delete settlement', `Delete "${settlement.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeSettlement(groupId, settlement.id);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBack(router, '/(tabs)/groups')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <View style={styles.backIcon}>
              <Ionicons name="chevron-back" size={24} color="#191919" />
              <Ionicons name="chevron-back" size={24} color="#191919" style={styles.secondChevron} />
            </View>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Receipt History
            </Text>
            {groupName.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {groupName}
              </Text>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {settlements.length === 0 && <Text style={styles.emptyText}>No settlements yet.</Text>}
          {settlements.map((settlement) => (
            <View key={settlement.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {settlement.name}
                </Text>
                <Text style={styles.cardDate}>{formatDate(settlement.createdAt)}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${settlement.name}`}
                  onPress={() => viewSettlement(settlement)}
                  style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}
                >
                  <Text style={styles.actionText}>View</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${settlement.name}`}
                  onPress={() => deleteSettlement(settlement)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                >
                  <Text style={styles.actionText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {settlements.length > 0 && (
            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>Insights</Text>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{money(insights.thisMonthTotal)}</Text>
                  <Text style={styles.statLabel}>
                    This month · {insights.thisMonthCount} {insights.thisMonthCount === 1 ? 'bill' : 'bills'}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{money(insights.averageBill)}</Text>
                  <Text style={styles.statLabel}>Average bill</Text>
                </View>
              </View>

              <View style={styles.bars} accessibilityLabel="Spending over the last 6 months">
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

              <View style={styles.factList}>
                {insights.topPayer && (
                  <Text style={styles.factText}>
                    <Text style={styles.factStrong}>{insights.topPayer.name}</Text> usually pays (
                    {insights.topPayer.count} {insights.topPayer.count === 1 ? 'bill' : 'bills'})
                  </Text>
                )}
                {insights.topSpender && (
                  <Text style={styles.factText}>
                    <Text style={styles.factStrong}>{insights.topSpender.name}</Text> has the biggest share overall (
                    {money(insights.topSpender.total)})
                  </Text>
                )}
                {insights.biggestBill && (
                  <Text style={styles.factText}>
                    Biggest bill: <Text style={styles.factStrong}>{insights.biggestBill.name}</Text> (
                    {money(insights.biggestBill.total)})
                  </Text>
                )}
                {!insights.topPayer && (
                  <Text style={styles.factHint}>Set who paid on each bill to see who usually pays.</Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10 },
  backButton: { minWidth: 30, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  backIcon: { flexDirection: 'row', alignItems: 'center' },
  secondChevron: { marginLeft: -16 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#171717' },
  headerSubtitle: { fontSize: 14, color: '#696171', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 110,
    padding: 14,
    backgroundColor: '#E9D9FF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
  cardInfo: { flex: 1, minWidth: 0, justifyContent: 'space-between' },
  cardTitle: { fontSize: 20, fontWeight: '500', color: '#111' },
  cardDate: { fontSize: 20, color: '#111' },
  cardActions: { justifyContent: 'center', gap: 6 },
  viewButton: { minWidth: 96, paddingVertical: 6, borderRadius: 20, backgroundColor: '#3B7BFF', alignItems: 'center' },
  deleteButton: { minWidth: 96, paddingVertical: 6, borderRadius: 20, backgroundColor: '#E5484D', alignItems: 'center' },
  actionText: { fontSize: 16, fontWeight: '500', color: '#111' },
  insightsCard: {
    gap: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#333',
  },
  insightsTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '700', color: PURPLE },
  statLabel: { fontSize: 13, color: MUTED },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: BAR_AREA_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barCurrent: { backgroundColor: PURPLE },
  barPast: { backgroundColor: PURPLE_TINT },
  barEmpty: { backgroundColor: '#E5E5E5' },
  barLabel: { fontSize: 12, color: MUTED },
  factList: { gap: 6 },
  factText: { fontSize: 14, color: '#171717' },
  factStrong: { fontWeight: '700' },
  factHint: { fontSize: 13, color: MUTED },
  emptyText: { textAlign: 'center', paddingVertical: 24, color: '#75717F', fontSize: 16 },
  pressed: { opacity: 0.65 },
});
