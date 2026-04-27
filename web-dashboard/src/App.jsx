import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import PassengerDashboard from './pages/PassengerDashboard';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (saved && token) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (u) => setUser(u);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  if (user.user_type === 'admin' || user.user_type === 'operator') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  return <PassengerDashboard user={user} onLogout={handleLogout} />;
}

export default App;
