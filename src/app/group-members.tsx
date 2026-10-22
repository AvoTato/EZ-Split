import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroup, updateGroup } from '../lib/groups';
import { goBack } from '../lib/navigation';
import type { Person } from '../lib/receiptSession';

const PILL_GRAY = '#EFEFEF';

export default function GroupMembersScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Person[]>([]);
  const [draft, setDraft] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const syncDrafts = (list: Person[]) =>
    setDrafts(Object.fromEntries(list.map((member) => [member.id, member.name])));

  const load = useCallback(() => {
    const group = groupId ? getGroup(groupId) : undefined;
    setGroupName(group?.name ?? '');
    setMembers(group?.members ?? []);
    syncDrafts(group?.members ?? []);
  }, [groupId]);

  useFocusEffect(load);

  const save = (next: Person[]) => {
    const group = groupId ? getGroup(groupId) : undefined;
    if (!group) return;
    updateGroup(group.id, { name: group.name, members: next });
    setMembers(next);
    syncDrafts(next);
  };

  const addMember = () => {
    const name = draft.trim();
    if (!name) return;
    const taken = new Set(members.map((member) => member.id));
    let n = 1;
    let id = `m${Date.now()}-${n}`;
    while (taken.has(id)) {
      n += 1;
      id = `m${Date.now()}-${n}`;
    }
    save([...members, { id, name }]);
    setDraft('');
  };

  const renameMember = (memberId: string) => {
    const current = members.find((member) => member.id === memberId);
    if (!current) return;
    const name = (drafts[memberId] ?? '').trim();
    if (!name || name === current.name) {
      setDrafts((prev) => ({ ...prev, [memberId]: current.name }));
      return;
    }
    save(members.map((member) => (member.id === memberId ? { ...member, name } : member)));
  };

  const removeMember = (memberId: string) => save(members.filter((member) => member.id !== memberId));

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
            <Text style={styles.headerTitle}>Members</Text>
            {groupName.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {groupName}
              </Text>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {members.length === 0 && <Text style={styles.emptyText}>No members yet. Add one below.</Text>}
          {members.map((member) => (
            <View key={member.id} style={styles.pill}>
              <TextInput
                accessibilityLabel={`Rename ${member.name}`}
                style={styles.input}
                value={drafts[member.id] ?? member.name}
                onChangeText={(text) => setDrafts((prev) => ({ ...prev, [member.id]: text }))}
                onBlur={() => renameMember(member.id)}
                onSubmitEditing={() => renameMember(member.id)}
                returnKeyType="done"
                maxLength={60}
              />
              <Ionicons name="pencil" size={14} color="#8A8A8A" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${member.name}`}
                onPress={() => removeMember(member.id)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={20} color="#B42318" />
              </Pressable>
            </View>
          ))}

          <View style={styles.pill}>
            <TextInput
              accessibilityLabel="New member name"
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add member"
              placeholderTextColor="#999"
              returnKeyType="done"
              onSubmitEditing={addMember}
              maxLength={60}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add member"
              onPress={addMember}
              disabled={!draft.trim()}
              hitSlop={8}
              style={({ pressed }) => [
                styles.removeButton,
                (pressed || !draft.trim()) && styles.pressed,
              ]}
            >
              <Ionicons name="add" size={26} color="#000" />
            </Pressable>
          </View>
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
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 14 },
  pill: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  input: { flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 16, color: '#000' },
  removeButton: { padding: 2 },
  emptyText: { textAlign: 'center', paddingVertical: 16, color: '#75717F', fontSize: 16 },
  pressed: { opacity: 0.65 },
});
