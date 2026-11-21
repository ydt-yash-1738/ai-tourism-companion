import { useEffect, useMemo, useState } from 'react';
import { Hospital, PhoneCall, ShieldAlert, X } from 'lucide-react';
import { getDestinationConfig } from '../data/destinationMedia';
import { getUiText } from '../data/i18n';
import { getEmergency } from '../services/api';
import { haversineMeters } from '../services/offlineStore';
import type { EmergencyResponse, Facility, HelplineItem, OfflinePack } from '../types/api';
import { FallbackNoticeBanner } from './ApiStateCard';

interface EmergencyModalProps {
  destinationSlug: string;
  open: boolean;
  onClose: () => void;
  language: string;
  userCoords: { lat: number; lng: number } | null;
  offlinePack: OfflinePack | null;
}

export function EmergencyModal({
  destinationSlug,
  open,
  onClose,
  language,
  userCoords,
  offlinePack,
}: EmergencyModalProps) {
  const ui = getUiText(language);
  const isHi = language.startsWith('hi');
  const destConfig = getDestinationConfig(destinationSlug);
  const [liveData, setLiveData] = useState<EmergencyResponse | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const offlineFallback = useMemo<EmergencyResponse>(() => {
    const refLat = userCoords?.lat ?? destConfig.center[0];
    const refLng = userCoords?.lng ?? destConfig.center[1];
    const facilities = offlinePack?.facilities || [];
    const nearestByType = (ftype: string): Facility | null => {
      const list = facilities
        .filter((f) => f.facility_type === ftype)
        .map((f) => ({
          ...f,
          distance_meters: haversineMeters(refLat, refLng, f.lat, f.lng),
        }))
        .sort((a, b) => (a.distance_meters ?? 999999) - (b.distance_meters ?? 999999));
      return list[0] || null;
    };
    return {
      destination_slug: destinationSlug,
      nearest_hospital: nearestByType('medical'),
      nearest_police: nearestByType('police'),
      helplines: offlinePack?.destination.emergency_helplines.length
        ? offlinePack.destination.emergency_helplines
        : destConfig.defaultHelplines,
    };
  }, [destinationSlug, destConfig, userCoords, offlinePack]);

  const reqKey =
    open && typeof navigator !== 'undefined' && navigator.onLine
      ? `${destinationSlug}|${userCoords?.lat ?? 'x'}|${userCoords?.lng ?? 'x'}|${retryCount}`
      : null;
  const loading = Boolean(reqKey && settledKey !== reqKey);

  useEffect(() => {
    if (!reqKey) return;
    let active = true;
    getEmergency(destinationSlug, userCoords?.lat, userCoords?.lng)
      .then((res) => {
        if (!active) return;
        setLiveData(res);
        setApiError(null);
        setSettledKey(reqKey);
      })
      .catch((err) => {
        if (!active) return;
        setApiError(err instanceof Error ? err.message : 'Unable to reach emergency API.');
        setSettledKey(reqKey);
      });
    return () => {
      active = false;
    };
  }, [reqKey, destinationSlug, userCoords]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const data = liveData && liveData.destination_slug === destinationSlug ? liveData : offlineFallback;
  const helplines: HelplineItem[] =
    data.helplines && data.helplines.length > 0 ? data.helplines : destConfig.defaultHelplines;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="sos-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sos-modal__header">
          <h2 id="sos-title">
            <ShieldAlert size={22} />
            <span>{ui.sosTitle}</span>
          </h2>
          <button type="button" className="pill-btn" onClick={onClose} aria-label="Close SOS modal">
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '10px 0 10px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          {ui.sosSub}
        </p>

        {loading && <FallbackNoticeBanner message={ui.loadingEmergency} variant="info" loading />}

        {!loading && apiError && (
          <FallbackNoticeBanner
            message={ui.offlineFallbackNotice}
            retryLabel={ui.retry}
            onRetry={() => setRetryCount((n) => n + 1)}
            variant="warning"
          />
        )}

        <div className="sos-modal__nearest-grid">
          {data.nearest_hospital && (
            <div className="sos-modal__spot">
              <strong>
                <Hospital size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                {isHi && data.nearest_hospital.name_hi
                  ? data.nearest_hospital.name_hi
                  : data.nearest_hospital.name}
              </strong>
              <span>
                {data.nearest_hospital.address}
                {data.nearest_hospital.distance_meters != null &&
                  ` · ~${data.nearest_hospital.distance_meters} m`}
              </span>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${data.nearest_hospital.lat},${data.nearest_hospital.lng}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.82rem', fontWeight: 700 }}
              >
                {ui.hospitalDirections}
              </a>
            </div>
          )}

          {data.nearest_police && (
            <div className="sos-modal__spot">
              <strong>
                {isHi && data.nearest_police.name_hi
                  ? data.nearest_police.name_hi
                  : data.nearest_police.name}
              </strong>
              <span>
                {data.nearest_police.address}
                {data.nearest_police.distance_meters != null &&
                  ` · ~${data.nearest_police.distance_meters} m`}
              </span>
            </div>
          )}
        </div>

        <div className="sos-modal__helplines">
          {helplines.map((item) => (
            <a
              key={`${item.number}-${item.label}`}
              href={`tel:${item.number.replace(/\s+/g, '')}`}
              className="sos-modal__call-btn"
            >
              <span>
                <PhoneCall size={14} style={{ marginRight: 7, verticalAlign: 'text-bottom' }} />
                {isHi && item.label_hi ? item.label_hi : item.label}
              </span>
              <span className="num">{item.number}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
