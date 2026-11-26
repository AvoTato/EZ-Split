import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

import SplitBreakdown from './SplitBreakdown';

import { payBackStatus } from '../lib/debts';
import { groupStep } from '../lib/flowSteps';
import { money, pctOf } from '../lib/format';
import type { ParsedReceipt } from '../lib/parseReceipt';
import type { SettlementSummarySession } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

type Props = {
  session: SettlementSummarySession;
  title: string;
  isGroup: boolean;
  onBack: () => void;
  onSelectPayer: (personId: string) => void;
  onTogglePaid: (personId: string) => void;
  onShare: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  onCreateGroup?: (groupName: string) => void;
  receipt: ParsedReceipt | null;
  isEqual: boolean;
  isHistory?: boolean;
  date?: number;
};

export default function EqualSplitSummary({
  session,
  title,
  isGroup,
  onBack,
  onSelectPayer,
  onTogglePaid,
  onShare,
  onSave,
  saveDisabled = false,
  onCreateGroup,
  receipt,
  isEqual,
  isHistory = false,
  date,
}: Props) {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, MUTED, GREEN } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [namingGroup, setNamingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const status = payBackStatus(session);
  const payer = status.payer;
  const total = session.people.reduce((sum, person) => sum + person.amount, 0);
  const count = session.people.length;
  const each = count > 0 ? total / count : 0;
  const owed = status.friends.reduce((sum, friend) => sum + friend.amount, 0);
  const collected = status.friends
    .filter((friend) => friend.paidBack)
    .reduce((sum, friend) => sum + friend.amount, 0);
  const fraction = owed > 0 ? collected / owed : 0;
  const paidIds = new Set(session.settledIds ?? []);
  const servicePct = receipt ? pctOf(receipt.serviceCharge, receipt.subtotal) : null;
  const taxPct = receipt ? pctOf(receipt.tax, receipt.subtotal) : null;
  const includes = [
    receipt && receipt.serviceCharge !== null ? `${servicePct !== null ? `${servicePct}% ` : ''}${t('service')}` : null,
    receipt && receipt.tax !== null ? `${taxPct !== null ? `${taxPct}% ` : ''}${t('SST')}` : null,
  ].filter((part): part is string => part !== null);
  const peopleLabel = count === 1 ? t('1 person') : t('{n} people', { n: count });
  const heroSub = isEqual
    ? `${peopleLabel} · ${t('split equally, {amount} each', { amount: money(each) })}`
    : includes.length > 0
      ? `${peopleLabel} · ${t('includes {list}', { list: includes.join(t(' and ')) })}`
      : `${peopleLabel} · ${t('split by dish')}`;

  const submitGroup = () => {
    const name = groupName.trim();
    if (!name || !onCreateGroup) return;
    setNamingGroup(false);
    setGroupName('');
    onCreateGroup(name);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={onBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View>
            <Text style={styles.stepLabel}>{isHistory ? (isGroup ? t('Group settlement') : t('Instant split')) : isGroup ? groupStep(4).label : t('Instant split · Step {n} of 3', { n: 3 })}</Text>
            <Text style={styles.headerTitle}>{t('Settlement summary')}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroMeta}>
              {title} · {formatDate(date ? new Date(date) : new Date())}
            </Text>
            <Text style={styles.heroTotal}>{money(total)}</Text>
            <Text style={styles.heroSub}>
              {heroSub}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>{t('Who paid upfront?')}</Text>
          <View style={styles.chips}>
            {session.people.map((person) => {
              const selected = session.paidBy === person.id;
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('{name} paid upfront', { name: person.name })}
                  accessibilityState={{ selected }}
                  onPress={() => onSelectPayer(person.id)}
                  style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{person.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            {payer ? (
              <>
                <View style={styles.collectedRow}>
                  <Text style={styles.collectedTitle}>{t('Collected so far')}</Text>
                  <Text style={styles.collectedValue}>
                    {money(collected)} of {money(owed)}
                  </Text>
                </View>
                <View style={styles.collectedTrack}>
                  <View style={[styles.collectedFill, { width: `${Math.round(fraction * 100)}%` }]} />
                </View>
              </>
            ) : (
              <Text style={styles.hint}>{t('Pick who paid upfront to track who has paid them back.')}</Text>
            )}

            {session.people.map((person, index) => {
              const isPayer = payer?.id === person.id;
              const paid = paidIds.has(person.id);
              return (
                <View key={person.id}>
                <View style={[styles.personRow, index > 0 || payer ? styles.personRowDivided : null]}>
                  <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                    <Text style={styles.avatarText}>{person.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.personCopy}>
                    <Text style={styles.personName} numberOfLines={1}>
                      {person.name}
                    </Text>
                    {payer && (
                      <Text style={styles.personSub} numberOfLines={2}>
                        {isPayer ? t('Own share {amount}', { amount: money(person.amount) }) : t('Owes {name}', { name: payer.name })}
                      </Text>
                    )}
                  </View>
                  {person.breakdown ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: expandedId === person.id }}
                      accessibilityLabel={expandedId === person.id ? t('Hide how {name}’s {amount} was worked out', { name: person.name, amount: money(person.amount) }) : t('Show how {name}’s {amount} was worked out', { name: person.name, amount: money(person.amount) })}
                      onPress={() => setExpandedId(expandedId === person.id ? null : person.id)}
                      hitSlop={8}
                      style={styles.amountToggle}
                    >
                      <Text style={styles.personAmount}>{money(person.amount)}</Text>
                      <Ionicons
                        name={expandedId === person.id ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={MUTED}
                      />
                    </Pressable>
                  ) : (
                    <Text style={styles.personAmount}>{money(person.amount)}</Text>
                  )}
                  {payer &&
                    (isPayer ? (
                      <View style={styles.upfrontPill}>
                        <Text style={styles.upfrontText}>{t('Paid upfront')}</Text>
                      </View>
                    ) : paid ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('{name} has paid {payer} back. Tap to undo', { name: person.name, payer: payer.name })}
                        onPress={() => onTogglePaid(person.id)}
                        style={({ pressed }) => [styles.paidPill, pressed && styles.pressed]}
                      >
                        <Ionicons name="checkmark" size={20} color={GREEN} />
                        <Text style={styles.paidText}>{t('Paid')}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('Mark {name} as paid back', { name: person.name })}
                        onPress={() => onTogglePaid(person.id)}
                        style={({ pressed }) => [styles.markButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.markText}>{t('Mark paid')}</Text>
                      </Pressable>
                    ))}
                </View>
                {person.breakdown && expandedId === person.id && (
                  <SplitBreakdown breakdown={person.breakdown} receipt={receipt} />
                )}
                </View>
              );
            })}
          </View>

          {session.unassignedItems && session.unassignedItems.length > 0 && (
            <View style={styles.unassignedCard}>
              <Text style={styles.unassignedTitle}>{t('Unassigned items')}</Text>
              <Text style={styles.unassignedNote}>
                {session.unassignedItems.some((item) => item.withCharges !== undefined)
                  ? t('These items were not assigned to anyone and are not included above (amounts include their share of discount, tax and service).')
                  : t('These items were not assigned to anyone and are not included above.')}
              </Text>
              {session.unassignedItems.map((item, i) => (
                <View key={i} style={styles.unassignedRow}>
                  <Text style={styles.unassignedName}>{item.name}</Text>
                  <Text style={styles.unassignedPrice}>{money(item.withCharges ?? item.price)}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/how-split',
                params: { personId: session.paidBy ?? session.people[0]?.id ?? '', title },
              })
            }
            style={styles.linkRow}
          >
            <Ionicons name="information-circle-outline" size={26} color={PURPLE_DARK} />
            <Text style={styles.linkText}>{t('How was this split?')}</Text>
          </Pressable>

          {onCreateGroup && !isGroup && !isHistory && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNamingGroup(true)}
              style={styles.createGroup}
            >
              <Text style={styles.linkText}>{t('Create a group from these people')}</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={saveDisabled}
            onPress={onSave}
            style={({ pressed }) => [styles.saveButton, saveDisabled && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.saveText} numberOfLines={1}>
              {isHistory ? t('Done') : isGroup ? t('Save') : t('Back to homepage')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onShare}
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
          >
            <Ionicons name="share-outline" size={22} color={colors.ON_PURPLE} />
            <Text style={styles.shareText}>{t('Share bill')}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={namingGroup} transparent animationType="fade" onRequestClose={() => setNamingGroup(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t('Name your group')}</Text>
            <TextInput
              style={styles.dialogInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t('e.g. Housemates')}
              placeholderTextColor={MUTED}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitGroup}
            />
            <View style={styles.dialogActions}>
              <Pressable style={styles.dialogCancel} onPress={() => setNamingGroup(false)}>
                <Text style={styles.dialogCancelText}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogCreate, groupName.trim().length === 0 && styles.disabled]}
                disabled={groupName.trim().length === 0}
                onPress={submitGroup}
              >
                <Text style={styles.dialogCreateText}>{t('Create group')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, TRACK, PANEL, BG, SURFACE, GREEN_BAR, GREEN_TINT, GREEN, AMBER, OVERLAY  }: Colors) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
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
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: PURPLE,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: PURPLE,
    borderRadius: 32,
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  heroMeta: {
    fontSize: 17,
    fontWeight: '700',
    color: ON_PURPLE,
  },
  heroTotal: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '800',
    color: ON_PURPLE,
    letterSpacing: -2,
  },
  heroSub: {
    fontSize: 17,
    color: ON_PURPLE,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
    marginTop: 24,
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: SURFACE,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  chipSelected: {
    backgroundColor: PURPLE,
  },
  chipText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  chipTextSelected: {
    color: ON_PURPLE,
  },
  card: {
    marginTop: 24,
    backgroundColor: SURFACE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 6,
  },
  collectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  collectedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
  },
  collectedValue: {
    fontSize: 16,
    fontWeight: '700',
    color: MUTED,
  },
  collectedTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: TRACK,
    overflow: 'hidden',
    marginBottom: 6,
  },
  collectedFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: GREEN_BAR,
  },
  hint: {
    fontSize: 15,
    color: MUTED,
    marginBottom: 6,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  personRowDivided: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginTop: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  personCopy: {
    flex: 1,
  },
  personName: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  personSub: {
    fontSize: 15,
    color: MUTED,
  },
  personAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  markButton: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: AMBER,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  markText: {
    fontSize: 17,
    fontWeight: '800',
    color: AMBER,
  },
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: GREEN_TINT,
    paddingVertical: 16,
    paddingHorizontal: 26,
  },
  paidText: {
    fontSize: 17,
    fontWeight: '800',
    color: GREEN,
  },
  upfrontPill: {
    borderRadius: 999,
    backgroundColor: PURPLE_TINT,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  upfrontText: {
    fontSize: 16,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  linkText: {
    fontSize: 20,
    fontWeight: '800',
    color: PURPLE_DARK,
    letterSpacing: -0.4,
  },
  amountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unassignedCard: {
    marginTop: 16,
    backgroundColor: PANEL,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    gap: 6,
  },
  unassignedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  unassignedNote: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 4,
  },
  unassignedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  unassignedName: {
    flex: 1,
    fontSize: 16,
    color: INK,
  },
  unassignedPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
  },
  createGroup: {
    marginTop: 28,
  },
  footer: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  saveButton: {
    flex: 1.5,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: SURFACE,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  shareButton: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 18,
    backgroundColor: PURPLE,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: OVERLAY,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: SURFACE,
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  dialogTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: INK,
  },
  dialogInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BORDER,
    paddingHorizontal: 16,
    fontSize: 18,
    color: INK,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogCancel: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PURPLE,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dialogCancelText: {
    fontSize: 17,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  dialogCreate: {
    flex: 1.4,
    borderRadius: 16,
    backgroundColor: PURPLE,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dialogCreateText: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },
});
