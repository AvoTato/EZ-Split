import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const PURPLE = '#9B87F0';
const PURPLE_TINT = '#F1EDFD';
const MUTED = '#8A8A8A';

type Props = {
  visible: boolean;
  onGoToGroups: () => void;
};

export default function GroupCreatedModal({ visible, onGoToGroups }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onGoToGroups}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badgeOuter}>
            <View style={styles.badgeInner}>
              <Ionicons name="checkmark" size={26} color="#fff" />
            </View>
          </View>
          <Text style={styles.title}>Group Created!</Text>
          <Text style={styles.message}>
            Group has been created, you can view it in Groups tab
          </Text>
          <Pressable style={styles.button} onPress={onGoToGroups}>
            <Text style={styles.buttonText}>Go to Manage Groups</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  badgeOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PURPLE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: PURPLE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
