import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  Car,
  Clock,
  CupSoda,
  Droplets,
  Info,
  Loader2,
  MapPin,
  Navigation,
  PhoneCall,
  ShieldCheck,
  Stethoscope,
  Toilet,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { FACILITY_PHOTOS, getDestinationConfig } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { getFacilities } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import { translateBatchCached } from '../services/translateCache';
import type { Facility, OfflinePack } from '../types/api';
import {
  EmptyStateCard,
  ErrorStateCard,
  FallbackNoticeBanner,
  LoadingStateCard,
  SkeletonCards,
} from './ApiStateCard';
import { LeafletMap, type MapPinItem } from './LeafletMap';

// Every facility shows a clear type icon. Where a verified photo of its location
// exists, the photo sits behind the icon with a caption naming the area it shows.
const FACILITY_ICONS: Record<string, LucideIcon> = {
  toilet: Toilet,
  drinking_water: Droplets,
  medical: Stethoscope,
  police: ShieldCheck,
  parking: Car,
  food: UtensilsCrossed,
  help_desk: Info,
  cafe: CupSoda,
};

interface FacilitiesTabProps {
  destinationSlug: string;
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
  destinationSlug,
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
  const destConfig = getDestinationConfig(destinationSlug);

  const [facilityType, setFacilityType] = useState<string>('');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [liveFacilities, setLiveFacilities] = useState<Facility[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translationSettledKey, setTranslationSettledKey] = useState<string | null>(null);

  const refLat = userCoords?.lat ?? destConfig.center[0];
  const refLng = userCoords?.lng ?? destConfig.center[1];

  const offlineFacilities = useMemo(() => {
    return (offlinePack?.facilities || [])
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
  }, [offlinePack, facilityType, accessibleOnly, refLat, refLng]);

  const reqKey = isOnline
    ? `${destinationSlug}|${facilityType}|${accessibleOnly}|${refLat}|${refLng}|${retryCount}`
    : null;
  const loading = Boolean(reqKey && settledKey !== reqKey);

  useEffect(() => {
    if (!reqKey) return;
    let active = true;
    getFacilities(destinationSlug, {
      facilityType: facilityType || undefined,
      accessibleOnly,
      lat: refLat,
      lng: refLng,
      sessionHash,
    })
      .then((res) => {
        if (!active) return;
        setLiveFacilities(res);
        setApiError(null);
        setSettledKey(reqKey);
      })
      .catch((err) => {
        if (!active) return;
        setApiError(err instanceof Error ? err.message : ui.serverErrorDesc);
        setSettledKey(reqKey);
      });
    return () => {
      active = false;
    };
  }, [reqKey, destinationSlug, facilityType, accessibleOnly, refLat, refLng, sessionHash, ui.serverErrorDesc]);

  const facilities = isOnline && !apiError ? liveFacilities : offlineFacilities;

  const translationReqKey = useMemo(() => {
    if (!needsDynamicTranslate || facilities.length === 0) return null;
    return `${baseLang}|${facilities.map((f) => f.slug).join(',')}`;
  }, [needsDynamicTranslate, baseLang, facilities]);

  const translating = Boolean(
    translationReqKey && translationSettledKey !== translationReqKey,
  );

  useEffect(() => {
    if (!translationReqKey) return;
    let active = true;
    const raw = facilities.flatMap((f) => [f.name, f.notes]);
    const unique = Array.from(new Set(raw.filter(Boolean))).slice(0, 30);
    if (!unique.length) return;

    translateBatchCached(unique, baseLang)
      .then((res) => {
        if (!active) return;
        const next: Record<string, string> = {};
        unique.forEach((orig, idx) => {
          next[`${baseLang}::${orig}`] = res[idx] || orig;
        });
        setTranslatedMap((prev) => ({ ...prev, ...next }));
        setTranslationSettledKey(translationReqKey);
      })
      .catch(() => {
        if (active) setTranslationSettledKey(translationReqKey);
      });
    return () => {
      active = false;
    };
  }, [translationReqKey, baseLang, facilities]);

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

  const hasActiveFilters = Boolean(facilityType || accessibleOnly);

  const resetFilters = () => {
    setFacilityType('');
    setAccessibleOnly(false);
  };

  return (
    <div className="tab-panel">
      <div className="section-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'calc(1.35rem * var(--text-scale))', color: 'var(--navy-deep)' }}>
              {ui.facilitiesHeading}
            </h2>
            <p style={{ margin: '4px 0 12px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              {ui.facilitiesSub}
            </p>
          </div>
          {translating && (
            <span className="translating-pill" role="status">
              <Loader2 size={13} className="spin-icon" />
              <span>{ui.translating}</span>
            </span>
          )}
        </div>

        <div className="mobile-only-controls mobile-filter-row">
          <select
            className="lang-select"
            style={{ flex: '1 1 140px' }}
            value={facilityType}
            onChange={(e) => setFacilityType(e.target.value)}
            aria-label="Filter by facility type"
          >
            {FACILITY_TYPE_KEYS.map((key) => (
              <option key={key || 'all'} value={key}>
                {ui.facilityTypes[key] || key}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`pill-btn ${accessibleOnly ? 'is-emerald' : ''}`}
            onClick={() => setAccessibleOnly((v) => !v)}
          >
            <Accessibility size={15} />
            <span>{ui.wheelchairAccessible}</span>
          </button>
        </div>

        <div className="filter-row desktop-only-controls" style={{ marginBottom: 0 }}>
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

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <LoadingStateCard message={ui.loadingFacilities} compact />
          <div className="skeleton-map" aria-hidden="true" />
          <SkeletonCards count={4} variant="card" />
        </div>
      ) : apiError && offlineFacilities.length === 0 ? (
        <ErrorStateCard
          title={ui.serverErrorTitle}
          message={ui.serverErrorDesc}
          detail={apiError}
          retryLabel={ui.retry}
          onRetry={() => setRetryCount((n) => n + 1)}
        />
      ) : (
        <>
          {apiError && offlineFacilities.length > 0 && (
            <FallbackNoticeBanner
              message={ui.offlineFallbackNotice}
              retryLabel={ui.retry}
              onRetry={() => setRetryCount((n) => n + 1)}
              variant="warning"
            />
          )}

          {facilities.length === 0 ? (
            <EmptyStateCard
              message={hasActiveFilters ? ui.noFacilitiesMatched : ui.facilitiesPending}
              actionLabel={hasActiveFilters ? ui.resetFilters : undefined}
              onAction={hasActiveFilters ? resetFilters : undefined}
            />
          ) : (
            <>
              <LeafletMap center={destConfig.facilitiesCenter} pins={mapPins} userCoords={userCoords} />

              <div className="cards-grid">
                {facilities.map((item) => {
                  const Icon = FACILITY_ICONS[item.facility_type] ?? MapPin;
                  const photo = FACILITY_PHOTOS[item.slug];

                  return (
                    <article key={item.slug} className="info-card has-media">
                      <div className={`info-card__media facility-art is-${item.facility_type} ${photo ? 'has-photo' : ''}`}>
                        {photo ? (
                          <>
                            <img
                              className="facility-art__photo"
                              src={`${import.meta.env.BASE_URL}${photo.image.replace(/^\//, '')}`}
                              alt={language.startsWith('hi') ? photo.captionHi : photo.captionEn}
                              style={{ objectPosition: photo.position }}
                              loading="lazy"
                            />
                            <span className="facility-art__badge" aria-hidden="true">
                              <Icon size={22} />
                            </span>
                            <span className="facility-art__caption">
                              {language.startsWith('hi') ? 'फ़ोटो: ' : 'Photo: '}
                              {language.startsWith('hi') ? photo.captionHi : photo.captionEn}
                            </span>
                          </>
                        ) : (
                          <Icon className="facility-art__icon" size={46} aria-hidden="true" />
                        )}
                        <div className="info-card__media-scrim" aria-hidden="true" />
                        <div className="info-card__media-top">
                          <div className="info-card__media-badges">
                            <span className="info-card__tag is-saffron">
                              {(ui.facilityTypes[item.facility_type] || item.facility_type).toUpperCase()}
                            </span>
                            {item.is_accessible && (
                              <span className="info-card__tag is-odop">
                                <Accessibility size={12} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                                {ui.wheelchairAccessible}
                              </span>
                            )}
                            {item.is_emergency && (
                              <span className="info-card__tag is-emergency">Emergency</span>
                            )}
                          </div>
                          {item.distance_meters != null && (
                            <span className="info-card__tag is-glass">{item.distance_meters} m</span>
                          )}
                        </div>
                      </div>

                      <div className="info-card__body">
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
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
