import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useUser } from '../../../context/UserContext';
import { API_URL, useAuthFetch } from '../../../hooks/useAuthFetch';

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

interface SeccionResumen {
  seccion: string;
  total: number;
  visitados: number;
}

interface Ciudadano {
  id: number; nombre: string; paterno: string; materno: string;
  calle: string; no: string; colonia: string; seccion: string;
  cel: string; visitas: number; ultima_visita: string | null;
}

const VISITA_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos
function getMinutosRestantes(ultimaVisita: string | null): number {
  if (!ultimaVisita) return 0;
  const diff = Date.now() - new Date(ultimaVisita).getTime();
  return diff < VISITA_COOLDOWN_MS ? Math.ceil((VISITA_COOLDOWN_MS - diff) / 60000) : 0;
}

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
  const { user, setUser, setToken, token } = useUser();
  const router = useRouter();
  const authFetch = useAuthFetch();

  // Resumen de secciones (carga inicial, ligera)
  const [secciones, setSecciones] = useState<SeccionResumen[]>([]);
  // Ciudadanos cargados por sección (caché local)
  const [ciudadanosPorSeccion, setCiudadanosPorSeccion] = useState<Record<string, Ciudadano[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSeccion, setLoadingSeccion] = useState<string | null>(null);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [busquedaSeccion, setBusquedaSeccion] = useState('');
  const [busquedaNombre, setBusquedaNombre] = useState<Record<string, string>>({});
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string | null>(null);
  const [modalSeccion, setModalSeccion] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Totales calculados desde los resúmenes de sección
  const totalVisitados = useMemo(() => secciones.reduce((a, s) => a + Number(s.visitados), 0), [secciones]);
  const totalCiudadanos = useMemo(() => secciones.reduce((a, s) => a + Number(s.total), 0), [secciones]);

  // Cargar resumen de secciones (endpoint ligero)
  const fetchSecciones = useCallback(async () => {
    try {
      setErrorMsg(null);
      const res = await authFetch(`${API_URL}/movilizadores/secciones-resumen`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${body?.error || 'Error del servidor'}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) setSecciones(data);
    } catch (err: any) {
      const msg = err.message || 'Error desconocido';
      console.warn('Error al cargar secciones:', msg);
      setErrorMsg(msg);
    }
  }, [authFetch]);

  // Cargar ciudadanos de una sección específica (solo cuando se abre la sección)
  const fetchCiudadanosSeccion = useCallback(async (seccion: string) => {
    setLoadingSeccion(seccion);
    try {
      const res = await authFetch(`${API_URL}/movilizadores/ciudadanos-seccion/${seccion}`);
      if (!res.ok) throw new Error('Error en la respuesta del servidor');
      const data = await res.json();
      if (Array.isArray(data)) {
        // Preservar ultima_visita local si el servidor devuelve null (evita perder el cooldown)
        setCiudadanosPorSeccion(prev => {
          const local = prev[seccion] || [];
          const merged = data.map((c: Ciudadano) => {
            const localC = local.find(l => l.id === c.id);
            return {
              ...c,
              ultima_visita: c.ultima_visita ?? localC?.ultima_visita ?? null,
            };
          });
          return { ...prev, [seccion]: merged };
        });
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo cargar la sección.\n' + (err.message || err));
    }
    setLoadingSeccion(null);
  }, [authFetch]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      await fetchSecciones();
    } finally {
      setLoading(false);
    }
  }, [fetchSecciones]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSecciones();
    // Si hay una sección abierta, recargar sus ciudadanos también
    if (seccionSeleccionada) await fetchCiudadanosSeccion(seccionSeleccionada);
    setRefreshing(false);
  }, [fetchSecciones, fetchCiudadanosSeccion, seccionSeleccionada]);

  const [sendingVisita, setSendingVisita] = useState<Set<number>>(new Set());

  // Marcar visita: actualiza el estado local sin recargar todo
  const marcarVisita = useCallback(async (ciudadanoId: number, seccion: string) => {
    if (sendingVisita.has(ciudadanoId)) return; // evitar doble clic
    setSendingVisita(prev => new Set(prev).add(ciudadanoId));
    try {
      const res = await authFetch(`${API_URL}/movilizadores/visita/${ciudadanoId}`, { method: 'PUT' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'VISITA_RECIENTE') {
          Alert.alert('Visita reciente', `Este ciudadano ya fue visitado. Espera ${body.minutosRestantes} min para registrar otra visita.`);
        } else {
          Alert.alert('Error', body.error || 'No se pudo registrar la visita.');
        }
        return;
      }
      const ahora = new Date().toISOString();
      // Actualizar estado local en lugar de recargar todo
      setCiudadanosPorSeccion(prev => {
        const lista = prev[seccion] || [];
        const ciudadano = lista.find(c => c.id === ciudadanoId);
        const eraNoVisitado = ciudadano?.visitas === 0;
        // Actualizar resumen usando el valor correcto
        setSecciones(s => s.map(sec =>
          sec.seccion === seccion
            ? { ...sec, visitados: sec.visitados + (eraNoVisitado ? 1 : 0) }
            : sec
        ));
        return {
          ...prev,
          [seccion]: lista.map(c => c.id === ciudadanoId ? { ...c, visitas: c.visitas + 1, ultima_visita: ahora } : c),
        };
      });
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo registrar la visita.\n' + (err.message || err));
    } finally {
      setSendingVisita(prev => { const s = new Set(prev); s.delete(ciudadanoId); return s; });
    }
  }, [authFetch, sendingVisita]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
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
          await authFetch(`${API_URL}/movilizadores/ubicacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movilizadorId: user?.id, lat: location.coords.latitude, lng: location.coords.longitude, activo: 1 }),
          });
        } catch (err: any) { console.warn('No se pudo obtener ubicación:', err.message || err); }
        setSendingLocation(false);
      };
      await sendLocation();
      interval = setInterval(sendLocation, 5 * 60 * 1000); // Cada 5 min (ventana de actividad = 12 min)
    };
    if (user) startLocationUpdates();
    return () => { if (interval) clearInterval(interval); };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar cuando user Y token están disponibles (llegan async desde AsyncStorage o login)
  useEffect(() => {
    if (!user || !token) return;
    loadInitial();
    const interval = setInterval(fetchSecciones, 15000);
    return () => clearInterval(interval);
  }, [user?.id, !!token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling: refrescar ciudadanos de la sección abierta cada 30s
  useEffect(() => {
    if (!seccionSeleccionada) return;
    const interval = setInterval(() => fetchCiudadanosSeccion(seccionSeleccionada), 15_000);
    return () => clearInterval(interval);
  }, [seccionSeleccionada, fetchCiudadanosSeccion]);

  const handleLogout = useCallback(async () => {
    try { await fetch(API_URL + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); } catch { }
    setToken(null);
    setUser(null);
    setTimeout(() => router.replace('/Proyect/Login/login'), 250);
  }, [token, setToken, setUser, router]);

  const abrirSeccion = useCallback(async (seccion: string) => {
    setSeccionSeleccionada(seccion);
    setModalSeccion(null);
    // Solo cargar si no está ya en caché
    if (!ciudadanosPorSeccion[seccion]) {
      await fetchCiudadanosSeccion(seccion);
    }
  }, [ciudadanosPorSeccion, fetchCiudadanosSeccion]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={{ color: C.textSecondary, marginTop: 14, fontSize: 14, fontWeight: '600' }}>Cargando ciudadanos...</Text>
    </View>
  );

  const seccionesFiltradas = secciones
    .filter(s => s.seccion.includes(busquedaSeccion.trim()))
    .sort((a, b) => a.seccion.localeCompare(b.seccion));

  return (
    <View style={st.container}>
      {/* MODAL CONFIRMACIÓN SECCIÓN */}
      <Modal
        visible={!!modalSeccion}
        transparent
        
        animationType="fade"
        onRequestClose={() => setModalSeccion(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 28, width: '80%', alignItems: 'center', elevation: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: C.primary }}>Confirmar acceso</Text>
            <Text style={{ fontSize: 15, color: C.textPrimary, textAlign: 'center', marginBottom: 18 }}>
              ¿Estás seguro de ingresar a la sección {modalSeccion}?
             
            </Text>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: C.errorLight, borderWidth: 1, borderColor: C.error }} onPress={() => setModalSeccion(null)}>
                <Text style={{ color: C.error, fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: C.primary }} onPress={() => modalSeccion && abrirSeccion(modalSeccion)}>
                <Text style={{ color: C.white, fontWeight: 'bold' }}>Ingresar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            <Text style={st.statBadgeNum}>{totalVisitados}/{totalCiudadanos}</Text>
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
                <Text style={[st.kpiNum, { color: C.primary }]}>{secciones.length}</Text>
                <Text style={st.kpiLabel}>Secciones</Text>
              </View>
              <View style={[st.kpiCard, { backgroundColor: C.successLight }]}>
                <Text style={[st.kpiNum, { color: C.success }]}>{totalVisitados}</Text>
                <Text style={st.kpiLabel}>Visitados</Text>
              </View>
              <View style={[st.kpiCard, { backgroundColor: C.errorLight }]}>
                <Text style={[st.kpiNum, { color: C.error }]}>{totalCiudadanos - totalVisitados}</Text>
                <Text style={st.kpiLabel}>Pendientes</Text>
              </View>
            </View>

            {/* BARRA PROGRESO */}
            <View style={st.progressCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={st.progressLabel}>Avance de visitas</Text>
                <Text style={st.progressPct}>{totalCiudadanos > 0 ? Math.round((totalVisitados / totalCiudadanos) * 100) : 0}%</Text>
              </View>
              <View style={st.progressTrack}>
                <View style={[st.progressFill, { width: totalCiudadanos > 0 ? `${(totalVisitados / totalCiudadanos) * 100}%` : '0%' }]} />
              </View>
            </View>

            {/* BUSQUEDA */}
            <TextInput style={st.searchInput} placeholder="Buscar sección..." placeholderTextColor={C.textTertiary}
              value={busquedaSeccion} onChangeText={setBusquedaSeccion} />

            {/* LISTA SECCIONES */}
            {errorMsg ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={[st.emptyText, { color: C.error, marginBottom: 12 }]}>⚠️ {errorMsg}</Text>
                <TouchableOpacity onPress={loadInitial} style={{ backgroundColor: C.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}>
                  <Text style={{ color: C.white, fontWeight: '800', fontSize: 13 }}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : seccionesFiltradas.length === 0 ? (
              <Text style={st.emptyText}>No hay ciudadanos asignados</Text>
            ) : (
              seccionesFiltradas.map((s, i) => {
                const pct = s.total > 0 ? Math.round((Number(s.visitados) / Number(s.total)) * 100) : 0;
                return (
                  <FadeIn key={s.seccion} delay={i * 60}>
                    <TouchableOpacity style={st.secCard} onPress={() => setModalSeccion(s.seccion)} activeOpacity={0.7}>
                      <View style={st.secLeft}>
                        <View style={st.secIcon}>
                          <Text style={st.secIconText}>{s.seccion}</Text>
                        </View>
                        <View>
                          <Text style={st.secTitle}>Sección {s.seccion}</Text>
                          <Text style={st.secMeta}>{s.total} ciudadanos • {s.visitados} visitados</Text>
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

            {(() => {
              const resumen = secciones.find(s => s.seccion === seccionSeleccionada);
              const lista = ciudadanosPorSeccion[seccionSeleccionada] || [];
              const visitadosLocal = lista.filter(c => c.visitas > 0).length;
              return (
                <View style={st.secDetailHeader}>
                  <Text style={st.secDetailTitle}>Sección {seccionSeleccionada}</Text>
                  <View style={st.secDetailBadge}>
                    <Text style={st.secDetailBadgeText}>
                      {loadingSeccion === seccionSeleccionada ? '...' : `${visitadosLocal}/${resumen?.total ?? lista.length}`}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {loadingSeccion === seccionSeleccionada ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={{ color: C.textSecondary, marginTop: 12, fontWeight: '600' }}>Cargando ciudadanos...</Text>
              </View>
            ) : (
              <>
                <TextInput style={st.searchInput} placeholder="Buscar nombre..." placeholderTextColor={C.textTertiary}
                  value={busquedaNombre[seccionSeleccionada] || ''}
                  onChangeText={txt => setBusquedaNombre(prev => ({ ...prev, [seccionSeleccionada!]: txt }))} />

                {(() => {
                  const lista = ciudadanosPorSeccion[seccionSeleccionada] || [];
                  const filtro = busquedaNombre[seccionSeleccionada] || '';
                  const filtrada = filtro
                    ? lista.filter(c => `${c.nombre} ${c.paterno} ${c.materno}`.toLowerCase().includes(filtro.toLowerCase()))
                    : lista;
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
                          style={[st.visitBtn,
                            item.visitas > 0 && { backgroundColor: C.primaryLight, borderColor: C.primary },
                            (sendingVisita.has(item.id) || getMinutosRestantes(item.ultima_visita) > 0) && { opacity: 0.5 }
                          ]}
                          onPress={() => marcarVisita(item.id, seccionSeleccionada!)}
                          disabled={sendingVisita.has(item.id) || getMinutosRestantes(item.ultima_visita) > 0}
                          activeOpacity={0.7}>
                          <Text style={[st.visitBtnText, item.visitas > 0 && { color: C.primary }]}>
                            {getMinutosRestantes(item.ultima_visita) > 0
                              ? `Espera ${getMinutosRestantes(item.ultima_visita)} min`
                              : item.visitas > 0 ? 'Registrar otra visita' : 'Marcar visita'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </FadeIn>
                  ));
                })()}
              </>
            )}
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
