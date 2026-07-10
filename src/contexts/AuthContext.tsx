import { useEffect, useState } from 'react';
import { onIdTokenChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { setAuthToken } from '../services/api';
import { authApi } from '../services/authApi';
import { isFullAdminRole, isPrivilegedRole } from '../lib/constants';
import type { MeResponse } from '../types/auth';
import { AuthContext } from './auth';

/**
 * 인증 Provider.
 *
 * 흐름:
 *  1) Firebase 로그인(구글) → onIdTokenChanged 가 ID 토큰을 받는다.
 *  2) 토큰을 setAuthToken() 으로 API 클라이언트에 주입한다.
 *     (Firebase 가 약 1시간마다 토큰을 자동 갱신할 때도 이 콜백이 다시 불려 최신 토큰이 유지된다.)
 *  3) GET /api/me 로 백엔드 프로필을 받아 권한(role)을 확인한다.
 *
 * 콘솔 진입 권한(isOperator)은 백엔드 isOperatorProfile 과 동일하게
 * role ∈ {operator, admin, super_admin} 이고 status==='active' 인 경우로 본다.
 * 더미/목업 경로는 없다 — 항상 실제 Firebase + 실제 API 로만 동작한다.
 *
 * (AuthState/useAuth/Context 는 ./auth 에 분리되어 있다.)
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);

      if (user) {
        try {
          const token = await user.getIdToken();
          setAuthToken(token);
          // /api/me 는 프로필이 없으면 생성도 해준다(getOrInitUserProfile).
          const meData = await authApi.getMe();
          setMe(meData);
        } catch (e) {
          setAuthError(e instanceof Error ? e.message : '사용자 정보를 불러오지 못했습니다.');
          setMe(null);
        }
      } else {
        setAuthToken(null);
        setMe(null);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAuthToken(null);
    setMe(null);
  };

  const isAuthenticated = firebaseUser !== null;
  const isOperator = me != null && me.status === 'active' && isPrivilegedRole(me.role);
  // 콘솔 진입은 완전 관리자(super_admin)만 허용한다.
  const isFullAdmin = me != null && me.status === 'active' && isFullAdminRole(me.role);

  return (
    <AuthContext.Provider
      value={{ firebaseUser, me, isAuthenticated, isOperator, isFullAdmin, isLoading, authError, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
