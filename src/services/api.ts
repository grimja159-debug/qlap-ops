/**
 * QLapServices API HTTP 클라이언트 (어드민 콘솔의 유일한 백엔드 진입점).
 *
 * [구조 / 왜 이렇게 했는가]
 *  - 어드민 콘솔이 실제로 도달할 수 있는 백엔드는 QLapServices API 하나뿐이다.
 *    nginx(conf/nginx.conf)가 `/services/` 만 이 API(포트 6000)로 프록시하고,
 *    QLapGuild API 등 다른 서비스는 외부로 노출하지 않기 때문이다.
 *    그래서 BASE_URL 은 `.../services` 한 개만 둔다.
 *  - 백엔드 응답 봉투(envelope)는 항상 다음 둘 중 하나다
 *    (QLapServices API/src/http/responses.ts):
 *      성공:  { ok: true,  ...data }
 *      실패:  { ok: false, errorCode, message }
 *    HTTP 상태코드(401/403/404/409/400/500…)도 함께 내려온다.
 *  - 따라서 이 모듈은 "봉투를 인지"한다: HTTP 가 4xx/5xx 이거나 ok:false 면
 *    errorCode/message 를 담은 ApiError 를 던진다. 각 서비스 함수는 성공 봉투를
 *    그대로 받아 자기 키(users/user/season/…)만 꺼내 쓴다.
 *  - 인증: Firebase ID 토큰을 Authorization: Bearer 로 보낸다.
 *    토큰은 AuthContext 가 onIdTokenChanged 로 최신값을 setAuthToken() 해준다.
 */

const BASE_URL =
  import.meta.env.VITE_QLAP_SERVICES_API_BASE_URL ?? 'http://localhost:8080/services';

/** AuthContext 가 주입하는 현재 Firebase ID 토큰. 비로그인 시 null. */
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * 백엔드 에러를 표준화한 예외.
 * - status: HTTP 상태코드
 * - errorCode: 백엔드 errorCode (예: ADMIN_REQUIRED, USER_NOT_FOUND, GMTIKET_REQUIRED)
 * - message: 사람이 읽을 메시지
 * UI 는 errorCode 로 분기하고, message 를 그대로 보여줄 수 있다.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

/** 성공 응답 봉투의 공통 형태. 나머지 키는 엔드포인트별로 다르다. */
export interface ApiEnvelope {
  ok: true;
  [key: string]: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
    });
  } catch (networkError) {
    // 서버가 꺼져 있거나 CORS/네트워크 단절 — fetch 자체가 실패한 경우.
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      networkError instanceof Error
        ? `서버에 연결할 수 없습니다: ${networkError.message}`
        : '서버에 연결할 수 없습니다.',
    );
  }

  // 본문이 비어 있을 수 있으므로(예: 204) 먼저 text 로 읽고 JSON 파싱을 시도한다.
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = null; // JSON 이 아닌 응답(프록시 오류 페이지 등)
    }
  }

  // HTTP 실패 또는 봉투 ok:false → ApiError 로 변환해 던진다.
  if (!res.ok || (body != null && body.ok === false)) {
    const errorCode = (body?.errorCode as string) ?? `HTTP_${res.status}`;
    const message =
      (body?.message as string) ?? res.statusText ?? '요청을 처리하지 못했습니다.';
    throw new ApiError(res.status, errorCode, message);
  }

  return (body ?? {}) as T;
}

/**
 * 쿼리스트링 빌더.
 * undefined / null / '' 인 값은 제외해서, 빈 필터가 서버로 넘어가지 않게 한다.
 */
export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
