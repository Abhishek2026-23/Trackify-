import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, Tabs, Tab } from '@mui/material';
import { API_BASE_URL } from '../config';

export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', user_type: 'commuter' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const url = tab === 0 ? `${API_BASE_URL}/auth/login` : `${API_BASE_URL}/auth/register`;
      const body = tab === 0
        ? { phone: form.phone, password: form.password }
        : { name: form.name, phone: form.phone, email: form.email, password: form.password };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      if (tab === 0) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setTab(0);
        setError('Registered! Please login.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f0f4f8' }}>
      <Paper sx={{ p: 4, width: 380 }}>
        <Typography variant="h5" fontWeight="bold" mb={2} textAlign="center">🚌 Bus Tracking</Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered sx={{ mb: 2 }}>
          <Tab label="Login" />
          <Tab label="Register" />
        </Tabs>
        {error && <Alert severity={error.includes('Registered') ? 'success' : 'error'} sx={{ mb: 2 }}>{error}</Alert>}
        {tab === 1 && <TextField fullWidth label="Full Name" name="name" value={form.name} onChange={handle} sx={{ mb: 2 }} />}
        <TextField fullWidth label="Phone (10 digits)" name="phone" value={form.phone} onChange={handle} sx={{ mb: 2 }} />
        {tab === 1 && <TextField fullWidth label="Email (optional)" name="email" value={form.email} onChange={handle} sx={{ mb: 2 }} />}
        <TextField fullWidth label="Password" name="password" type="password" value={form.password} onChange={handle} sx={{ mb: 2 }} />
        <Button fullWidth variant="contained" onClick={submit} disabled={loading}>
          {loading ? 'Please wait...' : tab === 0 ? 'Login' : 'Register'}
        </Button>
        <Typography variant="caption" display="block" textAlign="center" mt={2} color="text.secondary">
          Demo: phone=9999999999, password=admin123
        </Typography>
      </Paper>
    </Box>
  );
}
