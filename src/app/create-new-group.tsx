import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GroupCreatedModal from '../components/GroupCreatedModal';
import { addGroup } from '../lib/groups';
import { goBack } from '../lib/navigation';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

type MemberRow = { key: number; name: string };

const initialOf = (name: string, index: number) => name.trim().charAt(0).toUpperCase() || String(index + 1);

export default function CreateNewGroupScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, MUTED } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [created, setCreated] = useState<{ id: string; name: string; memberCount: number } | null>(null);
  const nextKey = useRef(0);

  const addMember = () => setMembers((prev) => [...prev, { key: nextKey.current++, name: '' }]);
  const updateMember = (key: number, text: string) =>
    setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, name: text } : m)));
  const removeMember = (key: number) => setMembers((prev) => prev.filter((m) => m.key !== key));

  const missingHint = !groupName.trim()
    ? t('Enter a group name to continue.')
    : members.some((member) => !member.name.trim())
      ? t('Fill in every member name or remove the empty ones.')
      : null;
  const isValid = missingHint === null && !created;

  const handleCreate = () => {
    if (!isValid) return;
    const group = addGroup({
      name: groupName.trim(),
      members: [
        { id: 'you', name: 'You' },
        ...members.map((member, index) => ({ id: `p${index + 1}`, name: member.name.trim() })),
      ],
    });
    setCreated({ id: group.id, name: group.name, memberCount: members.length + 1 });
  };

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
          <Text style={styles.title}>{t('New group')}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>{t('Group name')}</Text>
          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder={t('e.g. Housemates')}
            placeholderTextColor={colors.MUTED}
            maxLength={80}
          />

          <View style={styles.membersHeader}>
            <Text style={styles.fieldLabelPlain}>{t('Who is in this group?')}</Text>
            <Text style={styles.countText}>
              {members.length + 1} {members.length === 0 ? 'member' : 'members'}
            </Text>
          </View>
          <View style={styles.memberCard}>
            <View style={styles.memberRow}>
              <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[0] }]}>
                <Text style={styles.avatarText}>{t('Y')}</Text>
              </View>
              <Text style={styles.memberName}>{t('You')}</Text>
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>{t('You')}</Text>
              </View>
            </View>
            {members.map((member, index) => (
              <View key={member.key} style={styles.memberRow}>
                <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[(index + 1) % AVATAR_COLORS.length] }]}>
                  <Text style={styles.avatarText}>{initialOf(member.name, index + 1)}</Text>
                </View>
                <TextInput
                  style={styles.memberInput}
                  value={member.name}
                  onChangeText={(text) => updateMember(member.key, text)}
                  placeholder={t('Name')}
                  placeholderTextColor={colors.MUTED}
                  autoCapitalize="words"
                  autoFocus
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Remove {name}', { name: member.name.trim() || t('member') })}
                  onPress={() => removeMember(member.key)}
                  hitSlop={10}
                  style={styles.removeButton}
                >
                  <Ionicons name="close" size={26} color={MUTED} />
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable accessibilityRole="button" style={styles.addButton} onPress={addMember}>
            <Ionicons name="add" size={26} color={PURPLE_DARK} />
            <Text style={styles.addButtonText}>{t('Add member')}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          {missingHint && <Text style={styles.hintText}>{missingHint}</Text>}
          <Pressable
            accessibilityRole="button"
            style={[styles.createButton, !isValid && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!isValid}
          >
            <Text style={styles.createText}>{t('Create group')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <GroupCreatedModal
        visible={created !== null}
        groupName={created?.name ?? ''}
        memberCount={created?.memberCount ?? 0}
        onStartSplit={() => {
          if (created) router.replace({ pathname: '/create-group-settlement', params: { groupId: created.id } });
        }}
        onGoToGroups={() => router.replace('/(tabs)/groups')}
      />
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  fieldLabel: { fontSize: 16, fontWeight: '800', color: MUTED, marginBottom: 10, marginTop: 8 },
  fieldLabelPlain: { fontSize: 16, fontWeight: '800', color: MUTED },
  input: {
    height: 58,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingHorizontal: 22,
    fontSize: 20,
    color: INK,
  },
  membersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  countText: { fontSize: 16, color: MUTED },
  memberCard: { borderRadius: 28, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, paddingVertical: 12, paddingHorizontal: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  memberName: { flex: 1, fontSize: 22, fontWeight: '700', color: INK },
  memberInput: { flex: 1, height: 44, borderRadius: 14, borderWidth: 2, borderColor: BORDER, paddingHorizontal: 14, fontSize: 20, color: INK },
  youBadge: { backgroundColor: PURPLE_TINT, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8 },
  youBadgeText: { fontSize: 18, fontWeight: '800', color: PURPLE_DARK },
  removeButton: { paddingHorizontal: 10 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 64,
    marginTop: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PURPLE,
  },
  addButtonText: { fontSize: 20, fontWeight: '800', color: PURPLE_DARK },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: BORDER },
  hintText: { fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 12 },
  createButton: { backgroundColor: PURPLE, borderRadius: 24, paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  createButtonDisabled: { opacity: 0.5 },
  createText: { fontSize: 20, fontWeight: '800', color: ON_PURPLE },
});
