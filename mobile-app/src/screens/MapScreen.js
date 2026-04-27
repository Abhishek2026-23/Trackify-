import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import axios from 'axios';
import { API_URL, MAP_CONFIG } from '../config';

const MapScreen = ({ route }) => {
  const { routeId } = route.params;
  const [buses, setBuses] = useState([]);
  const [routeData, setRouteData] = useState(null);

  useEffect(() => {
    fetchRouteData();
    fetchBuses();
    const interval = setInterval(fetchBuses, 5000);
    return () => clearInterval(interval);
  }, [routeId]);

  const fetchRouteData = async () => {
    try {
      const response = await axios.get(`${API_URL}/routes/${routeId}`);
      setRouteData(response.data.route);
    } catch (error) {
      console.error('Failed to fetch route:', error);
    }
  };

  const fetchBuses = async () => {
    try {
      const response = await axios.get(`${API_URL}/buses/live`, {
        params: { route_id: routeId },
      });
      setBuses(response.data.buses);
    } catch (error) {
      console.error('Failed to fetch buses:', error);
    }
  };

  const routeCoordinates = routeData?.stops?.map(stop => ({
    latitude: stop.latitude,
    longitude: stop.longitude,
  })) || [];

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={MAP_CONFIG.initialRegion}>
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2196F3"
            strokeWidth={3}
          />
        )}
        {buses.map((bus) => (
          bus.location && (
            <Marker
              key={bus.bus_id}
              coordinate={{
                latitude: bus.location.latitude,
                longitude: bus.location.longitude,
              }}
              title={bus.bus_number}
              description={`Speed: ${bus.location.speed?.toFixed(1)} km/h`}
            />
          )
        ))}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

export default MapScreen;
