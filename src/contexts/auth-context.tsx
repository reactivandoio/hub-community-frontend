'use client';

import { useMutation } from '@apollo/client';
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react';

import { isTokenExpired } from '@/lib/jwt';
import { REQUEST_LOGIN_CODE, UPDATE_USER_PHONE, VERIFY_LOGIN_CODE } from '@/lib/queries';
import type {
  AuthContextType,
  AuthState,
  RequestLoginCodeResponse,
  User,
  VerifyLoginCodeResponse,
} from '@/lib/types';

const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
};

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_ERROR' }
  | { type: 'SIGN_OUT' }
  | { type: 'LOAD_FROM_STORAGE'; payload: { user: User; token: string } }
  | { type: 'SHOW_LOGOUT_ALERT' }
  | { type: 'HIDE_LOGOUT_ALERT' }
  | { type: 'UPDATE_USER'; payload: { user: User } }
  | { type: 'HYDRATED' };

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  showLogoutModal: false,
  isHydrated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
      };
    case 'AUTH_ERROR':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
      };
    case 'SIGN_OUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
      };
    case 'LOAD_FROM_STORAGE':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
      };
    case 'SHOW_LOGOUT_ALERT':
      return {
        ...state,
        showLogoutModal: true,
      };
    case 'HIDE_LOGOUT_ALERT':
      return {
        ...state,
        showLogoutModal: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload.user,
      };
    case 'HYDRATED':
      return { ...state, isHydrated: true };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const [requestLoginCodeMutation] = useMutation<RequestLoginCodeResponse>(REQUEST_LOGIN_CODE);
  const [verifyLoginCodeMutation] = useMutation<VerifyLoginCodeResponse>(VERIFY_LOGIN_CODE);
  const [updateUserPhoneMutation] = useMutation(UPDATE_USER_PHONE, {
    errorPolicy: 'none',
  });

  // Load auth data from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const userString = localStorage.getItem(STORAGE_KEYS.USER);

      if (token && userString) {
        // Check if token is expired before loading
        if (isTokenExpired(token)) {
          clearStorage();
          return;
        }

        const user = JSON.parse(userString);
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: { user, token } });
      }
    } catch (error) {
      console.error('Error loading auth data from storage:', error);
      // Clear potentially corrupted data
      clearStorage();
    } finally {
      // Pages that need a session (the admin) wait for this before deciding.
      dispatch({ type: 'HYDRATED' });
    }
  }, []);

  // Periodic token validation (check every 5 minutes)
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(
      () => {
        validateToken();
      },
      5 * 60 * 1000
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [state.isAuthenticated, state.token]);

  // Listen for token expired events from Apollo client
  useEffect(() => {
    const handleTokenExpired = () => {
      dispatch({ type: 'SIGN_OUT' });
      dispatch({ type: 'SHOW_LOGOUT_ALERT' });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:tokenExpired', handleTokenExpired);
      return () =>
        window.removeEventListener('auth:tokenExpired', handleTokenExpired);
    }
  }, []);

  // Save auth data to localStorage
  const saveToStorage = (user: User, token: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving auth data to storage:', error);
    }
  };

  // Clear auth data from localStorage
  const clearStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Error clearing auth data from storage:', error);
    }
  };

  // Validate current token and clear if expired
  const validateToken = () => {
    if (state.token && isTokenExpired(state.token)) {
      signOut(true); // Show logout alert
      return false;
    }
    return true;
  };

  // Show logout alert modal
  const showLogoutAlert = () => {
    dispatch({ type: 'SHOW_LOGOUT_ALERT' });
  };

  // Hide logout alert modal
  const hideLogoutAlert = () => {
    dispatch({ type: 'HIDE_LOGOUT_ALERT' });
  };

  // REA-26: login by a code sent to the e-mail. Errors keep the BFF's pt-BR message and code
  // (ApolloError), so the modal can show the cooldown or the tries left.
  const requestLoginCode = async (email: string) => {
    const result = await requestLoginCodeMutation({ variables: { email: email.trim().toLowerCase() } });
    return { resendIn: result.data?.requestLoginCode?.resendIn ?? 60 };
  };

  const verifyLoginCode = async (email: string, code: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await verifyLoginCodeMutation({
        variables: { email: email.trim().toLowerCase(), code: code.replace(/\D/g, '') },
      });
      const session = result.data?.verifyLoginCode;
      if (!session?.token) throw new Error('Não foi possível entrar. Tente novamente.');

      const user: User = {
        id: session.id || undefined,
        email: session.email || email,
        username: session.username || email.split('@')[0],
        name: session.name || undefined,
        phone: session.phone || undefined,
        cpf: session.cpf || undefined,
        date_of_birth: session.date_of_birth || undefined,
        adult_declaration: session.adult_declaration === true,
      };

      saveToStorage(user, session.token);
      dispatch({ type: 'AUTH_SUCCESS', payload: { user, token: session.token } });
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' });
      throw error;
    }
  };

  const signOut = (showAlert = false) => {
    clearStorage();
    dispatch({ type: 'SIGN_OUT' });
    if (showAlert) {
      dispatch({ type: 'SHOW_LOGOUT_ALERT' });
    }
  };

  const updatePhone = async (phone: string) => {
    if (!state.user?.email) {
      throw new Error('Usuário não encontrado. Faça login novamente.');
    }
    try {
      const { data } = await updateUserPhoneMutation({
        variables: { email: state.user.email, phone },
      });
      if (data?.updateUserPhone) {
        const updatedUser: User = {
          ...state.user,
          phone: data.updateUserPhone.phone || phone,
        };
        // Update in memory and localStorage
        dispatch({ type: 'UPDATE_USER', payload: { user: updatedUser } });
        if (state.token) {
          saveToStorage(updatedUser, state.token);
        }
      }
    } catch (error) {
      console.error('Update phone error:', error);
      throw error;
    }
  };
  // Sync partial user data from fresh API responses (e.g., profile page fetch)
  const syncUser = (data: Partial<User>) => {
    if (!state.user) return;
    const updatedUser: User = { ...state.user, ...data };
    if (JSON.stringify(updatedUser) !== JSON.stringify(state.user)) {
      dispatch({ type: 'UPDATE_USER', payload: { user: updatedUser } });
      if (state.token) {
        saveToStorage(updatedUser, state.token);
      }
    }
  };

  const value: AuthContextType = {
    ...state,
    requestLoginCode,
    verifyLoginCode,
    signOut,
    updatePhone,
    syncUser,
    validateToken,
    showLogoutAlert,
    hideLogoutAlert,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

