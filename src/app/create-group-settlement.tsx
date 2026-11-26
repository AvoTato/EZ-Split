import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroup, getGroups } from '../lib/groups';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];
const YOU_ID = 'you';

type MemberRow = { key: string; id: string | null; name: string; billOnly: boolean; you?: boolean };

let rowCounter = 0;
const nextKey = () => `row-${rowCounter++}`;

const youRow = (): MemberRow => ({ key: nextKey(), id: YOU_ID, name: 'You', billOnly: false, you: true });

const rowsForGroup = (groupId: string | null): MemberRow[] => {
  const group = groupId ? getGroup(groupId) : undefined;
  const rows = (group?.members ?? []).map((member) => ({
    key: nextKey(),
    id: member.id,
    name: member.name,
    billOnly: false,
    you: member.id === YOU_ID || member.name.trim().toLowerCase() === 'you',
  }));
  const hasYou = rows.some((row) => row.you);
  return hasYou ? rows : [youRow(), ...rows];
};

const isYou = (row: MemberRow) => Boolean(row.you);
const initialOf = (name: string, index: number) => name.trim().charAt(0).toUpperCase() || String(index + 1);

export default function CreateGroupSettlementScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, MUTED } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const initialGroupId = groupId && getGroup(groupId) ? groupId : null;
  const groups = getGroups();

  const [settlementName, setSettlementName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [newGroupName, setNewGroupName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>(() => rowsForGroup(initialGroupId));

  const selectedGroup = selectedGroupId ? getGroup(selectedGroupId) : undefined;
  const totalMembers = selectedGroup ? rowsForGroup(selectedGroup.id).length : members.length;

  const selectGroup = (id: string | null) => {
    if (id === selectedGroupId) return;
    setSelectedGroupId(id);
    setMembers(rowsForGroup(id));
  };

  const [editingYou, setEditingYou] = useState(false);
  const [youBackup, setYouBackup] = useState('You');

  const startEditingYou = (name: string) => {
    setYouBackup(name);
    setEditingYou(true);
  };
  const finishEditingYou = (key: string) => {
    setEditingYou(false);
    setMembers((prev) =>
      prev.map((m) => (m.key === key && !m.name.trim() ? { ...m, name: youBackup } : m)),
    );
  };

  const addBillOnly = () =>
    setMembers((prev) => [...prev, { key: nextKey(), id: null, name: '', billOnly: true }]);
  const updateMember = (key: string, text: string) =>
    setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, name: text } : m)));
  const removeMember = (key: string) => setMembers((prev) => prev.filter((m) => m.key !== key));

  const missingHint = !settlementName.trim()
    ? t('Enter a settlement name to continue.')
    : !selectedGroup && !newGroupName.trim()
      ? t('Enter a group name to continue.')
      : members.some((member) => !member.name.trim())
        ? t('Fill in every name or remove the empty ones.')
        : members.length < 2
          ? t('Add at least one more person to continue.')
          : null;
  const isValid = missingHint === null;

  const handleContinue = () => {
    if (!isValid) return;
    const used = new Set(members.map((member) => member.id).filter(Boolean));
    let counter = 1;
    const finalMembers = members.map((member) => {
      if (member.id) return { id: member.id, name: member.name.trim() };
      while (used.has(`p${counter}`)) counter += 1;
      const id = `p${counter}`;
      used.add(id);
      return { id, name: member.name.trim() };
    });
    setGroupSettlementSetup({
      settlementName: settlementName.trim(),
      groupName: selectedGroup ? selectedGroup.name : newGroupName.trim(),
      members: finalMembers,
      groupId: selectedGroup?.id,
    });
    router.push('/upload-file?flow=group');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View>
            <Text style={styles.stepLabel}>{t('Group settlement · Step {n} of 4', { n: 1 })}</Text>
            <Text style={styles.title}>{t('New settlement')}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>{t('Settlement name')}</Text>
          <TextInput
            style={styles.input}
            value={settlementName}
            onChangeText={setSettlementName}
            placeholder={t('e.g. Mamak Corner')}
            placeholderTextColor={colors.MUTED}
          />

          <Text style={[styles.fieldLabel, styles.sectionGap]}>{t('Group')}</Text>
          <View style={styles.chips}>
            {groups.map((group) => {
              const selected = group.id === selectedGroupId;
              return (
                <Pressable
                  key={group.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => selectGroup(group.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  {selected && <Ionicons name="checkmark" size={20} color={colors.ON_PURPLE} />}
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{group.name}</Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !selectedGroup }}
              onPress={() => selectGroup(null)}
              style={[styles.chip, styles.chipNew, !selectedGroup && styles.chipSelected]}
            >
              {selectedGroup ? (
                <Ionicons name="add" size={22} color={PURPLE_DARK} />
              ) : (
                <Ionicons name="checkmark" size={20} color={colors.ON_PURPLE} />
              )}
              <Text style={[styles.chipText, !selectedGroup && styles.chipTextSelected]}>{t('New group')}</Text>
            </Pressable>
          </View>

          {!selectedGroup && (
            <TextInput
              style={[styles.input, styles.groupNameInput]}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder={t('Group name')}
              placeholderTextColor={colors.MUTED}
            />
          )}

          <View style={[styles.membersHeader, styles.sectionGap]}>
            <Text style={styles.fieldLabelPlain}>{t('Who is splitting?')}</Text>
            <Text style={styles.countText}>
              {t('{n} of {total} members', { n: members.length, total: Math.max(totalMembers, members.length) })}
            </Text>
          </View>
          <View style={styles.memberCard}>
            {members.map((member, index) => {
              const you = isYou(member);
              return (
                <View key={member.key} style={styles.memberRow}>
                  <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                    <Text style={styles.avatarText}>{initialOf(member.name, index)}</Text>
                  </View>
                  {member.billOnly || (you && editingYou) ? (
                    <TextInput
                      style={styles.memberInput}
                      value={member.name}
                      onChangeText={(text) => updateMember(member.key, text)}
                      onBlur={you ? () => finishEditingYou(member.key) : undefined}
                      onSubmitEditing={you ? () => finishEditingYou(member.key) : undefined}
                      placeholder={t('Name')}
                      placeholderTextColor={colors.MUTED}
                      returnKeyType="done"
                      autoFocus
                    />
                  ) : (
                    <Text style={styles.memberName}>{member.name}</Text>
                  )}
                  {you ? (
                    <>
                      {!editingYou && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('Change your name')}
                          onPress={() => startEditingYou(member.name)}
                          hitSlop={8}
                        >
                          <Ionicons name="pencil-outline" size={22} color={PURPLE_DARK} />
                        </Pressable>
                      )}
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>{t('You')}</Text>
                      </View>
                    </>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('Remove {name}', { name: member.name || t('person') })}
                      onPress={() => removeMember(member.key)}
                      hitSlop={10}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close" size={26} color={MUTED} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          <Pressable accessibilityRole="button" style={styles.addButton} onPress={addBillOnly}>
            <Ionicons name="add" size={26} color={PURPLE_DARK} />
            <Text style={styles.addButtonText}>{t('Add a member')}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          {missingHint && <Text style={styles.hintText}>{missingHint}</Text>}
          <Pressable
            accessibilityRole="button"
            style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isValid}
          >
            <Text style={styles.continueText}>{t('Continue')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, TRACK, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  stepLabel: { fontSize: 14, fontWeight: '700', color: MUTED },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: TRACK, overflow: 'hidden', marginHorizontal: 20, marginBottom: 16 },
  progressFill: { width: '25%', height: '100%', borderRadius: 4, backgroundColor: PURPLE },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  fieldLabel: { fontSize: 16, fontWeight: '800', color: MUTED, marginBottom: 10, marginTop: 8 },
  fieldLabelPlain: { fontSize: 16, fontWeight: '800', color: MUTED },
  sectionGap: { marginTop: 22 },
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
  groupNameInput: { marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 26,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: SURFACE,
  },
  chipSelected: { backgroundColor: PURPLE },
  chipNew: { borderStyle: 'dashed' },
  chipText: { fontSize: 20, fontWeight: '800', color: PURPLE_DARK },
  chipTextSelected: { color: ON_PURPLE },
  membersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  countText: { fontSize: 16, color: MUTED },
  memberCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  memberName: { flex: 1, fontSize: 22, fontWeight: '700', color: INK },
  memberInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BORDER,
    paddingHorizontal: 14,
    fontSize: 20,
    color: INK,
  },
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
  continueButton: {
    backgroundColor: PURPLE,
    borderRadius: 24,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: { opacity: 0.5 },
  continueText: { fontSize: 20, fontWeight: '800', color: ON_PURPLE },
});
