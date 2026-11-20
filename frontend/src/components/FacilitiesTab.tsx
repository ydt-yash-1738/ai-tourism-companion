import { useEffect, useState } from 'react';
import { Accessibility, Clock, Navigation, PhoneCall } from 'lucide-react';
import { getUiText } from '../data/i18n';
import { getFacilities } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import { translateBatchCached } from '../services/translateCache';
import type { Facility, OfflinePack } from '../types/api';
import { LeafletMap, type MapPinItem } from './LeafletMap';

interface FacilitiesTabProps {
  language: string;
  isOnline: boolean;
  sessionHash: string;
  userCoords: { lat: number; lng: number } | null;
  offlinePack: OfflinePack | null;
}

const FACILITY_TYPE_KEYS = [
  '',
  'toilet',
  'drinking_water',
  'parking',
  'medical',
  'police',
  'help_desk',
  'food',
];

export function FacilitiesTab({
  language,
  isOnline,
  sessionHash,
  userCoords,
  offlinePack,
}: FacilitiesTabProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const baseLang = language.toLowerCase().split('-')[0];
  const needsDynamicTranslate = baseLang !== 'en' && baseLang !== 'hi';

  const [facilityType, setFacilityType] = useState<string>('');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const refLat = userCoords?.lat ?? 27.1751;
    const refLng = userCoords?.lng ?? 78.0421;

    const filterLocally = () => {
      const list = (offlinePack?.facilities || [])
        .filter((f) => {
          if (facilityType && f.facility_type !== facilityType) return false;
          if (accessibleOnly && !f.is_accessible) return false;
          return true;
        })
        .map((f) => ({
          ...f,
          distance_meters: haversineMeters(refLat, refLng, f.lat, f.lng),
        }))
        .sort((a, b) => (a.distance_meters ?? 999999) - (b.distance_meters ?? 999999));
      setFacilities(list);
    };

    if (!isOnline) {
      filterLocally();
      return;
    }

    getFacilities('agra', {
      facilityType: facilityType || undefined,
      accessibleOnly,
      lat: refLat,
      lng: refLng,
      sessionHash,
    })
      .then((res) => setFacilities(res))
      .catch(() => filterLocally());
  }, [facilityType, accessibleOnly, isOnline, userCoords, sessionHash, offlinePack]);

  useEffect(() => {
    if (!needsDynamicTranslate || facilities.length === 0) return;
    let active = true;
    const raw = facilities.flatMap((f) => [f.name, f.notes]);
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
  }, [needsDynamicTranslate, baseLang, facilities]);

  const tr = (enText: string, hiText = ''): string => {
    if (isHi && hiText) return hiText;
    if (needsDynamicTranslate) {
      return translatedMap[`${baseLang}::${enText}`] || enText;
    }
    return enText;
  };

  const mapPins: MapPinItem[] = facilities.map((f) => ({
    id: f.slug,
    label: f.facility_type.slice(0, 1).toUpperCase(),
    title: tr(f.name, f.name_hi),
    subtitle: `${f.timings}${f.distance_meters != null ? ` · ${f.distance_meters} m` : ''}`,
    lat: f.lat,
    lng: f.lng,
    variant: f.is_emergency ? 'emergency' : f.is_accessible ? 'accessible' : 'default',
  }));

  return (
    <div className="tab-panel">
      <div className="section-card">
        <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
          {ui.facilitiesHeading}
        </h2>
        <p style={{ margin: '4px 0 12px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
          {ui.facilitiesSub}
        </p>

        <div className="filter-row" style={{ marginBottom: 0 }}>
          {FACILITY_TYPE_KEYS.map((key) => (
            <button
              key={key || 'all'}
              type="button"
              className={`pill-btn ${facilityType === key ? 'is-active' : ''}`}
              onClick={() => setFacilityType(key)}
            >
              {ui.facilityTypes[key] || key}
            </button>
          ))}

          <button
            type="button"
            className={`pill-btn ${accessibleOnly ? 'is-emerald' : ''}`}
            onClick={() => setAccessibleOnly((v) => !v)}
          >
            <Accessibility size={15} />
            <span>{ui.wheelchairAccessible}</span>
          </button>
        </div>
      </div>

      <LeafletMap center={[27.1735, 78.0421]} pins={mapPins} userCoords={userCoords} />

      <div className="cards-grid">
        {facilities.map((item) => (
          <article key={item.slug} className="info-card">
            <div className="info-card__badges">
              <span className="info-card__tag is-saffron">
                {(ui.facilityTypes[item.facility_type] || item.facility_type).toUpperCase()}
              </span>
              {item.is_accessible && (
                <span className="info-card__tag is-odop">
                  <Accessibility size={12} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                  {ui.wheelchairAccessible}
                </span>
              )}
              {item.is_emergency && <span className="info-card__tag is-emergency">Emergency</span>}
              {item.distance_meters != null && (
                <span className="info-card__tag">{item.distance_meters} m</span>
              )}
            </div>

            <h3 style={{ fontSize: 'calc(1.2rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
              {tr(item.name, item.name_hi)}
            </h3>

            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {tr(item.notes, item.notes_hi)}
            </p>

            <div className="info-card__meta-list">
              <span>
                <Clock size={13} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                {item.timings}
              </span>
              <span>{item.address}</span>
            </div>

            <div className="info-card__actions">
              {item.phone && (
                <a
                  className="pill-btn is-saffron"
                  style={{
                    minHeight: 38,
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    textDecoration: 'none',
                  }}
                  href={`tel:${item.phone.replace(/\s+/g, '')}`}
                >
                  <PhoneCall size={14} />
                  <span>{item.phone}</span>
                </a>
              )}
              <a
                className="pill-btn is-active"
                style={{
                  minHeight: 38,
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                }}
                href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation size={14} />
                <span>{ui.directions}</span>
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
