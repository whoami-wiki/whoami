'use client';

import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { type LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapPerson {
  record: string;
  name: string;
  place: string;
  href: string;
}

interface MapPlace {
  name: string;
  lat: number;
  lon: number;
  note?: string;
  people: MapPerson[];
}

interface Props {
  places: MapPlace[];
}

function radiusForCount(n: number): number {
  return 4 + Math.min(8, Math.sqrt(n) * 2);
}

export function BirthplacesMap({ places }: Props) {
  if (places.length === 0) return null;

  const lats = places.map(p => p.lat);
  const lons = places.map(p => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const pad = 2;
  const bounds: LatLngBoundsExpression = [
    [minLat - pad, minLon - pad],
    [maxLat + pad, maxLon + pad],
  ];

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-md ring-1 ring-foreground/12 [&_.leaflet-container]:bg-muted/30">
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />
        {places.map(place => {
          const isFallback = place.note?.toLowerCase().includes('country-only')
            || place.note?.toLowerCase().includes('historical country');
          return (
            <CircleMarker
              key={`${place.lat}-${place.lon}-${place.name}`}
              center={[place.lat, place.lon]}
              radius={radiusForCount(place.people.length)}
              pathOptions={{
                color: isFallback ? 'rgb(120 120 120)' : 'rgb(56 117 207)',
                weight: isFallback ? 1 : 1.5,
                fillColor: isFallback ? 'rgb(160 160 160)' : 'rgb(56 117 207)',
                fillOpacity: isFallback ? 0.35 : 0.65,
              }}
            >
              <Popup>
                <div className="font-display text-[0.95rem] leading-snug tracking-tight">
                  {place.name}
                </div>
                {place.note ? (
                  <div className="mt-1 text-[0.7rem] italic text-muted-foreground">
                    {place.note}
                  </div>
                ) : null}
                <ul className="mt-2 space-y-0.5 text-[0.8rem]">
                  {place.people.map(p => (
                    <li key={p.record}>
                      <a href={p.href} className="text-blue-600 hover:underline">
                        {p.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
