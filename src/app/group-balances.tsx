import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ShareBillModal from '../components/ShareBillModal';
import {
  billSections,
  reminderSessionFor,
  type BillFriend,
  type BillSection,
} from '../lib/debts';
import { money } from '../lib/format';
import { setSharePaid } from '../lib/cloud';
import { getGroup, migrateLegacyPayments, pullSharedPaid, updateSettlementSummary } from '../lib/groups';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup, setSettlementSummarySession, type SettlementPerson } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT, localeTag } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];
const SNACKBAR_MS = 6000;

type Toast = { message: string; onUndo?: () => void };
type RemindTarget = { section: BillSection; friend: BillFriend };

function formatBillDate(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });
}

const isYou = (friend: BillFriend) => friend.id === 'you' || friend.name.trim().toLowerCase() === 'you';
const initialOf = (name: string, index: number) => name.trim().charAt(0).toUpperCase() || String(index + 1);

export default function GroupBalancesScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, MUTED, GREEN, AMBER } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [groupName, setGroupName] = useState('');
  const [sections, setSections] = useState<BillSection[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [billPeople, setBillPeople] = useState<Record<string, SettlementPerson[]>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [remindQueue, setRemindQueue] = useState<RemindTarget[]>([]);
  const remindFor = remindQueue[0] ?? null;
  const setRemindFor = (target: RemindTarget) => setRemindQueue([target]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), SNACKBAR_MS);
  }, []);

  const load = useCallback(() => {
    if (!groupId) return;
    const { unmatched } = migrateLegacyPayments(groupId);
    const group = getGroup(groupId);
    setGroupName(group?.name ?? '');
    const bills = group?.settlements ?? [];
    setMemberIds((group?.members ?? []).map((member) => member.id));
    setBillPeople(Object.fromEntries(bills.map((bill) => [bill.id, bill.summary.people])));
    setSections(
      billSections(bills).map((section) => {
        const order = bills.find((bill) => bill.id === section.id)?.summary.people.map((person) => person.id) ?? [];
        const rank = (id: string) => {
          const at = order.indexOf(id);
          return at === -1 ? order.length : at;
        };
        return { ...section, friends: [...section.friends].sort((a, b) => rank(a.id) - rank(b.id)) };
      }),
    );
    if (unmatched > 0) {
      showToast({
        message: unmatched === 1 ? t("1 earlier payment couldn't be matched to a settlement") : t("{n} earlier payments couldn't be matched to a settlement", { n: unmatched }),
      });
    }
  }, [groupId, showToast, t]);

  useFocusEffect(load);

  // Then pull in "I've paid" taps from share links, and redraw if any arrived.
  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;
      let active = true;
      pullSharedPaid(groupId)
        .then((changed) => {
          if (active && changed) load();
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [groupId, load]),
  );

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const setPaidBack = (section: BillSection, friend: BillFriend, paidBack: boolean) => {
    if (!groupId) return;
    const bill = getGroup(groupId)?.settlements?.find((item) => item.id === section.id);
    const current = bill?.summary.settledIds ?? [];
    const next = paidBack
      ? current.includes(friend.id)
        ? current
        : [...current, friend.id]
      : current.filter((id) => id !== friend.id);
    updateSettlementSummary(groupId, section.id, { settledIds: next.length > 0 ? next : undefined });
    if (bill?.summary.shareId) setSharePaid(bill.summary.shareId, friend.id, paidBack).catch(() => {});
    load();
  };

  const setPayer = (section: BillSection, person: SettlementPerson) => {
    if (!groupId) return;
    updateSettlementSummary(groupId, section.id, { paidBy: person.id });
    load();
    showToast({
      message: t('{name} paid upfront for {bill}', { name: person.name, bill: section.name }),
      onUndo: () => {
        updateSettlementSummary(groupId, section.id, { paidBy: undefined });
        load();
        setToast(null);
      },
    });
  };

  const togglePaid = (section: BillSection, friend: BillFriend) => {
    const nextPaid = !friend.paidBack;
    setPaidBack(section, friend, nextPaid);
    if (nextPaid && section.payer) {
      showToast({
        message: t('{name} paid {payer} {amount}', { name: friend.name, payer: section.payer.name, amount: money(friend.amount) }),
        onUndo: () => {
          setPaidBack(section, friend, false);
          setToast(null);
        },
      });
    }
  };

  const openBill = (section: BillSection) => {
    if (!groupId) return;
    const bill = getGroup(groupId)?.settlements?.find((item) => item.id === section.id);
    if (!bill) return;
    setGroupSettlementSetup(null);
    setSettlementSummarySession(bill.summary);
    router.push({ pathname: '/settlement-summary', params: { groupId, settlementId: bill.id } });
  };

  const openSections = sections.filter((section) => !section.allPaid);
  const settledSections = sections.filter((section) => section.allPaid);
  const stillToCollect = openSections.reduce((sum, section) => sum + Math.round(section.remaining * 100), 0) / 100;
  const unpaidTargets: RemindTarget[] = openSections.flatMap((section) =>
    section.payer ? section.friends.filter((friend) => !friend.paidBack).map((friend) => ({ section, friend })) : [],
  );
  const owingPeople = new Set(unpaidTargets.map((target) => target.friend.id)).size;

  const colorIndex = (id: string, fallback: number) => {
    const at = memberIds.indexOf(id);
    return at === -1 ? fallback : at;
  };

  const renderFriend = (section: BillSection, friend: BillFriend, index: number) => (
    <View key={friend.id} style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[colorIndex(friend.id, index) % AVATAR_COLORS.length] }]}>
        <Text style={styles.avatarText}>{initialOf(friend.name, index)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={friend.paidBack ? t('{name} has paid', { name: friend.name }) : t('Mark {name} as paid', { name: friend.name })}
        disabled={friend.paidBack}
        onPress={() => togglePaid(section, friend)}
        style={styles.friendInfo}
      >
        <Text style={styles.friendName} numberOfLines={1}>
          {friend.name}
        </Text>
        <Text style={[styles.friendStatus, { color: friend.paidBack ? GREEN : AMBER }]}>
          {friend.paidBack ? t('Paid back') : t('Not paid')}
        </Text>
      </Pressable>
      <Text style={[styles.friendAmount, friend.paidBack && styles.friendAmountPaid]}>{money(friend.amount)}</Text>
      {friend.paidBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('{name} has paid. Tap to undo', { name: friend.name })}
          onPress={() => togglePaid(section, friend)}
          style={styles.checkCircle}
        >
          <Ionicons name="checkmark" size={20} color={GREEN} />
        </Pressable>
      ) : isYou(friend) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Mark {name} as paid', { name: friend.name })}
          onPress={() => togglePaid(section, friend)}
          style={({ pressed }) => [styles.markPaidButton, pressed && styles.pressed]}
        >
          <Text style={styles.markPaidText}>{t('Mark paid')}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Remind {name} to pay {payer}', { name: friend.name, payer: section.payer?.name ?? '' })}
          onPress={() => setRemindFor({ section, friend })}
          style={({ pressed }) => [styles.remindButton, pressed && styles.pressed]}
        >
          <Text style={styles.remindText}>{t('Remind')}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Go back')}
            onPress={() => goBack(router, '/(tabs)/groups')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View style={styles.headerText}>
            {groupName.length > 0 && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {groupName}
              </Text>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>{t('Balances')}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summary}>
            {sections.length === 0 ? (
              <Text style={styles.summaryEmpty}>{t('No settlements yet. Save one to this group to track who has paid.')}</Text>
            ) : stillToCollect > 0 ? (
              <>
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryLabel}>{t('Still to collect')}</Text>
                  <Text style={styles.summaryAmount}>{money(stillToCollect)}</Text>
                  <Text style={styles.summarySub}>
                    {owingPeople === 1 ? t('1 person') : t('{n} people', { n: owingPeople })} ·{' '}
                    {openSections.length === 1 ? t('1 open settlement') : t('{n} open settlements', { n: openSections.length })}
                  </Text>
                </View>
                {unpaidTargets.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Remind everyone who hasn't paid")}
                    onPress={() => setRemindQueue(unpaidTargets)}
                    style={({ pressed }) => [styles.remindAll, pressed && styles.pressed]}
                  >
                    <Ionicons name="notifications-outline" size={20} color={PURPLE_DARK} />
                    <Text style={styles.remindAllText}>{t('Remind all')}</Text>
                  </Pressable>
                )}
              </>
            ) : openSections.length > 0 ? (
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>{t('Who paid upfront?')}</Text>
                <Text style={styles.summarySub}>{t('Pick who paid on each open settlement so we can track who owes what.')}</Text>
              </View>
            ) : (
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>{t('All settled')}</Text>
                <Text style={styles.summarySub}>{t('Everyone has paid back.')}</Text>
              </View>
            )}
          </View>

          {openSections.length > 0 && <Text style={styles.sectionLabel}>{t('OPEN')}</Text>}
          {openSections.map((section) => {
            const paidAmount = section.friends
              .filter((friend) => friend.paidBack)
              .reduce((sum, friend) => sum + Math.round(friend.amount * 100), 0);
            const totalAmount = section.friends.reduce((sum, friend) => sum + Math.round(friend.amount * 100), 0);
            const fraction = totalAmount === 0 ? 0 : paidAmount / totalAmount;
            return (
              <View key={section.id} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleBlock}>
                    <Text style={styles.sectionTitle} numberOfLines={2}>
                      {section.name}
                    </Text>
                    <Text style={styles.sectionDate}>
                      {formatBillDate(section.createdAt)}
                      {section.payer ? ` · ${t('{name} paid upfront', { name: section.payer.name })}` : ''}
                    </Text>
                  </View>
                  {section.hasPayer ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {t('{n} of {total} paid', { n: section.paidBackCount, total: section.friends.length })}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.badgeMuted]}>
                      <Text style={[styles.badgeText, { color: MUTED }]}>{t('Payer needed')}</Text>
                    </View>
                  )}
                </View>

                {section.payer ? (
                  <>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(fraction * 100)}%` }]} />
                    </View>
                    <View>{section.friends.map((friend, index) => renderFriend(section, friend, index))}</View>
                  </>
                ) : (
                  <>
                    <Text style={styles.payerPrompt}>{t('Who paid upfront?')}</Text>
                    <View style={styles.payerChips}>
                      {(billPeople[section.id] ?? []).map((person, index) => (
                        <Pressable
                          key={person.id}
                          accessibilityRole="button"
                          accessibilityLabel={t('{name} paid upfront', { name: person.name })}
                          onPress={() => setPayer(section, person)}
                          style={({ pressed }) => [styles.payerChip, pressed && styles.pressed]}
                        >
                          <View
                            style={[
                              styles.payerChipAvatar,
                              { backgroundColor: AVATAR_COLORS[colorIndex(person.id, index) % AVATAR_COLORS.length] },
                            ]}
                          >
                            <Text style={styles.payerChipInitial}>{initialOf(person.name, index)}</Text>
                          </View>
                          <Text style={styles.payerChipText}>{person.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View>
                      {(billPeople[section.id] ?? []).map((person, index) => (
                        <View key={person.id} style={styles.friendRow}>
                          <View
                            style={[
                              styles.avatar,
                              { backgroundColor: AVATAR_COLORS[colorIndex(person.id, index) % AVATAR_COLORS.length] },
                            ]}
                          >
                            <Text style={styles.avatarText}>{initialOf(person.name, index)}</Text>
                          </View>
                          <Text style={[styles.friendName, styles.friendInfo]} numberOfLines={1}>
                            {person.name}
                          </Text>
                          <Text style={styles.friendAmount}>{money(person.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Open {name}', { name: section.name })}
                  onPress={() => openBill(section)}
                  style={({ pressed }) => [styles.openLink, pressed && styles.pressed]}
                >
                  <Text style={styles.openLinkText}>{t('Open settlement')}</Text>
                  <Ionicons name="chevron-forward" size={18} color={PURPLE_DARK} />
                </Pressable>
              </View>
            );
          })}

          {settledSections.length > 0 && <Text style={styles.sectionLabel}>{t('SETTLED')}</Text>}
          {settledSections.map((section) => (
            <Pressable
              key={section.id}
              accessibilityRole="button"
              accessibilityLabel={t('Open {name}', { name: section.name })}
              onPress={() => openBill(section)}
              style={({ pressed }) => [styles.settledCard, pressed && styles.pressed]}
            >
              <View style={styles.settledCheck}>
                <Ionicons name="checkmark" size={20} color={GREEN} />
              </View>
              <View style={styles.settledCopy}>
                <Text style={styles.settledTitle} numberOfLines={1}>
                  {section.name}
                </Text>
                <Text style={styles.settledSub}>{formatBillDate(section.createdAt)} · {t('All paid back')}</Text>
              </View>
              <Text style={styles.settledAmount}>{money(section.total)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {remindFor && remindFor.section.payer && (
          <ShareBillModal
            remindOnly
            visible
            title={remindFor.section.name}
            session={reminderSessionFor({
              fromId: remindFor.friend.id,
              fromName: remindFor.friend.name,
              toId: remindFor.section.payer.id,
              toName: remindFor.section.payer.name,
              amount: remindFor.friend.amount,
            })}
            onClose={() => setRemindQueue((prev) => prev.slice(1))}
          />
        )}

        {toast && (
          <View style={styles.snackbar} accessibilityLiveRegion="polite">
            <Text style={styles.snackbarText} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.onUndo && (
              <Pressable accessibilityRole="button" accessibilityLabel={t('Undo')} onPress={toast.onUndo} hitSlop={8}>
                <Text style={styles.snackbarUndo}>{t('Undo')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE, ON_PURPLE, INK, MUTED, BORDER, TRACK, BG, SURFACE, GREEN_TINT, GREEN, AMBER_TINT, AMBER  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  headerText: { flex: 1, minWidth: 0 },
  headerSubtitle: { fontSize: 14, fontWeight: '700', color: MUTED },
  headerTitle: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  content: { paddingHorizontal: 20, paddingBottom: 96, gap: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderRadius: 26, backgroundColor: PURPLE },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryLabel: { fontSize: 15, fontWeight: '800', color: ON_PURPLE },
  summaryAmount: { fontSize: 36, fontWeight: '800', color: ON_PURPLE, letterSpacing: -1 },
  summarySub: { fontSize: 14, color: ON_PURPLE },
  summaryEmpty: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: ON_PURPLE },
  remindAll: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 18, backgroundColor: SURFACE },
  remindAllText: { fontSize: 16, fontWeight: '800', color: PURPLE_DARK },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: MUTED, letterSpacing: 0.4, marginTop: 6 },
  sectionCard: { padding: 18, borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionTitleBlock: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  sectionDate: { fontSize: 14, color: MUTED },
  badge: { borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: AMBER_TINT },
  badgeText: { fontSize: 14, fontWeight: '800', color: AMBER },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: TRACK, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: GREEN },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: BORDER },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  friendInfo: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 17, fontWeight: '800', color: INK },
  friendStatus: { fontSize: 14, fontWeight: '800' },
  friendAmount: { fontSize: 17, fontWeight: '800', color: INK },
  friendAmountPaid: { color: MUTED },
  checkCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN_TINT, alignItems: 'center', justifyContent: 'center' },
  markPaidButton: { height: 44, paddingHorizontal: 16, borderRadius: 16, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  markPaidText: { fontSize: 15, fontWeight: '800', color: ON_PURPLE },
  remindButton: { height: 44, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, borderColor: PURPLE, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  remindText: { fontSize: 15, fontWeight: '800', color: PURPLE_DARK },
  openLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  openLinkText: { fontSize: 16, fontWeight: '800', color: PURPLE_DARK },
  badgeMuted: { backgroundColor: TRACK },
  payerPrompt: { fontSize: 15, fontWeight: '800', color: INK },
  payerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payerChip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 5, paddingRight: 14, borderRadius: 20, borderWidth: 2, borderColor: PURPLE, backgroundColor: SURFACE },
  payerChipAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  payerChipInitial: { fontSize: 13, fontWeight: '800', color: '#fff' },
  payerChipText: { fontSize: 15, fontWeight: '800', color: PURPLE_DARK },
  settledCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  settledCheck: { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN_TINT, alignItems: 'center', justifyContent: 'center' },
  settledCopy: { flex: 1, minWidth: 0 },
  settledTitle: { fontSize: 17, fontWeight: '800', color: INK },
  settledSub: { fontSize: 13, color: MUTED },
  settledAmount: { fontSize: 17, fontWeight: '800', color: MUTED },
  snackbar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: ON_PURPLE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  snackbarText: { flex: 1, fontSize: 14, color: '#fff' },
  snackbarUndo: { fontSize: 14, fontWeight: '800', color: '#C9BDFB' },
  pressed: { opacity: 0.65 },
});
