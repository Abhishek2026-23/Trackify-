import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

const HomeScreen = ({ navigation }) => {
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await axios.get(`${API_URL}/routes`);
      setRoutes(response.data.routes);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    }
  };

  const renderRoute = ({ item }) => (
    <TouchableOpacity
      style={styles.routeCard}
      onPress={() => navigation.navigate('Map', { routeId: item.id })}
    >
      <Text style={styles.routeNumber}>{item.route_number}</Text>
      <Text style={styles.routeName}>{item.route_name}</Text>
      <Text style={styles.routeDetails}>
        {item.start_point} → {item.end_point}
      </Text>
      <Text style={styles.duration}>{item.estimated_duration} min</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Available Routes</Text>
      <FlatList
        data={routes}
        renderItem={renderRoute}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  routeCard: { backgroundColor: 'white', padding: 16, marginBottom: 12, borderRadius: 8 },
  routeNumber: { fontSize: 18, fontWeight: 'bold', color: '#2196F3' },
  routeName: { fontSize: 16, marginTop: 4 },
  routeDetails: { fontSize: 14, color: '#666', marginTop: 4 },
  duration: { fontSize: 12, color: '#999', marginTop: 4 },
});

export default HomeScreen;
