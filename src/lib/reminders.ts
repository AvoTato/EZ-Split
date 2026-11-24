export const TONES = ['friendly', 'casual', 'neutral', 'firm', 'urgent', 'apologetic', 'funny'] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  friendly: 'Friendly',
  casual: 'Casual',
  neutral: 'Neutral',
  firm: 'Firm',
  urgent: 'Urgent',
  apologetic: 'Apologetic',
  funny: 'Funny',
};

export type ReminderInput = {
  name: string;
  amountLabel: string;
  title?: string;
  payerName?: string;
};

export function buildReminder(tone: Tone, input: ReminderInput) {
  const { name, payerName, amountLabel: amount } = input;
  const title = input.title?.trim() ? input.title.trim() : 'our bill';
  const payTo = payerName ? ` to ${payerName}` : '';

  switch (tone) {
    case 'friendly':
      return `Hi ${name}! 😊 Just a little reminder about your share for ${title}: ${amount}. Could you send it${payTo} when you get a chance? Thank you!`;
    case 'casual':
      return `Hey ${name}, quick one - your ${amount} for ${title} is still open. Send it${payTo} when you can 🙌`;
    case 'urgent':
      return `Hi ${name}, could you settle your ${amount} for ${title}${payTo} today? It's time-sensitive. Thank you!`;
    case 'apologetic':
      return `Hi ${name}, sorry to bug you! Just a gentle nudge about your ${amount} for ${title}. Could you send it${payTo} when you get a chance?`;
    case 'neutral':
      return `Hi ${name}, your share for ${title} is ${amount}. Please send it${payTo} when you can.`;
    case 'firm':
      return `Hi ${name}, following up: your ${amount} for ${title} is still unpaid. Please settle it${payTo} today.`;
    case 'funny':
      return `${name}, my wallet is crying 😭 your ${amount} for ${title} hasn't arrived yet. Please send it${payTo} before I start charging interest 💸`;
  }
}
