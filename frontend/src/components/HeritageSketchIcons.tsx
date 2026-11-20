import type { HeritageSketchKey } from '../data/upCities';

interface SketchProps {
  className?: string;
}

export function UpHeritageCrest({ className }: SketchProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 38H40M11 38V23C11 16.5 16.5 11.5 24 7C31.5 11.5 37 16.5 37 23V38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 38V26C17 22 20.2 19.2 24 17C27.8 19.2 31 22 31 26V38"
        stroke="#FF9933"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="24" cy="28" r="4" stroke="#4ADE80" strokeWidth="1.6" />
      <path d="M24 24V32M20 28H28" stroke="#4ADE80" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function HeritageJaliBackdrop({ className }: SketchProps) {
  return (
    <svg viewBox="0 0 240 240" fill="none" className={className} aria-hidden="true">
      <circle cx="120" cy="120" r="108" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" />
      <circle cx="120" cy="120" r="82" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M120 20L148 92L220 120L148 148L120 220L92 148L20 120L92 92Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M52 52L120 82L188 52L158 120L188 188L120 158L52 188L82 120Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="120" cy="120" r="24" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function CityHeritageSketch({ city }: { city: HeritageSketchKey }) {
  switch (city) {
    case 'agra':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M8 52H56" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 52V28M16 52V28M11 28H17L14 23L11 28Z" stroke="currentColor" strokeWidth="1.4" />
          <path d="M48 52V28M52 52V28M47 28H53L50 23L47 28Z" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M21 52V33H43V52M24 33C24 23 28 19 32 14C36 19 40 23 40 33"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M32 14V10M29 52V42C29 39.5 30.5 38 32 37C33.5 38 35 39.5 35 42V52" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M18 56H46" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" strokeLinecap="round" />
        </svg>
      );

    case 'varanasi':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M8 46H56M10 51H54M14 56H50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M20 46V28L27 12L34 28V46M27 12V8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M38 46V32L43 22L48 32V46" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M38 54C42 56 49 56 53 53H37L38 54Z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="48" cy="14" r="4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );

    case 'lucknow':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M8 52H56" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M15 52V28C15 20 22 14 32 12C42 14 49 20 49 28V52"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M23 52V35C23 28 27 25 32 23C37 25 41 28 41 35V52"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path d="M21 15L23 11L25 15M30 12L32 8L34 12M39 15L41 11L43 15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case 'ayodhya':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M10 52H54M14 46H50" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path
            d="M22 46V32L32 12L42 32V46M32 12V7M32 7L39 9.5L32 11.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M16 46V37L20 31L22 36M42 36L44 31L48 37V46" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M14 56C20 54 26 58 32 56C38 54 44 58 50 56" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case 'mathura-vrindavan':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M10 52H54" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path
            d="M19 52V31C19 25 25 19 32 14C39 19 45 25 45 31V52"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path d="M26 52V38C26 34 29 31 32 30C35 31 38 34 38 38V52" stroke="currentColor" strokeWidth="1.6" />
          <path d="M41 18L54 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );

    case 'prayagraj':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M10 38H54M14 38V26H50V38" stroke="currentColor" strokeWidth="1.6" />
          <path d="M22 26V18C22 15 26 13 32 13C38 13 42 15 42 18V26" stroke="currentColor" strokeWidth="1.6" />
          <path d="M32 38V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M10 46C18 43 24 49 32 46C40 43 46 49 54 46M12 53C20 50 26 56 34 53C42 50 48 56 54 53"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'sarnath':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M10 52H54" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M16 52V36C16 24 23 16 32 16C41 16 48 24 48 36V52"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M16 41H48M16 34H48" stroke="currentColor" strokeWidth="1.3" strokeDasharray="4 3" />
          <circle cx="32" cy="25" r="5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M32 20V30M27 25H37" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );

    case 'fatehpur-sikri':
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M8 54H56" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 54V18H48V54" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M24 54V33C24 27 27.5 24 32 22C36.5 24 40 27 40 33V54" stroke="currentColor" strokeWidth="1.7" />
          <path d="M19 18V12H24V18M30 18V10H34V18M40 18V12H45V18" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
  }
}

