import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cafeos_token');
    const storedUser = localStorage.getItem('cafeos_user');
    
    if (token && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    }
    setLoading(false);
  }, []);

  const login = async (phone, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });

    const userObj = { ...data.user, role: 'delivery_partner' };
    localStorage.setItem('cafeos_token', data.accessToken);
    localStorage.setItem('cafeos_user', JSON.stringify(userObj));
    setUser(userObj);
  };

  const register = async (payload) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...payload, role: 'delivery_partner' }),
    });

    const userObj = { ...data.user, role: 'delivery_partner' };
    localStorage.setItem('cafeos_token', data.accessToken);
    localStorage.setItem('cafeos_user', JSON.stringify(userObj));
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem('cafeos_token');
    localStorage.removeItem('cafeos_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
