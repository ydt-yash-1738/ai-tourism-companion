import { Flower2, Landmark, Smile, Zap, type LucideIcon } from 'lucide-react';
import type { PersonaType } from '../types/api';

/** The four ways Raahi can tell a place: one definition used by every style picker. */
export interface AnswerStyle {
  id: PersonaType;
  icon: LucideIcon;
  hintEn: string;
  hintHi: string;
}

export const ANSWER_STYLES: AnswerStyle[] = [
  { id: 'quick', icon: Zap, hintEn: 'Short, crisp facts.', hintHi: 'छोटे, सटीक तथ्य।' },
  { id: 'kids', icon: Smile, hintEn: 'Told as a simple story for children.', hintHi: 'बच्चों के लिए सरल कहानी के रूप में।' },
  {
    id: 'scholar',
    icon: Landmark,
    hintEn: 'In depth: history, architecture and sources.',
    hintHi: 'विस्तार से: इतिहास, स्थापत्य और स्रोत।',
  },
  {
    id: 'pilgrim',
    icon: Flower2,
    hintEn: 'With the spiritual meaning and etiquette of the place.',
    hintHi: 'स्थान के आध्यात्मिक महत्व और मर्यादा के साथ।',
  },
];

export function answerStyleHint(id: PersonaType, isHi: boolean): string {
  const style = ANSWER_STYLES.find((s) => s.id === id) ?? ANSWER_STYLES[0];
  return isHi ? style.hintHi : style.hintEn;
}
