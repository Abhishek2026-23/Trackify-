import React from 'react';
import { List, ListItem, ListItemText, Chip, Box } from '@mui/material';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';

const BusList = ({ buses, onBusSelect }) => {
  return (
    <List>
      {buses.map((bus) => (
        <ListItem
          key={bus.bus_id}
          button
          onClick={() => onBusSelect(bus)}
          sx={{ borderBottom: '1px solid #eee' }}
        >
          <DirectionsBusIcon sx={{ mr: 2, color: '#2196F3' }} />
          <ListItemText
            primary={`${bus.bus_number} - ${bus.route_name}`}
            secondary={`Speed: ${bus.location?.speed?.toFixed(1) || 0} km/h`}
          />
          <Chip
            label={bus.trip_status}
            color={bus.trip_status === 'active' ? 'success' : 'default'}
            size="small"
          />
        </ListItem>
      ))}
    </List>
  );
};

export default BusList;
