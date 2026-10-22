import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import GroupCreatedModal from '../components/GroupCreatedModal';
import { addGroup } from '../lib/groups';
import { goBack } from '../lib/navigation';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';

export default function CreateNewGroupScreen() {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [created, setCreated] = useState(false);

  const addMember = () => setMembers((prev) => [...prev, '']);
  const updateMember = (index: number, text: string) =>
    setMembers((prev) => prev.map((m, i) => (i === index ? text : m)));
  const removeMember = (index: number) =>
    setMembers((prev) => prev.filter((_, i) => i !== index));

  const missingHint = !groupName.trim()
    ? 'Enter a group name to continue.'
    : members.some((name) => !name.trim())
      ? 'Fill in every member name or remove the empty ones.'
      : null;
  const isValid = missingHint === null && !created;

  const handleAddGroup = () => {
    if (!isValid) return;
    addGroup({
      name: groupName.trim(),
      members: members.map((name, index) => ({ id: `p${index + 1}`, name: name.trim() })),
    });
    setCreated(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router, '/(tabs)/groups')} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Create New Group</Text>
        </View>

        <View style={styles.divider} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Group Name:</Text>
          <TextInput
            style={styles.pillInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter group name"
            placeholderTextColor="#999"
            textAlign="center"
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>Add members :</Text>
          <View style={styles.membersList}>
            {members.map((member, index) => (
              <View key={index} style={styles.memberRow}>
                <TextInput
                  style={[styles.pillInput, styles.memberInput]}
                  value={member}
                  onChangeText={(text) => updateMember(index, text)}
                  placeholder="Member name"
                  placeholderTextColor="#999"
                  textAlign="center"
                />
                <Pressable onPress={() => removeMember(index)} hitSlop={8} style={styles.removeMemberButton}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addMemberPill} onPress={addMember}>
              <Ionicons name="add" size={22} color="#000" />
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {missingHint && <Text style={styles.hintText}>{missingHint}</Text>}
          <Pressable
            style={[styles.addGroupButton, !isValid && styles.addGroupButtonDisabled]}
            onPress={handleAddGroup}
            disabled={!isValid}
          >
            <Text style={styles.addGroupButtonText}>Add Group</Text>
          </Pressable>
        </View>
      </View>

      <GroupCreatedModal visible={created} onGoToGroups={() => router.replace('/(tabs)/groups')} />
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  divider: {
    height: 2,
    backgroundColor: '#000',
    marginHorizontal: 20,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  pillInput: {
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#000',
    marginBottom: 24,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  membersList: {
    gap: 12,
  },
  memberRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  memberInput: {
    marginBottom: 0,
  },
  removeMemberButton: {
    position: 'absolute',
    right: 8,
  },
  addMemberPill: {
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  hintText: {
    fontSize: 13,
    color: '#8A8A8A',
    textAlign: 'center',
    marginBottom: 12,
  },
  addGroupButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGroupButtonDisabled: {
    opacity: 0.5,
  },
  addGroupButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
