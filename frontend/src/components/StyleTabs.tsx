import { ANSWER_STYLES, answerStyleHint } from '../data/answerStyles';
import { getUiText } from '../data/i18n';
import type { PersonaType } from '../types/api';

interface StyleTabsProps {
  value: PersonaType;
  onChange: (style: PersonaType) => void;
  language: string;
  /** 'light' on cards, 'dark' on the video tour */
  tone?: 'light' | 'dark';
}

/**
 * "Raahi tells it as": four labelled style pills with icons, shown right above
 * the narration they change, plus a line saying what the chosen style does.
 */
export function StyleTabs({ value, onChange, language, tone = 'light' }: StyleTabsProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const label = isHi ? 'राही किस अंदाज़ में सुनाए' : 'Raahi tells it as';

  return (
    <div className={`style-tabs is-${tone}`}>
      <span className="style-tabs__label" id="style-tabs-label">
        {label}
      </span>
      <div className="style-tabs__row" role="radiogroup" aria-labelledby="style-tabs-label">
        {ANSWER_STYLES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={`style-tabs__pill ${value === id ? 'is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{ui.personas[id]}</span>
          </button>
        ))}
      </div>
      <p className="style-tabs__hint" role="status">
        {answerStyleHint(value, isHi)}
      </p>
    </div>
  );
}
