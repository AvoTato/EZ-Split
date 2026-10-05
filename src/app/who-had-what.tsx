import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../lib/navigation';
import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  getParsedReceipt,
  setWhoHadWhatSession,
  type ItemAssignment,
  type Person,
} from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const GREEN = '#2E7D32';
const MUTED = '#8A8A8A';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

export default function WhoHadWhatScreen() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const nextPersonId = useRef(1);

  useEffect(() => {
    const stored = getParsedReceipt();
    if (!stored) {
      router.replace('/upload-receipt');
      return;
    }
    setReceipt(stored);
  }, [router]);

  if (!receipt) return null;

  const getPersonAssignments = (personId: string) =>
    assignments.filter((a) => a.personId === personId && a.shares > 0);

  const getPersonShares = (personId: string, itemIndex: number) =>
    assignments.find((a) => a.personId === personId && a.itemIndex === itemIndex)?.shares ?? 0;

  const addPerson = () => {
    const id = `p${nextPersonId.current}`;
    nextPersonId.current += 1;
    setPeople((prev) => [...prev, { id, name: '' }]);
    setExpandedPersonId(id);
  };

  const toggleExpanded = (personId: string) =>
    setExpandedPersonId((prev) => (prev === personId ? null : personId));

  const toggleItemForPerson = (personId: string, itemIndex: number) => {
    setAssignments((prev) => {
      const exists = prev.some((a) => a.personId === personId && a.itemIndex === itemIndex);
      if (exists) {
        return prev.filter((a) => !(a.personId === personId && a.itemIndex === itemIndex));
      }
      return [...prev, { itemIndex, personId, shares: 1 }];
    });
  };

  const handleNext = () => {
    setWhoHadWhatSession({ people, assignments });
    router.push('/item-quantities');
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
            <Text style={styles.headerTitle}>Who had what?</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {people.map((person, index) => {
            const personAssignments = getPersonAssignments(person.id);
            const isExpanded = expandedPersonId === person.id;

            return (
              <View key={person.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.personLabel}>Person {index + 1}</Text>
                  <Pressable onPress={() => toggleExpanded(person.id)} hitSlop={8}>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#000"
                    />
                  </Pressable>
                </View>

                {isExpanded ? (
                  <View style={styles.checklist}>
                    {receipt.items.map((item, itemIndex) => {
                      const checked = getPersonShares(person.id, itemIndex) > 0;
                      return (
                        <Pressable
                          key={itemIndex}
                          style={styles.checklistRow}
                          onPress={() => toggleItemForPerson(person.id, itemIndex)}
                        >
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemPrice}>{money(item.price)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Pressable
                    style={styles.selectDishesPill}
                    onPress={() => toggleExpanded(person.id)}
                  >
                    <View style={styles.selectDishesTextGroup}>
                      <Text style={styles.selectDishesText}>Select dishes</Text>
                      {personAssignments.length > 0 && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>
                            {personAssignments.length} item{personAssignments.length === 1 ? '' : 's'}{' '}
                            selected
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-down" size={18} color={MUTED} />
                  </Pressable>
                )}
              </View>
            );
          })}

          <Pressable style={styles.addPersonPill} onPress={addPerson}>
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.addPersonText}>Add person</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.calculateButton, people.length === 0 && styles.calculateButtonDisabled]}
            onPress={handleNext}
            disabled={people.length === 0}
          >
            <Text style={styles.calculateButtonText}>Next</Text>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  checklist: {
    marginTop: 12,
    gap: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: GREEN,
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
  selectDishesPill: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  selectDishesTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectDishesText: {
    fontSize: 15,
    color: MUTED,
  },
  selectedBadge: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  addPersonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    paddingVertical: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  addPersonText: {
    fontSize: 15,
    fontWeight: '600',
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
  calculateButtonDisabled: {
    opacity: 0.5,
  },
  calculateButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
