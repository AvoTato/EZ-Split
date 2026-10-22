import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getGroup, updateGroup } from '../lib/groups';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';

type MemberRow = { id: string | null; name: string };

export default function CreateGroupSettlementScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const existingGroup = groupId ? getGroup(groupId) : undefined;
  const isExistingGroup = Boolean(existingGroup);
  const [settlementName, setSettlementName] = useState('');
  const [groupName, setGroupName] = useState(existingGroup?.name ?? '');
  const [members, setMembers] = useState<MemberRow[]>(
    () => existingGroup?.members?.map((member) => ({ id: member.id, name: member.name })) ?? [],
  );

  const addMember = () => setMembers((prev) => [...prev, { id: null, name: '' }]);
  const updateMember = (index: number, text: string) =>
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, name: text } : m)));
  const removeMember = (index: number) =>
    setMembers((prev) => prev.filter((_, i) => i !== index));

  const missingHint = !settlementName.trim()
    ? 'Enter a settlement name to continue.'
    : !groupName.trim()
      ? 'Enter a group name to continue.'
      : isExistingGroup && !existingGroup?.members?.length
        ? 'Add members to this group from the Members button first.'
        : !isExistingGroup && members.length === 0
          ? 'Add at least one member to continue.'
          : members.some((member) => !member.name.trim())
            ? 'Fill in every member name or remove the empty ones.'
            : null;
  const isValid = missingHint === null;

  const handleContinue = () => {
    if (!isValid) return;
    const finalMembers = existingGroup
      ? (existingGroup.members ?? [])
      : members.map((member, index) => ({
          id: member.id ?? `p${index + 1}`,
          name: member.name.trim(),
        }));
    const finalGroupName = groupName.trim();
    if (existingGroup) {
      updateGroup(existingGroup.id, { name: finalGroupName, members: finalMembers });
    }
    setGroupSettlementSetup({
      settlementName: settlementName.trim(),
      groupName: finalGroupName,
      members: finalMembers,
      groupId: existingGroup?.id,
    });
    router.push('/upload-file?flow=group');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isExistingGroup ? 'Create New Settlement' : 'Create Group Settlement'}
          </Text>
        </View>

        <View style={styles.divider} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Settlement name :</Text>
          <TextInput
            style={styles.pillInput}
            value={settlementName}
            onChangeText={setSettlementName}
            placeholder="Enter your settlement name"
            placeholderTextColor="#999"
            textAlign="center"
          />

          <Text style={styles.fieldLabel}>Group name:</Text>
          <TextInput
            style={styles.pillInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter Group Name"
            placeholderTextColor="#999"
            textAlign="center"
          />

          {!isExistingGroup && (
            <>
              <Text style={styles.fieldLabel}>Add members :</Text>
              <View style={styles.membersList}>
                {members.map((member, index) => (
                  <View key={member.id ?? `new-${index}`} style={styles.memberRow}>
                    <TextInput
                      style={[styles.pillInput, styles.memberInput]}
                      value={member.name}
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
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {missingHint && <Text style={styles.hintText}>{missingHint}</Text>}
          <Pressable
            style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isValid}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
  continueButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  hintText: {
    fontSize: 13,
    color: '#8A8A8A',
    textAlign: 'center',
    marginBottom: 12,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
