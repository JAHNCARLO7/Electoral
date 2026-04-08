import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, FlatList, Modal, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useUser } from '../../../context/UserContext';

const API_BASE = Platform.OS === 'android' ? 'http://10.0.2.2:8080/api' : 'http://localhost:8080/api';
const API_URL = API_BASE + '/ciudadanos';

/* ---------- PALETA CORPORATIVA ---------- */
const C = {
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#E3F2FD',
  navy: '#0D1B2A',
  navyLight: '#1B2838',
  white: '#FFFFFF',
  bg: '#F0F4F8',
  cardBorder: '#E2E8F0',
  textPrimary: '#1A1F36',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  error: '#C62828',
  errorLight: '#FFEBEE',
  warning: '#EF6C00',
  warningLight: '#FFF3E0',
};

type Seccion = { seccion: string };
type Ciudadano = { id: number; nombre: string; paterno: string; materno: string };

/* ---------- ANIMACIÓN ---------- */
const FadeIn = React.memo(({ delay = 0, children }: { delay?: number; children: React.ReactNode }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
});

export default function CasilleroScreen() {
  const { user, setUser } = useUser();
  const router = useRouter();

  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [seccionesFiltradas, setSeccionesFiltradas] = useState<Seccion[]>([]);
  const [busquedaSeccion, setBusquedaSeccion] = useState('');

  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string | null>(null);
  const [ciudadanos, setCiudadanos] = useState<Ciudadano[]>([]);
  const [ciudadanosFiltrados, setCiudadanosFiltrados] = useState<Ciudadano[]>([]);
  const [busquedaCiudadano, setBusquedaCiudadano] = useState('');

  const [ciudadanoAVotar, setCiudadanoAVotar] = useState<Ciudadano | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [votosRegistrados, setVotosRegistrados] = useState(0);

  const handleLogout = () => {
    setUser(null);
    setTimeout(() => router.replace('/Proyect/Login/login'), 250);
  };

  useEffect(() => { cargarSecciones(); }, []);

  const cargarSecciones = async () => {
    setCargando(true);
    try {
      const res = await fetch(API_URL + '/secciones');
      const data: Seccion[] = await res.json();
      setSecciones(data);
      setSeccionesFiltradas(data);
    } catch { }
    setCargando(false);
  };

  const buscarSeccion = (texto: string) => {
    setBusquedaSeccion(texto);
    setSeccionesFiltradas(secciones.filter(s => s.seccion.toLowerCase().includes(texto.toLowerCase())));
  };

  const cargarCiudadanos = async (seccion: string) => {
    setCargando(true);
    setSeccionSeleccionada(seccion);
    setBusquedaCiudadano('');
    try {
      const res = await fetch(API_URL + '/seccion/' + seccion);
      const data: Ciudadano[] = await res.json();
      setCiudadanos(data);
      setCiudadanosFiltrados(data);
    } catch { }
    setCargando(false);
  };

  const buscarCiudadano = (texto: string) => {
    setBusquedaCiudadano(texto);
    setCiudadanosFiltrados(ciudadanos.filter(c =>
      (c.nombre + ' ' + c.paterno + ' ' + c.materno).toLowerCase().includes(texto.toLowerCase())
    ));
  };

  const abrirConfirmacion = (c: Ciudadano) => { setCiudadanoAVotar(c); setModalVisible(true); };

  const confirmarVoto = async () => {
    if (!ciudadanoAVotar) return;
    try {
      await fetch(API_URL + '/votar/' + ciudadanoAVotar.id, { method: 'PUT' });
      setModalVisible(false);
      const nueva = ciudadanos.filter(c => c.id !== ciudadanoAVotar.id);
      setCiudadanos(nueva);
      setCiudadanosFiltrados(nueva.filter(c =>
        (c.nombre + ' ' + c.paterno + ' ' + c.materno).toLowerCase().includes(busquedaCiudadano.toLowerCase())
      ));
      setVotosRegistrados(v => v + 1);
      setCiudadanoAVotar(null);
    } catch { }
  };

  const cancelarVoto = () => { setModalVisible(false); setCiudadanoAVotar(null); };

  /* ==================== VISTA SECCIONES ==================== */
  if (!seccionSeleccionada) {
    return (
      <View style={st.container}>
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Casilla Electoral</Text>
            <Text style={st.headerSub}>{user?.nombre || 'Casillero'}</Text>
          </View>
          <View style={st.headerRight}>
            {votosRegistrados > 0 && (
              <View style={st.votosBadge}>
                <Text style={st.votosNum}>{votosRegistrados}</Text>
                <Text style={st.votosLabel}>VOTOS</Text>
              </View>
            )}
            <TouchableOpacity style={st.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={st.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={st.body}>
          <View style={st.statsRow}>
            <View style={[st.statCard, { backgroundColor: C.primaryLight }]}>
              <Text style={[st.statNum, { color: C.primary }]}>{secciones.length}</Text>
              <Text style={st.statLabel}>Secciones</Text>
            </View>
          </View>

          <TextInput style={st.searchInput} placeholder="Buscar sección..." placeholderTextColor={C.textTertiary}
            value={busquedaSeccion} onChangeText={buscarSeccion} />

          {cargando ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
          ) : seccionesFiltradas.length === 0 ? (
            <Text style={st.emptyText}>No se encontró esa sección</Text>
          ) : (
            <FlatList data={seccionesFiltradas} keyExtractor={item => item.seccion}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item, index }) => (
                <FadeIn delay={index * 50}>
                  <TouchableOpacity style={st.secCard} onPress={() => cargarCiudadanos(item.seccion)} activeOpacity={0.7}>
                    <View style={st.secIcon}>
                      <Text style={st.secIconText}>{item.seccion}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.secTitle}>Sección {item.seccion}</Text>
                      <Text style={st.secMeta}>Toca para ver ciudadanos</Text>
                    </View>
                    <Text style={st.secArrow}>›</Text>
                  </TouchableOpacity>
                </FadeIn>
              )}
            />
          )}
        </View>
      </View>
    );
  }

  /* ==================== VISTA CIUDADANOS ==================== */
  return (
    <View style={st.container}>
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Sección {seccionSeleccionada}</Text>
          <Text style={st.headerSub}>{ciudadanosFiltrados.length} ciudadanos pendientes</Text>
        </View>
        <View style={st.headerRight}>
          <View style={st.votosBadge}>
            <Text style={st.votosNum}>{votosRegistrados}</Text>
            <Text style={st.votosLabel}>VOTOS</Text>
          </View>
        </View>
      </View>

      <View style={st.body}>
        <TouchableOpacity style={st.backBtn} onPress={() => setSeccionSeleccionada(null)} activeOpacity={0.7}>
          <Text style={st.backBtnText}>← Regresar a secciones</Text>
        </TouchableOpacity>

        <TextInput style={st.searchInput} placeholder="Buscar ciudadano..." placeholderTextColor={C.textTertiary}
          value={busquedaCiudadano} onChangeText={buscarCiudadano} />

        {cargando ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : ciudadanosFiltrados.length === 0 ? (
          <View style={st.emptyBox}>
            <Text style={st.emptyIcon}>✅</Text>
            <Text style={st.emptyTitle}>{busquedaCiudadano ? 'Sin resultados' : '¡Todos han votado!'}</Text>
            <Text style={st.emptyMeta}>{busquedaCiudadano ? 'Intenta con otro nombre' : 'Esta sección está completa'}</Text>
          </View>
        ) : (
          <FlatList data={ciudadanosFiltrados} keyExtractor={item => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item, index }) => (
              <FadeIn delay={index * 30}>
                <TouchableOpacity style={st.citizenCard} onPress={() => abrirConfirmacion(item)} activeOpacity={0.7}>
                  <View style={st.citizenRow}>
                    <View style={st.avatar}>
                      <Text style={st.avatarText}>{(item.paterno || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.citizenName}>{item.paterno} {item.materno} {item.nombre}</Text>
                      <Text style={st.citizenMeta}>Toca para registrar voto</Text>
                    </View>
                    <View style={st.voteIcon}>
                      <Text style={{ color: C.white, fontWeight: '900', fontSize: 14 }}>✓</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </FadeIn>
            )}
          />
        )}
      </View>

      {/* MODAL CONFIRMACIÓN */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={st.modalBg}>
          <View style={st.modalBox}>
            <View style={st.modalIconCircle}>
              <Text style={{ fontSize: 28 }}>🗳️</Text>
            </View>
            <Text style={st.modalTitle}>¿Confirmar voto?</Text>
            <Text style={st.modalDesc}>
              Estás a punto de registrar el voto de:
            </Text>
            <View style={st.modalNameBox}>
              <Text style={st.modalName}>
                {ciudadanoAVotar?.paterno} {ciudadanoAVotar?.materno} {ciudadanoAVotar?.nombre}
              </Text>
            </View>
            <Text style={st.modalWarn}>Esta acción no se puede deshacer</Text>
            <View style={st.modalActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={cancelarVoto} activeOpacity={0.7}>
                <Text style={st.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.confirmBtn} onPress={confirmarVoto} activeOpacity={0.7}>
                <Text style={st.confirmBtnText}>Confirmar Voto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- ESTILOS CORPORATIVOS ---------- */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.navy, paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: 0.5 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  votosBadge: {
    alignItems: 'center', backgroundColor: 'rgba(46,125,50,0.2)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(46,125,50,0.3)',
  },
  votosNum: { fontSize: 15, fontWeight: '900', color: '#66BB6A' },
  votosLabel: { fontSize: 7, fontWeight: '800', color: 'rgba(102,187,106,0.7)', letterSpacing: 1 },
  logoutBtn: {
    backgroundColor: 'rgba(198,40,40,0.15)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(198,40,40,0.4)',
  },
  logoutText: { color: '#EF5350', fontWeight: '800', fontSize: 11 },

  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  statNum: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 9, color: C.textSecondary, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },

  searchInput: {
    backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: C.textPrimary, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 14,
  },

  secCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  secIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  secIconText: { fontSize: 15, fontWeight: '900', color: C.primary },
  secTitle: { fontSize: 15, fontWeight: '800', color: C.textPrimary },
  secMeta: { fontSize: 11, color: C.textTertiary, fontWeight: '600', marginTop: 2 },
  secArrow: { fontSize: 24, color: C.textTertiary },

  backBtn: {
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18,
    alignSelf: 'flex-start', marginBottom: 14,
  },
  backBtnText: { color: C.white, fontWeight: '800', fontSize: 13 },

  citizenCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  citizenRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.white, fontWeight: '900', fontSize: 18 },
  citizenName: { fontSize: 15, fontWeight: '800', color: C.textPrimary },
  citizenMeta: { fontSize: 11, color: C.textTertiary, fontWeight: '600', marginTop: 2 },
  voteIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.success,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyText: { textAlign: 'center', color: C.textTertiary, fontSize: 14, paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: C.textPrimary, marginBottom: 4 },
  emptyMeta: { fontSize: 13, color: C.textSecondary },

  modalBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: {
    backgroundColor: C.white, borderRadius: 22, padding: 28, width: 320, maxWidth: '90%',
    alignItems: 'center',
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 25, shadowOffset: { width: 0, height: 10 },
  },
  modalIconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: C.textPrimary, marginBottom: 8 },
  modalDesc: { fontSize: 13, color: C.textSecondary, textAlign: 'center', marginBottom: 12 },
  modalNameBox: {
    backgroundColor: C.primaryLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20,
    marginBottom: 12, width: '100%', alignItems: 'center',
  },
  modalName: { fontSize: 16, fontWeight: '900', color: C.primary, textAlign: 'center' },
  modalWarn: { fontSize: 11, color: C.error, fontWeight: '700', marginBottom: 20, fontStyle: 'italic' },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#F0F4F8', borderWidth: 1, borderColor: C.cardBorder,
  },
  cancelBtnText: { color: C.textSecondary, fontWeight: '800', fontSize: 14 },
  confirmBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: C.success,
  },
  confirmBtnText: { color: C.white, fontWeight: '800', fontSize: 14 },
});
