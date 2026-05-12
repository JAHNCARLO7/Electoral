import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useUser } from '../../../context/UserContext';
import { API_URL } from '../../../hooks/useAuthFetch';

	interface LoginProps {
		onLogin?: (usuario: string, password: string) => Promise<void>;
	}

	const Login: React.FC<LoginProps> = ({ onLogin }) => {
		const { setUser, setToken, logoutMessage, setLogoutMessage, setSessionActive } = useUser();
		const [usuario, setUsuario] = useState('');
		const [password, setPassword] = useState('');
		const [loading, setLoading] = useState(false);
		const [showPass, setShowPass] = useState(false);
		const [errorMsg, setErrorMsg] = useState<string | null>(null);

		// Limpiar mensaje de cierre de sesión después de mostrarlo
		useEffect(() => {
			if (logoutMessage) {
				const t = setTimeout(() => setLogoutMessage(null), 6000);
				return () => clearTimeout(t);
			}
		}, [logoutMessage]);

		// Función para autenticar contra la API electoral
		const loginWithAPI = async (usuario: string, password: string) => {
			try {
				const response = await fetch(`${API_URL}/auth/login`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ usuario, password }),
				});
				const data = await response.json();
				if (!response.ok || !data.success) {
					throw new Error(data.error || 'Credenciales incorrectas.');
				}
				setSessionActive(true);
				setUser(data.user);
				setToken(data.token);
				// Redirigir según el rol
				if (data.user.rol === 'admin') {
					router.replace('/Proyect/admin/admin');
				} else if (data.user.rol === 'movilizador') {
					router.replace('/Proyect/Movilizador/movilizador');
				} else if (data.user.rol === 'casillero') {
					router.replace('/Proyect/casillero/casillero');
				} else if (data.user.rol === 'rp') {
					router.replace('/Proyect/rp/rp');
				}
			} catch (err: any) {
				const raw = err.message || 'Error de autenticación';
				// Mapear mensajes del backend a texto amigable
				if (raw.includes('inactivo')) setErrorMsg('Tu cuenta ha sido desactivada. Contacta al administrador.');
				else if (raw.includes('incorrectas') || raw.includes('incorrectos')) setErrorMsg('Usuario o contraseña incorrectos.');
				else if (raw.includes('red') || raw.includes('fetch')) setErrorMsg('No se pudo conectar al servidor. Verifica tu conexión.');
				else if (raw.includes('SESION_ACTIVA')) setErrorMsg('Este usuario ya tiene una sesión activa. Cierra la sesión en el otro dispositivo primero.');
				else setErrorMsg(raw);
			}
		};

		const handleLogin = async () => {
			setErrorMsg(null);
			if (!usuario.trim() || !password.trim()) {
				setErrorMsg('Ingresa tu usuario y contraseña.');
				return;
			}
			if (!/^[0-9]{4,}$/.test(password)) {
				setErrorMsg('La contraseña debe tener al menos 4 dígitos numéricos.');
				return;
			}
			setLoading(true);
			try {
				await loginWithAPI(usuario, password);
			} finally {
				setLoading(false);
			}
		};

		return (
			<View style={styles.root}>
				<View style={styles.accentBar} />
			{logoutMessage ? (
				<View style={styles.logoutBanner}>
					<Text style={styles.logoutBannerText}>{logoutMessage}</Text>
				</View>
			) : null}
			{errorMsg ? (
				<View style={styles.errorBanner}>
					<MaterialCommunityIcons name="alert-circle" size={18} color="#c62828" />
					<Text style={styles.errorBannerText}>{errorMsg}</Text>
				</View>
			) : null}
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
		logoutBanner: {
			backgroundColor: '#c62828',
			borderRadius: 8,
			paddingVertical: 10,
			paddingHorizontal: 14,
			marginBottom: 12,
		},
		logoutBannerText: {
			color: '#fff',
			fontWeight: '700',
			fontSize: 14,
			textAlign: 'center',
		},
		errorBanner: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
			backgroundColor: '#fff0f0',
			borderWidth: 1,
			borderColor: '#e57373',
			borderRadius: 8,
			paddingVertical: 10,
			paddingHorizontal: 14,
			marginBottom: 12,
		},
		errorBannerText: {
			flex: 1,
			color: '#c62828',
			fontWeight: '600',
			fontSize: 13,
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
