import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/auth';

const LOGIN_NEXT_STORAGE_KEY = 'qlap_ops_login_next';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/admin')) return '/admin';
  return value;
}

function shouldFallbackToRedirect(error: unknown): boolean {
  if (typeof error !== 'object' || error == null || !('code' in error)) return false;
  const code = String((error as { code?: unknown }).code);
  return code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request';
}

function formatAuthError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error != null && 'code' in error) {
    const code = String((error as { code?: unknown }).code);
    const message = error instanceof Error ? error.message : fallback;
    return `${code}: ${message}`;
  }

  return error instanceof Error ? error.message : fallback;
}

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = useMemo(
    () => safeNextPath(searchParams.get('next') ?? window.sessionStorage.getItem(LOGIN_NEXT_STORAGE_KEY)),
    [searchParams],
  );

  useEffect(() => {
    void getRedirectResult(auth).catch((e) => {
      setError(formatAuthError(e, '로그인 결과를 확인하지 못했습니다.'));
      setSigningIn(false);
    });
  }, []);

  if (!isLoading && isAuthenticated) {
    window.sessionStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
    return <Navigate to={nextPath} replace />;
  }

  const handleGoogleSignIn = async () => {
    setError(null);
    setSigningIn(true);

    try {
      const provider = new GoogleAuthProvider();
      window.sessionStorage.setItem(LOGIN_NEXT_STORAGE_KEY, nextPath);
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (shouldFallbackToRedirect(e)) {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          setError(formatAuthError(redirectError, '로그인에 실패했습니다.'));
          setSigningIn(false);
          return;
        }
      }

      setError(formatAuthError(e, '로그인에 실패했습니다.'));
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-violet-400 font-bold text-2xl">QLap</span>
            <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded font-medium">OPS</span>
          </div>
          <p className="text-zinc-500 text-sm">운영 콘솔 - 관리자 계정 전용</p>
        </div>

        <div className="rounded-lg border border-zinc-700/60 bg-zinc-900 p-6 flex flex-col gap-4">
          <div>
            <h1 className="text-zinc-200 font-semibold text-base">로그인</h1>
            <p className="text-zinc-500 text-xs mt-0.5">QLapGG 운영자 계정으로 로그인하세요.</p>
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={signingIn || isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded bg-white hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-zinc-800"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
            </svg>
            {signingIn ? '로그인 중...' : 'Google 계정으로 계속'}
          </button>

          {error && (
            <div className="rounded bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <p className="text-xs text-zinc-600 text-center">
            운영 권한이 있는 계정만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
