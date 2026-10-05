import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../lib/navigation';
import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  getParsedReceipt,
  getWhoHadWhatSession,
  setSettlementSummarySession,
  type ItemAssignment,
  type Person,
  type SettlementPerson,
} from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const GREEN = '#2E7D32';
const MUTED = '#8A8A8A';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function computeSettlement(receipt: ParsedReceipt, people: Person[], assignments: ItemAssignment[]) {
  const unassignedItems: { name: string; price: number }[] = [];
  const totalSharesByItem: number[] = receipt.items.map((_, itemIndex) =>
    assignments.filter((a) => a.itemIndex === itemIndex).reduce((sum, a) => sum + a.shares, 0)
  );

  receipt.items.forEach((item, itemIndex) => {
    if (totalSharesByItem[itemIndex] === 0) {
      unassignedItems.push({ name: item.name, price: item.price });
    }
  });

  const perPersonSubtotal = people.map((person) => {
    const costs = assignments
      .filter((a) => a.personId === person.id && a.shares > 0)
      .map((a) => receipt.items[a.itemIndex].price * a.shares);
    return costs.reduce((sum, cost) => sum + cost, 0);
  });

  const assignedSubtotalAcrossAllPeople = perPersonSubtotal.reduce((sum, s) => sum + s, 0);

  const settlementPeople: SettlementPerson[] = people.map((person, index) => {
    const subtotal = perPersonSubtotal[index];
    const personProportion =
      assignedSubtotalAcrossAllPeople > 0 ? subtotal / assignedSubtotalAcrossAllPeople : 0;
    const tax = (receipt.tax ?? 0) * personProportion;
    const serviceCharge = (receipt.serviceCharge ?? 0) * personProportion;
    const name = person.name.trim() || `Person ${index + 1}`;
    return { id: person.id, name, amount: subtotal + tax + serviceCharge };
  });

  return { settlementPeople, unassignedItems };
}

export default function ItemQuantitiesScreen() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);

  useEffect(() => {
    const storedReceipt = getParsedReceipt();
    if (!storedReceipt) {
      router.replace('/upload-receipt');
      return;
    }
    const storedSession = getWhoHadWhatSession();
    if (!storedSession) {
      router.replace('/who-had-what');
      return;
    }
    setReceipt(storedReceipt);
    setPeople(storedSession.people);
    setAssignments(storedSession.assignments);
  }, [router]);

  if (!receipt || !people) return null;

  const getPersonAssignments = (personId: string) =>
    assignments.filter((a) => a.personId === personId && a.shares > 0);

  const getItemLiveCost = (itemIndex: number, shares: number) =>
    receipt.items[itemIndex].price * shares;

  const incrementShare = (personId: string, itemIndex: number) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.personId === personId && a.itemIndex === itemIndex ? { ...a, shares: a.shares + 1 } : a
      )
    );
  };

  const decrementShare = (personId: string, itemIndex: number) => {
    setAssignments((prev) => {
      const current = prev.find((a) => a.personId === personId && a.itemIndex === itemIndex);
      if (!current) return prev;
      if (current.shares <= 1) {
        return prev.filter((a) => !(a.personId === personId && a.itemIndex === itemIndex));
      }
      return prev.map((a) =>
        a.personId === personId && a.itemIndex === itemIndex ? { ...a, shares: a.shares - 1 } : a
      );
    });
  };

  const handleCalculate = () => {
    const { settlementPeople, unassignedItems } = computeSettlement(receipt, people, assignments);
    setSettlementSummarySession({
      people: settlementPeople,
      note: 'Amount based on items each person had.',
      unassignedItems: unassignedItems.length > 0 ? unassignedItems : undefined,
    });
    router.push('/settlement-summary');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <View>
            <Text style={styles.headerEyebrow}>Instant Settlement</Text>
            <Text style={styles.headerTitle}>How many did they have?</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {people.map((person, index) => {
            const personAssignments = getPersonAssignments(person.id);

            return (
              <View key={person.id} style={styles.card}>
                <Text style={styles.personLabel}>Person {index + 1}</Text>

                {personAssignments.length === 0 ? (
                  <Text style={styles.noItemsText}>No items selected</Text>
                ) : (
                  <View style={styles.selectedList}>
                    {personAssignments.map((a) => {
                      const item = receipt.items[a.itemIndex];
                      return (
                        <View key={a.itemIndex} style={styles.selectedRow}>
                          <Ionicons name="checkmark-circle" size={18} color={GREEN} />
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemPrice}>
                            {money(getItemLiveCost(a.itemIndex, a.shares))}
                          </Text>
                          <View style={styles.stepper}>
                            <Pressable
                              style={styles.stepperButton}
                              onPress={() => decrementShare(person.id, a.itemIndex)}
                              hitSlop={8}
                            >
                              <Ionicons name="remove" size={14} color={PURPLE} />
                            </Pressable>
                            <Text style={styles.stepperCount}>{a.shares}</Text>
                            <Pressable
                              style={styles.stepperButton}
                              onPress={() => incrementShare(person.id, a.itemIndex)}
                              hitSlop={8}
                            >
                              <Ionicons name="add" size={14} color={PURPLE} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                    <View style={styles.subtotalRow}>
                      <Text style={styles.subtotalLabel}>Subtotal</Text>
                      <Text style={styles.subtotalValue}>
                        {money(
                          personAssignments.reduce(
                            (sum, a) => sum + getItemLiveCost(a.itemIndex, a.shares),
                            0
                          )
                        )}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.calculateButton} onPress={handleCalculate}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
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
  },
  noItemsText: {
    fontSize: 14,
    color: MUTED,
    marginTop: 8,
  },
  selectedList: {
    marginTop: 12,
    gap: 12,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    color: '#000',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PILL_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    minWidth: 16,
    textAlign: 'center',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  subtotalLabel: {
    fontSize: 14,
    color: MUTED,
  },
  subtotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  calculateButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculateButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
