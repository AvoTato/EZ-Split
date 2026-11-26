import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';


type Props = {
  visible: boolean;
  groupName: string;
  memberCount: number;
  onStartSplit: () => void;
  onGoToGroups: () => void;
};

export default function GroupCreatedModal({
  visible,
  groupName,
  memberCount,
  onStartSplit,
  onGoToGroups,
}: Props) {
  const t = useT();
  const colors = useColors();
  const { PURPLE } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const message =
    memberCount > 0
      ? memberCount === 1
        ? t('{name} has 1 member and is ready for its first split.', { name: groupName })
        : t('{name} has {n} members and is ready for its first split.', { name: groupName, n: memberCount })
      : t('{name} is ready for its first split.', { name: groupName });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onGoToGroups}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View pointerEvents="none" style={styles.confetti}>
            <View style={[styles.square, { top: 20, left: 22, backgroundColor: PURPLE, transform: [{ rotate: '20deg' }] }]} />
            <View style={[styles.square, { top: 112, right: 12, backgroundColor: PURPLE, transform: [{ rotate: '35deg' }] }]} />
            <View style={[styles.dot, { top: 34, right: 40, backgroundColor: '#0F766E' }]} />
            <View style={[styles.dot, { top: 108, left: 70, backgroundColor: '#B45309' }]} />
            <View style={[styles.dot, { top: 262, left: 4, backgroundColor: '#C2185B' }]} />
          </View>
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={52} color={colors.ON_PURPLE} />
          </View>
          <Text style={styles.title}>{t('Group created!')}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={onStartSplit}
          >
            <Ionicons name="add" size={26} color={colors.ON_PURPLE} />
            <Text style={styles.buttonText}>{t('Start a split')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onGoToGroups} hitSlop={8} style={styles.link}>
            <Text style={styles.linkText}>{t('Go to Groups')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE, ON_PURPLE, INK, MUTED, SURFACE, OVERLAY  }: Colors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: OVERLAY,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: SURFACE,
    borderRadius: 32,
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  square: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    lineHeight: 26,
    color: MUTED,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  button: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: PURPLE,
    borderRadius: 24,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '800',
    color: ON_PURPLE,
  },
  pressed: {
    opacity: 0.85,
  },
  link: {
    paddingVertical: 20,
  },
  linkText: {
    fontSize: 20,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
});
