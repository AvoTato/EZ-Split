import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroup, removeSettlement, type GroupSettlement } from '../lib/groups';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup, setSettlementSummarySession } from '../lib/receiptSession';

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
  emptyText: { textAlign: 'center', paddingVertical: 24, color: '#75717F', fontSize: 16 },
  pressed: { opacity: 0.65 },
});
