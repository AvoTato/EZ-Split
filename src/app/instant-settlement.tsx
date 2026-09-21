import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ParsedReceipt } from '../lib/parseReceipt';
import { getParsedReceipt } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';
const GREEN = '#2E7D32';
const MUTED = '#8A8A8A';

type SplitMode = 'equal' | 'separate';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function pctOf(part: number | null, whole: number | null) {
  if (part === null || whole === null || whole === 0) return null;
  return Math.round((part / whole) * 100);
}

export default function InstantSettlementScreen() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('separate');
  const [pax, setPax] = useState(2);

  useEffect(() => {
    const stored = getParsedReceipt();
    if (!stored) {
      router.replace('/upload-receipt');
      return;
    }
    setReceipt(stored);
  }, [router]);

  if (!receipt) return null;

  const taxPct = pctOf(receipt.tax, receipt.subtotal);
  const servicePct = pctOf(receipt.serviceCharge, receipt.subtotal);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Instant Settlement</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segment, splitMode === 'equal' && styles.segmentActive]}
              onPress={() => setSplitMode('equal')}
            >
              <Text style={[styles.segmentText, splitMode === 'equal' && styles.segmentTextActive]}>
                Split equally
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, splitMode === 'separate' && styles.segmentActive]}
              onPress={() => setSplitMode('separate')}
            >
              <Text style={[styles.segmentText, splitMode === 'separate' && styles.segmentTextActive]}>
                Split separately
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.detectedRow}>
              <Ionicons name="checkmark" size={16} color={GREEN} />
              <Text style={styles.detectedText}>Receipt detected</Text>
            </View>

            {receipt.items.map((item, index) => (
              <View key={index} style={styles.row}>
                <Text style={styles.rowText}>{item.name}</Text>
                <Text style={styles.rowTextBold}>{money(item.price)}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            {receipt.tax !== null && (
              <View style={styles.row}>
                <Text style={styles.mutedText}>SST{taxPct !== null ? ` (${taxPct}%)` : ''}</Text>
                <Text style={styles.mutedText}>{money(receipt.tax)}</Text>
              </View>
            )}

            {receipt.serviceCharge !== null && (
              <View style={styles.row}>
                <Text style={styles.mutedText}>
                  Service Charge{servicePct !== null ? ` (${servicePct}%)` : ''}
                </Text>
                <Text style={styles.mutedText}>{money(receipt.serviceCharge)}</Text>
              </View>
            )}

            {receipt.total !== null && (
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalText}>Total</Text>
                <Text style={styles.totalText}>{money(receipt.total)}</Text>
              </View>
            )}
          </View>

          {splitMode === 'equal' && (
            <View style={styles.paxRow}>
              <Text style={styles.paxLabel}>Number of Pax:</Text>
              <Pressable
                style={styles.paxButton}
                onPress={() => setPax((p) => Math.max(1, p - 1))}
                hitSlop={8}
              >
                <Ionicons name="remove" size={16} color={PURPLE} />
              </Pressable>
              <Text style={styles.paxCount}>{pax}</Text>
              <Pressable style={styles.paxButton} onPress={() => setPax((p) => p + 1)} hitSlop={8}>
                <Ionicons name="add" size={16} color={PURPLE} />
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.continueButton} onPress={() => router.back()}>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
  },
  segment: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: PURPLE,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  detectedText: {
    fontSize: 13,
    fontWeight: '700',
    color: GREEN,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowText: {
    fontSize: 15,
    color: '#000',
  },
  rowTextBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  mutedText: {
    fontSize: 14,
    color: MUTED,
  },
  totalRow: {
    marginTop: 4,
  },
  totalText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  paxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  paxLabel: {
    fontSize: 15,
    color: '#000',
    marginRight: 'auto',
  },
  paxButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PILL_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paxCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    minWidth: 16,
    textAlign: 'center',
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
