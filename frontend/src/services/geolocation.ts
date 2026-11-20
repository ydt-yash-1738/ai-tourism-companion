export interface GeoCoords {
  lat: number;
  lng: number;
}

export type GeoStatus = 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export interface GeoResult {
  coords: GeoCoords | null;
  status: GeoStatus;
  accuracyMeters?: number;
}

function getPosPromise(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function mapGeoError(err: unknown): GeoStatus {
  const code = (err as { code?: number } | null)?.code;
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

export async function isGeolocationAlreadyGranted(): Promise<boolean> {
  try {
    if (!('permissions' in navigator) || !navigator.permissions?.query) return false;
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

export async function requestBrowserLocation(): Promise<GeoResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { coords: null, status: 'unsupported' };
  }

  try {
    const pos = await getPosPromise({
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 60_000,
    });
    return {
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      status: 'granted',
      accuracyMeters: Math.round(pos.coords.accuracy),
    };
  } catch (err) {
    const firstStatus = mapGeoError(err);
    if (firstStatus === 'denied') {
      return { coords: null, status: 'denied' };
    }

    // Retry with low-accuracy network/Wi-Fi positioning (vital on Windows laptops & indoors)
    try {
      const fallbackPos = await getPosPromise({
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 300_000,
      });
      return {
        coords: { lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude },
        status: 'granted',
        accuracyMeters: Math.round(fallbackPos.coords.accuracy),
      };
    } catch (fallbackErr) {
      return { coords: null, status: mapGeoError(fallbackErr) };
    }
  }
}

