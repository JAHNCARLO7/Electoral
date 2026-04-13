import React from 'react';
import { Text, View } from 'react-native';
import { useUser } from '../../../context/UserContext';

export default function CasilleroScreen() {
  const { user } = useUser();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Bienvenido, {user?.nombre} ({user?.rol})</Text>
    </View>
  );
}
const NOMBRE_USUARIO = 'casillero'; // This line can be removed if not needed
