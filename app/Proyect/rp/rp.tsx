import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useUser } from '../../../context/UserContext';
import { API_URL, useAuthFetch } from '../../../hooks/useAuthFetch';
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_PAD = 16;

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
  warning: '#EF6C00',
  warningLight: '#FFF3E0',
  error: '#C62828',
  errorLight: '#FFEBEE',
  purple: '#7B1FA2',
  purpleLight: '#F3E5F5',
  cyan: '#00838F',
  cyanLight: '#E0F7FA',
  track: '#E2E8F0',
};

interface Movilizador {
  id: number; nombre: string; cuenta_activa: number;
  lat: number | null; lng: number | null; ultima_ubicacion: string | null;
  estado: 'activo' | 'inactivo' | 'sin_conexion';
  total_visitas: number; ciudadanos_visitados: number; ciudadanos_asignados: number;
}
interface EstadisticaVotos { seccion: string; total: number; votaron: number; pendientes: number; }
interface CiudadanoDetalle { id: number; nombre: string; paterno: string; materno: string; seccion: string; visitas: number; status_voto: string; }

/* ---------- COMPONENTES GRAFICOS PROFESIONALES ---------- */

const AnimatedBar = React.memo(({ pct, color, height = 8, delay = 0 }: { pct: number; color: string; height?: number; delay?: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: Math.min(pct, 100), duration: 900, delay, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ height, backgroundColor: C.track, borderRadius: height / 2, overflow: 'hidden' }}>
      <Animated.View style={{
        height, borderRadius: height / 2, backgroundColor: color,
        width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
      }} />
    </View>
  );
});

const RingChart = React.memo(({ segments, size = 120, thickness = 10 }: {
  segments: { value: number; color: string; label: string }[]; size?: number; thickness?: number;
}) => {
  const total = segments.reduce((a, seg) => a + seg.value, 0);
  const inner = size - thickness * 2 - 4;
  let cumDeg = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: C.track }} />
        {total > 0 && segments.map((seg, i) => {
          const pct = seg.value / total;
          const deg = pct * 360;
          const startDeg = cumDeg;
          cumDeg += deg;
          if (seg.value === 0) return null;
          return (
            <View key={i} style={{
              position: 'absolute', width: size, height: size, borderRadius: size / 2,
              borderWidth: thickness, borderColor: 'transparent',
              borderTopColor: seg.color,
              borderRightColor: deg > 90 ? seg.color : 'transparent',
              borderBottomColor: deg > 180 ? seg.color : 'transparent',
              borderLeftColor: deg > 270 ? seg.color : 'transparent',
              transform: [{ rotate: startDeg - 90 + 'deg' }], opacity: 0.9,
            }} />
          );
        })}
        <View style={{
          width: inner, height: inner, borderRadius: inner / 2,
          backgroundColor: C.white, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: C.textPrimary }}>{total}</Text>
          <Text style={{ fontSize: 9, color: C.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Total</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 14, gap: 16 }}>
        {segments.map((seg, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color }} />
            <Text style={{ fontSize: 11, color: C.textSecondary, fontWeight: '600' }}>{seg.label} ({seg.value})</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const SemiGauge = React.memo(({ value, total, color, label, icon }: {
  value: number; total: number; color: string; label: string; icon: string;
}) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: pct, duration: 1000, useNativeDriver: false }).start(); }, [pct]);
  const SIZE = 90;
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: SIZE, height: SIZE / 2 + 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{
          width: SIZE, height: SIZE, borderRadius: SIZE / 2,
          borderWidth: 8, borderColor: C.track,
          borderBottomColor: 'transparent', borderRightColor: 'transparent',
          transform: [{ rotate: '-45deg' }], position: 'absolute', top: 0,
        }} />
        <Animated.View style={{
          width: SIZE, height: SIZE, borderRadius: SIZE / 2,
          borderWidth: 8, borderColor: color,
          borderBottomColor: 'transparent', borderRightColor: 'transparent',
          position: 'absolute', top: 0,
          opacity: anim.interpolate({ inputRange: [0, 100], outputRange: [0.1, 1] }),
          transform: [{ rotate: '-45deg' }],
        }} />
        <Text style={{ fontSize: 10, marginBottom: 2 }}>{icon}</Text>
      </View>
      <Text style={{ fontSize: 20, fontWeight: '900', color, marginTop: -2 }}>{pct}%</Text>
      <Text style={{ fontSize: 10, color: C.textSecondary, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 11, color: C.textTertiary, fontWeight: '600', marginTop: 1 }}>{value}/{total}</Text>
    </View>
  );
});

const HBarChart = React.memo(({ data }: {
  data: { label: string; value: number; total: number; color: string }[];
}) => (
  <View style={{ gap: 10 }}>
    {data.map((d, i) => {
      const pct = d.total > 0 ? (d.value / d.total) * 100 : 0;
      const pctReal = Math.round(pct);
      return (
        <View key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.textPrimary }}>{d.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: d.color }}>{d.value}/{d.total} ({pctReal}%)</Text>
          </View>
          <AnimatedBar pct={pct} color={d.color} height={10} delay={i * 80} />
        </View>
      );
    })}
  </View>
));

const KPICard = React.memo(({ num, label, accent, icon, sub, bgTint }: {
  num: number | string; label: string; accent: string; icon: string; sub?: string; bgTint?: string;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  useEffect(() => { Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[st.kpiCard, bgTint ? { backgroundColor: bgTint } : {}, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[st.kpiAccent, { backgroundColor: accent }]} />
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[st.kpiNum, { color: accent }]}>{num}</Text>
      <Text style={st.kpiLabel}>{label}</Text>
      {sub ? <Text style={st.kpiSub}>{sub}</Text> : null}
    </Animated.View>
  );
});

const StatusBadge = React.memo(({ estado }: { estado: string }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (estado === 'activo') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [estado]);
  const map: Record<string, { bg: string; fg: string; text: string }> = {
    activo: { bg: C.successLight, fg: C.success, text: 'Activo' },
    inactivo: { bg: C.warningLight, fg: C.warning, text: 'Inactivo' },
    sin_conexion: { bg: C.errorLight, fg: C.error, text: 'Sin conexión' },
  };
  const m = map[estado] || map.sin_conexion;
  return (
    <Animated.View style={{ backgroundColor: m.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, opacity: estado === 'activo' ? pulseAnim : 1 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: m.fg, letterSpacing: 0.4 }}>{m.text}</Text>
    </Animated.View>
  );
});

const SparkBars = React.memo(({ values, color, height = 32 }: { values: number[]; color: string; height?: number }) => {
  const maxV = Math.max(...values, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
      {values.map((v, i) => (
        <View key={i} style={{
          flex: 1, backgroundColor: color, borderRadius: 2,
          height: Math.max((v / maxV) * height, 2),
          opacity: 0.4 + (v / maxV) * 0.6,
        }} />
      ))}
    </View>
  );
});

/* ---------- PANTALLA PRINCIPAL ---------- */

export default function RPScreen() {
  const { user, setUser, setToken, token } = useUser();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [movilizadores, setMovilizadores] = useState<Movilizador[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticaVotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busquedaMov, setBusquedaMov] = useState('');
  const [busquedaSec, setBusquedaSec] = useState('');
  const [tabActivo, setTabActivo] = useState<'todos' | 'activo' | 'inactivo' | 'sin_conexion'>('todos');
  const [expandedMov, setExpandedMov] = useState<number | null>(null);
  const [ciudadanosMov, setCiudadanosMov] = useState<Record<number, CiudadanoDetalle[]>>({});
  const [loadingCiudadanos, setLoadingCiudadanos] = useState<number | null>(null);
  const [vista, setVista] = useState<'resumen' | 'movilizadores'>('resumen');

  const fetchData = useCallback(async () => {
    try {
      const [movRes, votosRes] = await Promise.all([
        authFetch(API_URL + '/movilizadores/estado'),
        authFetch(API_URL + '/ciudadanos/estadisticas/votos'),
      ]);
      const movData = await movRes.json();
      const votosData = await votosRes.json();
      if (Array.isArray(movData)) setMovilizadores(movData);
      if (Array.isArray(votosData)) setEstadisticas(votosData);
    } catch (err) { console.warn('Error al cargar datos RG:', err); }
  }, [authFetch]);

  const loadInitial = useCallback(async () => { setLoading(true); await fetchData(); setLoading(false); }, [fetchData]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, [fetchData]);

  const toggleCiudadanos = useCallback(async (movId: number) => {
    if (expandedMov === movId) { setExpandedMov(null); return; }
    setExpandedMov(movId);
    if (ciudadanosMov[movId]) return;
    setLoadingCiudadanos(movId);
    try {
      const res = await authFetch(API_URL + '/movilizadores/detalle-ciudadanos/' + movId);
      const data = await res.json();
      if (Array.isArray(data)) setCiudadanosMov(prev => ({ ...prev, [movId]: data }));
    } catch (err) { console.warn('Error al cargar ciudadanos:', err); }
    setLoadingCiudadanos(null);
  }, [expandedMov, ciudadanosMov, authFetch]);

  // Ref para evitar stale closure en el intervalo de polling
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    loadInitial();
    const interval = setInterval(() => fetchDataRef.current(), 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = useCallback(async () => {
    try { await fetch(API_URL + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); } catch { }
    setToken(null);
    setUser(null);
    setTimeout(() => router.replace('/Proyect/Login/login'), 250);
  }, [token]);

  const stats = useMemo(() => {
    const activos = movilizadores.filter(m => m.estado === 'activo').length;
    const inactivos = movilizadores.filter(m => m.estado === 'inactivo').length;
    const sinConexion = movilizadores.filter(m => m.estado === 'sin_conexion').length;
    const totalMov = movilizadores.length;
    const totalVotaron = estadisticas.reduce((a, e) => a + Number(e.votaron), 0);
    const totalGeneral = estadisticas.reduce((a, e) => a + Number(e.total), 0);
    const totalVisitas = movilizadores.reduce((a, m) => a + Number(m.total_visitas), 0);
    const totalVisitados = movilizadores.reduce((a, m) => a + Number(m.ciudadanos_visitados), 0);
    const totalAsignados = movilizadores.reduce((a, m) => a + Number(m.ciudadanos_asignados), 0);
    const maxVisitas = Math.max(...movilizadores.map(m => Number(m.total_visitas)), 1);
    return { activos, inactivos, sinConexion, totalMov, totalVotaron, totalGeneral, totalVisitas, totalVisitados, totalAsignados, maxVisitas };
  }, [movilizadores, estadisticas]);

  const movFiltrados = useMemo(() =>
    movilizadores.filter(m => tabActivo === 'todos' || m.estado === tabActivo).filter(m => m.nombre.toLowerCase().includes(busquedaMov.toLowerCase())),
    [movilizadores, tabActivo, busquedaMov]);

  const secFiltradas = useMemo(() => estadisticas.filter(e => e.seccion.includes(busquedaSec.trim())), [estadisticas, busquedaSec]);

  const secBarData = useMemo(() => {
    const maxT = Math.max(...estadisticas.map(e => Number(e.total)), 1);
    return secFiltradas.map(e => {
      const v = Number(e.votaron), t = Number(e.total);
      const pct = t > 0 ? (v / t) * 100 : 0;
      return { label: 'Sección ' + e.seccion, value: v, total: t, color: pct >= 70 ? C.success : pct >= 40 ? C.warning : C.error };
    });
  }, [secFiltradas, estadisticas]);

  const sparkVisitas = useMemo(() => movilizadores.map(m => Number(m.total_visitas)), [movilizadores]);

  const formatTime = (ts: string | null) => {
    if (!ts) return '--:--';
    return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };
  const pctColor = (p: number) => p >= 70 ? C.success : p >= 40 ? C.warning : C.error;

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={{ color: C.textSecondary, marginTop: 14, fontSize: 14, fontWeight: '600' }}>Cargando centro de control...</Text>
    </View>
  );

  return (
    <View style={st.container}>
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Centro de Control</Text>
          <Text style={st.headerSub}>{user?.nombre} — RG</Text>
        </View>
        <View style={st.headerRight}>
          <TouchableOpacity style={st.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={st.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={st.miniMenu}>
        {([['resumen', 'Resumen General'], ['movilizadores', 'Movilizadores']] as const).map(([key, lbl]) => (
          <TouchableOpacity key={key} style={[st.miniTab, vista === key && st.miniTabActive]} onPress={() => setVista(key)} activeOpacity={0.7}>
            <Text style={[st.miniTabText, vista === key && st.miniTabTextActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}>

        {vista === 'resumen' ? (<>
          <View style={st.kpiRow}>
            <KPICard num={stats.totalMov} label="Movilizadores" accent={C.primary} icon="👥" bgTint={C.primaryLight} sub={stats.activos + ' en línea'} />
            <KPICard num={stats.totalVisitas} label="Visitas" accent={C.purple} icon="🏠" bgTint={C.purpleLight} sub={stats.totalVisitados + ' hogares'} />
          </View>
          <View style={st.kpiRow}>
            <KPICard num={stats.totalGeneral} label="Ciudadanos" accent={C.cyan} icon="📋" bgTint={C.cyanLight} sub={estadisticas.length + ' secciones'} />
            <KPICard num={stats.totalVotaron} label="Votaron" accent={C.success} icon="✅" bgTint={C.successLight} sub={(stats.totalGeneral > 0 ? Math.round((stats.totalVotaron / stats.totalGeneral) * 100) : 0) + '% del padrón'} />
          </View>

          <View style={[st.card, { backgroundColor: '#FFFDE7' }]}>
            <Text style={st.cardTitle}>Indicadores de Avance</Text>
            <View style={{ flexDirection: 'row', paddingTop: 8, paddingBottom: 4 }}>
              <SemiGauge value={stats.totalVotaron} total={stats.totalGeneral} color={C.primary} label="Votación" icon="🗳" />
              <SemiGauge value={stats.activos} total={stats.totalMov} color={C.success} label="Conectados" icon="📡" />
              <SemiGauge value={stats.totalVisitados} total={stats.totalAsignados} color={C.purple} label="Visitados" icon="🏠" />
            </View>
          </View>

          <View style={[st.card, { backgroundColor: C.purpleLight }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={st.cardTitle}>Monitor de Conexión</Text>
              <View style={st.liveIndicator}>
                <View style={st.liveDot} />
                <Text style={st.liveText}>TIEMPO REAL</Text>
              </View>
            </View>
            <RingChart size={130} thickness={12} segments={[
              { value: stats.activos, color: C.success, label: 'Activos' },
              { value: stats.inactivos, color: C.warning, label: 'Inactivos' },
              { value: stats.sinConexion, color: C.error, label: 'Sin conexión' },
            ]} />
            <View style={{ marginTop: 16 }}>
              <View style={st.distBar}>
                {stats.activos > 0 && <View style={[st.distSeg, { flex: stats.activos, backgroundColor: C.success }]} />}
                {stats.inactivos > 0 && <View style={[st.distSeg, { flex: stats.inactivos, backgroundColor: C.warning }]} />}
                {stats.sinConexion > 0 && <View style={[st.distSeg, { flex: stats.sinConexion, backgroundColor: C.error }]} />}
                {stats.totalMov === 0 && <View style={[st.distSeg, { flex: 1, backgroundColor: C.track }]} />}
              </View>
            </View>
          </View>

          {/* Gráfica de Actividad de Visitas por Movilizador eliminada */}

          <View style={[st.card, { backgroundColor: '#E0F2F1' }]}>
            <Text style={st.cardTitle}>Avance Electoral por Sección</Text>
            <TextInput style={st.searchInput} placeholder="Buscar sección..." placeholderTextColor={C.textTertiary} value={busquedaSec} onChangeText={setBusquedaSec} />
            {secBarData.length === 0 ? (
              <Text style={st.emptyText}>Sin datos</Text>
            ) : (
              <HBarChart data={secBarData} />
            )}
            <View style={[st.tableHead, { marginTop: 16 }]}>
              <Text style={[st.thCell, { flex: 1.2 }]}>Sección</Text>
              <Text style={[st.thCell, { flex: 1 }]}>Votaron</Text>
              <Text style={[st.thCell, { flex: 1 }]}>Pend.</Text>
              <Text style={[st.thCell, { flex: 0.8, textAlign: 'right' }]}>%</Text>
            </View>
            {secFiltradas.map((e, i) => {
              const v = Number(e.votaron), p = Number(e.pendientes), t = Number(e.total);
              const pct = t > 0 ? Math.round((v / t) * 100) : 0;
              return (
                <View key={e.seccion} style={[st.tRow, i % 2 === 0 && { backgroundColor: '#F0FAF8' }]}>
                  <Text style={[st.tCell, { flex: 1.2, fontWeight: '700' }]}>SEC {e.seccion}</Text>
                  <Text style={[st.tCell, { flex: 1, color: C.success }]}>{v}</Text>
                  <Text style={[st.tCell, { flex: 1, color: C.error }]}>{p}</Text>
                  <Text style={[st.tCell, { flex: 0.8, textAlign: 'right', fontWeight: '800', color: pctColor(pct) }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </>) : (<>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={[st.miniStat, { borderLeftColor: C.success }]}>
              <Text style={st.miniStatNum}>{stats.activos}</Text>
              <Text style={st.miniStatLabel}>Activos</Text>
            </View>
            <View style={[st.miniStat, { borderLeftColor: C.warning }]}>
              <Text style={st.miniStatNum}>{stats.inactivos}</Text>
              <Text style={st.miniStatLabel}>Inactivos</Text>
            </View>
            <View style={[st.miniStat, { borderLeftColor: C.error }]}>
              <Text style={st.miniStatNum}>{stats.sinConexion}</Text>
              <Text style={st.miniStatLabel}>Sin señal</Text>
            </View>
          </View>

          <View style={st.card}>
            <Text style={st.cardTitle}>Detalle de Movilizadores</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {([['todos', 'Todos', C.primary], ['activo', 'Activos', C.success], ['inactivo', 'Inactivos', C.warning], ['sin_conexion', 'Sin conexión', C.error]] as const).map(([key, lbl, clr]) => (
                <TouchableOpacity key={key} onPress={() => setTabActivo(key)}
                  style={[st.tab, tabActivo === key && { backgroundColor: clr, borderColor: clr }]} activeOpacity={0.7}>
                  <Text style={[st.tabText, tabActivo === key && { color: C.white }]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput style={st.searchInput} placeholder="Buscar por nombre..." placeholderTextColor={C.textTertiary} value={busquedaMov} onChangeText={setBusquedaMov} />
            {movFiltrados.length === 0 ? (
              <Text style={st.emptyText}>Sin resultados</Text>
            ) : (
              movFiltrados.map(m => {
                const vis = Number(m.total_visitas);
                const visitados = Number(m.ciudadanos_visitados);
                const asignados = Number(m.ciudadanos_asignados);
                const visPct = asignados > 0 ? Math.round((visitados / asignados) * 100) : 0;
                const isExpanded = expandedMov === m.id;
                const ciudadanos = ciudadanosMov[m.id] || [];
                const porSeccion: Record<string, CiudadanoDetalle[]> = {};
                ciudadanos.forEach(c => {
                  if (!porSeccion[c.seccion]) porSeccion[c.seccion] = [];
                  porSeccion[c.seccion].push(c);
                });
                return (
                  <View key={m.id} style={st.movCard}>
                    <View style={st.movHeader}>
                      <View style={st.movAvatar}>
                        <Text style={st.movAvatarText}>{(m.nombre || 'M')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={st.movName}>{m.nombre}</Text>
                          <StatusBadge estado={m.estado} />
                        </View>
                        <Text style={st.movMeta}>
                          Señal: {formatTime(m.ultima_ubicacion)}
                          {m.lat != null && m.lng != null && '  |  ' + Number(m.lat).toFixed(4) + ', ' + Number(m.lng).toFixed(4)}
                        </Text>
                      </View>
                    </View>
                    <View style={st.movStatsRow}>
                      <View style={st.movStatBox}>
                        <Text style={st.movStatVal}>{vis}</Text>
                        <Text style={st.movStatLbl}>Visitas</Text>
                      </View>
                      <View style={[st.movStatBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.cardBorder }]}> 
                        <Text style={st.movStatVal}>{visitados}/{asignados}</Text>
                        <Text style={st.movStatLbl}>Visitados</Text>
                      </View>
                      <View style={st.movStatBox}>
                        <Text style={[st.movStatVal, { color: pctColor(visPct) }]}>{visPct}%</Text>
                        <Text style={st.movStatLbl}>Cobertura</Text>
                      </View>
                    </View>
                    <AnimatedBar pct={(vis / stats.maxVisitas) * 100} color={C.purple} height={6} />
                    {/* Botón y panel de ciudadanos eliminados */}
                  </View>
                );
              })
            )}
          </View>
        </>)}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

/* ---------- ESTILOS CORPORATIVOS ---------- */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.navy, paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: 0.5 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(46,125,50,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  liveText: { fontSize: 9, fontWeight: '800', color: C.success, letterSpacing: 1 },
  logoutBtn: {
    backgroundColor: 'rgba(198,40,40,0.15)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(198,40,40,0.4)',
  },
  logoutText: { color: '#EF5350', fontWeight: '800', fontSize: 12 },
  miniMenu: {
    flexDirection: 'row', backgroundColor: C.navyLight, paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 14, gap: 8,
  },
  miniTab: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  miniTabActive: { backgroundColor: C.primary, borderColor: C.primary },
  miniTabText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  miniTabTextActive: { color: C.white },
  scroll: { paddingHorizontal: CARD_PAD, paddingTop: 16, paddingBottom: 40 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14,
    alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: C.cardBorder,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  kpiAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  kpiNum: { fontSize: 28, fontWeight: '900', marginTop: 6 },
  kpiLabel: { fontSize: 9, color: C.textSecondary, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  kpiSub: { fontSize: 10, color: C.textSecondary, fontWeight: '600', marginTop: 2 },
  card: {
    backgroundColor: C.white, borderRadius: 18, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.textPrimary, marginBottom: 14, letterSpacing: 0.3 },
  distBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: C.track },
  distSeg: { height: 10 },
  miniStat: {
    flex: 1, backgroundColor: C.white, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10,
    alignItems: 'center', borderLeftWidth: 4, borderWidth: 1, borderColor: C.cardBorder,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  miniStatNum: { fontSize: 22, fontWeight: '900', color: C.textPrimary },
  miniStatLabel: { fontSize: 9, color: C.textTertiary, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  tab: {
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 16, marginRight: 8,
    backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: C.cardBorder,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: C.textTertiary },
  searchInput: {
    backgroundColor: '#F5F7FA', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: C.textPrimary, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 12,
  },
  emptyText: { textAlign: 'center', color: C.textTertiary, fontSize: 13, paddingVertical: 24 },
  movCard: {
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  movHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  movAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  movAvatarText: { fontSize: 18, fontWeight: '800', color: C.primary },
  movName: { fontSize: 15, fontWeight: '800', color: C.textPrimary },
  movMeta: { fontSize: 11, color: C.textTertiary, marginTop: 3 },
  movStatsRow: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, paddingVertical: 10, marginBottom: 10 },
  movStatBox: { flex: 1, alignItems: 'center' },
  movStatVal: { fontSize: 16, fontWeight: '900', color: C.textPrimary },
  movStatLbl: { fontSize: 9, color: C.textTertiary, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  expandBtn: {
    marginTop: 10, borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.cardBorder,
  },
  expandText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
  ciudPanel: {
    marginTop: 12, backgroundColor: C.bg, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  secGroup: { marginBottom: 14 },
  secHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.cardBorder, marginBottom: 8,
  },
  secTitle: { fontSize: 12, fontWeight: '800', color: C.textPrimary },
  secCount: { fontSize: 10, color: C.textTertiary, fontWeight: '600' },
  cRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.white },
  cDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  cName: { fontSize: 12, fontWeight: '700', color: C.textPrimary },
  cTag: { fontSize: 10, fontWeight: '600' },
  tableHead: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: C.navy, borderRadius: 8, marginBottom: 2,
  },
  thCell: { fontSize: 10, fontWeight: '800', color: C.white, textTransform: 'uppercase', letterSpacing: 0.8 },
  tRow: { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 10, borderRadius: 4 },
  tCell: { fontSize: 12, color: C.textPrimary, fontWeight: '600' },
});


