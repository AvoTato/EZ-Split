import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { groupStatus } from '../../lib/debts';
import { money } from '../../lib/format';
import { getGroups, removeGroup as deleteGroup, setGroups as storeGroups, type Group } from '../../lib/groups';
import { setGroupSettlementSetup } from '../../lib/receiptSession';
import { useColors, type Colors } from '../../lib/theme';
import { useT, localeTag } from '../../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

const initialOf = (name: string, index: number) => name.trim().charAt(0).toUpperCase() || String(index + 1);

function lastSplitLabel(group: Group) {
  const times = (group.settlements ?? []).map((settlement) => settlement.createdAt);
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });
}

export default function GroupsScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, MUTED, PANEL, GREEN_TINT, GREEN, AMBER_TINT, AMBER } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(getGroups());

  useFocusEffect(
    useCallback(() => {
      setGroups(getGroups());
    }, []),
  );

  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');

  const visibleGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openGroupEditor = (group?: Group) => {
    setEditingGroupId(group?.id ?? null);
    setGroupName(group?.name ?? '');
    setModalVisible(true);
  };

  const saveGroup = () => {
    const name = groupName.trim();
    if (!name) return;

    if (editingGroupId === null) return;

    storeGroups(getGroups().map((group) =>
      group.id === editingGroupId ? { ...group, name } : group,
    ));
    setGroups(getGroups());
    setModalVisible(false);
  };

  const removeGroup = (groupId: string) => {
    deleteGroup(groupId);
    setGroups(getGroups());
  };

  const createSettlement = (group: Group) => {
    setGroupSettlementSetup(null);
    router.push({ pathname: '/create-group-settlement', params: { groupId: group.id } });
  };

  const viewSettlements = (group: Group) => {
    router.push({ pathname: '/receipt-history', params: { groupId: group.id } });
  };

  const renderAvatars = (group: Group) => {
    const members = group.members ?? [];
    const overflow = members.length > 4;
    const shown = overflow ? members.slice(0, 3) : members;
    return (
      <View style={styles.avatars}>
        {shown.map((member, index) => (
          <View
            key={member.id}
            style={[styles.avatar, index > 0 && styles.avatarOverlap, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}
          >
            <Text style={styles.avatarText}>{initialOf(member.name, index)}</Text>
          </View>
        ))}
        {overflow && (
          <View style={[styles.avatar, styles.avatarOverlap, { backgroundColor: MUTED }]}>
            <Text style={styles.avatarText}>+{members.length - 3}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderStatus = (group: Group) => {
    const status = groupStatus(group.settlements ?? []);
    if (status.kind === 'none') {
      return (
        <View style={[styles.pill, { backgroundColor: PANEL }]}>
          <View style={[styles.pillDot, { backgroundColor: MUTED }]} />
          <Text style={[styles.pillText, { color: MUTED }]}>{t('No splits yet')}</Text>
        </View>
      );
    }
    if (status.kind === 'settled') {
      return (
        <View style={[styles.pill, { backgroundColor: GREEN_TINT }]}>
          <View style={[styles.pillDot, { backgroundColor: GREEN }]} />
          <Text style={[styles.pillText, { color: GREEN }]}>{t('All settled')}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.pill, { backgroundColor: AMBER_TINT }]}>
        <View style={[styles.pillDot, { backgroundColor: AMBER }]} />
        <Text style={[styles.pillText, { color: AMBER }]}>
          {status.kind === 'owed' ? t('You are owed {amount}', { amount: money(status.amount) }) : t('You owe {amount}', { amount: money(status.amount) })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>{t('Groups')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Backup and restore')}
            onPress={() => router.push('/backup')}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Ionicons name="cloud-outline" size={26} color={PURPLE_DARK} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? t('Finish editing groups') : t('Edit groups')}
            accessibilityState={{ selected: isEditing }}
            onPress={() => setIsEditing((current) => !current)}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Ionicons name={isEditing ? 'checkmark-outline' : 'pencil-outline'} size={24} color={PURPLE_DARK} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={24} color={MUTED} />
            <TextInput
              accessibilityLabel={t('Search groups')}
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('Search groups')}
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel={t('Clear search')} onPress={() => setSearch('')} hitSlop={10}>
                <Ionicons name="close-circle" size={20} color={MUTED} />
              </Pressable>
            )}
          </View>

          {isEditing && <Text style={styles.editHint}>{t('Tap a group name to rename it, or the trash icon to remove it.')}</Text>}

          <View style={styles.groupList}>
            {visibleGroups.map((group) => {
              const memberCount = group.members?.length ?? 0;
              const lastSplit = lastSplitLabel(group);
              const subtitle = `${memberCount === 1 ? t('1 member') : t('{n} members', { n: memberCount })}${lastSplit ? ` · ${t('last split {date}', { date: lastSplit })}` : ''}`;
              return (
                <View key={group.id} style={styles.groupCard}>
                  <View style={styles.cardBody}>
                    <View style={styles.topRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isEditing ? t('Rename {name}', { name: group.name }) : t('View {name} settlements', { name: group.name })}
                        onPress={() => (isEditing ? openGroupEditor(group) : viewSettlements(group))}
                        style={({ pressed }) => [styles.topPress, pressed && styles.pressed]}
                      >
                        {renderAvatars(group)}
                        <View style={styles.titleBlock}>
                          <Text style={styles.groupTitle} numberOfLines={1}>
                            {group.name}
                          </Text>
                          <Text style={styles.groupSub}>{subtitle}</Text>
                        </View>
                        <Ionicons name={isEditing ? 'pencil-outline' : 'chevron-forward'} size={24} color={MUTED} />
                      </Pressable>
                      {isEditing && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('Remove {name}', { name: group.name })}
                          onPress={() => removeGroup(group.id)}
                          style={({ pressed }) => [styles.deleteGroupButton, pressed && styles.pressed]}
                        >
                          <Ionicons name="trash-outline" size={22} color={colors.RED} />
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.statusRow}>
                      {renderStatus(group)}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('Create new settlement for {name}', { name: group.name })}
                        onPress={() => createSettlement(group)}
                        style={({ pressed }) => [styles.newSplit, pressed && styles.pressed]}
                      >
                        <Ionicons name="add" size={26} color={colors.ON_PURPLE} />
                        <Text style={styles.newSplitText}>{t('New split')}</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.footerRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('Balances for {name}', { name: group.name })}
                      onPress={() => router.push({ pathname: '/group-balances', params: { groupId: group.id } })}
                      style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="wallet-outline" size={22} color={PURPLE_DARK} />
                      <Text style={styles.footerText}>{t('Balances')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('View settlements for {name}', { name: group.name })}
                      onPress={() => viewSettlements(group)}
                      style={({ pressed }) => [styles.footerButton, styles.footerDivider, pressed && styles.pressed]}
                    >
                      <Ionicons name="receipt-outline" size={22} color={PURPLE_DARK} />
                      <Text style={styles.footerText}>{t('History')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('Members of {name}', { name: group.name })}
                      onPress={() => router.push({ pathname: '/group-members', params: { groupId: group.id } })}
                      style={({ pressed }) => [styles.footerButton, styles.footerDivider, pressed && styles.pressed]}
                    >
                      <Ionicons name="people-outline" size={22} color={PURPLE_DARK} />
                      <Text style={styles.footerText}>{t('Members')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          {visibleGroups.length === 0 && <Text style={styles.emptyText}>{t('No groups found.')}</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/create-new-group')}
            style={({ pressed }) => [styles.createGroupButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={28} color={PURPLE_DARK} />
            <Text style={styles.createGroupText}>{t('Create new group')}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>{t('Rename group')}</Text>
            <TextInput
              accessibilityLabel={t('Group name')}
              style={styles.modalInput}
              placeholder={t('Enter group name')}
              placeholderTextColor={MUTED}
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={saveGroup}
            />
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !groupName.trim() }}
                disabled={!groupName.trim()}
                style={[styles.modalSave, !groupName.trim() && styles.pressed]}
                onPress={saveGroup}
              >
                <Text style={styles.modalSaveText}>{t('Save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, PANEL, BG, SURFACE, RED_TINT, OVERLAY  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12 },
  headerTitle: { flex: 1, fontSize: 40, fontWeight: '800', color: INK, letterSpacing: -1 },
  roundButton: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  searchBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, marginBottom: 24, backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 22 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 20, color: INK },
  editHint: { color: MUTED, marginBottom: 16, fontSize: 14 },
  groupList: { gap: 20 },
  groupCard: { backgroundColor: SURFACE, borderRadius: 30, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  cardBody: { padding: 18, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topPress: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  avatarOverlap: { marginLeft: -16 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  titleBlock: { flex: 1, minWidth: 0 },
  groupTitle: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  groupSub: { fontSize: 16, color: MUTED, marginTop: 2 },
  deleteGroupButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: RED_TINT },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pill: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 26, paddingHorizontal: 18, paddingVertical: 8 },
  pillDot: { width: 10, height: 10, borderRadius: 5 },
  pillText: { flexShrink: 1, fontSize: 18, fontWeight: '800' },
  newSplit: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 22, backgroundColor: PURPLE },
  newSplitText: { fontSize: 20, fontWeight: '800', color: ON_PURPLE },
  footerRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER },
  footerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  footerDivider: { borderLeftWidth: 1, borderLeftColor: BORDER },
  footerText: { fontSize: 18, fontWeight: '800', color: PURPLE_DARK },
  createGroupButton: { minHeight: 68, marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: PURPLE },
  createGroupText: { fontSize: 22, fontWeight: '800', color: PURPLE_DARK },
  emptyText: { textAlign: 'center', paddingVertical: 24, color: MUTED, fontSize: 16 },
  pressed: { opacity: 0.65 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: OVERLAY },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: 28, padding: 24, backgroundColor: SURFACE },
  modalTitle: { fontSize: 22, fontWeight: '800', color: INK, marginBottom: 20 },
  modalInput: { borderWidth: 1, borderColor: BORDER, backgroundColor: PANEL, borderRadius: 16, padding: 14, fontSize: 17, color: INK },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalCancel: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14, backgroundColor: PURPLE_TINT },
  modalSave: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: PURPLE },
  modalCancelText: { fontSize: 16, fontWeight: '800', color: PURPLE_DARK },
  modalSaveText: { fontSize: 16, fontWeight: '800', color: ON_PURPLE },
});
