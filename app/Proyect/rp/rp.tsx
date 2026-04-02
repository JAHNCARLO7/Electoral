
import React from 'react';
import { Text, View } from 'react-native';

export default function RPScreen() {
  const { user } = require('../../../context/UserContext');
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Bienvenido, {user?.nombre} ({user?.rol})</Text>
    </View>
  );
}
