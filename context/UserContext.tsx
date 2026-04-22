import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface User {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
}

interface UserContextProps {
  user: User | null;
  setUser: (user: User | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
}

const UserContext = createContext<UserContextProps>({ user: null, setUser: () => {}, token: null, setToken: () => {} });

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);

  // Guardar en AsyncStorage
  const setUser = async (u: User | null) => {
    setUserState(u);
    if (u) await AsyncStorage.setItem('user', JSON.stringify(u));
    else await AsyncStorage.removeItem('user');
  };
  const setToken = async (t: string | null) => {
    setTokenState(t);
    if (t) await AsyncStorage.setItem('token', t);
    else await AsyncStorage.removeItem('token');
  };

  // Cargar usuario/token al iniciar
  useEffect(() => {
    (async () => {
      const u = await AsyncStorage.getItem('user');
      const t = await AsyncStorage.getItem('token');
      if (u) setUserState(JSON.parse(u));
      if (t) setTokenState(t);
    })();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, token, setToken }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
