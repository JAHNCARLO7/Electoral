import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList, Modal, Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useUser } from '../../../context/UserContext';
import { API_URL, useAuthFetch } from '../../../hooks/useAuthFetch';

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

type Usuario = { id: number; nombre: string; usuario: string; rol: string; activo: number };
type Ciudadano = {
  id: number; nombre: string; paterno: string; materno: string;
  calle: string; no: string; colonia: string; seccion: string; cel: string;
  movilizador_id: number | null; movilizador_nombre: string | null;
  status_voto: string; visitas: number;
};
type Movilizador = { id: number; nombre: string };
type DeleteState = { visible: boolean; item: any; type: 'user' | 'ciudadano' | null };

export default function AdminScreen() {
  const { user, setUser, setToken } = useUser();
  const router = useRouter();
  const authFetch = useAuthFetch();

  // Tab state
  const [tab, setTab] = useState<'usuarios' | 'ciudadanos'>('usuarios');

  // ========== USUARIOS STATE ==========
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form, setForm] = useState({ usuario: '', password: '', nombre: '', rol: '' });
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({ visible: false, item: null, type: null });
  const [searchUsers, setSearchUsers] = useState('');

  // ========== CIUDADANOS STATE ==========
  const [ciudadanos, setCiudadanos] = useState<Ciudadano[]>([]);
  const [movilizadores, setMovilizadores] = useState<Movilizador[]>([]);
  const [loadingCiudadanos, setLoadingCiudadanos] = useState(true);
  const [searchCiudadanos, setSearchCiudadanos] = useState('');
  const [ciudPage, setCiudPage] = useState(1);
  const [ciudTotal, setCiudTotal] = useState(0);
  const [ciudTotalPages, setCiudTotalPages] = useState(1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ciudForm, setCiudForm] = useState({ nombre: '', paterno: '', materno: '', calle: '', no: '', colonia: '', seccion: '', cel: '', movilizador_id: '' });
  const [ciudModalVisible, setCiudModalVisible] = useState(false);
  const [editCiudModalVisible, setEditCiudModalVisible] = useState(false);
  const [editCiudForm, setEditCiudForm] = useState<any>(null);

  // ========== USUARIOS FUNCTIONS ==========
  const fetchUsers = async () => {
    setLoadingUsers(true); setError(null);
    try {
      const res = await authFetch(API_URL + '/users');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (e) { setError('Error al cargar usuarios'); }
    setLoadingUsers(false);
  };

  const handleAddUser = async () => {
    if (!form.usuario || !form.password || !form.nombre || !form.rol) return;
    setSaving(true); setError(null);
    try {
      const res = await authFetch(API_URL + '/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) { setError('Error al guardar usuario'); setSaving(false); return; }
      setModalVisible(false); setForm({ usuario: '', password: '', nombre: '', rol: '' }); fetchUsers();
    } catch (e) { setError('Error de red'); }
    setSaving(false);
  };

  const handleEditUser = async () => {
    if (!editForm) return;
    setSaving(true); setError(null);
    try {
      const { nombre, usuario, password, rol, activo } = editForm;
      const res = await authFetch(API_URL + '/users/' + editForm.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, usuario, password, rol, activo }),
      });
      if (!res.ok) { setError('Error al editar usuario'); setSaving(false); return; }
      setEditModalVisible(false); setEditForm(null); fetchUsers();
    } catch (e) { setError('Error de red'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteState.item) return;
    setSaving(true); setError(null);
    try {
      const url = deleteState.type === 'user'
        ? API_URL + '/users/' + deleteState.item.id
        : API_URL + '/ciudadanos/' + deleteState.item.id;
      const res = await authFetch(url, { method: 'DELETE' });
      if (!res.ok) { setError('Error al eliminar'); setSaving(false); return; }
      setDeleteState({ visible: false, item: null, type: null });
      if (deleteState.type === 'user') fetchUsers(); else fetchCiudadanos();
    } catch (e) { setError('Error de red'); }
    setSaving(false);
  };

  // ========== CIUDADANOS FUNCTIONS ==========
  const fetchCiudadanos = async (page = 1, search = '') => {
    setLoadingCiudadanos(true);
    try {
      const params = `?page=${page}&limit=100&search=${encodeURIComponent(search)}`;
      const [cRes, mRes] = await Promise.all([
        authFetch(API_URL + '/ciudadanos/todos' + params),
        authFetch(API_URL + '/ciudadanos/movilizadores-disponibles'),
      ]);
      const cData = await cRes.json();
      const mData = await mRes.json();
      if (cData.rows) {
        setCiudadanos(cData.rows);
        setCiudTotal(cData.total);
        setCiudPage(cData.page);
        setCiudTotalPages(cData.totalPages);
      }
      if (Array.isArray(mData)) setMovilizadores(mData);
    } catch (e) { setError('Error al cargar ciudadanos'); }
    setLoadingCiudadanos(false);
  };

  const handleAddCiudadano = async () => {
    if (!ciudForm.nombre || !ciudForm.paterno || !ciudForm.seccion) {
      setError('Nombre, apellido paterno y sección son requeridos');
      return;
    }
    setSaving(true); setError(null);
    try {
      const body = { ...ciudForm, movilizador_id: ciudForm.movilizador_id ? Number(ciudForm.movilizador_id) : null };
      const res = await authFetch(API_URL + '/ciudadanos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError('Error al agregar ciudadano'); setSaving(false); return; }
      setCiudModalVisible(false);
      setCiudForm({ nombre: '', paterno: '', materno: '', calle: '', no: '', colonia: '', seccion: '', cel: '', movilizador_id: '' });
      fetchCiudadanos();
    } catch (e) { setError('Error de red'); }
    setSaving(false);
  };

  const handleEditCiudadano = async () => {
    if (!editCiudForm) return;
    setSaving(true); setError(null);
    try {
      const body = { ...editCiudForm, movilizador_id: editCiudForm.movilizador_id ? Number(editCiudForm.movilizador_id) : null };
      const res = await authFetch(API_URL + '/ciudadanos/' + editCiudForm.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError('Error al editar ciudadano'); setSaving(false); return; }
      setEditCiudModalVisible(false); setEditCiudForm(null); fetchCiudadanos();
    } catch (e) { setError('Error de red'); }
    setSaving(false);
  };

  const handleSearchCiudadanos = useCallback((text: string) => {
    setSearchCiudadanos(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setCiudPage(1);
      fetchCiudadanos(1, text);
    }, 400);
  }, []);

  useEffect(() => { fetchUsers(); fetchCiudadanos(); }, []);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setTimeout(() => router.replace('/Proyect/Login/login'), 250);
  };

  const filteredUsers = users.filter(u =>
    u.nombre.toLowerCase().includes(searchUsers.toLowerCase()) ||
    u.usuario.toLowerCase().includes(searchUsers.toLowerCase())
  );

  // ========== RENDER HELPERS ==========
  const renderMovSelector = (value: string, onChange: (v: string) => void) => (
    <View>
      <Text style={st.fieldLabel}>Movilizador asignado</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <TouchableOpacity onPress={() => onChange('')}
          style={[st.roleBtn, !value && { backgroundColor: C.textTertiary }]}>
          <Text style={[st.roleBtnText, !value && { color: C.white }]}>Sin asignar</Text>
        </TouchableOpacity>
        {movilizadores.map(m => (
          <TouchableOpacity key={m.id} onPress={() => onChange(String(m.id))}
            style={[st.roleBtn, value === String(m.id) && { backgroundColor: C.primary }]}>
            <Text style={[st.roleBtnText, value === String(m.id) && { color: C.white }]}>{m.nombre}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={st.container}>
      {/* HEADER */}
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Administración</Text>
          <Text style={st.headerSub}>{user?.nombre || 'Admin'}</Text>
        </View>
        <TouchableOpacity style={st.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={st.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* TAB MENU */}
      <View style={st.tabBar}>
        <TouchableOpacity style={[st.tabItem, tab === 'usuarios' && st.tabItemActive]} onPress={() => setTab('usuarios')} activeOpacity={0.7}>
          <Text style={[st.tabItemText, tab === 'usuarios' && st.tabItemTextActive]}>Usuarios</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.tabItem, tab === 'ciudadanos' && st.tabItemActive]} onPress={() => setTab('ciudadanos')} activeOpacity={0.7}>
          <Text style={[st.tabItemText, tab === 'ciudadanos' && st.tabItemTextActive]}>Ciudadanos</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={st.errorBar}>
          <Text style={st.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}><Text style={st.errorClose}>✕</Text></TouchableOpacity>
        </View>
      )}

      {/* ==================== TAB USUARIOS ==================== */}
      {tab === 'usuarios' && (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}>
          <TextInput style={st.searchInput} placeholder="Buscar usuario o nombre..." placeholderTextColor={C.textTertiary}
            value={searchUsers} onChangeText={setSearchUsers} />
          {loadingUsers ? <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} /> : (
            <FlatList data={filteredUsers} keyExtractor={item => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <View style={st.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[st.avatar, { backgroundColor: item.activo ? C.primary : C.textTertiary }]}>
                      <Text style={st.avatarText}>{(item.nombre || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardName}>{item.nombre}</Text>
                      <Text style={st.cardMeta}>{item.usuario} • {item.rol.toUpperCase()}</Text>
                      {!item.activo && <Text style={{ fontSize: 10, color: C.error, fontWeight: '700' }}>INACTIVO</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={st.editBtn} onPress={() => { setEditForm(item); setEditModalVisible(true); }}>
                        <Text style={st.editBtnText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={st.deleteBtn} onPress={() => setDeleteState({ visible: true, item, type: 'user' })}>
                        <Text style={st.deleteBtnText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            />
          )}
          <TouchableOpacity style={st.fab} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
            <Text style={st.fabText}>+ Agregar usuario</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ==================== TAB CIUDADANOS ==================== */}
      {tab === 'ciudadanos' && (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}>
          <View style={st.statsRow}>
            <View style={[st.statCard, { backgroundColor: C.primaryLight }]}>
              <Text style={[st.statNum, { color: C.primary }]}>{ciudTotal}</Text>
              <Text style={st.statLabel}>Total</Text>
            </View>
            <View style={[st.statCard, { backgroundColor: C.successLight }]}>
              <Text style={[st.statNum, { color: C.success }]}>{ciudadanos.filter(c => c.movilizador_id).length}</Text>
              <Text style={st.statLabel}>Asignados</Text>
            </View>
            <View style={[st.statCard, { backgroundColor: C.warningLight }]}>
              <Text style={[st.statNum, { color: C.warning }]}>{ciudadanos.filter(c => !c.movilizador_id).length}</Text>
              <Text style={st.statLabel}>Sin asignar</Text>
            </View>
          </View>
          <TextInput style={st.searchInput} placeholder="Buscar nombre o sección (servidor)..." placeholderTextColor={C.textTertiary}
            value={searchCiudadanos} onChangeText={handleSearchCiudadanos} />
          {loadingCiudadanos ? <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} /> : (
            <FlatList data={ciudadanos} keyExtractor={item => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListFooterComponent={ciudTotalPages > 1 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                  <TouchableOpacity disabled={ciudPage <= 1} onPress={() => { const p = ciudPage - 1; setCiudPage(p); fetchCiudadanos(p, searchCiudadanos); }}
                    style={[st.pageBtn, ciudPage <= 1 && { opacity: 0.3 }]}>
                    <Text style={st.pageBtnText}>← Anterior</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.textPrimary }}>Pág {ciudPage}/{ciudTotalPages}</Text>
                  <TouchableOpacity disabled={ciudPage >= ciudTotalPages} onPress={() => { const p = ciudPage + 1; setCiudPage(p); fetchCiudadanos(p, searchCiudadanos); }}
                    style={[st.pageBtn, ciudPage >= ciudTotalPages && { opacity: 0.3 }]}>
                    <Text style={st.pageBtnText}>Siguiente →</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              renderItem={({ item }) => (
                <View style={st.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[st.avatar, { backgroundColor: item.movilizador_id ? C.success : C.warning }]}>
                      <Text style={st.avatarText}>{(item.paterno || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardName}>{item.paterno} {item.materno} {item.nombre}</Text>
                      <Text style={st.cardMeta}>Sec. {item.seccion} • {item.calle} #{item.no}</Text>
                      <Text style={[st.cardMeta, { color: item.movilizador_id ? C.success : C.warning, fontWeight: '700' }]}>
                        {item.movilizador_nombre ? '✓ ' + item.movilizador_nombre : 'Sin movilizador'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={st.editBtn} onPress={() => {
                        setEditCiudForm({ ...item, movilizador_id: item.movilizador_id ? String(item.movilizador_id) : '' });
                        setEditCiudModalVisible(true);
                      }}>
                        <Text style={st.editBtnText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={st.deleteBtn} onPress={() => setDeleteState({ visible: true, item, type: 'ciudadano' })}>
                        <Text style={st.deleteBtnText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            />
          )}
          <TouchableOpacity style={st.fab} onPress={() => setCiudModalVisible(true)} activeOpacity={0.8}>
            <Text style={st.fabText}>+ Agregar ciudadano</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Modal Agregar Usuario */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={st.modalBg}>
          <View style={st.modalBox}>
            <Text style={st.modalTitle}>Nuevo Usuario</Text>
            <TextInput style={st.input} placeholder="Usuario" placeholderTextColor={C.textTertiary} value={form.usuario} onChangeText={t => setForm(f => ({ ...f, usuario: t }))} />
            <TextInput style={st.input} placeholder="Contraseña" placeholderTextColor={C.textTertiary} value={form.password} onChangeText={t => setForm(f => ({ ...f, password: t }))} secureTextEntry />
            <TextInput style={st.input} placeholder="Nombre completo" placeholderTextColor={C.textTertiary} value={form.nombre} onChangeText={t => setForm(f => ({ ...f, nombre: t }))} />
            <Text style={st.fieldLabel}>Rol</Text>
            <View style={st.roleRow}>
              {['admin', 'movilizador', 'casillero', 'RG'].map(r => (
                <TouchableOpacity key={r} style={[st.roleBtn, form.rol === r && { backgroundColor: C.primary }]}
                  onPress={() => setForm(f => ({ ...f, rol: r }))}>
                  <Text style={[st.roleBtnText, form.rol === r && { color: C.white }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={st.modalActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setModalVisible(false)}><Text style={st.cancelBtnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={st.saveBtn} onPress={handleAddUser} disabled={saving}><Text style={st.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Usuario */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={st.modalBg}>
          <View style={st.modalBox}>
            <Text style={st.modalTitle}>Editar Usuario</Text>
            <TextInput style={st.input} placeholder="Usuario" placeholderTextColor={C.textTertiary} value={editForm?.usuario || ''} onChangeText={t => setEditForm((f: any) => ({ ...f, usuario: t }))} />
            <TextInput style={st.input} placeholder="Contraseña (vacío = no cambiar)" placeholderTextColor={C.textTertiary} value={editForm?.password || ''} onChangeText={t => setEditForm((f: any) => ({ ...f, password: t }))} secureTextEntry />
            <TextInput style={st.input} placeholder="Nombre" placeholderTextColor={C.textTertiary} value={editForm?.nombre || ''} onChangeText={t => setEditForm((f: any) => ({ ...f, nombre: t }))} />
            <Text style={st.fieldLabel}>Rol</Text>
            <View style={st.roleRow}>
              {['admin', 'movilizador', 'casillero', 'RG'].map(r => (
                <TouchableOpacity key={r} style={[st.roleBtn, editForm?.rol === r && { backgroundColor: C.primary }]}
                  onPress={() => setEditForm((f: any) => ({ ...f, rol: r }))}>
                  <Text style={[st.roleBtnText, editForm?.rol === r && { color: C.white }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Text style={st.fieldLabel}>Activo:</Text>
              <TouchableOpacity onPress={() => setEditForm((f: any) => ({ ...f, activo: f.activo ? 0 : 1 }))}
                style={[st.toggleBtn, { backgroundColor: editForm?.activo ? C.success : C.textTertiary }]}>
                <Text style={{ color: C.white, fontWeight: '800', fontSize: 12 }}>{editForm?.activo ? 'Sí' : 'No'}</Text>
              </TouchableOpacity>
            </View>
            <View style={st.modalActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => { setEditModalVisible(false); setEditForm(null); }}><Text style={st.cancelBtnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={st.saveBtn} onPress={handleEditUser} disabled={saving}><Text style={st.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Agregar Ciudadano */}
      <Modal visible={ciudModalVisible} animationType="slide" transparent>
        <View style={st.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={st.modalBox}>
              <Text style={st.modalTitle}>Nuevo Ciudadano</Text>
              <View style={{ backgroundColor: C.primaryLight, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.cardBorder }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.primary, marginBottom: 4 }}>Campos a rellenar:</Text>
                <Text style={{ fontSize: 11, color: C.textSecondary, lineHeight: 18 }}>
                  Nombre*, Apellido paterno*, Apellido materno, Calle, Número, Colonia, Sección*, Celular y Movilizador asignado.{'\n'}Los campos con * son obligatorios.
                </Text>
              </View>
              <TextInput style={st.input} placeholder="Nombre *" placeholderTextColor={C.textTertiary} value={ciudForm.nombre} onChangeText={t => setCiudForm(f => ({ ...f, nombre: t }))} />
              <TextInput style={st.input} placeholder="Apellido paterno *" placeholderTextColor={C.textTertiary} value={ciudForm.paterno} onChangeText={t => setCiudForm(f => ({ ...f, paterno: t }))} />
              <TextInput style={st.input} placeholder="Apellido materno" placeholderTextColor={C.textTertiary} value={ciudForm.materno} onChangeText={t => setCiudForm(f => ({ ...f, materno: t }))} />
              <TextInput style={st.input} placeholder="Calle" placeholderTextColor={C.textTertiary} value={ciudForm.calle} onChangeText={t => setCiudForm(f => ({ ...f, calle: t }))} />
              <TextInput style={st.input} placeholder="Número" placeholderTextColor={C.textTertiary} value={ciudForm.no} onChangeText={t => setCiudForm(f => ({ ...f, no: t }))} />
              <TextInput style={st.input} placeholder="Colonia" placeholderTextColor={C.textTertiary} value={ciudForm.colonia} onChangeText={t => setCiudForm(f => ({ ...f, colonia: t }))} />
              <TextInput style={st.input} placeholder="Sección *" placeholderTextColor={C.textTertiary} value={ciudForm.seccion} onChangeText={t => setCiudForm(f => ({ ...f, seccion: t }))} />
              <TextInput style={st.input} placeholder="Celular" placeholderTextColor={C.textTertiary} value={ciudForm.cel} onChangeText={t => setCiudForm(f => ({ ...f, cel: t }))} keyboardType="phone-pad" />
              {renderMovSelector(ciudForm.movilizador_id, v => setCiudForm(f => ({ ...f, movilizador_id: v })))}
              <View style={st.modalActions}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setCiudModalVisible(false)}><Text style={st.cancelBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={st.saveBtn} onPress={handleAddCiudadano} disabled={saving}><Text style={st.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Editar Ciudadano */}
      <Modal visible={editCiudModalVisible} animationType="slide" transparent>
        <View style={st.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={st.modalBox}>
              <Text style={st.modalTitle}>Editar Ciudadano</Text>
              <TextInput style={st.input} placeholder="Nombre" placeholderTextColor={C.textTertiary} value={editCiudForm?.nombre || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, nombre: t }))} />
              <TextInput style={st.input} placeholder="Apellido paterno" placeholderTextColor={C.textTertiary} value={editCiudForm?.paterno || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, paterno: t }))} />
              <TextInput style={st.input} placeholder="Apellido materno" placeholderTextColor={C.textTertiary} value={editCiudForm?.materno || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, materno: t }))} />
              <TextInput style={st.input} placeholder="Calle" placeholderTextColor={C.textTertiary} value={editCiudForm?.calle || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, calle: t }))} />
              <TextInput style={st.input} placeholder="Número" placeholderTextColor={C.textTertiary} value={editCiudForm?.no || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, no: t }))} />
              <TextInput style={st.input} placeholder="Colonia" placeholderTextColor={C.textTertiary} value={editCiudForm?.colonia || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, colonia: t }))} />
              <TextInput style={st.input} placeholder="Sección" placeholderTextColor={C.textTertiary} value={editCiudForm?.seccion || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, seccion: t }))} />
              <TextInput style={st.input} placeholder="Celular" placeholderTextColor={C.textTertiary} value={editCiudForm?.cel || ''} onChangeText={t => setEditCiudForm((f: any) => ({ ...f, cel: t }))} keyboardType="phone-pad" />
              {renderMovSelector(editCiudForm?.movilizador_id || '', v => setEditCiudForm((f: any) => ({ ...f, movilizador_id: v })))}
              <View style={st.modalActions}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => { setEditCiudModalVisible(false); setEditCiudForm(null); }}><Text style={st.cancelBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={st.saveBtn} onPress={handleEditCiudadano} disabled={saving}><Text style={st.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Eliminar */}
      <Modal visible={deleteState.visible} animationType="fade" transparent>
        <View style={st.modalBg}>
          <View style={[st.modalBox, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.error, marginBottom: 12 }}>
              ¿Eliminar {deleteState.type === 'user' ? 'usuario' : 'ciudadano'}?
            </Text>
            <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20, textAlign: 'center' }}>
              {deleteState.item?.nombre} {deleteState.item?.paterno || ''}{deleteState.type === 'user' ? ' (' + deleteState.item?.usuario + ')' : ''}
            </Text>
            <View style={st.modalActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setDeleteState({ visible: false, item: null, type: null })}><Text style={st.cancelBtnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[st.saveBtn, { backgroundColor: C.error }]} onPress={handleDelete} disabled={saving}><Text style={st.saveBtnText}>{saving ? 'Eliminando...' : 'Eliminar'}</Text></TouchableOpacity>
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
  logoutBtn: {
    backgroundColor: 'rgba(198,40,40,0.15)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(198,40,40,0.4)',
  },
  logoutText: { color: '#EF5350', fontWeight: '800', fontSize: 12 },

  tabBar: {
    flexDirection: 'row', backgroundColor: C.navyLight, paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 14, gap: 8,
  },
  tabItem: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  tabItemActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabItemText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  tabItemTextActive: { color: C.white },

  errorBar: {
    flexDirection: 'row', backgroundColor: C.errorLight, paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: C.error, fontWeight: '700', flex: 1, fontSize: 13 },
  errorClose: { color: C.error, fontSize: 16, fontWeight: '800', paddingLeft: 12 },

  searchInput: {
    backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: C.textPrimary, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 12,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: C.cardBorder,
  },
  statNum: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 9, color: C.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.cardBorder,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.white, fontWeight: '900', fontSize: 16 },
  cardName: { fontSize: 14, fontWeight: '800', color: C.textPrimary },
  cardMeta: { fontSize: 11, color: C.textSecondary, marginTop: 1 },

  editBtn: { backgroundColor: C.primaryLight, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  editBtnText: { color: C.primary, fontWeight: '800', fontSize: 11 },
  deleteBtn: { backgroundColor: C.errorLight, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: C.error, fontWeight: '800', fontSize: 11 },

  fab: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    elevation: 6, shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: C.white, fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },

  modalBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: {
    backgroundColor: C.white, borderRadius: 18, padding: 24, width: 340, maxWidth: '90%',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: C.textPrimary, marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: C.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.textPrimary, backgroundColor: '#F8FAFC', marginBottom: 10,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.textSecondary, marginBottom: 6, marginTop: 4 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  roleBtn: { backgroundColor: '#F0F4F8', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  roleBtnText: { fontWeight: '800', fontSize: 12, color: C.textSecondary },
  toggleBtn: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#F0F4F8', borderWidth: 1, borderColor: C.cardBorder,
  },
  cancelBtnText: { color: C.textSecondary, fontWeight: '800', fontSize: 13 },
  saveBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: C.primary },
  saveBtnText: { color: C.white, fontWeight: '800', fontSize: 13 },
  pageBtn: {
    backgroundColor: C.primaryLight, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: C.primary,
  },
  pageBtnText: { color: C.primary, fontWeight: '800', fontSize: 12 },
});
