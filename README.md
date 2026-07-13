# QLap OPS

QLapGG 운영자 콘솔입니다. 운영 API는 서비스별 직접 포트가 아니라 단일 게이트웨이를 사용합니다.

## Runtime

- Public/API gateway: `https://api.qlapgg.com`
- Local gateway: `http://127.0.0.1:8080`
- Local dev frontend: `http://localhost:5173`
- Package manager: `npm`

운영 번들은 기본적으로 `https://api.qlapgg.com/{prefix}` fallback을 사용합니다. 별도 환경변수를 둘 경우에도 `VITE_API_BASE_URL` 하나만 사용합니다.

```env
VITE_API_BASE_URL=https://api.qlapgg.com
```

사용하지 않는 운영 env:

- `VITE_QLAP_SERVICES_API_BASE_URL`
- `VITE_ROFL_API_BASE_URL`
- `VITE_GSS_API_BASE_URL`
- `VITE_TOURNAMENT_API_BASE_URL`
- `VITE_QLAP_GUILD_API_BASE_URL`

## Commands

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run preflight:frontend
npm.cmd run smoke:admin-frontend
```

`preflight:frontend`는 package manager, Firebase data SDK 사용 금지, production API env, build를 검사합니다.

`smoke:admin-frontend`는 다음을 확인합니다.

- dist 번들에 `https://api.qlapgg.com` 포함
- ngrok/직접 포트/서비스별 env 토큰 미포함
- gateway health
- admin 보호 라우트 401
- `/admin/live-cw` SPA route

## Firebase

프론트는 Firebase Auth 로그인 문지기만 사용합니다. Firestore/RTDB/Storage 직접 접근은 금지입니다. 운영 데이터 조회/수정은 서버 API를 통해 처리합니다.

## Local Mock Test

`/admin/frontend-test`의 `localhost:6300` 안내는 QLapMock API 전용 개발 테스트입니다. 운영 배포에는 사용하지 않습니다.
