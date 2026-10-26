import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ParsedReceipt } from '../lib/parseReceipt';
import CorrectionBox from './CorrectionBox';
import {
  checkReceipt,
  itemsSum,
  parseMoney,
  unitPrice,
  type ReceiptField,
  type ReceiptIssue,
  type ReceiptPatch,
} from '../lib/receiptReview';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';
const BORDER = '#E5E5E5';
const GREEN = '#2E7D32';
const AMBER = '#B45309';
const AMBER_TINT = '#FFF7ED';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function format(value: number | null) {
  return value === null ? '' : value.toFixed(2);
}

// Commits every valid keystroke so nothing is lost if the editor closes mid-edit, but
// keeps its own text while focused so half-typed values ("12.") aren't reformatted.
// Resyncs when the value changes from outside (e.g. an item above it was removed).
function MoneyInput({
  value,
  onCommit,
  allowEmpty = false,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(value));
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    if (allowEmpty && next.trim() === '') {
      onCommit(null);
      return;
    }
    const parsed = parseMoney(next);
    if (parsed !== null) onCommit(parsed);
  };

  return (
    <View style={styles.moneyInputWrap}>
      <Text style={styles.moneyPrefix}>RM</Text>
      <TextInput
        style={styles.moneyInput}
        value={text}
        onChangeText={handleChange}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setText(format(value));
        }}
        keyboardType="decimal-pad"
        placeholder={allowEmpty ? '—' : '0.00'}
        placeholderTextColor={MUTED}
        selectTextOnFocus
      />
    </View>
  );
}

const TOTAL_FIELDS: { field: ReceiptField; label: string }[] = [
  { field: 'subtotal', label: 'Subtotal' },
  { field: 'discount', label: 'Discount' },
  { field: 'tax', label: 'SST' },
  { field: 'serviceCharge', label: 'Service Charge' },
  { field: 'total', label: 'Total' },
];

function IssueNotes({
  issues,
  onPatch,
}: {
  issues: ReceiptIssue[];
  onPatch: (patch: ReceiptPatch) => void;
}) {
  return issues.map((issue) => (
    <View key={issue.id} style={styles.issueNote}>
      <Text style={issue.severity === 'warning' ? styles.issueWarningText : styles.issueInfoText}>
        {issue.message}
      </Text>
      {issue.fix && (
        <Pressable style={styles.fixButton} onPress={() => onPatch(issue.fix!.patch)} hitSlop={6}>
          <Text style={styles.fixButtonText}>{issue.fix.label}</Text>
        </Pressable>
      )}
    </View>
  ));
}

const hasWarning = (issues: ReceiptIssue[]) => issues.some((issue) => issue.severity === 'warning');

export default function ReceiptEditor({
  receipt,
  onPatch,
  onDone,
}: {
  receipt: ParsedReceipt;
  onPatch: (patch: ReceiptPatch) => void;
  onDone: () => void;
}) {
  const issues = checkReceipt(receipt);
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const itemIssues = (index: number) =>
    issues.filter((issue) => issue.target.kind === 'item' && issue.target.index === index);
  const fieldIssues = (field: ReceiptField) =>
    issues.filter((issue) => issue.target.kind === 'field' && issue.target.field === field);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>Editing receipt</Text>
        <Pressable onPress={onDone} hitSlop={12}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      {warningCount > 0 ? (
        <View style={[styles.banner, styles.bannerWarning]}>
          <Ionicons name="warning-outline" size={16} color={AMBER} />
          <Text style={styles.bannerWarningText}>
            {warningCount === 1 ? '1 thing doesn’t add up' : `${warningCount} things don’t add up`}
          </Text>
        </View>
      ) : (
        <View style={[styles.banner, styles.bannerOk]}>
          <Ionicons name="checkmark-circle-outline" size={16} color={GREEN} />
          <Text style={styles.bannerOkText}>Everything adds up</Text>
        </View>
      )}

      <CorrectionBox receipt={receipt} onPatch={onPatch} />

      {receipt.items.map((item, index) => (
        <View
          key={index}
          style={[styles.itemRow, hasWarning(itemIssues(index)) && styles.flagged]}
        >
          <View style={styles.itemTopRow}>
            <Text style={styles.itemNumber}>{index + 1}.</Text>
            <TextInput
              style={styles.nameInput}
              value={item.name}
              onChangeText={(name) => onPatch({ type: 'setItem', index, fields: { name } })}
              placeholder="Item name"
              placeholderTextColor={MUTED}
            />
            <Pressable
              onPress={() => onPatch({ type: 'removeItem', index })}
              hitSlop={8}
              accessibilityLabel={`Remove ${item.name || `item ${index + 1}`}`}
            >
              <Ionicons name="trash-outline" size={18} color={MUTED} />
            </Pressable>
          </View>

          <View style={styles.itemBottomRow}>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() =>
                  onPatch({ type: 'setItem', index, fields: { qty: Math.max(1, item.qty - 1) } })
                }
                hitSlop={8}
              >
                <Ionicons name="remove" size={14} color={PURPLE} />
              </Pressable>
              <Text style={styles.stepperCount}>{item.qty}</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => onPatch({ type: 'setItem', index, fields: { qty: item.qty + 1 } })}
                hitSlop={8}
              >
                <Ionicons name="add" size={14} color={PURPLE} />
              </Pressable>
            </View>
            <Text style={styles.eachText}>
              {item.qty > 1 ? `${money(unitPrice(item))} each` : ''}
            </Text>
            <MoneyInput
              value={item.price}
              onCommit={(price) => onPatch({ type: 'setItem', index, fields: { price: price ?? 0 } })}
            />
          </View>

          <IssueNotes issues={itemIssues(index)} onPatch={onPatch} />
        </View>
      ))}

      <Pressable
        style={styles.addItemButton}
        onPress={() => onPatch({ type: 'addItem', item: { name: '', price: 0, qty: 1 } })}
      >
        <Ionicons name="add-circle-outline" size={18} color={PURPLE} />
        <Text style={styles.addItemText}>Add item</Text>
      </Pressable>

      <Text style={styles.itemsSumText}>Items add up to {money(itemsSum(receipt))}</Text>

      <View style={styles.divider} />

      {TOTAL_FIELDS.map(({ field, label }) => (
        <View key={field} style={hasWarning(fieldIssues(field)) && styles.flagged}>
          <View style={styles.totalRow}>
            <Text style={field === 'total' ? styles.totalLabelBold : styles.totalLabel}>{label}</Text>
            <MoneyInput
              value={receipt[field]}
              onCommit={(value) => onPatch({ type: 'setField', field, value })}
              allowEmpty
            />
          </View>
          <IssueNotes issues={fieldIssues(field)} onPatch={onPatch} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: MUTED,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: PURPLE,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  bannerWarning: {
    backgroundColor: AMBER_TINT,
  },
  bannerWarningText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER,
  },
  bannerOk: {
    backgroundColor: '#F0F7F0',
  },
  bannerOkText: {
    fontSize: 13,
    fontWeight: '600',
    color: GREEN,
  },
  flagged: {
    backgroundColor: AMBER_TINT,
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  issueNote: {
    gap: 6,
    paddingLeft: 28,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  issueWarningText: {
    fontSize: 13,
    color: AMBER,
  },
  issueInfoText: {
    fontSize: 13,
    color: MUTED,
  },
  fixButton: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  fixButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemNumber: {
    fontSize: 14,
    color: MUTED,
    minWidth: 20,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 4,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 28,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PILL_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    minWidth: 16,
    textAlign: 'center',
  },
  eachText: {
    flex: 1,
    fontSize: 12,
    color: MUTED,
  },
  moneyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PILL_GRAY,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  moneyPrefix: {
    fontSize: 14,
    color: MUTED,
  },
  moneyInput: {
    minWidth: 64,
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    paddingVertical: 6,
    textAlign: 'right',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  addItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: PURPLE,
  },
  itemsSumText: {
    fontSize: 13,
    color: MUTED,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: {
    fontSize: 15,
    color: MUTED,
  },
  totalLabelBold: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
});
