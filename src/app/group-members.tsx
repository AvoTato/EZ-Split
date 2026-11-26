import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroup, updateGroup } from '../lib/groups';
import { goBack } from '../lib/navigation';
import type { Person } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

const isYou = (member: Person) => member.id === 'you' || member.name.trim().toLowerCase() === 'you';
const initialOf = (name: string, index: number) => name.trim().charAt(0).toUpperCase() || String(index + 1);

export default function GroupMembersScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, RED } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Person[]>([]);
  const [draft, setDraft] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const syncDrafts = (list: Person[]) =>
    setDrafts(Object.fromEntries(list.map((member) => [member.id, member.name])));

  const load = useCallback(() => {
    const group = groupId ? getGroup(groupId) : undefined;
    setGroupName(group?.name ?? '');
    setMembers(group?.members ?? []);
    syncDrafts(group?.members ?? []);
    setEditingId(null);
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
    setEditingId(null);
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
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Go back')}
            onPress={() => goBack(router, '/(tabs)/groups')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View style={styles.headerText}>
            {groupName.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {groupName}
              </Text>
            )}
            <Text style={styles.headerTitle}>{t('Members')}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>
            {members.length === 1 ? t('1 MEMBER') : t('{n} MEMBERS', { n: members.length })}
          </Text>

          {members.length === 0 ? (
            <Text style={styles.emptyText}>{t('No members yet. Add one below.')}</Text>
          ) : (
            <View style={styles.card}>
              {members.map((member, index) => {
                const you = isYou(member);
                const editing = editingId === member.id;
                return (
                  <View key={member.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                    <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                      <Text style={styles.avatarText}>{initialOf(member.name, index)}</Text>
                    </View>
                    {editing ? (
                      <TextInput
                        accessibilityLabel={t('Rename {name}', { name: member.name })}
                        style={styles.nameInput}
                        value={drafts[member.id] ?? member.name}
                        onChangeText={(text) => setDrafts((prev) => ({ ...prev, [member.id]: text }))}
                        onBlur={() => renameMember(member.id)}
                        onSubmitEditing={() => renameMember(member.id)}
                        returnKeyType="done"
                        maxLength={60}
                        autoFocus
                      />
                    ) : (
                      <Text style={styles.name} numberOfLines={1}>
                        {member.name}
                      </Text>
                    )}
                    {you ? (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>{t('You')}</Text>
                      </View>
                    ) : (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('Rename {name}', { name: member.name })}
                          onPress={() => setEditingId(member.id)}
                          hitSlop={8}
                          style={styles.iconButton}
                        >
                          <Ionicons name="pencil-outline" size={24} color={PURPLE_DARK} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('Remove {name}', { name: member.name })}
                          onPress={() => removeMember(member.id)}
                          hitSlop={8}
                          style={styles.iconButton}
                        >
                          <Ionicons name="trash-outline" size={24} color={RED} />
                        </Pressable>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.banner}>
            <Ionicons name="information-circle-outline" size={24} color={PURPLE_DARK} />
            <Text style={styles.bannerText}>{t('Removing someone keeps their past settlements in History.')}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TextInput
            accessibilityLabel={t('New member name')}
            style={styles.addInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('Add member')}
            placeholderTextColor={colors.MUTED}
            returnKeyType="done"
            onSubmitEditing={addMember}
            autoCapitalize="words"
            maxLength={60}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Add member')}
            onPress={addMember}
            disabled={!draft.trim()}
            style={({ pressed }) => [styles.addButton, (!draft.trim() || pressed) && styles.dimmed]}
          >
            <Text style={styles.addButtonText}>{t('Add')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  headerText: { flex: 1, minWidth: 0 },
  headerSubtitle: { fontSize: 14, fontWeight: '700', color: MUTED },
  headerTitle: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: { fontSize: 16, fontWeight: '800', color: MUTED, letterSpacing: 0.3, marginTop: 8, marginBottom: 10 },
  card: { borderRadius: 28, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  rowDivider: { borderTopWidth: 1, borderTopColor: BORDER },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  name: { flex: 1, fontSize: 24, fontWeight: '800', color: INK },
  nameInput: { flex: 1, height: 46, borderRadius: 14, borderWidth: 2, borderColor: BORDER, paddingHorizontal: 14, fontSize: 20, color: INK },
  iconButton: { paddingHorizontal: 12 },
  youBadge: { backgroundColor: PURPLE_TINT, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
  youBadgeText: { fontSize: 18, fontWeight: '800', color: PURPLE_DARK },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 18, borderRadius: 22, backgroundColor: PURPLE_TINT },
  bannerText: { flex: 1, fontSize: 18, lineHeight: 26, color: INK },
  emptyText: { textAlign: 'center', paddingVertical: 16, color: MUTED, fontSize: 16 },
  footer: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: BORDER },
  addInput: { flex: 1, height: 64, borderRadius: 24, borderWidth: 2, borderColor: BORDER, backgroundColor: SURFACE, paddingHorizontal: 22, fontSize: 20, color: INK },
  addButton: { height: 64, paddingHorizontal: 32, borderRadius: 24, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 22, fontWeight: '800', color: ON_PURPLE },
  dimmed: { opacity: 0.55 },
});
