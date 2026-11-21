import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { haversineMeters } from '../services/offlineStore';

export interface MapPinItem {
  id: string;
  label: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  variant?: 'default' | 'active' | 'accessible' | 'emergency';
}

interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  pins: MapPinItem[];
  polyline?: Array<[number, number]>;
  userCoords?: { lat: number; lng: number } | null;
  onSelectPin?: (id: string) => void;
}

export function LeafletMap({
  center,
  zoom = 15,
  pins,
  polyline,
  userCoords,
  onSelectPin,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, { zoomControl: true }).setView(center, zoom);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Initialize map instance once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);
    const boundsPoints: Array<[number, number]> = [];

    if (polyline && polyline.length >= 2) {
      L.polyline(polyline, {
        color: '#e86f1f',
        weight: 4,
        dashArray: '8 6',
        opacity: 0.9,
      }).addTo(layerGroup);
    }

    for (const pin of pins) {
      const variantClass =
        pin.variant === 'active'
          ? 'is-active'
          : pin.variant === 'accessible'
            ? 'is-accessible'
            : pin.variant === 'emergency'
              ? 'is-emergency'
              : '';

      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div class="custom-pin__badge ${variantClass}">${pin.label}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(layerGroup);
      const subtitleHtml = pin.subtitle ? `<br/><small>${pin.subtitle}</small>` : '';
      marker.bindPopup(`<strong>${pin.title}</strong>${subtitleHtml}`);
      if (onSelectPin) {
        marker.on('click', () => onSelectPin(pin.id));
      }
      boundsPoints.push([pin.lat, pin.lng]);
    }

    if (userCoords) {
      L.circleMarker([userCoords.lat, userCoords.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: '#12346b',
        fillOpacity: 1,
      })
        .bindPopup('<strong>Your Current Location</strong>')
        .addTo(layerGroup);
      if (haversineMeters(userCoords.lat, userCoords.lng, center[0], center[1]) <= 15_000) {
        boundsPoints.push([userCoords.lat, userCoords.lng]);
      }
    }

    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints, { padding: [32, 32], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], zoom);
    } else {
      map.setView(center, zoom);
    }

    return () => {
      layerGroup.remove();
    };
  }, [center, zoom, pins, polyline, userCoords, onSelectPin]);

  return <div ref={containerRef} className="map-frame" aria-label="Interactive Heritage Map" />;
}

