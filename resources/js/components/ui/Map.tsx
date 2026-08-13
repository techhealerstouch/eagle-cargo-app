import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppearance } from '@/hooks/use-appearance';

// Fix for default Leaflet marker icon issues in React/Webpack/Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconRetinaUrl: iconRetina,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapSizeInvalidator() {
    const map = useMap();

    useEffect(() => {
        const container = map.getContainer();

        const invalidate = () => {
            map.invalidateSize();
        };

        invalidate();
        const timeout = window.setTimeout(invalidate, 250);

        const resizeObserver = new ResizeObserver(invalidate);
        resizeObserver.observe(container);

        return () => {
            window.clearTimeout(timeout);
            resizeObserver.disconnect();
        };
    }, [map]);

    return null;
}

interface MapProps {
    center?: [number, number];
    zoom?: number;
    className?: string;
    children?: React.ReactNode;
}

export default function Map({ center = [14.5995, 120.9842], zoom = 12, className = 'w-full h-96 rounded-lg', children }: MapProps) {
    const { resolvedAppearance } = useAppearance();

    const tileUrl = resolvedAppearance === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    return (
        <div className={className}>
            <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} className="w-full h-full z-0">
                <MapSizeInvalidator />
                <TileLayer
                    key={resolvedAppearance}
                    attribution={attribution}
                    url={tileUrl}
                />
                {children}
            </MapContainer>
        </div>
    );
}

