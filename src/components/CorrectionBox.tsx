import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  COMMAND_EXAMPLES,
  ruleBasedInterpreter,
  type CommandResult,
  type CorrectionInterpreter,
} from '../lib/receiptCommands';
import type { ReceiptPatch } from '../lib/receiptReview';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';
const AMBER = '#B45309';
const AMBER_TINT = '#FFF7ED';

export default function CorrectionBox({
  receipt,
  onPatch,
  interpreter = ruleBasedInterpreter,
}: {
  receipt: ParsedReceipt;
  onPatch: (patch: ReceiptPatch) => void;
  interpreter?: CorrectionInterpreter;
}) {
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState<{ result: CommandResult; receipt: ParsedReceipt } | null>(null);
  const [busy, setBusy] = useState(false);

  // A preview's patches point at item indexes, so it's dropped once the receipt changes.
  const result =
    answer && (!answer.result.ok || answer.receipt === receipt) ? answer.result : null;
  const setResult = (next: CommandResult | null) =>
    setAnswer(next ? { result: next, receipt } : null);

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setResult(await interpreter(text, receipt));
    } catch {
      setResult({ ok: false, error: 'Something went wrong. Try again or edit the receipt directly.' });
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    if (!result?.ok) return;
    result.patches.forEach(onPatch);
    setResult(null);
    setText('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(next) => {
            setText(next);
            if (result && !result.ok) setResult(null);
          }}
          onSubmitEditing={handleSubmit}
          placeholder={`Tell us what to fix, e.g. "${COMMAND_EXAMPLES[0]}"`}
          placeholderTextColor={MUTED}
          returnKeyType="go"
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSubmit}
          disabled={!text.trim() || busy}
          accessibilityLabel="Preview fix"
          hitSlop={6}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          )}
        </Pressable>
      </View>

      {result?.ok && (
        <View style={styles.preview}>
          <Text style={styles.previewText}>{result.summary}</Text>
          <View style={styles.previewActions}>
            <Pressable onPress={() => setResult(null)} hitSlop={6}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.applyButton} onPress={handleApply} hitSlop={6}>
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      )}

      {result && !result.ok && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{result.error}</Text>
          <Text style={styles.examplesText}>
            Try: {COMMAND_EXAMPLES.map((example) => `"${example}"`).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: PILL_GRAY,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  preview: {
    borderWidth: 1,
    borderColor: PURPLE,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
  applyButton: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  applyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  errorBox: {
    backgroundColor: AMBER_TINT,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER,
  },
  examplesText: {
    fontSize: 12,
    color: MUTED,
  },
});
