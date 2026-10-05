import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ShareBillModal from '../components/ShareBillModal';
import { goBack } from '../lib/navigation';
import {
  getSettlementSummarySession,
  setSettlementSummarySession,
  type SettlementSummarySession,
} from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

export default function SettlementSummaryScreen() {
  const router = useRouter();
  const [session, setSession] = useState<SettlementSummarySession | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);

  useEffect(() => {
    const stored = getSettlementSummarySession();
    if (!stored) {
      router.replace('/instant-settlement');
      return;
    }
    setSession(stored);
  }, [router]);

  if (!session) return null;

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <View>
            <Text style={styles.headerEyebrow}>Instant Settlement</Text>
            <Text style={styles.headerTitle}>Settlement Summary</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            {session.people.map((person, index) => (
              <View key={person.id}>
                <View style={styles.row}>
                  <View style={styles.nameGroup}>
                    {editingPersonId === person.id ? (
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
                        <Pressable onPress={() => startEditing(person.id, person.name)} hitSlop={8}>
                          <Ionicons name="pencil" size={14} color={MUTED} />
                        </Pressable>
                      </>
                    )}
                  </View>
                  <Text style={styles.rowTextBold}>{money(person.amount)}</Text>
                </View>
                {index < session.people.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={14} color={MUTED} />
            <Text style={styles.noteText}>{session.note}</Text>
          </View>

          {session.unassignedItems && session.unassignedItems.length > 0 && (
            <View style={styles.unassignedCard}>
              <Text style={styles.unassignedTitle}>Unassigned items</Text>
              <Text style={styles.unassignedNote}>
                These items were not assigned to anyone and are not included above.
              </Text>
              {session.unassignedItems.map((item, i) => (
                <View key={i} style={styles.unassignedRow}>
                  <Text style={styles.rowText}>{item.name}</Text>
                  <Text style={styles.rowTextBold}>{money(item.price)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.actionButton} onPress={() => setShareModalVisible(true)}>
            <Text style={styles.actionButtonText}>Share bill</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.actionButtonText}>Back to Homepage</Text>
          </Pressable>
        </View>
      </View>

      <ShareBillModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        session={session}
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
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
