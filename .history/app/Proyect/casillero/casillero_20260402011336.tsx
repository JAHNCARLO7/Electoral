import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  FlatList,
  Modal, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useUser } from '../../../context/UserContext';

const API_URL = 'http://10.0.2.2:8080/api/ciudadanos';

export default function CasilleroScreen() {
  const { user } = useUser();

  const [secciones, setSecciones] = useState([]);
  const [seccionesFiltradas, setSeccionesFiltradas] = useState([]);
  const [busquedaSeccion, setBusquedaSeccion] = useState('');

  const [seccionSeleccionada, setSeccionSeleccionada] = useState(null);
  const [ciudadanos, setCiudadanos] = useState([]);
  const [ciudadanosFiltrados, setCiudadanosFiltrados] = useState([]);
  const [busquedaCiudadano, setBusquedaCiudadano] = useState('');

  const [ciudadanoAVotar, setCiudadanoAVotar] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarSecciones();
  }, []);

  const cargarSecciones = async () => {
    setCargando(true);
    try {
      const respuesta = await fetch(`${API_URL}/secciones`);
      const data = await respuesta.json();
      setSecciones(data);
      setSeccionesFiltradas(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las secciones');
    }
    setCargando(false);
  };

  const buscarSeccion = (texto: string) => {
    setBusquedaSeccion(texto);
    const filtradas = secciones.filter(s =>
      s.seccion.toLowerCase().includes(texto.toLowerCase())
    );
    setSeccionesFiltradas(filtradas);
  };

  const cargarCiudadanos = async (seccion: string) => {
    setCargando(true);
    setSeccionSeleccionada(seccion);
    setBusquedaCiudadano('');
    try {
      const respuesta = await fetch(`${API_URL}/seccion/${seccion}`);
      const data = await respuesta.json();
      setCiudadanos(data);
      setCiudadanosFiltrados(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los ciudadanos');
    }
    setCargando(false);
  };

  const buscarCiudadano = (texto: string) => {
    setBusquedaCiudadano(texto);
    const filtrados = ciudadanos.filter(c => {
      const nombreCompleto = `${c.nombre} ${c.paterno} ${c.materno}`.toLowerCase();
      return nombreCompleto.includes(texto.toLowerCase());
    });
    setCiudadanosFiltrados(filtrados);
  };

  const abrirConfirmacion = (ciudadano: any) => {
    setCiudadanoAVotar(ciudadano);
    setModalVisible(true);
  };

  const confirmarVoto = async () => {
    try {
      await fetch(`${API_URL}/votar/${ciudadanoAVotar.id}`, { method: 'PUT' });
      setModalVisible(false);
      const nuevaLista = ciudadanos.filter(c => c.id !== ciudadanoAVotar.id);
      setCiudadanos(nuevaLista);
      setCiudadanosFiltrados(nuevaLista.filter(c => {
        const nombreCompleto = `${c.nombre} ${c.paterno} ${c.materno}`.toLowerCase();
        return nombreCompleto.includes(busquedaCiudadano.toLowerCase());
      }));
      setCiudadanoAVotar(null);
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar el voto');
    }
  };

  const cancelarVoto = () => {
    setModalVisible(false);
    setCiudadanoAVotar(null);
  };

  // Vista: Lista de secciones
  if (!seccionSeleccionada) {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>Bienvenido, {user?.nombre}</Text>
        <Text style={styles.subtitulo}>Selecciona una sección</Text>

        <TextInput
          style={styles.buscador}
          placeholder="Buscar sección..."
          placeholderTextColor="#999"
          value={busquedaSeccion}
          onChangeText={buscarSeccion}
        />

        {cargando ? (
          <ActivityIndicator size="large" color="#1a3a5c" />
        ) : seccionesFiltradas.length === 0 ? (
          <Text style={styles.textoVacio}>No se encontró esa sección</Text>
        ) : (
          <FlatList
            data={seccionesFiltradas}
            keyExtractor={(item) => item.seccion}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.tarjeta}
                onPress={() => cargarCiudadanos(item.seccion)}
              >
                <Text style={styles.textoTarjeta}>Sección {item.seccion}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // Vista: Lista de ciudadanos
  return (
    <View style={styles.contenedor}>
      <TouchableOpacity onPress={() => setSeccionSeleccionada(null)} style={styles.botonRegresar}>
        <Text style={styles.textoRegresar}>← Regresar</Text>
      </TouchableOpacity>
      <Text style={styles.titulo}>Sección {seccionSeleccionada}</Text>
      <Text style={styles.subtitulo}>Toca un nombre para registrar voto</Text>

      <TextInput
        style={styles.buscador}
        placeholder="Buscar ciudadano..."
        placeholderTextColor="#999"
        value={busquedaCiudadano}
        onChangeText={buscarCiudadano}
      />

      {cargando ? (
        <ActivityIndicator size="large" color="#1a3a5c" />
      ) : ciudadanosFiltrados.length === 0 ? (
        <Text style={styles.textoVacio}>
          {busquedaCiudadano ? 'No se encontró ese ciudadano' : 'Todos han votado en esta sección ✅'}
        </Text>
      ) : (
        <FlatList
          data={ciudadanosFiltrados}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tarjeta}
              onPress={() => abrirConfirmacion(item)}
            >
              <Text style={styles.textoTarjeta}>
                {item.nombre} {item.paterno} {item.materno}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.fondoModal}>
          <View style={styles.modal}>
            <Text style={styles.tituloModal}>¿Confirmar voto?</Text>
            <Text style={styles.textoModal}>
              ¿Está seguro de registrar el voto de{'\n'}
              <Text style={styles.negrita}>
                {ciudadanoAVotar?.nombre} {ciudadanoAVotar?.paterno} {ciudadanoAVotar?.materno}
              </Text>
              ?
            </Text>
            <View style={styles.botonesModal}>
              <TouchableOpacity style={styles.botonCancelar} onPress={cancelarVoto}>
                <Text style={styles.textoBoton}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonConfirmar} onPress={confirmarVoto}>
                <Text style={styles.textoBoton}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#fff', padding: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1a3a5c', marginBottom: 4 },
  subtitulo: { fontSize: 14, color: '#666', marginBottom: 12 },
  buscador: {
    backgroundColor: '#f0f4f8',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d0d9e3'
  },
  tarjeta: {
    backgroundColor: '#f0f4f8', padding: 16, borderRadius: 10,
    marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#1a3a5c'
  },
  textoTarjeta: { fontSize: 16, color: '#1a3a5c', fontWeight: '500' },
  botonRegresar: { marginBottom: 12 },
  textoRegresar: { color: '#1a3a5c', fontSize: 16 },
  textoVacio: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16 },
  fondoModal: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center'
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    width: '80%', alignItems: 'center'
  },
  tituloModal: { fontSize: 18, fontWeight: 'bold', color: '#1a3a5c', marginBottom: 12 },
  textoModal: { fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 20 },
  negrita: { fontWeight: 'bold' },
  botonesModal: { flexDirection: 'row', gap: 12 },
  botonCancelar: {
    backgroundColor: '#ccc', paddingVertical: 10,
    paddingHorizontal: 20, borderRadius: 8
  },
  botonConfirmar: {
    backgroundColor: '#1a3a5c', paddingVertical: 10,
    paddingHorizontal: 20, borderRadius: 8
  },
  textoBoton: { color: '#fff', fontWeight: 'bold' },
});