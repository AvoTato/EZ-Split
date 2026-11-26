import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import EqualSplitSummary from '../components/EqualSplitSummary';
import GroupCreatedModal from '../components/GroupCreatedModal';
import ShareBillModal from '../components/ShareBillModal';
import { fetchSharesPaid, isCloudConfigured, setSharePaid, updateShare } from '../lib/cloud';
import { addGroup, addSettlement, getGroup, updateSettlementSummary } from '../lib/groups';
import { CURRENCY } from '../lib/format';
import { goBack } from '../lib/navigation';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  getSettlementSummarySession,
  setGroupSettlementSetup,
  setSettlementSummarySession,
  type GroupSettlementSetup,
  type SettlementSummarySession,
} from '../lib/receiptSession';
import { billSnapshot, mergePaid } from '../lib/shareBill';
import { useT } from '../lib/i18n';

export default function SettlementSummaryScreen() {
  const t = useT();
  const router = useRouter();
  const { groupId, settlementId } = useLocalSearchParams<{ groupId?: string; settlementId?: string }>();
  const historyReceipt =
    groupId && settlementId
      ? getGroup(groupId)?.settlements?.find((s) => s.id === settlementId)?.receipt ?? null
      : null;
  const isHistory = Boolean(groupId && settlementId);
  const historyDate =
    groupId && settlementId
      ? getGroup(groupId)?.settlements?.find((s) => s.id === settlementId)?.createdAt
      : undefined;
  const historyName =
    groupId && settlementId
      ? getGroup(groupId)?.settlements?.find((s) => s.id === settlementId)?.name
      : undefined;
  const [session, setSession] = useState<SettlementSummarySession | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [groupSetup, setGroupSetup] = useState<GroupSettlementSetup | null>(null);
  const [groupCreated, setGroupCreated] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<{ id: string; name: string; memberCount: number } | null>(null);
  const [settlementSaved, setSettlementSaved] = useState(false);

  useEffect(() => {
    const stored = getSettlementSummarySession();
    if (!stored) {
      router.replace('/instant-settlement');
      return;
    }
    setGroupSetup(getGroupSettlementSetup());
    setSession(stored);
  }, [router]);

  // Pull in "I've paid" taps friends made on this bill's share link.
  const shareId = session?.shareId;
  useEffect(() => {
    if (!shareId || !isCloudConfigured()) return;
    let cancelled = false;
    fetchSharesPaid([shareId])
      .then((remote) => {
        const paidIds = remote[shareId];
        const latest = getSettlementSummarySession();
        if (cancelled || !paidIds || !latest || latest.shareId !== shareId) return;
        const merged = mergePaid(latest, paidIds);
        if ((merged?.length ?? 0) === (latest.settledIds?.length ?? 0)) return;
        const updated = { ...latest, settledIds: merged };
        setSession(updated);
        setSettlementSummarySession(updated);
        if (groupId && settlementId) updateSettlementSummary(groupId, settlementId, { settledIds: merged });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shareId, groupId, settlementId]);

  if (!session) return null;

  const billTitle = historyName ?? groupSetup?.settlementName;
  const receipt = isHistory ? historyReceipt : getParsedReceipt();

  // Keeps the share link's copy of the bill in step. Best effort: the app's copy is the real one.
  const pushShareBill = (updated: SettlementSummarySession) => {
    if (updated.shareId) updateShare(updated.shareId, billSnapshot(updated, billTitle, CURRENCY)).catch(() => {});
  };

  const handleShareId = (newShareId: string) => {
    // The link was made in the background, so build on the latest session, not this render's.
    const latest = getSettlementSummarySession() ?? session;
    const updated = { ...latest, shareId: newShareId };
    setSession(updated);
    setSettlementSummarySession(updated);
    if (groupId && settlementId) updateSettlementSummary(groupId, settlementId, { shareId: newShareId });
  };

  const saveSessionChange = (updatedSession: SettlementSummarySession) => {
    setSession(updatedSession);
    setSettlementSummarySession(updatedSession);
    if (groupId && settlementId) {
      updateSettlementSummary(groupId, settlementId, {
        paidBy: updatedSession.paidBy,
        settledIds: updatedSession.settledIds,
      });
    }
  };

  const selectPayer = (personId: string) => {
    const updated = {
      ...session,
      paidBy: session.paidBy === personId ? undefined : personId,
      settledIds: undefined,
    };
    saveSessionChange(updated);
    // The server clears paid marks too when the payer changes.
    pushShareBill(updated);
  };

  const togglePaidBack = (personId: string) => {
    const current = session.settledIds ?? [];
    const wasPaid = current.includes(personId);
    const next = wasPaid ? current.filter((id) => id !== personId) : [...current, personId];
    saveSessionChange({ ...session, settledIds: next.length > 0 ? next : undefined });
    if (session.shareId) setSharePaid(session.shareId, personId, !wasPaid).catch(() => {});
  };

  const handleCreateGroup = () => {
    if (!groupSetup || groupCreated) return;
    const group = addGroup({
      name: groupSetup.groupName,
      members: session.people.map(({ id, name }) => ({ id, name })),
    });
    addSettlement(group.id, {
      name: groupSetup.settlementName,
      createdAt: Date.now(),
      summary: session,
      receipt: getParsedReceipt(),
    });
    setCreatedGroup({ id: group.id, name: group.name, memberCount: session.people.length });
    setGroupCreated(true);
  };

  const handleCreateGroupFromPeople = (name: string) => {
    if (groupCreated) return;
    const group = addGroup({
      name,
      members: session.people.map(({ id, name: memberName }) => ({ id, name: memberName })),
    });
    addSettlement(group.id, {
      name: 'Instant split',
      createdAt: Date.now(),
      summary: session,
      receipt: getParsedReceipt(),
    });
    setCreatedGroup({ id: group.id, name: group.name, memberCount: session.people.length });
    setGroupCreated(true);
  };

  const handleSaveSettlement = () => {
    if (!groupSetup?.groupId || settlementSaved) return;
    const savedGroupId = groupSetup.groupId;
    addSettlement(savedGroupId, {
      name: groupSetup.settlementName,
      createdAt: Date.now(),
      summary: session,
      receipt: getParsedReceipt(),
    });
    setSettlementSaved(true);
    setGroupSettlementSetup(null);
    router.replace('/(tabs)/groups');
  };

  const handleStartSplit = () => {
    if (!createdGroup) return;
    setGroupSettlementSetup(null);
    router.replace({ pathname: '/create-group-settlement', params: { groupId: createdGroup.id } });
  };

  const handleGoToGroups = () => {
    setGroupSettlementSetup(null);
    router.replace('/(tabs)/groups');
  };

  if (!isHistory) {
    const handleEqualSave = () => {
      if (groupSetup?.groupId) handleSaveSettlement();
      else if (groupSetup) handleCreateGroup();
      else {
        setGroupSettlementSetup(null);
        router.replace('/(tabs)');
      }
    };
    return (
      <>
        <EqualSplitSummary
          session={session}
          title={billTitle ?? t('Instant split')}
          isGroup={Boolean(groupSetup)}
          onBack={() => goBack(router)}
          onSelectPayer={selectPayer}
          onTogglePaid={togglePaidBack}
          onShare={() => setShareModalVisible(true)}
          onSave={handleEqualSave}
          saveDisabled={groupSetup?.groupId ? settlementSaved : groupSetup ? groupCreated : false}
          onCreateGroup={groupSetup ? undefined : handleCreateGroupFromPeople}
          receipt={receipt}
          isEqual={session.pax !== undefined}
        />
        <GroupCreatedModal
          visible={groupCreated}
          groupName={createdGroup?.name ?? ''}
          memberCount={createdGroup?.memberCount ?? 0}
          onStartSplit={handleStartSplit}
          onGoToGroups={handleGoToGroups}
        />
        <ShareBillModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          session={session}
          title={billTitle}
          onShareId={handleShareId}
        />
      </>
    );
  }

  return (
    <>
      <EqualSplitSummary
        session={session}
        title={billTitle ?? t('Settlement')}
        isGroup={Boolean(groupId)}
        isHistory
        date={historyDate}
        onBack={() => goBack(router)}
        onSelectPayer={selectPayer}
        onTogglePaid={togglePaidBack}
        onShare={() => setShareModalVisible(true)}
        onSave={() => goBack(router)}
        receipt={receipt}
        isEqual={session.pax !== undefined}
      />
      <ShareBillModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        session={session}
        title={billTitle}
        onShareId={handleShareId}
      />
    </>
  );
}
