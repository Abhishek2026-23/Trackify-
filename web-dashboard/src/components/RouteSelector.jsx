import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const RouteSelector = ({ routes, selectedRoute, onChange }) => {
  return (
    <FormControl fullWidth sx={{ mb: 2 }}>
      <InputLabel>Select Route</InputLabel>
      <Select
        value={selectedRoute || ''}
        label="Select Route"
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">All Routes</MenuItem>
        {routes.map((route) => (
          <MenuItem key={route.id} value={route.id}>
            {route.route_number} - {route.route_name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default RouteSelector;
