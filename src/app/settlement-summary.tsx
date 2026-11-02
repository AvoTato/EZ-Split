import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GroupCreatedModal from '../components/GroupCreatedModal';
import ShareBillModal from '../components/ShareBillModal';
import ReceiptDetectedCard from '../components/ReceiptDetectedCard';
import SplitBreakdown from '../components/SplitBreakdown';
import { explainSplit } from '../lib/api';
import { addGroup, addSettlement, getGroup, updateSettlementSummary } from '../lib/groups';
import { payBackStatus } from '../lib/debts';
import { money } from '../lib/format';
import { goBack } from '../lib/navigation';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  getSettlementSummarySession,
  setGroupSettlementSetup,
  setSettlementSummarySession,
  type GroupSettlementSetup,
  type SettlementSummarySession,
} from '../lib/receiptSession';
import { describeSplit, splitFacts } from '../lib/splitExplanation';

const PURPLE = '#9B87F0';
const PURPLE_TINT = '#F1EDFD';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';
const GREEN = '#2E7D32';
const GREEN_TINT = '#E6F4EA';

export default function SettlementSummaryScreen() {
  const router = useRouter();
  const { groupId, settlementId } = useLocalSearchParams<{ groupId?: string; settlementId?: string }>();
  const historyReceipt =
    groupId && settlementId
      ? getGroup(groupId)?.settlements?.find((s) => s.id === settlementId)?.receipt ?? null
      : null;
  const isHistory = Boolean(groupId && settlementId);
  const historyName =
    groupId && settlementId
      ? getGroup(groupId)?.settlements?.find((s) => s.id === settlementId)?.name
      : undefined;
  const [session, setSession] = useState<SettlementSummarySession | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [groupSetup, setGroupSetup] = useState<GroupSettlementSetup | null>(null);
  const [groupCreated, setGroupCreated] = useState(false);
  const [settlementSaved, setSettlementSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    const stored = getSettlementSummarySession();
    if (!stored) {
      router.replace('/instant-settlement');
      return;
    }
    setGroupSetup(getGroupSettlementSetup());
    setSession(stored);
  }, [router]);

  if (!session) return null;

  const billTitle = historyName ?? groupSetup?.settlementName;
  const status = payBackStatus(session);
  const payer = status.payer;
  const billTotal = session.people.reduce((sum, person) => sum + person.amount, 0);
  const receipt = isHistory ? historyReceipt : getParsedReceipt();
  const canExplain = Boolean(receipt && session.people.some((person) => person.breakdown));

  const startEditing = (personId: string, currentName: string) => {
    setEditingPersonId(personId);
    setDraftName(currentName);
  };

  const commitEditing = () => {
    if (!editingPersonId) return;
    const trimmed = draftName.trim();
    if (trimmed.length > 0) {
      const updatedPeople = session.people.map((p) =>
        p.id === editingPersonId ? { ...p, name: trimmed } : p
      );
      const updatedSession = { ...session, people: updatedPeople };
      setSession(updatedSession);
      setSettlementSummarySession(updatedSession);
    }
    setEditingPersonId(null);
  };

  const saveSessionChange = (updatedSession: SettlementSummarySession) => {
    setSession(updatedSession);
    setSettlementSummarySession(updatedSession);
    if (groupId && settlementId) {
      updateSettlementSummary(groupId, settlementId, {
        paidBy: updatedSession.paidBy,
        settledIds: updatedSession.settledIds,
      });
    }
  };

  const selectPayer = (personId: string) => {
    saveSessionChange({
      ...session,
      paidBy: session.paidBy === personId ? undefined : personId,
      settledIds: undefined,
    });
  };

  const togglePaidBack = (personId: string) => {
    const current = session.settledIds ?? [];
    const next = current.includes(personId)
      ? current.filter((id) => id !== personId)
      : [...current, personId];
    saveSessionChange({ ...session, settledIds: next.length > 0 ? next : undefined });
  };

  const handleExplain = async () => {
    if (!receipt || explaining) return;
    const facts = splitFacts(receipt, session.people, session.unassignedItems, money);
    setExplaining(true);
    let explanation: string;
    try {
      explanation = await explainSplit(facts);
    } catch {
      // Offline, not configured, or the AI's answer failed the number check.
      explanation = describeSplit(facts);
    } finally {
      setExplaining(false);
    }
    const updatedSession = { ...session, explanation };
    setSession(updatedSession);
    setSettlementSummarySession(updatedSession);
    if (groupId && settlementId) updateSettlementSummary(groupId, settlementId, { explanation });
  };

  const handleCreateGroup = () => {
    if (!groupSetup || groupCreated) return;
    const group = addGroup({
      name: groupSetup.groupName,
      members: session.people.map(({ id, name }) => ({ id, name })),
    });
    addSettlement(group.id, {
      name: groupSetup.settlementName,
      createdAt: Date.now(),
      summary: session,
      receipt: getParsedReceipt(),
    });
    setGroupCreated(true);
  };

  const handleSaveSettlement = () => {
    if (!groupSetup?.groupId || settlementSaved) return;
    const savedGroupId = groupSetup.groupId;
    addSettlement(savedGroupId, {
      name: groupSetup.settlementName,
      createdAt: Date.now(),
      summary: session,
      receipt: getParsedReceipt(),
    });
    setSettlementSaved(true);
    setGroupSettlementSetup(null);
    router.replace('/(tabs)/groups');
  };

  const handleGoToGroups = () => {
    setGroupSettlementSetup(null);
    router.replace('/(tabs)/groups');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <View>
            <Text style={styles.headerEyebrow}>
              {isHistory ? 'Receipt History' : groupSetup ? 'Group Settlement' : 'Instant Settlement'}
            </Text>
            <Text style={styles.headerTitle}>Settlement Summary</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            {session.people.map((person, index) => (
              <View key={person.id}>
                <View style={styles.row}>
                  <View style={styles.nameGroup}>
                    {!isHistory && editingPersonId === person.id ? (
                      <TextInput
                        style={styles.nameInput}
                        value={draftName}
                        onChangeText={setDraftName}
                        onBlur={commitEditing}
                        onSubmitEditing={commitEditing}
                        autoFocus
                      />
                    ) : (
                      <>
                        <Text style={styles.rowText}>{person.name}</Text>
                        {!isHistory && (
                          <Pressable onPress={() => startEditing(person.id, person.name)} hitSlop={8}>
                            <Ionicons name="pencil" size={14} color={MUTED} />
                          </Pressable>
                        )}
                        {payer && person.id === payer.id && (
                          <View style={styles.statusTag}>
                            <Text style={styles.statusTagText}>Paid upfront</Text>
                          </View>
                        )}
                        {payer && person.id !== payer.id && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              session.settledIds?.includes(person.id)
                                ? `${person.name} has paid ${payer.name} back. Tap to undo`
                                : `Mark ${person.name} as paid back`
                            }
                            accessibilityState={{ selected: Boolean(session.settledIds?.includes(person.id)) }}
                            onPress={() => togglePaidBack(person.id)}
                            hitSlop={6}
                            style={({ pressed }) => [
                              styles.paidToggle,
                              session.settledIds?.includes(person.id) && styles.paidToggleOn,
                              pressed && styles.pressed,
                            ]}
                          >
                            {session.settledIds?.includes(person.id) && (
                              <Ionicons name="checkmark" size={14} color={GREEN} />
                            )}
                            <Text
                              style={[
                                styles.paidToggleText,
                                session.settledIds?.includes(person.id) && styles.paidToggleTextOn,
                              ]}
                            >
                              {session.settledIds?.includes(person.id) ? 'Paid' : 'Not paid'}
                            </Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                  {person.breakdown ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${expandedId === person.id ? 'Hide' : 'Show'} how ${person.name}'s ${money(person.amount)} was worked out`}
                      accessibilityState={{ expanded: expandedId === person.id }}
                      onPress={() => setExpandedId(expandedId === person.id ? null : person.id)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.amountToggle, pressed && styles.pressed]}
                    >
                      <Text style={styles.rowTextBold}>{money(person.amount)}</Text>
                      <Ionicons
                        name={expandedId === person.id ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={MUTED}
                      />
                    </Pressable>
                  ) : (
                    <Text style={styles.rowTextBold}>{money(person.amount)}</Text>
                  )}
                </View>
                {person.breakdown && expandedId === person.id && (
                  <SplitBreakdown breakdown={person.breakdown} receipt={receipt} />
                )}
                {index < session.people.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          <View style={styles.payerSection}>
            <Text style={styles.payerTitle}>Who paid upfront?</Text>
            <View style={styles.payerChips}>
              {session.people.map((person) => {
                const selected = session.paidBy === person.id;
                return (
                  <Pressable
                    key={person.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${person.name} paid upfront`}
                    accessibilityState={{ selected }}
                    onPress={() => selectPayer(person.id)}
                    style={({ pressed }) => [
                      styles.payerChip,
                      selected && styles.payerChipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    <Text style={[styles.payerChipText, selected && styles.payerChipTextSelected]}>
                      {person.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {payer ? (
              <View style={styles.payerCard}>
                <Ionicons name="wallet-outline" size={20} color={GREEN} />
                <View style={styles.payerCardBody}>
                  <Text style={styles.payerCardText}>
                    <Text style={styles.payerCardStrong}>{payer.name}</Text> paid upfront ({money(billTotal)})
                  </Text>
                  {status.friends.length > 0 && (
                    <Text style={styles.payerCardSub}>
                      {status.paidBackCount === status.friends.length
                        ? `Everyone has paid ${payer.name} back`
                        : `${status.paidBackCount} of ${status.friends.length} paid back · ${money(status.remaining)} still owed`}
                    </Text>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Clear ${payer.name} as the payer`}
                  onPress={() => selectPayer(payer.id)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.payerClear, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={16} color="#000" />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.payerHint}>Pick who paid upfront to track who has paid them back.</Text>
            )}
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={14} color={MUTED} />
            <Text style={styles.noteText}>{session.note}</Text>
          </View>

          {session.explanation ? (
            <View style={styles.explainCard}>
              <View style={styles.explainHeader}>
                <Ionicons name="sparkles" size={16} color={PURPLE} />
                <Text style={styles.explainTitle}>How this was split</Text>
              </View>
              <Text style={styles.explainText}>{session.explanation}</Text>
            </View>
          ) : (
            canExplain && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Explain how this bill was split"
                disabled={explaining}
                onPress={handleExplain}
                style={({ pressed }) => [styles.explainButton, (pressed || explaining) && styles.pressed]}
              >
                {explaining ? (
                  <ActivityIndicator size="small" color={PURPLE} />
                ) : (
                  <Ionicons name="sparkles" size={16} color={PURPLE} />
                )}
                <Text style={styles.explainButtonText}>Explain this split</Text>
              </Pressable>
            )
          )}

          {session.unassignedItems && session.unassignedItems.length > 0 && (
            <View style={styles.unassignedCard}>
              <Text style={styles.unassignedTitle}>Unassigned items</Text>
              <Text style={styles.unassignedNote}>
                These items were not assigned to anyone and are not included above
                {session.unassignedItems.some((item) => item.withCharges !== undefined)
                  ? ' (amounts include their share of discount, tax and service).'
                  : '.'}
              </Text>
              {session.unassignedItems.map((item, i) => (
                <View key={i} style={styles.unassignedRow}>
                  <Text style={styles.rowText}>{item.name}</Text>
                  <Text style={styles.rowTextBold}>{money(item.withCharges ?? item.price)}</Text>
                </View>
              ))}
            </View>
          )}

          {historyReceipt && (
            <View style={styles.receiptReference}>
              <ReceiptDetectedCard receipt={historyReceipt} />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.actionButton} onPress={() => setShareModalVisible(true)}>
            <Text style={styles.actionButtonText}>Share bill</Text>
          </Pressable>
          {groupSetup?.groupId ? (
            <Pressable
              style={[styles.actionButton, settlementSaved && styles.actionButtonDisabled]}
              onPress={handleSaveSettlement}
              disabled={settlementSaved}
            >
              <Text style={styles.actionButtonText}>Save Settlement</Text>
            </Pressable>
          ) : groupSetup ? (
            <Pressable
              style={[styles.actionButton, groupCreated && styles.actionButtonDisabled]}
              onPress={handleCreateGroup}
              disabled={groupCreated}
            >
              <Text style={styles.actionButtonText}>Create Group</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                setGroupSettlementSetup(null);
                router.replace('/(tabs)');
              }}
            >
              <Text style={styles.actionButtonText}>Back to Homepage</Text>
            </Pressable>
          )}
        </View>
      </View>

      <GroupCreatedModal visible={groupCreated} onGoToGroups={handleGoToGroups} />

      <ShareBillModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        session={session}
        title={billTitle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  rowText: {
    fontSize: 15,
    color: '#000',
  },
  rowTextBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  nameInput: {
    fontSize: 15,
    color: '#000',
    flex: 1,
    paddingVertical: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  payerSection: {
    marginTop: 16,
  },
  payerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  payerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  payerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PILL_GRAY,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  payerChipSelected: {
    backgroundColor: PURPLE,
  },
  payerChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  payerChipTextSelected: {
    color: '#fff',
  },
  payerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: GREEN_TINT,
  },
  payerCardBody: {
    flex: 1,
    gap: 2,
  },
  payerCardText: {
    fontSize: 14,
    color: '#000',
  },
  payerCardSub: {
    fontSize: 13,
    color: MUTED,
  },
  paidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#C9C9C9',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  paidToggleOn: {
    borderColor: GREEN,
    backgroundColor: GREEN_TINT,
  },
  paidToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
  },
  paidToggleTextOn: {
    color: GREEN,
  },
  payerCardStrong: {
    fontWeight: '700',
  },
  payerClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payerHint: {
    marginTop: 10,
    fontSize: 13,
    color: MUTED,
  },
  statusTag: {
    backgroundColor: PILL_GRAY,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
  },

  pressed: {
    opacity: 0.7,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  noteText: {
    fontSize: 13,
    color: MUTED,
  },
  receiptReference: {
    marginTop: 16,
  },
  amountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: PURPLE_TINT,
  },
  explainButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PURPLE,
  },
  explainCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: PURPLE_TINT,
    gap: 8,
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explainTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  explainText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  unassignedCard: {
    backgroundColor: PILL_GRAY,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  unassignedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: MUTED,
    marginBottom: 4,
  },
  unassignedNote: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 8,
  },
  unassignedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  actionButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
