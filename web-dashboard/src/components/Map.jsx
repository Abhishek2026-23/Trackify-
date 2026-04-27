import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MAP_CONFIG } from '../config';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const busIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const Map = ({ buses, route }) => {
  const routeCoordinates = route?.stops?.map(stop => [stop.latitude, stop.longitude]) || [];

  return (
    <MapContainer center={MAP_CONFIG.center} zoom={MAP_CONFIG.zoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      
      {routeCoordinates.length > 0 && (
        <Polyline positions={routeCoordinates} color="blue" weight={3} opacity={0.6} />
      )}
      
      {buses.map((bus) => (
        bus.location && (
          <Marker
            key={bus.bus_id}
            position={[bus.location.latitude, bus.location.longitude]}
            icon={busIcon}
          >
            <Popup>
              <strong>{bus.bus_number}</strong><br />
              Route: {bus.route_number}<br />
              Speed: {bus.location.speed?.toFixed(1)} km/h
            </Popup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
};

export default Map;
