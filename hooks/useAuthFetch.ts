import { router } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useUser } from '../context/UserContext';

// En producción, configura EXPO_PUBLIC_API_URL en tu .env o app.json extra
const DEFAULT_API = Platform.OS === 'android' ? 'http://10.0.2.2:8080/api' : 'http://localhost:8080/api';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API;

/**
 * Hook que retorna una función fetch autenticada.
 * Agrega automáticamente el header Authorization: Bearer <token>
 * Reintenta hasta 2 veces en caso de error de red.
 * Redirige a login si recibe 401 (token expirado/inválido).
 */
export function useAuthFetch() {
  const { token, setToken, setUser } = useUser();

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}, retries = 2): Promise<Response> => {
      // Prevenir requests a URLs no autorizadas
      if (!url.startsWith(API_URL)) {
        throw new Error('URL no autorizada');
      }

      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      for (let i = 0; i <= retries; i++) {
        try {
          const res = await fetch(url, { ...options, headers });

          // Si el token expiró o es inválido, cerrar sesión
          if (res.status === 401) {
            setToken(null);
            setUser(null);
            router.replace('/Proyect/Login/login');
            throw new Error('Sesión expirada. Inicia sesión nuevamente.');
          }

          return res;
        } catch (err: any) {
          // No reintentar si fue un 401 (sesión expirada)
          if (err.message?.includes('Sesión expirada')) throw err;
          if (i === retries) throw err;
          // Espera breve antes de reintentar (500ms, 1000ms)
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
      }
      throw new Error('Error de red');
    },
    [token, setToken, setUser]
  );

  return authFetch;
}
