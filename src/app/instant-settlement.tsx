import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ReceiptDetectedCard from '../components/ReceiptDetectedCard';
import { goBack } from '../lib/navigation';
import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  setSettlementSummarySession,
  type Person,
  type SettlementPerson,
} from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';

type SplitMode = 'equal' | 'separate';

export default function InstantSettlementScreen() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('separate');
  const [pax, setPax] = useState(2);
  const [members, setMembers] = useState<Person[]>([]);

  useEffect(() => {
    const stored = getParsedReceipt();
    if (!stored) {
      router.replace('/upload-receipt');
      return;
    }
    const groupMembers = getGroupSettlementSetup()?.members ?? [];
    if (groupMembers.length > 0) {
      setMembers(groupMembers);
      setPax(groupMembers.length);
    }
    setReceipt(stored);
  }, [router]);

  if (!receipt) return null;

  const isGroup = members.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>{isGroup ? 'Group Settlement' : 'Instant Settlement'}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segment, splitMode === 'equal' && styles.segmentActive]}
              onPress={() => setSplitMode('equal')}
            >
              <Text style={[styles.segmentText, splitMode === 'equal' && styles.segmentTextActive]}>
                Split equally
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, splitMode === 'separate' && styles.segmentActive]}
              onPress={() => setSplitMode('separate')}
            >
              <Text style={[styles.segmentText, splitMode === 'separate' && styles.segmentTextActive]}>
                Split separately
              </Text>
            </Pressable>
          </View>

          <ReceiptDetectedCard receipt={receipt} />

          {splitMode === 'equal' && isGroup && (
            <View style={styles.membersCard}>
              <View style={styles.membersHeader}>
                <Text style={styles.paxLabel}>Number of Pax:</Text>
                <Text style={styles.paxCount}>{members.length}</Text>
              </View>
              <Text style={styles.membersNames}>{members.map((m) => m.name).join(', ')}</Text>
            </View>
          )}

          {splitMode === 'equal' && !isGroup && (
            <View style={styles.paxRow}>
              <Text style={styles.paxLabel}>Number of Pax:</Text>
              <Pressable
                style={styles.paxButton}
                onPress={() => setPax((p) => Math.max(1, p - 1))}
                hitSlop={8}
              >
                <Ionicons name="remove" size={16} color={PURPLE} />
              </Pressable>
              <Text style={styles.paxCount}>{pax}</Text>
              <Pressable style={styles.paxButton} onPress={() => setPax((p) => p + 1)} hitSlop={8}>
                <Ionicons name="add" size={16} color={PURPLE} />
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.continueButton}
            onPress={() => {
              if (splitMode === 'separate') {
                router.push('/who-had-what');
              } else {
                const totalForSplit = receipt.total ?? 0;
                const amountPerPerson = totalForSplit / pax;
                const settlementPeople: SettlementPerson[] = Array.from({ length: pax }, (_, index) => ({
                  id: members[index]?.id ?? `e${index + 1}`,
                  name: members[index]?.name ?? `Person ${index + 1}`,
                  amount: amountPerPerson,
                }));
                setSettlementSummarySession({
                  pax,
                  people: settlementPeople,
                  note: `Total split equally among ${pax} people.`,
                });
                router.push('/settlement-summary');
              }
            }}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
  },
  segment: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: PURPLE,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  paxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  membersCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 6,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersNames: {
    fontSize: 13,
    color: MUTED,
  },
  paxLabel: {
    fontSize: 15,
    color: '#000',
    marginRight: 'auto',
  },
  paxButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PILL_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paxCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    minWidth: 16,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  continueButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
