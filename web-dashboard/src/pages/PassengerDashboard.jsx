import React, { useEffect, useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, Paper, Grid, Card, CardContent, Chip } from '@mui/material';
import Map from '../components/Map';
import { busAPI, routeAPI } from '../services/api';
import socketService from '../services/socket';

export default function PassengerDashboard({ user, onLogout }) {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [busRes, routeRes] = await Promise.all([busAPI.getLive(), routeAPI.getAll()]);
        setBuses(busRes.data?.buses || busRes.data || []);
        setRoutes(routeRes.data?.routes || routeRes.data || []);
      } catch (e) { console.error(e); }
    };
    fetchData();
    socketService.connect();
    socketService.onLocationUpdate((data) => {
      setBuses(prev => prev.map(b => b.bus_id === data.bus_id ? { ...b, location: data } : b));
    });
    return () => socketService.disconnect();
  }, []);

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="success">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>🚌 Bus Tracking — Passenger View</Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>Hi, {user?.name}</Typography>
          <Button color="inherit" onClick={onLogout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, bgcolor: '#f5f5f5', flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ height: '70vh' }}>
              <Map buses={buses} route={selectedRoute} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
              <Typography variant="subtitle1" fontWeight="bold" mb={1}>Select a Route</Typography>
              {routes.map(r => (
                <Card key={r.id} onClick={() => setSelectedRoute(r)} sx={{ mb: 1, cursor: 'pointer', border: selectedRoute?.id === r.id ? '2px solid #2e7d32' : '1px solid #ddd' }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight="bold">{r.route_number}</Typography>
                      <Chip label={`${r.estimated_duration} min`} size="small" color="primary" />
                    </Box>
                    <Typography variant="caption" color="text.secondary">{r.start_point} → {r.end_point}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">{r.total_distance} km</Typography>
                  </CardContent>
                </Card>
              ))}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
