import React, { createContext, useContext, useState } from 'react';

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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  return (
    <UserContext.Provider value={{ user, setUser, token, setToken }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
