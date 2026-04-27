import React, { useEffect, useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, Grid, Paper, Chip, Avatar } from '@mui/material';
import Map from '../components/Map';
import { busAPI, routeAPI } from '../services/api';
import socketService from '../services/socket';

export default function AdminDashboard({ user, onLogout }) {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stats, setStats] = useState({ active: 0, total: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [busRes, routeRes] = await Promise.all([busAPI.getLive(), routeAPI.getAll()]);
        const busList = busRes.data?.buses || busRes.data || [];
        const routeList = routeRes.data?.routes || routeRes.data || [];
        setBuses(busList);
        setRoutes(routeList);
        setStats({ active: busList.filter(b => b.location).length, total: busList.length });
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
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>🚌 Bus Tracking — Admin Dashboard</Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>Welcome, {user?.name}</Typography>
          <Button color="inherit" onClick={onLogout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{stats.active}</Typography>
              <Typography variant="body2">Active Buses</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="secondary">{stats.total}</Typography>
              <Typography variant="body2">Total Buses</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4">{routes.length}</Typography>
              <Typography variant="body2">Routes</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Chip label="LIVE" color="success" />
              <Typography variant="body2" mt={1}>System Status</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ height: '60vh' }}>
              <Map buses={buses} route={selectedRoute} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '60vh', overflow: 'auto' }}>
              <Typography variant="subtitle1" fontWeight="bold" mb={1}>Routes</Typography>
              {routes.map(r => (
                <Box key={r.id} onClick={() => setSelectedRoute(r)}
                  sx={{ p: 1, mb: 1, borderRadius: 1, cursor: 'pointer', bgcolor: selectedRoute?.id === r.id ? '#e3f2fd' : '#fafafa', border: '1px solid #ddd' }}>
                  <Typography variant="body2" fontWeight="bold">{r.route_number}</Typography>
                  <Typography variant="caption">{r.start_point} → {r.end_point}</Typography>
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
