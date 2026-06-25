import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'
);

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session from localstorage on layout mount
  useEffect(() => {
    const rehydrateSession = () => {
      try {
        const cachedToken = localStorage.getItem('campusflow_token');
        const cachedUser = localStorage.getItem('campusflow_user');

        if (cachedToken && cachedUser) {
          setToken(cachedToken);
          setUser(JSON.parse(cachedUser));
        }
      } catch (err) {
        console.error('Session rehydration failed:', err);
        localStorage.removeItem('campusflow_token');
        localStorage.removeItem('campusflow_user');
      } finally {
        setLoading(false);
      }
    };

    rehydrateSession();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { user: profile, token: sessionToken } = response.data;

      localStorage.setItem('campusflow_token', sessionToken);
      localStorage.setItem('campusflow_user', JSON.stringify(profile));

      setToken(sessionToken);
      setUser(profile);
      return response.data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', formData);
      const { user: profile, session } = response.data;

      if (session && session.access_token) {
        localStorage.setItem('campusflow_token', session.access_token);
        localStorage.setItem('campusflow_user', JSON.stringify(profile));

        setToken(session.access_token);
        setUser(profile);
      }
      return response.data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('campusflow_token');
    localStorage.removeItem('campusflow_user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    setUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be called inside an AuthProvider scope');
  }
  return context;
};
