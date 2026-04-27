import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1';

export default function App() {
  const [buses, setBuses] = useState([]);
  const [region, setRegion] = useState({
    latitude: 30.7333,
    longitude: 76.7794,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  useEffect(() => {
    fetchBuses();
    const interval = setInterval(fetchBuses, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchBuses = async () => {
    try {
      const response = await axios.get(`${API_URL}/buses/live`);
      setBuses(response.data.buses);
    } catch (error) {
      console.error('Failed to fetch buses:', error);
    }
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region}>
        {buses.map((bus) => (
          bus.location && (
            <Marker
              key={bus.bus_id}
              coordinate={{
                latitude: bus.location.latitude,
                longitude: bus.location.longitude,
              }}
              title={bus.bus_number}
              description={`Route: ${bus.route_number}`}
            />
          )
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
