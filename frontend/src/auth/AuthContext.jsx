import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  api,
  setTokens,
  setAuthFailHandler,
  setTokensChangedHandler,
} from '../api/client.js';

const AuthCtx = createContext(null);
const STORE = 'aprueba_admin_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(STORE) || 'null'
      );

      if (saved) {
        setTokens(saved.accessToken, saved.refreshToken);
        return saved.user;
      }
    } catch {
      // No hay una sesión local válida.
    }

    return null;
  });

  const [loggingOut, setLoggingOut] = useState(false);
  const logoutPending = useRef(null);

  // Limpieza local para sesiones expiradas o revocadas.
  const clearLocalSession = useCallback(() => {
    setTokens(null, null);
    setUser(null);

    try {
      sessionStorage.removeItem(STORE);
    } catch {
      // Los tokens en memoria ya quedaron eliminados.
    }
  }, []);

  // Logout solicitado por el usuario: revoca la sesión en el servidor y,
  // pase lo que pase (sin red, token ya inválido, timeout), cierra la sesión
  // local para que el usuario nunca quede atrapado en la consola.
  const logout = useCallback(() => {
    if (logoutPending.current) return logoutPending.current;

    setLoggingOut(true);

    const pending = (async () => {
      try {
        await Promise.race([
          api.logout(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 4000)
          ),
        ]);
      } catch {
        // Best effort: el refresh token caduca solo si el servidor no respondió.
      } finally {
        clearLocalSession();
        setLoggingOut(false);
        logoutPending.current = null;
      }
      return true;
    })();

    logoutPending.current = pending;
    return pending;
  }, [clearLocalSession]);

  // Un fallo de autenticación limpia la sesión local.
  // No intenta llamar al logout con credenciales inválidas.
  useEffect(() => {
    setAuthFailHandler(clearLocalSession);

    return () => {
      setAuthFailHandler(null);
    };
  }, [clearLocalSession]);

  // Persiste los tokens renovados por el refresh automático.
  useEffect(() => {
    setTokensChangedHandler((accessToken, refreshToken) => {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem(STORE) || 'null'
        );

        if (saved) {
          sessionStorage.setItem(
            STORE,
            JSON.stringify({
              ...saved,
              accessToken,
              refreshToken,
            })
          );
        }
      } catch {
        // No se pudo actualizar el almacenamiento local.
      }
    });

    return () => {
      setTokensChangedHandler(null);
    };
  }, []);

  const login = useCallback(async (email, password, otp) => {
    const { data } = await api.login(email, password, otp);

    setTokens(data.accessToken, data.refreshToken);

    try {
      sessionStorage.setItem(STORE, JSON.stringify(data));
    } catch {
      // La sesión puede continuar en memoria.
    }
    setUser(data.user);

    return data.user;
  }, []);

  const canAccess = useCallback((roles) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return roles.includes(user.role);
  }, [user]);

  const hasRole = useCallback((...roles) => {
    if (!user) return false;

    return (
      user.role === 'admin' ||
      roles.includes(user.role)
    );
  }, [user]);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthCtx.Provider
      value={{
        user,
        login,
        logout,
        loggingOut,
        canAccess,
        hasRole,
        isAdmin,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);