import { useState } from 'react';
import { FONT_STEPS, getFontStep, stepFont } from '../services/fontScale';

interface FontSizeControlProps {
  language: string;
}

/** A− / A+ text-size buttons for the top bar. */
export function FontSizeControl({ language }: FontSizeControlProps) {
  const isHi = language.startsWith('hi');
  const [step, setStep] = useState(getFontStep);
  const last = FONT_STEPS.length - 1;
  const percent = Math.round(FONT_STEPS[step] * 100);

  return (
    <div className="font-size-ctl" role="group" aria-label={isHi ? 'अक्षर का आकार' : 'Text size'}>
      <button
        type="button"
        className="font-size-ctl__btn"
        onClick={() => setStep(stepFont(-1))}
        disabled={step === 0}
        aria-label={isHi ? 'अक्षर छोटे करें' : 'Decrease text size'}
        title={isHi ? 'अक्षर छोटे करें' : 'Decrease text size'}
      >
        A<span aria-hidden="true">−</span>
      </button>
      <span className="font-size-ctl__value" aria-live="polite">
        {percent}%
      </span>
      <button
        type="button"
        className="font-size-ctl__btn is-large"
        onClick={() => setStep(stepFont(1))}
        disabled={step === last}
        aria-label={isHi ? 'अक्षर बड़े करें' : 'Increase text size'}
        title={isHi ? 'अक्षर बड़े करें' : 'Increase text size'}
      >
        A<span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
