export const TONES = ['friendly', 'neutral', 'firm', 'funny'] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  friendly: 'Friendly',
  neutral: 'Neutral',
  firm: 'Firm',
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
    case 'neutral':
      return `Hi ${name}, your share for ${title} is ${amount}. Please send it${payTo} when you can.`;
    case 'firm':
      return `Hi ${name}, following up: your ${amount} for ${title} is still unpaid. Please settle it${payTo} today.`;
    case 'funny':
      return `${name}, my wallet is crying 😭 your ${amount} for ${title} hasn't arrived yet. Please send it${payTo} before I start charging interest 💸`;
  }
}
