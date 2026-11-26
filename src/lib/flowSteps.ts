import { t } from './i18n';
import { getGroupSettlementSetup } from './receiptSession';

export const isGroupFlow = () => (getGroupSettlementSetup()?.members ?? []).length > 0;

export function groupStep(step: 1 | 2 | 3 | 4) {
  return { label: t('Group settlement · Step {n} of 4', { n: step }), fill: `${step * 25}%` as `${number}%` };
}
