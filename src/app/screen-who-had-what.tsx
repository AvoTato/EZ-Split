import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../lib/navigation';
import type { ParsedReceipt, ReceiptItem } from '../lib/parseReceipt';
import { getParsedReceipt, getWhoHadWhatSession, type Person, type WhoHadWhatSession } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const GREEN = '#2E7D32';
const MUTED = '#8A8A8A';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

type PersonBreakdown = {
  person: Person;
  items: { item: ReceiptItem; shares: number; totalShares: number; cost: number }[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
};

function computeBreakdown(receipt: ParsedReceipt, session: WhoHadWhatSession) {
  const unassignedItems: ReceiptItem[] = [];
  const totalSharesByItem: number[] = receipt.items.map((_, itemIndex) =>
    session.assignments
      .filter((a) => a.itemIndex === itemIndex)
      .reduce((sum, a) => sum + a.shares, 0)
  );

  receipt.items.forEach((item, itemIndex) => {
    if (totalSharesByItem[itemIndex] === 0) {
      unassignedItems.push(item);
    }
  });

  const perPerson: PersonBreakdown[] = session.people.map((person) => {
    const items = session.assignments
      .filter((a) => a.personId === person.id && a.shares > 0)
      .map((a) => {
        const item = receipt.items[a.itemIndex];
        const totalShares = totalSharesByItem[a.itemIndex];
        return {
          item,
          shares: a.shares,
          totalShares,
          cost: item.price * (a.shares / totalShares),
        };
      });

    const subtotal = items.reduce((sum, i) => sum + i.cost, 0);
    return { person, items, subtotal, tax: 0, serviceCharge: 0, total: subtotal };
  });

  const assignedSubtotalAcrossAllPeople = perPerson.reduce((sum, p) => sum + p.subtotal, 0);

  perPerson.forEach((p) => {
    const personProportion =
      assignedSubtotalAcrossAllPeople > 0 ? p.subtotal / assignedSubtotalAcrossAllPeople : 0;
    p.tax = (receipt.tax ?? 0) * personProportion;
    p.serviceCharge = (receipt.serviceCharge ?? 0) * personProportion;
    p.total = p.subtotal + p.tax + p.serviceCharge;
  });

  return { perPerson, unassignedItems };
}

export default function ScreenWhoHadWhat() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [session, setSession] = useState<WhoHadWhatSession | null>(null);

  useEffect(() => {
    const storedReceipt = getParsedReceipt();
    if (!storedReceipt) {
      router.replace('/upload-receipt');
      return;
    }
    const storedSession = getWhoHadWhatSession();
    if (!storedSession) {
      router.replace('/instant-settlement');
      return;
    }
    setReceipt(storedReceipt);
    setSession(storedSession);
  }, [router]);

  if (!receipt || !session) return null;

  const { perPerson, unassignedItems } = computeBreakdown(receipt, session);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <View>
            <Text style={styles.headerEyebrow}>Instant Settlement</Text>
            <Text style={styles.headerTitle}>Who owes what?</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {perPerson.map((breakdown, index) => (
            <View key={breakdown.person.id} style={styles.card}>
              <Text style={styles.personLabel}>Person {index + 1}</Text>

              {breakdown.items.map((entry, i) => (
                <View key={i} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                    <Text style={styles.rowText}>{entry.item.name}</Text>
                  </View>
                  <Text style={styles.rowTextBold}>{money(entry.cost)}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.mutedText}>Subtotal</Text>
                <Text style={styles.mutedText}>{money(breakdown.subtotal)}</Text>
              </View>

              {receipt.tax !== null && (
                <View style={styles.row}>
                  <Text style={styles.mutedText}>SST</Text>
                  <Text style={styles.mutedText}>{money(breakdown.tax)}</Text>
                </View>
              )}

              {receipt.serviceCharge !== null && (
                <View style={styles.row}>
                  <Text style={styles.mutedText}>Service Charge</Text>
                  <Text style={styles.mutedText}>{money(breakdown.serviceCharge)}</Text>
                </View>
              )}

              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalText}>Total owed</Text>
                <Text style={styles.totalText}>{money(breakdown.total)}</Text>
              </View>
            </View>
          ))}

          {unassignedItems.length > 0 && (
            <View style={styles.unassignedCard}>
              <Text style={styles.unassignedTitle}>Unassigned items</Text>
              <Text style={styles.unassignedNote}>
                These items were not assigned to anyone and are not included above.
              </Text>
              {unassignedItems.map((item, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowText}>{item.name}</Text>
                  <Text style={styles.rowTextBold}>{money(item.price)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.doneButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.doneButtonText}>Done</Text>
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
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  personLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  mutedText: {
    fontSize: 14,
    color: MUTED,
  },
  totalRow: {
    marginTop: 4,
  },
  totalText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  unassignedCard: {
    backgroundColor: PILL_GRAY,
    borderRadius: 16,
    padding: 20,
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
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  doneButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
