import { useEffect, useState } from 'react';
import { Award, Clock, IndianRupee, MapPin, Navigation, Volume2 } from 'lucide-react';
import { getUiText } from '../data/i18n';
import { getNearbyPlaces } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import { speakText } from '../services/speech';
import { translateBatchCached } from '../services/translateCache';
import type { NearbyPlace, OfflinePack } from '../types/api';

interface NearbyTabProps {
  language: string;
  isOnline: boolean;
  userCoords: { lat: number; lng: number } | null;
  offlinePack: OfflinePack | null;
}

const INTEREST_KEYS: Array<'heritage' | 'crafts' | 'food' | 'shopping'> = [
  'heritage',
  'crafts',
  'food',
  'shopping',
];

const GROUP_KEYS = ['', 'family', 'kids', 'elderly', 'solo'];

export function NearbyTab({ language, isOnline, userCoords, offlinePack }: NearbyTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];
  const needsDynamicTranslate = baseLang !== 'en' && baseLang !== 'hi';

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [group, setGroup] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [odopOnly, setOdopOnly] = useState(false);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    const interestsParam = selectedInterests.length ? selectedInterests.join(',') : undefined;
    const filterLocally = () => {
      const list = (offlinePack?.nearby_places || [])
        .filter((p) => {
          if (odopOnly && !p.is_odop) return false;
          if (group && !p.suitable_for.includes(group)) return false;
          if (budget === 'free' && p.budget_tier !== 'free') return false;
          if (budget === 'low' && !['free', 'low'].includes(p.budget_tier)) return false;
          if (
            selectedInterests.length &&
            !selectedInterests.some((i) => p.interests.includes(i) || p.category === i)
          ) {
            return false;
          }
          return true;
        })
        .map((p) => ({
          ...p,
          distance_meters: userCoords
            ? haversineMeters(userCoords.lat, userCoords.lng, p.lat, p.lng)
            : null,
        }));
      setPlaces(list);
    };

    if (!isOnline) {
      filterLocally();
      return;
    }

    getNearbyPlaces('agra', {
      interests: interestsParam,
      budget: budget || undefined,
      group: group || undefined,
      odopOnly,
      lat: userCoords?.lat,
      lng: userCoords?.lng,
    })
      .then((res) => setPlaces(res))
      .catch(() => filterLocally());
  }, [selectedInterests, group, budget, odopOnly, isOnline, userCoords, offlinePack]);

  useEffect(() => {
    if (!needsDynamicTranslate || places.length === 0) return;

    let active = true;
    const raw = places.flatMap((p) => [p.name, p.description, p.how_to_reach]);
    const unique = Array.from(new Set(raw.filter(Boolean))).slice(0, 30);
    if (!unique.length) return;

    translateBatchCached(unique, baseLang).then((res) => {
      if (!active) return;
      const next: Record<string, string> = {};
      unique.forEach((orig, idx) => {
        next[`${baseLang}::${orig}`] = res[idx] || orig;
      });
      setTranslatedMap((prev) => ({ ...prev, ...next }));
    });
    return () => {
      active = false;
    };
  }, [needsDynamicTranslate, baseLang, places]);

  const tr = (enText: string, hiText = ''): string => {
    if (isHi && hiText) return hiText;
    if (needsDynamicTranslate) {
      return translatedMap[`${baseLang}::${enText}`] || enText;
    }
    return enText;
  };

  return (
    <div className="tab-panel">
      <div className="section-card">
        <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
          {ui.nearbyHeading}
        </h2>
        <p style={{ margin: '4px 0 12px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
          {ui.nearbySub}
        </p>

        <div className="filter-row">
          {INTEREST_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`pill-btn ${selectedInterests.includes(key) ? 'is-active' : ''}`}
              onClick={() => toggleInterest(key)}
            >
              {ui.interests[key]}
            </button>
          ))}

          <button
            type="button"
            className={`pill-btn ${odopOnly ? 'is-emerald' : ''}`}
            onClick={() => setOdopOnly((v) => !v)}
          >
            <Award size={15} />
            <span>{ui.odopOnly}</span>
          </button>
        </div>

        <div className="filter-row" style={{ marginBottom: 0 }}>
          <select
            className="lang-select"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-label="Who are you travelling with"
          >
            {GROUP_KEYS.map((key) => (
              <option key={key || 'all'} value={key}>
                {ui.groups[key] || key}
              </option>
            ))}
          </select>

          <select
            className="lang-select"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            aria-label="Budget preference"
          >
            <option value="">{ui.budgetAny}</option>
            <option value="free">{ui.budgetFree}</option>
            <option value="low">{ui.budgetLow}</option>
            <option value="medium">{ui.budgetMed}</option>
          </select>
        </div>
      </div>

      <div className="cards-grid">
        {places.map((place) => {
          const title = tr(place.name, place.name_hi);
          const desc = tr(place.description, place.description_hi);
          const reach = tr(place.how_to_reach);
          return (
            <article key={place.slug} className="info-card">
              <div className="info-card__badges">
                <span className="info-card__tag is-saffron">{place.category.toUpperCase()}</span>
                {place.is_odop && (
                  <span className="info-card__tag is-odop">
                    <Award size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                    {place.odop_product || 'UP ODOP Craft'}
                  </span>
                )}
                {place.distance_meters != null && (
                  <span className="info-card__tag">{(place.distance_meters / 1000).toFixed(1)} km</span>
                )}
              </div>

              <h3 style={{ fontSize: 'calc(1.24rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
                {title}
              </h3>

              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                {desc}
              </p>

              <div className="info-card__meta-list">
                <span>
                  <Clock size={13} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                  <strong>{ui.timingsLabel}</strong> {place.timings} (~{place.estimated_time_min}{' '}
                  min)
                </span>
                <span>
                  <IndianRupee size={13} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                  <strong>{ui.feeLabel}</strong> {place.entry_fee_inr}
                </span>
                <span>
                  <MapPin size={13} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                  <strong>{ui.reachLabel}</strong> {reach}
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--navy)' }}>
                  {ui.sourceLabel}
                  {place.official_source}
                </span>
              </div>

              <div className="info-card__actions">
                <button
                  type="button"
                  className="pill-btn"
                  style={{ minHeight: 38, padding: '6px 12px', fontSize: '0.82rem' }}
                  onClick={() =>
                    speakText(`${title}. ${desc}`, language, undefined, {
                      autoTranslate: needsDynamicTranslate && title === place.name,
                    })
                  }
                >
                  <Volume2 size={14} />
                  <span>{ui.readAloud}</span>
                </button>

                <a
                  className="pill-btn is-active"
                  style={{
                    minHeight: 38,
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    textDecoration: 'none',
                  }}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={14} />
                  <span>{ui.directions}</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
