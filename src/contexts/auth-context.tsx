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
import { FORWARD_PASSWORD, RESET_PASSWORD, SIGN_IN, SIGN_UP, UPDATE_USER_PHONE } from '@/lib/queries';
import type {
  AuthContextType,
  AuthState,
  ForwardPasswordResponse,
  ResetPasswordResponse,
  SignInInput,
  SignInResponse,
  SignUpInput,
  SignUpResponse,
  User,
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
  | { type: 'UPDATE_USER'; payload: { user: User } };

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  showLogoutModal: false,
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
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const [signInMutation] = useMutation<SignInResponse>(SIGN_IN, {
    errorPolicy: 'all',
  });
  const [signUpMutation] = useMutation<SignUpResponse>(SIGN_UP, {
    errorPolicy: 'all',
  });
  const [forwardPasswordMutation] = useMutation<ForwardPasswordResponse>(
    FORWARD_PASSWORD,
    { errorPolicy: 'all' }
  );
  const [resetPasswordMutation] = useMutation<ResetPasswordResponse>(
    RESET_PASSWORD,
    { errorPolicy: 'all' }
  );
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

  const signIn = async (input: SignInInput) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await signInMutation({ variables: input });

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.signIn?.token) {
        const user: User = {
          id: result.data.signIn.id || undefined,
          email: result.data.signIn.email || input.identifier,
          username: result.data.signIn.username || input.identifier.split('@')[0],
          name: result.data.signIn.name || undefined,
          phone: result.data.signIn.phone || undefined,
        };

        saveToStorage(user, result.data.signIn.token);
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token: result.data.signIn.token },
        });
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' });
      throw error;
    }
  };

  const signUp = async (input: SignUpInput) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await signUpMutation({ variables: { input } });

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.signUp) {
        dispatch({ type: 'AUTH_ERROR' });
      } else {
        throw new Error('Erro ao criar conta. Tente novamente.');
      }
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

  const forwardPassword = async (email: string) => {
    try {
      const result = await forwardPasswordMutation({ variables: { email } });
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (code: string, password: string, passwordConfirmation: string) => {
    try {
      const result = await resetPasswordMutation({ variables: { code, password, passwordConfirmation } });
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }
    } catch (error) {
      throw error;
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
    signIn,
    signUp,
    signOut,
    forwardPassword,
    resetPassword,
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

