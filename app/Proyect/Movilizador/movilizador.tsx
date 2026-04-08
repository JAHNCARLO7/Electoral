import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useUser } from '../../../context/UserContext';

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
  track: '#E2E8F0',
};

interface Ciudadano {
  id: number; nombre: string; paterno: string; materno: string;
  calle: string; no: string; colonia: string; seccion: string;
  cel: string; visitas: number;
}

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080/api' : 'http://localhost:8080/api';

/* ---------- COMPONENTE ANIMADO ---------- */
const FadeIn = React.memo(({ delay = 0, children }: { delay?: number; children: React.ReactNode }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      {children}
    </Animated.View>
  );
});

const MovilizadorScreen = () => {
  const { user, setUser } = useUser();
  const router = useRouter();
  const [ciudadanos, setCiudadanos] = useState<Ciudadano[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [busquedaSeccion, setBusquedaSeccion] = useState('');
  const [busquedaNombre, setBusquedaNombre] = useState<Record<string, string>>({});
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string | null>(null);

  const ciudadanosPorSeccion = useMemo(() =>
    ciudadanos.reduce((acc: Record<string, Ciudadano[]>, c) => {
      if (!acc[c.seccion]) acc[c.seccion] = [];
      acc[c.seccion].push(c);
      return acc;
    }, {}),
    [ciudadanos]);

  const totalVisitados = useMemo(() => ciudadanos.filter(c => c.visitas > 0).length, [ciudadanos]);

  const fetchCiudadanos = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/movilizadores/ciudadanos/${user.id}`);
      if (!res.ok) throw new Error('Error en la respuesta del servidor');
      const data = await res.json();
      if (Array.isArray(data)) setCiudadanos(data);
      else { Alert.alert('Error', 'Respuesta inesperada del servidor'); setCiudadanos([]); }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo cargar la lista de ciudadanos.\n' + (err.message || err));
      setCiudadanos([]);
    }
  };

  const loadInitial = async () => { setLoading(true); await fetchCiudadanos(); setLoading(false); };
  const onRefresh = async () => { setRefreshing(true); await fetchCiudadanos(); setRefreshing(false); };

  const marcarVisita = async (ciudadanoId: number) => {
    try {
      const res = await fetch(`${API_URL}/movilizadores/visita/${ciudadanoId}`, { method: 'PUT' });
      if (!res.ok) throw new Error('Error en la respuesta del servidor');
      fetchCiudadanos();
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo registrar la visita.\n' + (err.message || err));
    }
  };

  useEffect(() => {
    let interval: any;
    const startLocationUpdates = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso de ubicación requerido', 'La aplicación necesita acceso a tu ubicación.');
        return;
      }
      const sendLocation = async () => {
        setSendingLocation(true);
        try {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await fetch(`${API_URL}/movilizadores/ubicacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movilizadorId: user?.id, lat: location.coords.latitude, lng: location.coords.longitude, activo: 1 }),
          });
        } catch (err: any) { console.warn('No se pudo obtener ubicación:', err.message || err); }
        setSendingLocation(false);
      };
      await sendLocation();
      interval = setInterval(sendLocation, 10 * 60 * 1000);
    };
    if (user) startLocationUpdates();
    return () => interval && clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    setTimeout(() => router.replace('/Proyect/Login/login'), 250);
  };

  useEffect(() => {
    loadInitial();
    const interval = setInterval(fetchCiudadanos, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={{ color: C.textSecondary, marginTop: 14, fontSize: 14, fontWeight: '600' }}>Cargando ciudadanos...</Text>
    </View>
  );

  const seccionesFiltradas = Object.entries(ciudadanosPorSeccion)
    .filter(([seccion]) => seccion.includes(busquedaSeccion.trim()))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <View style={st.container}>
      {/* HEADER */}
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Mis Ciudadanos</Text>
          <Text style={st.headerSub}>{user?.nombre} — Movilizador</Text>
        </View>
        <View style={st.headerRight}>
          {sendingLocation && (
            <View style={st.gpsBadge}>
              <Text style={st.gpsText}>GPS</Text>
            </View>
          )}
          <View style={st.statBadge}>
            <Text style={st.statBadgeNum}>{totalVisitados}/{ciudadanos.length}</Text>
            <Text style={st.statBadgeLabel}>visitados</Text>
          </View>
          <TouchableOpacity style={st.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={st.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}>

        {!seccionSeleccionada ? (
          <>
            {/* KPI RESUMEN */}
            <View style={st.kpiRow}>
              <View style={[st.kpiCard, { backgroundColor: C.primaryLight }]}>
                <Text style={[st.kpiNum, { color: C.primary }]}>{Object.keys(ciudadanosPorSeccion).length}</Text>
                <Text style={st.kpiLabel}>Secciones</Text>
              </View>
              <View style={[st.kpiCard, { backgroundColor: C.successLight }]}>
                <Text style={[st.kpiNum, { color: C.success }]}>{totalVisitados}</Text>
                <Text style={st.kpiLabel}>Visitados</Text>
              </View>
              <View style={[st.kpiCard, { backgroundColor: C.errorLight }]}>
                <Text style={[st.kpiNum, { color: C.error }]}>{ciudadanos.length - totalVisitados}</Text>
                <Text style={st.kpiLabel}>Pendientes</Text>
              </View>
            </View>

            {/* BARRA PROGRESO */}
            <View style={st.progressCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={st.progressLabel}>Avance de visitas</Text>
                <Text style={st.progressPct}>{ciudadanos.length > 0 ? Math.round((totalVisitados / ciudadanos.length) * 100) : 0}%</Text>
              </View>
              <View style={st.progressTrack}>
                <View style={[st.progressFill, { width: ciudadanos.length > 0 ? `${(totalVisitados / ciudadanos.length) * 100}%` : '0%' }]} />
              </View>
            </View>

            {/* BUSQUEDA */}
            <TextInput style={st.searchInput} placeholder="Buscar sección..." placeholderTextColor={C.textTertiary}
              value={busquedaSeccion} onChangeText={setBusquedaSeccion} />

            {/* LISTA SECCIONES */}
            {seccionesFiltradas.length === 0 ? (
              <Text style={st.emptyText}>No hay ciudadanos asignados</Text>
            ) : (
              seccionesFiltradas.map(([seccion, lista], i) => {
                const visitados = lista.filter(c => c.visitas > 0).length;
                const pct = lista.length > 0 ? Math.round((visitados / lista.length) * 100) : 0;
                return (
                  <FadeIn key={seccion} delay={i * 60}>
                    <TouchableOpacity style={st.secCard} onPress={() => setSeccionSeleccionada(seccion)} activeOpacity={0.7}>
                      <View style={st.secLeft}>
                        <View style={st.secIcon}>
                          <Text style={st.secIconText}>{seccion}</Text>
                        </View>
                        <View>
                          <Text style={st.secTitle}>Sección {seccion}</Text>
                          <Text style={st.secMeta}>{lista.length} ciudadanos • {visitados} visitados</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[st.secPct, { color: pct >= 70 ? C.success : pct >= 40 ? '#EF6C00' : C.error }]}>{pct}%</Text>
                        <Text style={st.secArrow}>›</Text>
                      </View>
                    </TouchableOpacity>
                  </FadeIn>
                );
              })
            )}
          </>
        ) : (
          <>
            {/* DETALLE SECCION */}
            <TouchableOpacity style={st.backBtn} onPress={() => setSeccionSeleccionada(null)} activeOpacity={0.7}>
              <Text style={st.backBtnText}>← Regresar a secciones</Text>
            </TouchableOpacity>

            <View style={st.secDetailHeader}>
              <Text style={st.secDetailTitle}>Sección {seccionSeleccionada}</Text>
              <View style={st.secDetailBadge}>
                <Text style={st.secDetailBadgeText}>
                  {(ciudadanosPorSeccion[seccionSeleccionada] || []).filter(c => c.visitas > 0).length}/{(ciudadanosPorSeccion[seccionSeleccionada] || []).length}
                </Text>
              </View>
            </View>

            <TextInput style={st.searchInput} placeholder="Buscar nombre..." placeholderTextColor={C.textTertiary}
              value={busquedaNombre[seccionSeleccionada] || ''}
              onChangeText={txt => setBusquedaNombre(prev => ({ ...prev, [seccionSeleccionada!]: txt }))} />

            {(() => {
              const lista = ciudadanosPorSeccion[seccionSeleccionada] || [];
              const filtro = busquedaNombre[seccionSeleccionada] || '';
              const filtrada = lista.filter(c =>
                `${c.nombre} ${c.paterno} ${c.materno}`.toLowerCase().includes(filtro.toLowerCase())
              );
              if (filtrada.length === 0) return <Text style={st.emptyText}>Sin resultados</Text>;
              return filtrada.map((item, i) => (
                <FadeIn key={item.id} delay={i * 40}>
                  <View style={st.citizenCard}>
                    <View style={st.citizenRow}>
                      <View style={[st.avatar, item.visitas > 0 && { backgroundColor: C.success }]}>
                        <Text style={st.avatarText}>
                          {(item.nombre || '?')[0]}{(item.paterno || '?')[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={st.citizenName}>{item.nombre} {item.paterno} {item.materno}</Text>
                          {item.visitas > 0 && (
                            <View style={st.visitedTag}>
                              <Text style={st.visitedTagText}>✓ {item.visitas}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={st.citizenInfo}>{item.calle} #{item.no}, {item.colonia}</Text>
                        {item.cel ? <Text style={st.citizenInfo}>Tel: {item.cel}</Text> : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[st.visitBtn, item.visitas > 0 && { backgroundColor: C.primaryLight, borderColor: C.primary }]}
                      onPress={() => marcarVisita(item.id)} activeOpacity={0.7}>
                      <Text style={[st.visitBtnText, item.visitas > 0 && { color: C.primary }]}>
                        {item.visitas > 0 ? 'Registrar otra visita' : 'Marcar visita'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </FadeIn>
              ));
            })()}
          </>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

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
  gpsBadge: {
    backgroundColor: 'rgba(46,125,50,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  gpsText: { fontSize: 9, fontWeight: '800', color: C.success, letterSpacing: 1 },
  statBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statBadgeNum: { fontSize: 13, fontWeight: '900', color: C.white },
  statBadgeLabel: { fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  logoutBtn: {
    backgroundColor: 'rgba(198,40,40,0.15)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(198,40,40,0.4)',
  },
  logoutText: { color: '#EF5350', fontWeight: '800', fontSize: 11 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  kpiCard: {
    flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  kpiNum: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { fontSize: 9, color: C.textSecondary, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },

  progressCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  progressLabel: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  progressPct: { fontSize: 13, fontWeight: '900', color: C.primary },
  progressTrack: { height: 8, backgroundColor: C.track, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: C.primary, borderRadius: 4 },

  searchInput: {
    backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: C.textPrimary, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 14,
  },

  secCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  secLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  secIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  secIconText: { fontSize: 14, fontWeight: '900', color: C.primary },
  secTitle: { fontSize: 15, fontWeight: '800', color: C.textPrimary },
  secMeta: { fontSize: 11, color: C.textTertiary, fontWeight: '600', marginTop: 2 },
  secPct: { fontSize: 18, fontWeight: '900' },
  secArrow: { fontSize: 22, color: C.textTertiary, marginTop: -4 },

  backBtn: {
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  backBtnText: { color: C.white, fontWeight: '800', fontSize: 13 },

  secDetailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  secDetailTitle: { fontSize: 22, fontWeight: '900', color: C.textPrimary },
  secDetailBadge: {
    backgroundColor: C.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  secDetailBadgeText: { fontSize: 14, fontWeight: '900', color: C.primary },

  citizenCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  citizenRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.white, fontWeight: '900', fontSize: 18 },
  citizenName: { fontSize: 15, fontWeight: '800', color: C.textPrimary },
  citizenInfo: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  visitedTag: { backgroundColor: C.successLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  visitedTagText: { fontSize: 10, fontWeight: '800', color: C.success },
  visitBtn: {
    backgroundColor: C.success, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: C.success,
  },
  visitBtnText: { color: C.white, fontWeight: '800', fontSize: 13 },

  emptyText: { textAlign: 'center', color: C.textTertiary, fontSize: 14, paddingVertical: 40 },
});

export default MovilizadorScreen;
