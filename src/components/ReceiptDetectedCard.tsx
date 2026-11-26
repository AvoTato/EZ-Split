import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { money, pctOf } from '../lib/format';
import type { ParsedReceipt } from '../lib/parseReceipt';
import { unitPrice } from '../lib/receiptReview';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';


export default function ReceiptDetectedCard({
  receipt,
  onEditPress,
  issueCount = 0,
}: {
  receipt: ParsedReceipt;
  onEditPress?: () => void;
  issueCount?: number;
}) {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, GREEN, AMBER } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const taxPct = pctOf(receipt.tax, receipt.subtotal);
  const servicePct = pctOf(receipt.serviceCharge, receipt.subtotal);
  const hasIssues = Boolean(onEditPress) && issueCount > 0;

  return (
    <View>
      <View style={[styles.banner, hasIssues ? styles.bannerWarn : styles.bannerOk]}>
        <Ionicons
          name={hasIssues ? 'warning-outline' : 'checkmark'}
          size={22}
          color={hasIssues ? AMBER : GREEN}
        />
        <Text style={[styles.bannerText, { color: hasIssues ? AMBER : GREEN }]}>
          {hasIssues
            ? issueCount === 1
              ? t('1 thing doesn’t add up')
              : t('{n} things don’t add up', { n: issueCount })
            : onEditPress
              ? t('Receipt detected · everything adds up')
              : t('Receipt detected')}
        </Text>
      </View>

      {receipt.needsReview && !onEditPress && (
        <Text style={styles.reviewText}>{t('Some amounts may not have been read correctly. Please check the items against your receipt.')}</Text>
      )}

      <View style={styles.card}>
        {receipt.items.map((item, index) => (
          <View key={index} style={[styles.itemRow, index > 0 && styles.itemRowDivided]}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>
                {item.qty} × {unitPrice(item).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.itemPrice}>{money(item.price)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        {receipt.subtotal !== null && (
          <View style={styles.row}>
            <Text style={styles.mutedText}>{t('Subtotal')}</Text>
            <Text style={styles.mutedValue}>{money(receipt.subtotal)}</Text>
          </View>
        )}

        {receipt.discount !== null && (
          <View style={styles.row}>
            <Text style={styles.mutedText}>{t('Discount')}</Text>
            <Text style={styles.mutedValue}>−{money(receipt.discount)}</Text>
          </View>
        )}

        {receipt.serviceCharge !== null && (
          <View style={styles.row}>
            <Text style={styles.mutedText}>
              {t('Service charge')}{servicePct !== null ? ` ${servicePct}%` : ''}
            </Text>
            <Text style={styles.mutedValue}>{money(receipt.serviceCharge)}</Text>
          </View>
        )}

        {receipt.tax !== null && (
          <View style={styles.row}>
            <Text style={styles.mutedText}>{t('SST')}{taxPct !== null ? ` ${taxPct}%` : ''}</Text>
            <Text style={styles.mutedValue}>{money(receipt.tax)}</Text>
          </View>
        )}

        {receipt.total !== null && (
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalText}>{t('Total')}</Text>
            <Text style={styles.totalText}>{money(receipt.total)}</Text>
          </View>
        )}
      </View>

      {onEditPress && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.fixButton, pressed && styles.pressed]}
          onPress={onEditPress}
        >
          <Ionicons name="sparkles-outline" size={22} color={PURPLE_DARK} />
          <Text style={styles.fixText}>{t('Something missing? Tell us what to fix')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE, INK, MUTED, BORDER, SURFACE, GREEN_TINT, AMBER_TINT, AMBER  }: Colors) =>
  StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  bannerOk: {
    backgroundColor: GREEN_TINT,
  },
  bannerWarn: {
    backgroundColor: AMBER_TINT,
  },
  bannerText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  reviewText: {
    color: AMBER,
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  itemRowDivided: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  itemCopy: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.3,
  },
  itemQty: {
    fontSize: 15,
    color: MUTED,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 19,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  mutedText: {
    fontSize: 18,
    color: MUTED,
  },
  mutedValue: {
    fontSize: 17,
    fontWeight: '600',
    color: MUTED,
  },
  totalRow: {
    marginTop: 2,
    paddingBottom: 6,
  },
  totalText: {
    fontSize: 22,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
  },
  fixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PURPLE,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  fixText: {
    fontSize: 17,
    fontWeight: '800',
    color: PURPLE_DARK,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});
