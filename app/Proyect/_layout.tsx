import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, useAuthFetch } from '@/hooks/useAuthFetch';

function SessionHeartbeat() {
  const { token } = useUser();
  const authFetch = useAuthFetch();

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      authFetch(API_URL + '/auth/me').catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [token]);

  return null;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <>
      <SessionHeartbeat />
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: { display: 'none' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="Login/login" options={{ href: null }} />
      <Tabs.Screen name="admin/admin" options={{ href: null }} />
      <Tabs.Screen name="casillero/casillero" options={{ href: null }} />
      <Tabs.Screen name="rp/rp" options={{ href: null, title: 'RG' }} />
      <Tabs.Screen name="Movilizador/movilizador" options={{ href: null }} />
    </Tabs>
    </>
  );
}
