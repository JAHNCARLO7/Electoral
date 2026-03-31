
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useUser } from '../../../context/UserContext';


// Define el tipo de usuario
type Usuario = {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
  activo: number;
};

// Nuevo: Estado para eliminar usuario
type DeleteState = { visible: boolean; user: Usuario | null };

export default function AdminScreen() {
	const { user } = useUser();
	const [users, setUsers] = useState<Usuario[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalVisible, setModalVisible] = useState(false);
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [form, setForm] = useState({ usuario: '', password: '', nombre: '', rol: '' });
	const [editForm, setEditForm] = useState<any>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Estado para eliminar usuario
	const [deleteState, setDeleteState] = useState<DeleteState>({ visible: false, user: null });
	// Estado para búsqueda
	const [search, setSearch] = useState('');

	const fetchUsers = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch('http://10.0.2.2:8080/api/users');
			const data = await res.json();
			if (data.success) setUsers(data.users);
		} catch (e) {
			setError('Error al cargar usuarios');
			console.error('Error fetchUsers:', e);
		}
		setLoading(false);
	};

	useEffect(() => { fetchUsers(); }, []);

	const handleEditUser = async () => {
		if (!editForm) return;
		// Validar que al menos un campo relevante esté presente
		const { nombre, usuario, password, rol, activo } = editForm;
		if (
			(!nombre || nombre === '') &&
			(!usuario || usuario === '') &&
			(!password || password === '') &&
			(!rol || rol === '') &&
			(typeof activo === 'undefined' || activo === null)
		) {
			setError('No hay datos para actualizar. Modifica al menos un campo.');
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const res = await fetch(`http://10.0.2.2:8080/api/users/${editForm.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nombre, usuario, password, rol, activo }),
			});
			if (!res.ok) {
				const text = await res.text();
				setError('Error al editar usuario: ' + text);
				setSaving(false);
				return;
			}
			setEditModalVisible(false);
			setEditForm(null);
			fetchUsers();
		} catch (e) {
			setError('Error de red al editar usuario');
		}
		setSaving(false);
	};

	const handleAddUser = async () => {
		if (!form.usuario || !form.password || !form.nombre || !form.rol) return;
		setSaving(true);
		setError(null);
		try {
			const res = await fetch('http://10.0.2.2:8080/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(form),
			});
			if (!res.ok) {
				const text = await res.text();
				setError('Error al guardar usuario: ' + text);
				console.error('POST /api/users error:', text);
				setSaving(false);
				return;
			}
			setModalVisible(false);
			setForm({ usuario: '', password: '', nombre: '', rol: '' });
			fetchUsers();
		} catch (e) {
			setError('Error de red al guardar usuario');
			console.error('handleAddUser error:', e);
		}
		setSaving(false);
	};

	return (
		<View style={{ flex: 1, padding: 20 }}>
			<Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Bienvenido, {user?.nombre || 'admin'}</Text>
			<Text style={{ fontSize: 16, marginBottom: 10 }}>Todos los usuarios:</Text>
			{error && (
				<Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>
			)}
			{loading ? <ActivityIndicator /> : (
				<>
					{/* Barra de búsqueda */}
					<TextInput
						style={[styles.input, {marginBottom: 12}]}
						placeholder="Buscar usuario o nombre..."
						value={search}
						onChangeText={setSearch}
					/>
					<FlatList
						data={users.filter(u =>
							u.nombre.toLowerCase().includes(search.toLowerCase()) ||
							u.usuario.toLowerCase().includes(search.toLowerCase())
						)}
						keyExtractor={(item) => item.id.toString()}
						renderItem={({ item }: { item: Usuario }) => (
							<View style={[styles.userRow, {backgroundColor: '#f8f9fa', borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16}]}> 
								<View>
									<Text style={{fontWeight:'bold', fontSize:16}}>{item.nombre} <Text style={{color:'#888'}}>({item.usuario})</Text></Text>
									<Text style={{color:'#007bff', fontWeight:'bold'}}>{item.rol.toUpperCase()} {item.activo ? '' : <Text style={{color:'red'}}>(inactivo)</Text>}</Text>
								</View>
								<View style={{flexDirection:'row', gap:8}}>
									<TouchableOpacity style={{backgroundColor:'#222', padding:8, borderRadius:8, marginRight:8}} onPress={()=>{setEditForm(item); setEditModalVisible(true);}}>
										<Text style={{color:'white', fontWeight:'bold'}}>Editar</Text>
									</TouchableOpacity>
									<TouchableOpacity style={{backgroundColor:'#d9534f', padding:8, borderRadius:8}} onPress={()=>setDeleteState({visible:true, user:item})}>
										<Text style={{color:'white', fontWeight:'bold'}}>Eliminar</Text>
									</TouchableOpacity>
								</View>
							</View>
						)}
					/>
					{/* Modal de edición existente */}
					<Modal visible={editModalVisible} animationType="slide" transparent>
						<View style={styles.modalContainer}>
							<View style={[styles.modalContent, {width:340}]}> 
								<Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 10, color:'#007bff' }}>Editar usuario</Text>
								<TextInput placeholder="Usuario" value={editForm?.usuario || ''} onChangeText={t => setEditForm((f:any) => ({ ...f, usuario: t }))} style={styles.input} />
								<TextInput placeholder="Contraseña (dejar vacío para no cambiar)" value={editForm?.password || ''} onChangeText={t => setEditForm((f:any) => ({ ...f, password: t }))} style={styles.input} secureTextEntry />
								<TextInput placeholder="Nombre" value={editForm?.nombre || ''} onChangeText={t => setEditForm((f:any) => ({ ...f, nombre: t }))} style={styles.input} />
								<View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
									{['admin', 'movilizador', 'casillero', 'rp'].map(r => (
										<TouchableOpacity
											key={r}
											style={{
												backgroundColor: editForm?.rol === r ? '#007bff' : '#eee',
												padding: 8,
												borderRadius: 6,
												marginRight: 8,
												marginBottom: 8,
											}}
											onPress={() => setEditForm((f:any) => ({ ...f, rol: r }))}
										>
											<Text style={{ color: editForm?.rol === r ? 'white' : '#333', fontWeight: 'bold' }}>{r}</Text>
										</TouchableOpacity>
									))}
								</View>
								<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
									<Text style={{marginRight:8}}>Activo:</Text>
									<TouchableOpacity onPress={()=>setEditForm((f:any)=>({...f, activo: f.activo?0:1}))} style={{backgroundColor: editForm?.activo ? '#28a745':'#ccc', padding:8, borderRadius:6}}>
										<Text style={{color:'white', fontWeight:'bold'}}>{editForm?.activo ? 'Sí' : 'No'}</Text>
									</TouchableOpacity>
								</View>
								{error && (
									<Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>
								)}
								<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
									<Button title="Cancelar" onPress={() => {setEditModalVisible(false); setEditForm(null);}} color="#888" />
									<Button title={saving ? 'Guardando...' : 'Guardar'} onPress={handleEditUser} disabled={saving} color="#007bff" />
								</View>
							</View>
						</View>
					</Modal>
					{/* Modal de confirmación para eliminar usuario */}
					<Modal visible={deleteState.visible} animationType="fade" transparent>
						<View style={styles.modalContainer}>
							<View style={[styles.modalContent, {width:320, alignItems:'center'}]}>
								<Text style={{fontWeight:'bold', fontSize:18, color:'#d9534f', marginBottom:12}}>¿Estás seguro de que quieres eliminar este usuario?</Text>
								<Text style={{fontSize:16, marginBottom:16}}>{deleteState.user?.nombre} ({deleteState.user?.usuario})</Text>
								<View style={{flexDirection:'row', justifyContent:'space-between', width:'100%'}}>
									<Button title="Cancelar" onPress={()=>setDeleteState({visible:false, user:null})} color="#888" />
									<Button title="Eliminar" color="#d9534f" onPress={async ()=>{
										if (!deleteState.user) return;
										setSaving(true);
										setError(null);
										try {
											const res = await fetch(`http://10.0.2.2:8080/api/users/${deleteState.user.id}`, { method: 'DELETE' });
											if (!res.ok) {
												const text = await res.text();
												setError('Error al eliminar usuario: ' + text);
												setSaving(false);
												return;
											}
											setDeleteState({visible:false, user:null});
											fetchUsers();
										} catch (e) {
											setError('Error de red al eliminar usuario');
										}
										setSaving(false);
									}} disabled={saving} />
								</View>
								{error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}
							</View>
						</View>
					</Modal>
				</>
			)}
			<TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
				<Text style={styles.addButtonText}>Agregar usuario</Text>
			</TouchableOpacity>
			<Modal visible={modalVisible} animationType="slide" transparent>
				<View style={styles.modalContainer}>
					<View style={styles.modalContent}>
						<Text style={{ fontWeight: 'bold', fontSize: 16 }}>Nuevo usuario</Text>
						<TextInput placeholder="Usuario" value={form.usuario} onChangeText={t => setForm(f => ({ ...f, usuario: t }))} style={styles.input} />
						<TextInput placeholder="Contraseña" value={form.password} onChangeText={t => setForm(f => ({ ...f, password: t }))} style={styles.input} secureTextEntry />
						<TextInput placeholder="Nombre" value={form.nombre} onChangeText={t => setForm(f => ({ ...f, nombre: t }))} style={styles.input} />
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
							{['admin', 'movilizador', 'casillero', 'rp'].map(r => (
								<TouchableOpacity
									key={r}
									style={{
										backgroundColor: form.rol === r ? '#007bff' : '#eee',
										padding: 8,
										borderRadius: 6,
										marginRight: 8,
										marginBottom: 8,
									}}
									onPress={() => setForm(f => ({ ...f, rol: r }))}
								>
									<Text style={{ color: form.rol === r ? 'white' : '#333', fontWeight: 'bold' }}>{r}</Text>
								</TouchableOpacity>
							))}
						</View>
						{error && (
							<Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>
						)}
						<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
							<Button title="Cancelar" onPress={() => setModalVisible(false)} />
							<Button title={saving ? 'Guardando...' : 'Guardar'} onPress={handleAddUser} disabled={saving} />
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	userRow: {},
	addButton: { backgroundColor: '#007bff', padding: 16, borderRadius: 12, marginTop: 24, alignItems: 'center', shadowColor:'#007bff', shadowOpacity:0.2, shadowRadius:8, elevation:2 },
	addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing:1 },
	modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
	modalContent: { backgroundColor: 'white', padding: 28, borderRadius: 16, width: 340, shadowColor:'#000', shadowOpacity:0.2, shadowRadius:12, elevation:4 },
	input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginTop: 12, fontSize:16, backgroundColor:'#f4f6fa' },
});
