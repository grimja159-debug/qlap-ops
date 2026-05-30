import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { MeResponse } from '../types/auth';

/**
 * 인증 상태 타입 + Context + useAuth 훅.
 *
 * [왜 컴포넌트 파일과 분리?] react-refresh 는 "컴포넌트만 export 하는 파일"에서 동작한다.
 * AuthProvider(컴포넌트)와 useAuth(훅)/Context(값)를 한 파일에 두면 fast-refresh 가 깨지므로,
 * 비(非)컴포넌트 export 는 여기 .ts 파일에 모으고 Provider 컴포넌트만 AuthContext.tsx 에 둔다.
 */
export interface AuthState {
  firebaseUser: User | null;
  me: MeResponse | null;
  isAuthenticated: boolean;
  /** 운영자 콘솔 사용 가능 여부 = status==='active' && role∈{operator,admin,super_admin}. */
  isOperator: boolean;
  isLoading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
