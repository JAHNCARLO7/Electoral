	import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useUser } from '../../../context/UserContext';

	interface LoginProps {
		onLogin?: (usuario: string, password: string) => Promise<void>;
	}


	const Login: React.FC<LoginProps> = ({ onLogin }) => {
		const { setUser } = useUser();
		const [usuario, setUsuario] = useState('');
		const [password, setPassword] = useState('');
		const [loading, setLoading] = useState(false);
		const [showPass, setShowPass] = useState(false);

		// Función para autenticar contra la API electoral
		const loginWithAPI = async (usuario: string, password: string) => {
			try {
				const response = await fetch('http://10.0.2.2:8080/api/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ usuario, password }),
				});
				const data = await response.json();
				if (!response.ok || !data.success) {
					throw new Error(data.error || 'Usuario o contraseña incorrectos.');
				}
				setUser(data.user);
				Alert.alert('Bienvenido', `Hola ${data.user.nombre} (${data.user.rol})`);
				// Redirigir según el rol
				if (data.user.rol === 'admin') {
					router.replace('/Proyect/admin/admin');
				} else if (data.user.rol === 'movilizador') {
					router.replace('/Movilizador/movilizador');
				} else if (data.user.rol === 'casillero') {
					router.replace('/Proyect/casillero/casillero');
				} else if (data.user.rol === 'rp') {
					router.replace('/Proyect/rp/rp');
				}
			} catch (err: any) {
				Alert.alert('Error', err.message || 'Error de autenticación');
			}
		};

		const handleLogin = async () => {
			if (!usuario.trim() || !password.trim()) {
				Alert.alert('Error', 'Ingresa tu usuario y contraseña.');
				return;
			}
			setLoading(true);
			try {
				// Enviar el usuario exactamente como lo escribió el usuario (case-sensitive)
				await loginWithAPI(usuario, password);
			} finally {
				setLoading(false);
			}
		};

		return (
			<View style={styles.root}>
				<View style={styles.accentBar} />
				<View style={styles.headerContainer}>
					<View style={styles.shieldWrapper}>
						<View style={styles.shieldOuter}>
							<View style={styles.shieldInner}>
								<Text style={styles.shieldEmoji} accessibilityLabel="escudo">🗳️</Text>
							</View>
						</View>
					</View>
					<Text style={styles.appTitle}>ELECTORAL</Text>
					<Text style={styles.appSubtitle}>Sistema de Gestión Electoral</Text>
					<View style={styles.dividerRow}>
						<View style={styles.dividerLine} />
						<View style={styles.dividerDot} />
						<View style={styles.dividerLine} />
					</View>
				</View>
				<View style={styles.formContainer}>
					<View style={styles.inputWrapper}>
						<Text style={styles.inputLabel}>USUARIO</Text>
						<View style={styles.inputRow}>
							<Text style={styles.inputIcon}>👤</Text>
							<TextInput
								style={styles.input}
								placeholder="Ingresa tu usuario"
								value={usuario}
								onChangeText={setUsuario}
								autoCapitalize="none"
								autoCorrect={false}
								textContentType="username"
							/>
						</View>
						<View style={styles.inputUnderline} />
					</View>
					<View style={[styles.inputWrapper, { marginTop: 28 }]}>
						<Text style={styles.inputLabel}>CONTRASEÑA</Text>
						<View style={styles.inputRow}>
							<Text style={styles.inputIcon}>🔒</Text>
							<TextInput
								style={styles.input}
								placeholder="Ingresa tu contraseña"
								value={password}
								onChangeText={setPassword}
								secureTextEntry={!showPass}
								textContentType="password"
							/>
							<TouchableOpacity onPress={() => setShowPass(!showPass)} accessibilityLabel="Mostrar/Ocultar contraseña">
								<MaterialCommunityIcons
									name={showPass ? 'eye-off' : 'eye'}
									size={24}
									color="#888"
								/>
							</TouchableOpacity>
						</View>
						<View style={styles.inputUnderline} />
					</View>
					<TouchableOpacity
						style={styles.loginButton}
						onPress={handleLogin}
						disabled={loading}
					>
						{loading ? (
							<ActivityIndicator color="#fff" />
						) : (
							<View style={styles.loginButtonContent}>
								<Text style={styles.loginButtonText}>INGRESAR</Text>
								<Text style={styles.loginButtonArrow}>→</Text>
							</View>
						)}
					</TouchableOpacity>
					<View style={styles.securityNote}>
						<Text style={styles.securityDot}>●</Text>
						<Text style={styles.securityText}>Acceso restringido · Sistema electoral oficial</Text>
					</View>
				</View>
				<View style={styles.footer}>
					<Text style={styles.footerText}>Aguascalientes · Jornada Electoral 2027</Text>
				</View>
				<View style={styles.accentBarBottom} />
			</View>
		);
	};

	const styles = StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: '#fff',
			paddingTop: Platform.OS === 'android' ? 40 : 60,
			paddingHorizontal: 16,
		},
		accentBar: {
			height: 6,
			backgroundColor: '#1e90ff',
			borderRadius: 3,
			marginBottom: 12,
		},
		headerContainer: {
			alignItems: 'center',
			marginBottom: 16,
		},
		shieldWrapper: {
			alignItems: 'center',
			marginBottom: 8,
		},
		shieldOuter: {
			backgroundColor: '#e6e6e6',
			borderRadius: 32,
			padding: 8,
		},
		shieldInner: {
			backgroundColor: '#fff',
			borderRadius: 24,
			padding: 8,
		},
		shieldEmoji: {
			fontSize: 32,
		},
		appTitle: {
			fontSize: 28,
			fontWeight: 'bold',
			color: '#1e90ff',
			marginBottom: 2,
		},
		appSubtitle: {
			fontSize: 16,
			color: '#555',
			marginBottom: 8,
		},
		dividerRow: {
			flexDirection: 'row',
			alignItems: 'center',
			marginBottom: 12,
		},
		dividerLine: {
			flex: 1,
			height: 1,
			backgroundColor: '#ccc',
		},
		dividerDot: {
			width: 8,
			height: 8,
			borderRadius: 4,
			backgroundColor: '#1e90ff',
			marginHorizontal: 6,
		},
		formContainer: {
			backgroundColor: '#f9f9f9',
			borderRadius: 12,
			padding: 16,
			marginBottom: 16,
		},
		inputWrapper: {
			marginBottom: 8,
		},
		inputLabel: {
			fontSize: 12,
			color: '#888',
			marginBottom: 2,
		},
		inputRow: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: '#fff',
			borderRadius: 6,
			borderWidth: 1,
			borderColor: '#ddd',
			paddingHorizontal: 8,
			paddingVertical: 4,
		},
		inputIcon: {
			fontSize: 18,
			marginRight: 6,
		},
		input: {
			flex: 1,
			fontSize: 16,
			color: '#222',
			paddingVertical: 6,
		},
		eyeIcon: {
			fontSize: 18,
			marginLeft: 8,
		},
		inputUnderline: {
			height: 1,
			backgroundColor: '#e0e0e0',
			marginTop: 2,
		},
		loginButton: {
			backgroundColor: '#1e90ff',
			borderRadius: 8,
			paddingVertical: 12,
			alignItems: 'center',
			marginTop: 24,
			flexDirection: 'row',
			justifyContent: 'center',
		},
		loginButtonContent: {
			flexDirection: 'row',
			alignItems: 'center',
		},
		loginButtonText: {
			color: '#fff',
			fontSize: 18,
			fontWeight: 'bold',
			marginRight: 8,
		},
		loginButtonArrow: {
			color: '#fff',
			fontSize: 20,
		},
		securityNote: {
			flexDirection: 'row',
			alignItems: 'center',
			marginTop: 16,
			justifyContent: 'center',
		},
		securityDot: {
			color: '#1e90ff',
			fontSize: 12,
			marginRight: 4,
		},
		securityText: {
			color: '#888',
			fontSize: 12,
		},
		footer: {
			alignItems: 'center',
			marginTop: 8,
		},
		footerText: {
			color: '#aaa',
			fontSize: 12,
		},
		accentBarBottom: {
			height: 6,
			backgroundColor: '#1e90ff',
			borderRadius: 3,
			marginTop: 12,
		},
	});

	export default Login;
