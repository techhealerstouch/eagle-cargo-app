import React, { useEffect, useState } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import Map from './Map';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';

export interface MapMarkerData {
    id: string | number;
    lat: number;
    lng: number;
    title: string;
    subtitle?: string;
    status: 'pending' | 'completed' | 'in_progress' | 'cancelled';
    reference_number?: string;
}

interface RunsheetMapProps {
    markers: MapMarkerData[];
    className?: string;
}

// Custom icons based on status
const createCustomIcon = (color: string, isProgress = false) => {
    const radarPulse = isProgress
        ? `<div style="
            position: absolute;
            width: 28px;
            height: 28px;
            top: -2px;
            left: -2px;
            border-radius: 50%;
            border: 2.5px solid ${color};
            animation: marker-radar 1.8s infinite ease-out;
            z-index: 1;
          "></div>`
        : '';

    return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
            <div style="position: relative; width: 24px; height: 28px; display: flex; justify-content: center; align-items: center;">
                <style>
                    @keyframes marker-radar {
                        0% { transform: scale(0.6); opacity: 0.8; }
                        100% { transform: scale(1.8); opacity: 0; }
                    }
                </style>
                ${radarPulse}
                <div style="position: relative; z-index: 10; color: ${color}; width: 24px; height: 28px;">
                    <svg viewBox="0 0 36 44" style="width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));">
                        <path fill="currentColor" stroke="#ffffff" stroke-width="2.5" d="M18,0 C8,0 0,8 0,18 C0,31 18,44 18,44 C18,44 36,31 36,18 C36,8 28,0 18,0 Z" />
                        <circle fill="#ffffff" cx="18" cy="18" r="8" />
                    </svg>
                </div>
            </div>
        `,
        iconSize: [24, 28],
        iconAnchor: [12, 28],
        popupAnchor: [0, -28],
    });
};

const icons = {
    pending: createCustomIcon('#eab308', false), // amber-500
    in_progress: createCustomIcon('#3b82f6', true), // blue-500
    completed: createCustomIcon('#10b981', false), // emerald-500
    cancelled: createCustomIcon('#ef4444', false), // red-500
};

function MapBoundsFitter({ markers }: { markers: MapMarkerData[] }) {
    const map = useMap();

    useEffect(() => {
        if (markers.length === 0) return;

        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
        
        // Pad the bounds so markers aren't right on the edge
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }, [markers, map]);

    return null;
}

export default function RunsheetMap({ markers, className = 'w-full h-80 rounded-2xl border border-brand-warm/50 shadow-sm overflow-hidden' }: RunsheetMapProps) {
    const validMarkers = markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));

    if (validMarkers.length === 0) {
        return (
            <div className={`flex items-center justify-center bg-brand-warm/20 ${className}`}>
                <div className="text-center text-brand-text-mid p-6">
                    <MapPin className="size-8 mx-auto mb-2 text-brand-sand" />
                    <p className="text-sm font-medium">No valid coordinates available</p>
                    <p className="text-xs text-brand-text-light">Locations will appear here once addresses are pinned.</p>
                </div>
            </div>
        );
    }

    return (
        <Map center={[validMarkers[0].lat, validMarkers[0].lng]} zoom={12} className={className}>
            <MapBoundsFitter markers={validMarkers} />
            
            {validMarkers.map((marker) => (
                <Marker 
                    key={marker.id} 
                    position={[marker.lat, marker.lng]}
                    icon={icons[marker.status] || icons.pending}
                >
                    <Popup className="rounded-lg shadow-xl border-0">
                        <div className="min-w-45">
                            <h3 className="font-bold text-gray-900 text-base mb-1">{marker.title}</h3>
                            {marker.subtitle && (
                                <p className="text-sm text-gray-600 leading-tight mb-2">{marker.subtitle}</p>
                            )}
                            {marker.reference_number && (
                                <div className="inline-block bg-gray-100 rounded px-2 py-0.5 text-[10px] font-bold text-gray-700 tracking-wider mb-3">
                                    {marker.reference_number}
                                </div>
                            )}
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${marker.lat},${marker.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md transition-colors text-sm"
                            >
                                <Navigation className="size-4" />
                                Navigate Here
                            </a>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </Map>
    );
}
