import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
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

type Group = { id: string; name: string };

const INITIAL_GROUPS: Group[] = [
  { id: '1', name: 'School Mates' },
  { id: '2', name: 'Dragon Fire' },
];

export default function GroupsScreen() {
  const router = useRouter();
  // Replace this local state with your stored groups when connecting your backend.
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const nextId = useRef(3);
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

    if (editingGroupId !== null) {
      setGroups((current) => current.map((group) =>
        group.id === editingGroupId ? { ...group, name } : group,
      ));
    } else {
      const id = String(nextId.current++);
      setGroups((current) => [...current, { id, name }]);
      setSearch('');
    }
    setModalVisible(false);
  };

  const removeGroup = (groupId: string) => {
    setGroups((current) => current.filter((group) => group.id !== groupId));
  };

  const createSettlement = (group: Group) => {
    router.push({
      pathname: '/upload-file',
      params: { flow: 'group', groupId: group.id, groupName: group.name },
    });
  };

  const viewSettlements = (group: Group) => {
    // TODO: Replace this with router.push to your actual settlements screen,
    // passing group.id so that screen can load the correct settlements.
    Alert.alert(group.name, 'Connect this button to your settlements screen.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <View style={styles.backIcon}>
              <Ionicons name="chevron-back" size={24} color="#191919" />
              <Ionicons name="chevron-back" size={24} color="#191919" style={styles.secondChevron} />
            </View>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
            Manage Groups
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Finish editing groups' : 'Edit groups'}
            accessibilityState={{ selected: isEditing }}
            onPress={() => setIsEditing((current) => !current)}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Ionicons name={isEditing ? 'checkmark-outline' : 'pencil-outline'} size={26} color="#9855FF" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={22} color="#75717F" />
            <TextInput
              accessibilityLabel="Search groups"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search groups"
              placeholderTextColor="#75717F"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={10}>
                <Ionicons name="close-circle" size={20} color="#75717F" />
              </Pressable>
            )}
          </View>

          {isEditing && <Text style={styles.editHint}>Tap a group name to rename it, or the trash icon to remove it.</Text>}

          <View style={styles.groupList}>
            {visibleGroups.map((group) => (
              <View key={group.id} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isEditing ? `Rename ${group.name}` : `View ${group.name} settlements`}
                    onPress={() => isEditing ? openGroupEditor(group) : viewSettlements(group)}
                    style={({ pressed }) => [styles.groupTitleButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.groupTitle}>{group.name}</Text>
                    {isEditing && <Ionicons name="pencil-outline" size={21} color="#222" />}
                  </Pressable>
                  {isEditing && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${group.name}`}
                      onPress={() => removeGroup(group.id)}
                      style={({ pressed }) => [styles.deleteGroupButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="trash-outline" size={22} color="#B42318" />
                    </Pressable>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Create new settlement for ${group.name}`}
                  onPress={() => createSettlement(group)}
                  style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}
                >
                  <Text style={styles.cardButtonText}>Create new settlement</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View and edit settlements for ${group.name}`}
                  onPress={() => viewSettlements(group)}
                  style={({ pressed }) => [styles.cardButton, pressed && styles.pressed]}
                >
                  <Text style={styles.cardButtonText}>View and edit Settlements</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {visibleGroups.length === 0 && <Text style={styles.emptyText}>No groups found.</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={() => openGroupEditor()}
            style={({ pressed }) => [styles.createGroupButton, pressed && styles.pressed]}
          >
            <Ionicons name="add-outline" size={34} color="#111" />
            <Text style={styles.createGroupText}>Create New Group</Text>
          </Pressable>
        </ScrollView>


      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>{editingGroupId !== null ? 'Rename group' : 'Create new group'}</Text>
            <TextInput
              accessibilityLabel="Group name"
              style={styles.modalInput}
              placeholder="Enter group name"
              placeholderTextColor="#75717F"
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={saveGroup}
            />
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !groupName.trim() }}
                disabled={!groupName.trim()}
                style={[styles.modalSave, !groupName.trim() && styles.pressed]}
                onPress={saveGroup}
              >
                <Text style={styles.modalActionText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 28, gap: 10 },
  backButton: { minWidth: 30, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  backIcon: { flexDirection: 'row', alignItems: 'center' },
  secondChevron: { marginLeft: -16 },
  headerTitle: { flex: 1, fontSize: 32, fontWeight: '600', color: '#171717', letterSpacing: 0.2 },
  editButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  searchBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginHorizontal: 5, marginBottom: 32, backgroundColor: '#F8F7FA', borderWidth: 1, borderColor: '#E6E3EE', borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 16, color: '#222' },
  editHint: { color: '#696171', marginBottom: 16, fontSize: 14 },
  groupList: { gap: 44 },
  groupCard: { backgroundColor: '#C39FFF', borderRadius: 22, paddingHorizontal: 21, paddingTop: 24, paddingBottom: 22, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 2.5, elevation: 4 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteGroupButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0EE' },
  groupTitleButton: { flex: 1, minWidth: 0, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 0 },
  groupTitle: { flexShrink: 1, fontSize: 27, fontWeight: '500', color: '#202020', textDecorationLine: 'underline' },
  cardButton: { minHeight: 58, backgroundColor: '#F7F7F7', borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 2, elevation: 4 },
  cardButtonText: { fontSize: 22, fontWeight: '500', color: '#202020', textAlign: 'center' },
  createGroupButton: { minHeight: 44, marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#C2C2C2', borderRadius: 16 },
  createGroupText: { fontSize: 18, fontWeight: '600', color: '#080808' },
  emptyText: { textAlign: 'center', paddingVertical: 24, color: '#75717F', fontSize: 16 },
  pressed: { opacity: 0.65 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: 22, padding: 24, backgroundColor: '#FFF' },
  modalTitle: { fontSize: 22, fontWeight: '600', color: '#171717', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderColor: '#E6E3EE', backgroundColor: '#F8F7FA', borderRadius: 14, padding: 14, fontSize: 17, color: '#222' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalCancel: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, backgroundColor: '#EFEFEF' },
  modalSave: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, backgroundColor: '#C39FFF' },
  modalActionText: { fontSize: 16, fontWeight: '600', color: '#171717' },
});
