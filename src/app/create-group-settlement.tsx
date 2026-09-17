import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';

export default function CreateGroupSettlementScreen() {
  const router = useRouter();
  const [settlementName, setSettlementName] = useState('Friday Night Out');
  const [groupName, setGroupName] = useState('Group 1');
  const [members, setMembers] = useState(['Imran', 'Ali']);

  const addMember = () => setMembers((prev) => [...prev, '']);
  const updateMember = (index: number, text: string) =>
    setMembers((prev) => prev.map((m, i) => (i === index ? text : m)));
  const removeMember = (index: number) =>
    setMembers((prev) => prev.filter((_, i) => i !== index));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Create Group Settlement</Text>
        </View>

        <View style={styles.divider} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Settlement name :</Text>
          <TextInput
            style={styles.pillInput}
            value={settlementName}
            onChangeText={setSettlementName}
            textAlign="center"
          />

          <Text style={styles.fieldLabel}>Group name:</Text>
          <TextInput
            style={styles.pillInput}
            value={groupName}
            onChangeText={setGroupName}
            textAlign="center"
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
          <Pressable style={styles.continueButton} onPress={() => {}}>
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
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
