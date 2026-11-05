import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Infrastructure } from './data'

export default function SmartMap({ assets, onSelect }: { assets: Infrastructure[]; onSelect: (asset: Infrastructure) => void }) {
  const markerColor = (type: string) => type === 'Treatment plant' ? '#38bdf8' : type === 'Reservoir' ? '#a78bfa' : type === 'Pumping station' ? '#34d399' : type === 'Solar installation' ? '#fbbf24' : '#60a5fa'
  return (
    <div className="map-wrap">
      <MapContainer center={[40.726, -73.986]} zoom={12} scrollWheelZoom className="leaflet-map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {assets.map((asset) => (
          <CircleMarker key={asset.id} center={[asset.lat, asset.lng]} radius={asset.type === 'Treatment plant' ? 10 : 8}
            pathOptions={{ color: markerColor(asset.type), fillColor: markerColor(asset.type), fillOpacity: 0.9, weight: 2 }}
            eventHandlers={{ click: () => onSelect(asset) }}>
            <Popup><strong>{asset.name}</strong><br />{asset.type} · {asset.status}<br /><button className="map-popup-btn" onClick={() => onSelect(asset)}>View asset details</button></Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend"><strong>ASSET TYPES</strong>{[
        ['Treatment plant', '#38bdf8'], ['Reservoir', '#a78bfa'], ['Pumping station', '#34d399'], ['Solar installation', '#fbbf24'], ['Distribution zone', '#60a5fa'],
      ].map(([label, color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}</div>
    </div>
  )
}
