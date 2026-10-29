import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ShareBillModal from '../components/ShareBillModal';
import {
  billSections,
  overallProgress,
  reminderSessionFor,
  type BillFriend,
  type BillSection,
} from '../lib/debts';
import { money } from '../lib/format';
import { getGroup, migrateLegacyPayments, updateSettlementSummary } from '../lib/groups';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup, setSettlementSummarySession } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_TINT = '#F1EDFD';
const MUTED = '#8A8A8A';
const GREEN = '#2E7D32';
const GREEN_TINT = '#E6F4EA';
const SNACKBAR_MS = 6000;

type Toast = { message: string; onUndo?: () => void };
type RemindTarget = { section: BillSection; friend: BillFriend };

function formatBillDate(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function GroupBalancesScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [groupName, setGroupName] = useState('');
  const [sections, setSections] = useState<BillSection[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [remindFor, setRemindFor] = useState<RemindTarget | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), SNACKBAR_MS);
  }, []);

  const load = useCallback(() => {
    if (!groupId) return;
    const { unmatched } = migrateLegacyPayments(groupId);
    const group = getGroup(groupId);
    setGroupName(group?.name ?? '');
    setSections(billSections(group?.settlements ?? []));
    if (unmatched > 0) {
      showToast({
        message: `${unmatched} earlier ${unmatched === 1 ? 'payment' : 'payments'} couldn't be matched to a settlement`,
      });
    }
  }, [groupId, showToast]);

  useFocusEffect(load);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const setPaidBack = (section: BillSection, friend: BillFriend, paidBack: boolean) => {
    if (!groupId) return;
    const bill = getGroup(groupId)?.settlements?.find((item) => item.id === section.id);
    const current = bill?.summary.settledIds ?? [];
    const next = paidBack
      ? current.includes(friend.id)
        ? current
        : [...current, friend.id]
      : current.filter((id) => id !== friend.id);
    updateSettlementSummary(groupId, section.id, { settledIds: next.length > 0 ? next : undefined });
    load();
  };

  const togglePaid = (section: BillSection, friend: BillFriend) => {
    const nextPaid = !friend.paidBack;
    setPaidBack(section, friend, nextPaid);
    if (nextPaid && section.payer) {
      showToast({
        message: `${friend.name} paid ${section.payer.name} ${money(friend.amount)}`,
        onUndo: () => {
          setPaidBack(section, friend, false);
          setToast(null);
        },
      });
    }
  };

  const openBill = (section: BillSection) => {
    if (!groupId) return;
    const bill = getGroup(groupId)?.settlements?.find((item) => item.id === section.id);
    if (!bill) return;
    setGroupSettlementSetup(null);
    setSettlementSummarySession(bill.summary);
    router.push({ pathname: '/settlement-summary', params: { groupId, settlementId: bill.id } });
  };

  const progress = overallProgress(sections);

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
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Balances
            </Text>
            {groupName.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {groupName}
              </Text>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Ionicons name="receipt-outline" size={20} color={PURPLE} />
            <Text style={styles.infoText}>
              {sections.length === 0
                ? 'No settlements yet. Save one to this group to track who has paid.'
                : 'Each settlement shows who has paid the upfront payer back and who hasn’t.'}
            </Text>
          </View>

          {progress.total > 0 && (
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress.fraction * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {money(progress.paid)} of {money(progress.total)} paid back
              </Text>
            </View>
          )}

          {sections.map((section) => (
            <View key={section.id} style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleBlock}>
                  <Text style={styles.sectionTitle} numberOfLines={2}>
                    {section.name}
                  </Text>
                  <Text style={styles.sectionDate}>{formatBillDate(section.createdAt)}</Text>
                </View>
                {section.hasPayer && (
                  <View style={[styles.badge, section.allPaid && styles.badgeDone]}>
                    {section.allPaid && <Ionicons name="checkmark" size={14} color={GREEN} />}
                    <Text style={[styles.badgeText, section.allPaid && styles.badgeTextDone]}>
                      {section.allPaid
                        ? 'All paid back'
                        : `${section.paidBackCount} of ${section.friends.length} paid back`}
                    </Text>
                  </View>
                )}
              </View>

              {section.payer ? (
                <>
                  <Text style={styles.upfrontText}>
                    <Text style={styles.strong}>{section.payer.name}</Text> paid upfront · {money(section.total)}
                  </Text>

                  <View style={styles.friendList}>
                    {section.friends.map((friend) => (
                      <View key={friend.id} style={styles.friendRow}>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName} numberOfLines={1}>
                            {friend.name}
                          </Text>
                          <Text style={styles.friendAmount}>{money(friend.amount)}</Text>
                        </View>
                        {!friend.paidBack && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remind ${friend.name} to pay ${section.payer?.name}`}
                            onPress={() => setRemindFor({ section, friend })}
                            style={({ pressed }) => [styles.remindButton, pressed && styles.pressed]}
                          >
                            <Ionicons name="paper-plane-outline" size={14} color={PURPLE} />
                            <Text style={styles.remindButtonText}>Remind</Text>
                          </Pressable>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            friend.paidBack
                              ? `${friend.name} has paid. Tap to undo`
                              : `Mark ${friend.name} as paid`
                          }
                          accessibilityState={{ selected: friend.paidBack }}
                          onPress={() => togglePaid(section, friend)}
                          style={({ pressed }) => [
                            styles.paidToggle,
                            friend.paidBack && styles.paidToggleOn,
                            pressed && styles.pressed,
                          ]}
                        >
                          {friend.paidBack && <Ionicons name="checkmark" size={14} color={GREEN} />}
                          <Text style={[styles.paidToggleText, friend.paidBack && styles.paidToggleTextOn]}>
                            {friend.paidBack ? 'Paid' : 'Not paid'}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  {section.friends.length === 0 && (
                    <Text style={styles.footerText}>Nobody else owes anything on this settlement.</Text>
                  )}
                  {section.remaining > 0 && (
                    <Text style={styles.footerText}>{money(section.remaining)} still owed</Text>
                  )}
                </>
              ) : (
                <View style={styles.noPayerBlock}>
                  <Text style={styles.noPayerText}>Pick who paid upfront to track payments.</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${section.name}`}
                    onPress={() => openBill(section)}
                    style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.openButtonText}>Open</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {remindFor && remindFor.section.payer && (
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

        {toast && (
          <View style={styles.snackbar} accessibilityLiveRegion="polite">
            <Text style={styles.snackbarText} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.onUndo && (
              <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={toast.onUndo} hitSlop={8}>
                <Text style={styles.snackbarUndo}>Undo</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff', alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { minWidth: 30, minHeight: 48, justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#171717' },
  headerSubtitle: { fontSize: 14, color: '#696171', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 96, gap: 16 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: PURPLE_TINT,
  },
  infoText: { flex: 1, fontSize: 14, color: '#171717' },
  progressBlock: { gap: 6 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#E5E5E5', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: PURPLE },
  progressText: { fontSize: 13, color: MUTED },
  sectionCard: {
    gap: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionTitleBlock: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  sectionDate: { fontSize: 13, color: MUTED },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#EFEFEF',
  },
  badgeDone: { backgroundColor: GREEN_TINT },
  badgeText: { fontSize: 12, fontWeight: '700', color: MUTED },
  badgeTextDone: { color: GREEN },
  upfrontText: { fontSize: 14, color: '#171717' },
  strong: { fontWeight: '700' },
  friendList: { gap: 4 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  friendInfo: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#000' },
  friendAmount: { fontSize: 13, color: MUTED, marginTop: 1 },
  remindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: PURPLE_TINT,
  },
  remindButtonText: { fontSize: 13, fontWeight: '700', color: PURPLE },
  paidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 82,
    borderWidth: 1,
    borderColor: '#C9C9C9',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  paidToggleOn: { borderColor: GREEN, backgroundColor: GREEN_TINT },
  paidToggleText: { fontSize: 13, fontWeight: '700', color: MUTED },
  paidToggleTextOn: { color: GREEN },
  footerText: { fontSize: 13, color: MUTED },
  noPayerBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noPayerText: { flex: 1, fontSize: 14, color: MUTED },
  openButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: PURPLE,
  },
  openButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  snackbar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#222',
  },
  snackbarText: { flex: 1, fontSize: 14, color: '#fff' },
  snackbarUndo: { fontSize: 14, fontWeight: '700', color: '#C9BDFB' },
  pressed: { opacity: 0.65 },
});
