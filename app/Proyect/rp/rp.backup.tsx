
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080/api' : 'http://localhost:8080/api';
const { width: SCREEN_W } = Dimensions.get('window');

interface Movilizador {
	id: number;
	nombre: string;
	cuenta_activa: number;
	lat: number | null;
	lng: number | null;
	ultima_ubicacion: string | null;
	estado: 'activo' | 'inactivo' | 'sin_conexion';
	total_visitas: number;
	ciudadanos_visitados: number;
	ciudadanos_asignados: number;
}

interface EstadisticaVotos {
	seccion: string;
	total: number;
	votaron: number;
	pendientes: number;
}

interface CiudadanoDetalle {
	id: number;
	nombre: string;
	paterno: string;
	materno: string;
	seccion: string;
	visitas: number;
	status_voto: string;
}

/* ───── Componentes reutilizables ───── */

const AnimatedBar = ({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) => {
	const anim = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		Animated.timing(anim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
	}, [pct]);
	return (
		<View style={{ height, backgroundColor: '#e9ecf2', borderRadius: height / 2, overflow: 'hidden' }}>
			<Animated.View style={{
				height, borderRadius: height / 2, backgroundColor: color,
				width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
			}} />
		</View>
	);
};

const CircleGauge = ({ value, total, color, size = 100, label, sublabel }: {
	value: number; total: number; color: string; size?: number; label: string; sublabel?: string;
}) => {
	const pct = total > 0 ? Math.round((value / total) * 100) : 0;
	const ring = 7;
	const inner = size - ring * 2 - 6;
	return (
		<View style={{ alignItems: 'center' }}>
			<View style={{
				width: size, height: size, borderRadius: size / 2,
				borderWidth: ring, borderColor: `${color}22`,
				alignItems: 'center', justifyContent: 'center',
			}}>
				{/* Filled arc simulation — full ring colored proportionally */}
				<View style={{
					position: 'absolute', width: size, height: size, borderRadius: size / 2,
					borderWidth: ring, borderColor: color,
					// clip to percentage via opacity trick—simple but effective
					opacity: pct / 100 || 0.04,
				}} />
				<View style={{
					width: inner, height: inner, borderRadius: inner / 2,
					backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
				}}>
					<Text style={{ fontSize: 22, fontWeight: '800', color }}>{pct}%</Text>
				</View>
			</View>
			<Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1f36', marginTop: 8 }}>{label}</Text>
			{sublabel && <Text style={{ fontSize: 11, color: '#8892a4', marginTop: 1 }}>{sublabel}</Text>}
		</View>
	);
};

const KPI = ({ num, label, color, icon }: { num: number | string; label: string; color: string; icon: string }) => (
	<View style={s.kpiCard}>
		<Text style={{ fontSize: 22 }}>{icon}</Text>
		<Text style={[s.kpiNum, { color }]}>{num}</Text>
		<Text style={s.kpiLabel}>{label}</Text>
	</View>
);

const StatusBadge = ({ estado }: { estado: string }) => {
	const map: Record<string, { bg: string; fg: string; text: string }> = {
		activo: { bg: '#e8f5e9', fg: '#2e7d32', text: 'Activo' },
		inactivo: { bg: '#fff3e0', fg: '#e65100', text: 'Inactivo' },
		sin_conexion: { bg: '#ffebee', fg: '#c62828', text: 'Sin conexión' },
	};
	const m = map[estado] || map.sin_conexion;
	return (
		<View style={{ backgroundColor: m.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
			<Text style={{ fontSize: 11, fontWeight: '700', color: m.fg, letterSpacing: 0.3 }}>{m.text}</Text>
		</View>
	);
};

/* ───── Pantalla principal ───── */

export default function RPScreen() {
	const { user, setUser } = useUser();
	const router = useRouter();
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
	const [vista, setVista] = useState<'dashboard' | 'movilizadores'>('dashboard');

	const fetchData = async () => {
		try {
			const [movRes, votosRes] = await Promise.all([
				fetch(`${API_URL}/movilizadores/estado`),
				fetch(`${API_URL}/ciudadanos/estadisticas/votos`),
			]);
			const movData = await movRes.json();
			const votosData = await votosRes.json();
			if (Array.isArray(movData)) setMovilizadores(movData);
			if (Array.isArray(votosData)) setEstadisticas(votosData);
		} catch (err) {
			console.warn('Error al cargar datos :', err);
		}
	};

	const loadInitial = async () => { setLoading(true); await fetchData(); setLoading(false); };
	const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

	const toggleCiudadanos = async (movId: number) => {
		if (expandedMov === movId) {
			setExpandedMov(null);
			return;
		}
		setExpandedMov(movId);
		if (ciudadanosMov[movId]) return; // ya cargados
		setLoadingCiudadanos(movId);
		try {
			const res = await fetch(`${API_URL}/movilizadores/detalle-ciudadanos/${movId}`);
			const data = await res.json();
			if (Array.isArray(data)) {
				setCiudadanosMov(prev => ({ ...prev, [movId]: data }));
			}
		} catch (err) {
			console.warn('Error al cargar ciudadanos:', err);
		}
		setLoadingCiudadanos(null);
	};

	useEffect(() => {
		loadInitial();
		const interval = setInterval(fetchData, 30000);
		return () => clearInterval(interval);
	}, []);

	const handleLogout = () => {
		setUser(null);
		setTimeout(() => router.replace('/Proyect/Login/login'), 250);
	};

	if (loading) return (
		<View style={{ flex: 1, backgroundColor: '#0f1729', justifyContent: 'center', alignItems: 'center' }}>
			<ActivityIndicator size="large" color="#6c8cff" />
			<Text style={{ color: '#8892a4', marginTop: 12, fontSize: 14 }}>Cargando panel...</Text>
		</View>
	);

	// ── Cálculos ──
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

	// Filtros
	const movFiltrados = movilizadores
		.filter(m => tabActivo === 'todos' || m.estado === tabActivo)
		.filter(m => m.nombre.toLowerCase().includes(busquedaMov.toLowerCase()));
	const secFiltradas = estadisticas.filter(e => e.seccion.includes(busquedaSec.trim()));

	const formatTime = (ts: string | null) => {
		if (!ts) return '--:--';
		return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
	};

	const pctColor = (p: number) => p >= 70 ? '#2e7d32' : p >= 40 ? '#e65100' : '#c62828';

	return (
		<View style={s.container}>
			{/* ── Header ── */}
			<View style={s.header}>
				<View>
					<Text style={s.headerTitle}>Panel de Supervisión</Text>
					<Text style={s.headerSub}>Bienvenido, {user?.nombre}</Text>
				</View>
				<TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
					<Text style={s.logoutText}>Salir</Text>
				</TouchableOpacity>
			</View>

			{/* ── Mini Menú ── */}
			<View style={s.miniMenu}>
				<TouchableOpacity
					style={[s.miniTab, vista === 'dashboard' && s.miniTabActive]}
					onPress={() => setVista('dashboard')}
					activeOpacity={0.8}
				>
					<Text style={[s.miniTabText, vista === 'dashboard' && s.miniTabTextActive]}>📊 Dashboard</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[s.miniTab, vista === 'movilizadores' && s.miniTabActive]}
					onPress={() => setVista('movilizadores')}
					activeOpacity={0.8}
				>
					<Text style={[s.miniTabText, vista === 'movilizadores' && s.miniTabTextActive]}>👥 Movilizadores</Text>
				</TouchableOpacity>
			</View>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={s.scroll}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c8cff" />}
				showsVerticalScrollIndicator={false}
			>
			{vista === 'dashboard' ? (
			<>
				{/* ── KPIs ── */}
				<View style={s.kpiRow}>
					<KPI num={totalMov} label="Movilizadores" color="#6c8cff" icon="👥" />
					<KPI num={totalVisitas} label="Visitas" color="#7c4dff" icon="🚶" />
					<KPI num={totalGeneral} label="Ciudadanos" color="#1976d2" icon="📋" />
					<KPI num={totalVotaron} label="Votaron" color="#2e7d32" icon="✅" />
				</View>

				{/* ── Gauges ── */}
				<View style={s.card}>
					<Text style={s.cardTitle}>Indicadores Clave</Text>
					<View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 }}>
						<CircleGauge value={totalVotaron} total={totalGeneral} color="#1976d2" label="Votación" sublabel={`${totalVotaron}/${totalGeneral}`} />
						<CircleGauge value={activos} total={totalMov} color="#2e7d32" label="Conectados" sublabel={`${activos}/${totalMov}`} />
						<CircleGauge value={totalVisitados} total={totalAsignados} color="#7c4dff" label="Visitados" sublabel={`${totalVisitados}/${totalAsignados}`} />
					</View>
				</View>

				{/* ── Monitor de Conexión ── */}
				<View style={s.card}>
					<Text style={s.cardTitle}>Monitor de Conexión en Tiempo Real</Text>
					<View style={s.monitorGrid}>
						<View style={[s.monitorBox, { borderColor: '#2e7d32' }]}>
							<View style={[s.monitorDot, { backgroundColor: '#2e7d32' }]} />
							<Text style={s.monitorNum}>{activos}</Text>
							<Text style={s.monitorLabel}>Activos</Text>
							<Text style={s.monitorPct}>{totalMov > 0 ? ((activos / totalMov) * 100).toFixed(0) : 0}%</Text>
						</View>
						<View style={[s.monitorBox, { borderColor: '#e65100' }]}>
							<View style={[s.monitorDot, { backgroundColor: '#e65100' }]} />
							<Text style={s.monitorNum}>{inactivos}</Text>
							<Text style={s.monitorLabel}>Inactivos</Text>
							<Text style={s.monitorPct}>{totalMov > 0 ? ((inactivos / totalMov) * 100).toFixed(0) : 0}%</Text>
						</View>
						<View style={[s.monitorBox, { borderColor: '#c62828' }]}>
							<View style={[s.monitorDot, { backgroundColor: '#c62828' }]} />
							<Text style={s.monitorNum}>{sinConexion}</Text>
							<Text style={s.monitorLabel}>Sin conexión</Text>
							<Text style={s.monitorPct}>{totalMov > 0 ? ((sinConexion / totalMov) * 100).toFixed(0) : 0}%</Text>
						</View>
					</View>
					{/* Barra de distribución */}
					<View style={s.distBar}>
						{activos > 0 && <View style={[s.distSeg, { flex: activos, backgroundColor: '#2e7d32' }]} />}
						{inactivos > 0 && <View style={[s.distSeg, { flex: inactivos, backgroundColor: '#e65100' }]} />}
						{sinConexion > 0 && <View style={[s.distSeg, { flex: sinConexion, backgroundColor: '#c62828' }]} />}
						{totalMov === 0 && <View style={[s.distSeg, { flex: 1, backgroundColor: '#ccc' }]} />}
					</View>
				</View>

				{/* ── Avance por Sección ── */}
				<View style={s.card}>
					<Text style={s.cardTitle}>Avance Electoral por Sección</Text>
					<TextInput
						style={s.searchInput}
						placeholder="Buscar sección..."
						placeholderTextColor="#a0a8b8"
						value={busquedaSec}
						onChangeText={setBusquedaSec}
					/>
					<View style={s.tableHead}>
						<Text style={[s.tableHeadCell, { flex: 1.2 }]}>Sección</Text>
						<Text style={[s.tableHeadCell, { flex: 1 }]}>Votaron</Text>
						<Text style={[s.tableHeadCell, { flex: 1 }]}>Pendiente</Text>
						<Text style={[s.tableHeadCell, { flex: 1.5 }]}>Avance</Text>
					</View>
					{secFiltradas.length === 0 ? (
						<Text style={s.emptyText}>Sin datos</Text>
					) : (
						secFiltradas.map((e, i) => {
							const votaron = Number(e.votaron);
							const pendientes = Number(e.pendientes);
							const total = Number(e.total);
							const pct = total > 0 ? (votaron / total) * 100 : 0;
							return (
								<View key={e.seccion} style={[s.tableRow, i % 2 === 0 && { backgroundColor: '#f7f8fc' }]}>
									<Text style={[s.tableCell, { flex: 1.2, fontWeight: '700' }]}>SEC {e.seccion}</Text>
									<Text style={[s.tableCell, { flex: 1, color: '#2e7d32' }]}>{votaron}</Text>
									<Text style={[s.tableCell, { flex: 1, color: '#c62828' }]}>{pendientes}</Text>
									<View style={{ flex: 1.5, justifyContent: 'center' }}>
										<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
											<View style={{ flex: 1 }}>
												<AnimatedBar pct={pct} color={pctColor(pct)} height={6} />
											</View>
											<Text style={{ fontSize: 12, fontWeight: '700', color: pctColor(pct), width: 36, textAlign: 'right' }}>
												{pct.toFixed(0)}%
											</Text>
										</View>
									</View>
								</View>
							);
						})
					)}
				</View>
			</>
			) : (
			<>
				{/* ── Movilizadores detalle ── */}
				<View style={s.card}>
					<Text style={s.cardTitle}>Detalle de Movilizadores</Text>
					{/* Tabs de filtro */}
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
						{([['todos', 'Todos', '#6c8cff'], ['activo', 'Activos', '#2e7d32'], ['inactivo', 'Inactivos', '#e65100'], ['sin_conexion', 'Sin conexión', '#c62828']] as const).map(([key, lbl, clr]) => (
							<TouchableOpacity
								key={key}
								onPress={() => setTabActivo(key)}
								style={[s.tab, tabActivo === key && { backgroundColor: clr }]}
								activeOpacity={0.8}
							>
								<Text style={[s.tabText, tabActivo === key && { color: '#fff' }]}>{lbl}</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
					<TextInput
						style={s.searchInput}
						placeholder="Buscar por nombre..."
						placeholderTextColor="#a0a8b8"
						value={busquedaMov}
						onChangeText={setBusquedaMov}
					/>
					{movFiltrados.length === 0 ? (
						<Text style={s.emptyText}>Sin resultados</Text>
					) : (
						movFiltrados.map(m => {
							const vis = Number(m.total_visitas);
							const visitados = Number(m.ciudadanos_visitados);
							const asignados = Number(m.ciudadanos_asignados);
							const visPct = asignados > 0 ? Math.round((visitados / asignados) * 100) : 0;
							const isExpanded = expandedMov === m.id;
							const ciudadanos = ciudadanosMov[m.id] || [];
							// Agrupar por sección
							const porSeccion: Record<string, CiudadanoDetalle[]> = {};
							ciudadanos.forEach(c => {
								if (!porSeccion[c.seccion]) porSeccion[c.seccion] = [];
								porSeccion[c.seccion].push(c);
							});
							return (
								<View key={m.id} style={s.movRow}>
									<View style={s.movTop}>
										<View style={{ flex: 1 }}>
											<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
												<Text style={s.movName}>{m.nombre}</Text>
												<StatusBadge estado={m.estado} />
											</View>
											<Text style={s.movMeta}>
												Última señal: {formatTime(m.ultima_ubicacion)}
												{m.lat != null && m.lng != null && `  ·  📍 ${Number(m.lat).toFixed(4)}, ${Number(m.lng).toFixed(4)}`}
											</Text>
										</View>
									</View>
									<View style={s.movStats}>
										<View style={s.movStatItem}>
											<Text style={s.movStatNum}>{vis}</Text>
											<Text style={s.movStatLabel}>Visitas</Text>
										</View>
										<View style={s.movStatDivider} />
										<View style={s.movStatItem}>
											<Text style={s.movStatNum}>{visitados}/{asignados}</Text>
											<Text style={s.movStatLabel}>Visitados</Text>
										</View>
										<View style={s.movStatDivider} />
										<View style={s.movStatItem}>
											<Text style={[s.movStatNum, { color: pctColor(visPct) }]}>{visPct}%</Text>
											<Text style={s.movStatLabel}>Cobertura</Text>
										</View>
									</View>
									<AnimatedBar pct={(vis / maxVisitas) * 100} color="#7c4dff" height={6} />
									{/* Botón ver ciudadanos */}
									<TouchableOpacity
										style={[s.verCiudadanosBtn, isExpanded && { backgroundColor: '#1a1f36' }]}
										onPress={() => toggleCiudadanos(m.id)}
										activeOpacity={0.8}
									>
										<Text style={[s.verCiudadanosText, isExpanded && { color: '#fff' }]}>
											{isExpanded ? '▲ Ocultar ciudadanos' : '▼ Ver ciudadanos asignados'}
										</Text>
									</TouchableOpacity>
									{/* Lista expandida */}
									{isExpanded && (
										<View style={s.ciudadanosPanel}>
											{loadingCiudadanos === m.id ? (
												<ActivityIndicator size="small" color="#6c8cff" style={{ paddingVertical: 16 }} />
											) : ciudadanos.length === 0 ? (
												<Text style={s.emptyText}>Sin ciudadanos asignados</Text>
											) : (
												Object.entries(porSeccion).sort(([a], [b]) => a.localeCompare(b)).map(([seccion, lista]) => {
													const visitadosSec = lista.filter(c => c.visitas > 0).length;
													const pendientesSec = lista.filter(c => c.status_voto === 'pendiente').length;
													return (
														<View key={seccion} style={s.secGrupo}>
															<View style={s.secGrupoHead}>
																<Text style={s.secGrupoTitle}>Sección {seccion}</Text>
																<Text style={s.secGrupoCount}>
																	{visitadosSec}/{lista.length} visitados · {pendientesSec} sin votar
																</Text>
															</View>
															{lista.map(c => (
																<View key={c.id} style={s.ciudadanoRow}>
																	<View style={[s.ciudadanoDot, {
																		backgroundColor: c.visitas > 0 ? '#2e7d32' : '#c62828'
																	}]} />
																	<View style={{ flex: 1 }}>
																		<Text style={s.ciudadanoName}>
																			{c.paterno} {c.materno} {c.nombre}
																		</Text>
																		<View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
																			<Text style={s.ciudadanoTag}>
																				{c.visitas > 0 ? `✓ ${c.visitas} visita${c.visitas > 1 ? 's' : ''}` : '✗ Sin visitar'}
																			</Text>
																			<Text style={[s.ciudadanoTag, {
																				color: c.status_voto === 'voto' ? '#2e7d32' : '#c62828'
																			}]}>
																				{c.status_voto === 'voto' ? '🗳 Votó' : '⏳ No ha votado'}
																			</Text>
																		</View>
																	</View>
																</View>
															))}
														</View>
													);
												})
											)}
										</View>
									)}
								</View>
							);
						})
					)}
				</View>
			</>
			)}

				<View style={{ height: 30 }} />
			</ScrollView>
		</View>
	);
}

/* ───── Estilos ───── */
const s = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#f0f2f8' },
	// Header
	header: {
		backgroundColor: '#0f1729',
		paddingTop: Platform.OS === 'ios' ? 56 : 38,
		paddingBottom: 18,
		paddingHorizontal: 20,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-end',
	},
	headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
	headerSub: { fontSize: 13, color: '#8892a4', marginTop: 2 },
	logoutBtn: {
		backgroundColor: '#ff1744',
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 16,
	},
	logoutText: { color: '#fff', fontWeight: '700', fontSize: 13 },
	// Mini Menu
	miniMenu: {
		flexDirection: 'row',
		backgroundColor: '#0f1729',
		paddingHorizontal: 16,
		paddingBottom: 12,
		gap: 8,
	},
	miniTab: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 10,
		alignItems: 'center',
		backgroundColor: '#1a2340',
		borderWidth: 1,
		borderColor: '#2a3558',
	},
	miniTabActive: {
		backgroundColor: '#6c8cff',
		borderColor: '#6c8cff',
	},
	miniTabText: {
		fontSize: 14,
		fontWeight: '700',
		color: '#8892a4',
	},
	miniTabTextActive: {
		color: '#fff',
	},
	// Scroll
	scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
	// KPIs
	kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
	kpiCard: {
		flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
		alignItems: 'center', marginHorizontal: 3,
		elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
	},
	kpiNum: { fontSize: 22, fontWeight: '800', marginTop: 4 },
	kpiLabel: { fontSize: 10, color: '#8892a4', fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
	// Cards
	card: {
		backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
		elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
	},
	cardTitle: { fontSize: 17, fontWeight: '800', color: '#1a1f36', marginBottom: 14, letterSpacing: 0.3 },
	// Monitor
	monitorGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
	monitorBox: {
		flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 14, marginHorizontal: 4,
		alignItems: 'center', backgroundColor: '#fafbfd',
	},
	monitorDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
	monitorNum: { fontSize: 28, fontWeight: '800', color: '#1a1f36' },
	monitorLabel: { fontSize: 11, color: '#8892a4', fontWeight: '600', marginTop: 2 },
	monitorPct: { fontSize: 13, fontWeight: '700', color: '#5a6278', marginTop: 4 },
	distBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
	distSeg: { height: 8 },
	// Tabs
	tab: {
		borderRadius: 8, paddingVertical: 7, paddingHorizontal: 16, marginRight: 8,
		backgroundColor: '#f0f2f8', borderWidth: 1, borderColor: '#e2e5ed',
	},
	tabText: { fontSize: 13, fontWeight: '600', color: '#5a6278' },
	// Search
	searchInput: {
		backgroundColor: '#f5f7fa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
		fontSize: 14, color: '#1a1f36', borderWidth: 1, borderColor: '#e2e5ed', marginBottom: 12,
	},
	emptyText: { textAlign: 'center', color: '#a0a8b8', fontSize: 14, paddingVertical: 24 },
	// Movilizador rows
	movRow: {
		borderBottomWidth: 1, borderBottomColor: '#f0f2f6', paddingBottom: 14, marginBottom: 14,
	},
	movTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
	movName: { fontSize: 15, fontWeight: '700', color: '#1a1f36' },
	movMeta: { fontSize: 12, color: '#8892a4', marginTop: 3 },
	movStats: {
		flexDirection: 'row', alignItems: 'center', marginBottom: 10,
		backgroundColor: '#f7f8fc', borderRadius: 10, paddingVertical: 10,
	},
	movStatItem: { flex: 1, alignItems: 'center' },
	movStatNum: { fontSize: 17, fontWeight: '800', color: '#1a1f36' },
	movStatLabel: { fontSize: 10, color: '#8892a4', fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
	movStatDivider: { width: 1, height: 28, backgroundColor: '#e2e5ed' },
	// Ver ciudadanos button
	verCiudadanosBtn: {
		marginTop: 10, borderRadius: 8, paddingVertical: 9, alignItems: 'center',
		backgroundColor: '#f0f2f8', borderWidth: 1, borderColor: '#e2e5ed',
	},
	verCiudadanosText: { fontSize: 13, fontWeight: '700', color: '#5a6278' },
	// Panel expandido ciudadanos
	ciudadanosPanel: {
		marginTop: 12, backgroundColor: '#f7f8fc', borderRadius: 12, padding: 12,
		borderWidth: 1, borderColor: '#e9ecf2',
	},
	secGrupo: { marginBottom: 12 },
	secGrupoHead: {
		flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
		paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e2e5ed', marginBottom: 8,
	},
	secGrupoTitle: { fontSize: 13, fontWeight: '800', color: '#1a1f36' },
	secGrupoCount: { fontSize: 11, color: '#8892a4', fontWeight: '600' },
	ciudadanoRow: {
		flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
		borderBottomWidth: 1, borderBottomColor: '#f0f2f6',
	},
	ciudadanoDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
	ciudadanoName: { fontSize: 13, fontWeight: '600', color: '#1a1f36' },
	ciudadanoTag: { fontSize: 11, color: '#8892a4', fontWeight: '500' },
	// Table
	tableHead: {
		flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8,
		backgroundColor: '#0f1729', borderRadius: 8, marginBottom: 4,
	},
	tableHeadCell: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
	tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 6 },
	tableCell: { fontSize: 13, color: '#1a1f36' },
});
