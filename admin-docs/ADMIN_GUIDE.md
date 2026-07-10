# QLap Ops — 운영자 콘솔 개발/운영 가이드

> 이 문서 하나로 **1년 뒤 처음 합류한 개발자**도 콘솔의 구조·연결된 API·운영 방법을 이해하고
> 바로 유지보수할 수 있도록 작성했습니다.

- 대상 프론트엔드: `qlap-ops` (Vite + React 19 + TS + Tailwind v4 + TanStack Query + React Router)
- 백엔드: **QLapServices API** (이 콘솔이 호출하는 유일한 백엔드)
- 인증: Firebase Authentication (Google 로그인) → Firebase ID 토큰을 `Authorization: Bearer` 로 전송
- 데이터: 모두 **실제 Firestore** 기반 (더미/목업 데이터 없음)

---

## 0. 30초 요약

- 로그인은 Google. 백엔드 `GET /api/me` 가 돌려준 `role` 이 **`super_admin`(완전 관리자)** 이고
  `status === 'active'` 여야 콘솔에 들어올 수 있다. (operator/admin 은 진입 불가 — `ForbiddenPage`)
- 화면에서 하는 거의 모든 행동은 **QLapServices Admin API(`/api/admin/...`)** 호출이다.
- API 호출 코드는 전부 `src/services/*.ts` 에 모여 있다. 페이지는 서비스 함수만 부른다.
- 백엔드에 **없는 기능**(공지, 상점 CRUD, 길드 변경, 랭킹 계산 등)은 가짜로 만들지 않고
  화면에 “⚠ 백엔드 API 필요” 패널로 **필요한 엔드포인트 명세**를 띄운다. (→ §7)

---

## 1. 실행 / 환경

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 타입체크(tsc -b) + 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

### 환경 변수 (`.env`)

| 변수 | 설명 |
|---|---|
| `VITE_QLAP_SERVICES_API_BASE_URL` | QLapServices API 베이스 URL. 기본 `http://localhost:8080/services` |
| `VITE_FIREBASE_*` | Firebase 웹앱 설정(apiKey, authDomain, projectId 등) |

> **왜 베이스 URL이 하나뿐인가?**
> nginx(`PROJECT_SERVER_BACKEND/nginx/conf/nginx.conf`)가 외부로 프록시하는 경로는
> `/gss/`, `/las/`, `/services/` 뿐이다. `/services/` 는 QLapServices(포트 6000)로 연결된다.
> QLapGuild API 등 다른 서비스는 외부 노출이 없어 콘솔에서 **도달할 수 없다.**
> 그래서 콘솔의 백엔드는 사실상 QLapServices 하나다.

경로 매핑 예: 콘솔이 `/api/admin/users` 호출 → 실제 `http://localhost:8080/services/api/admin/users`
→ nginx → `http://127.0.0.1:6000/api/admin/users`.

---

## 2. 권한 구조

### 역할(role) — `users.role`
`user` < `operator` < `admin` < `super_admin`

- **PRIVILEGED_ROLES** = `operator | admin | super_admin` → 백엔드 `/api/admin/*`(조회/재화 등) 호출 가능.
- **FULL_ADMIN_ROLES** = `super_admin` → **이 콘솔(qlap-ops) 진입 게이트**. operator/admin 은 진입 불가.
- 백엔드 게이트:
  - 일반 admin API: `requireOperator()` → `isOperatorProfile()` (`status==='active'` && role∈privileged)
  - **테스트랩 mutation**: `requireSuperAdmin()` → role==='super_admin' 아니면 `SUPER_ADMIN_REQUIRED`(403)
    (`QLapServices API/src/modules/testLab/testLabRoutes.ts`). `summary` 조회는 operator-level 로 허용.
- 프론트 게이트: `AuthContext.isFullAdmin`(super_admin) → 아니면 `ForbiddenPage`(403) 표시.

### 계정 상태(status) — `users.status`
`active | banned | deleted`
- `banned`/`deleted` 는 운영자라도 콘솔 진입 불가(백엔드도 거부).

### 기능 플래그(access) — `user_access`
`guildCreate | guildManage | aiReport` (각 boolean). 역할과 별개로 “이 기능을 쓸 수 있는가”를 제어.
→ **접근 권한** 페이지에서 토글.

> 인증 흐름: `AuthContext` 가 `onIdTokenChanged` 로 ID 토큰을 받고 `setAuthToken()` 으로 API
> 클라이언트에 주입 → `GET /api/me` 로 프로필/역할 확인. 토큰은 Firebase가 자동 갱신할 때마다 최신값 유지.

---

## 3. 페이지 구조 (사이드바)

메뉴/경로 정의의 단일 소스: `src/routes/navItems.ts` (사이드바·헤더 제목 공유).

| 그룹 | 메뉴 | 경로 | 핵심 기능 | 상태 |
|---|---|---|---|---|
| 개요 | 대시보드 | `/admin` | 유저/길드/시즌 요약, 헬스, 최근 코인 로그 | ✅ 실연동 |
| 사용자 | 유저 관리 | `/admin/users` | **유저 추가**, **서버사이드 검색**, 상세, 코인/티켓 지급·차감, 권한/상태/요금제/인증/Riot 수정, **CS 메모**, **통합 활동 타임라인**, **CSV 내보내기**, **계정 삭제(soft/hard)** | ✅ 실연동 |
| 사용자 | 접근 권한 | `/admin/access` | guildCreate/guildManage/aiReport 토글 | ✅ 실연동 |
| 사용자 | 재화 관리 | `/admin/economy` | 코인/티켓 지급·차감 + 최근 재화 로그 | ✅ 실연동 |
| 게임 | 길드 관리 | `/admin/guilds` | 검색/필터, 상세, **엠블럼 보기/업로드/URL수정/제거**, 생성/해체·정지/완전삭제/길드장변경/강퇴(super_admin) | ✅ 실연동 |
| 게임 | 시즌 관리 | `/admin/seasons` | 목록, 생성, 수정, 종료, 현재 시즌 | ✅ 실연동 |
| 게임 | 테스트랩 | `/admin/test-lab` | 테스트 유저/길드/재화/포인트/시나리오/정리 (super_admin 전용, 실데이터와 분리) | ✅ 실연동 / ⚠ 시즌 빠른도구만 미구현 |
| 게임 | 상점/아이템 | `/admin/items` | 전체(비활성 포함) 목록, **생성/수정/활성토글/삭제**, 지급, **회수** | ✅ 실연동 |
| 운영 | 공지 관리 | `/admin/notice` | 공지 **작성/수정/활성토글/삭제**(종류·고정·노출기간) | ✅ 실연동 |
| 운영 | 운영 로그 | `/admin/logs` | 4종 로그(코인/티켓/길드행동/길드점수) + 필터 | ✅ 실연동 |
| 운영 | 감사 로그 | `/admin/audit` | **모든 admin mutation 통합 감사**(actor/대상/변경) + 필터 + CSV | ✅ 실연동 |
| 운영 | 서버 관리 | `/admin/system` | QLapServices 헬스 체크 + **유지보수 모드 토글** + **길드 생성/가입 조건** | ✅ 실연동 |

> Tournament / AI 페이지는 대응 백엔드 API가 없어 **제거**했다(가짜 페이지를 두지 않는다).
>
> **2026-06-04 확장(super_admin 전용):** 통합 감사 로그·공지·유지보수 모드·실지표 대시보드 집계·아이템 CRUD/회수·
> 서버사이드 유저 검색·유저 메모를 QLapServices `modules/admin/*`(신규) + `modules/guilds`·`modules/items` 확장으로
> 구현했다(아래 §7 의 "필요 API" 중 상당수가 ✅ 로 전환). 신규/확장 엔드포인트는 전부 `requireSuperAdmin`/`assertSuperAdmin`.

---

## 4. 파일 구조

```
src/
├── main.tsx, App.tsx              # 진입점 / 라우터 + QueryClient + AuthProvider
├── index.css                       # Tailwind v4 + 전역 스타일
│
├── lib/
│   ├── firebase.ts                 # Firebase 앱/Auth 초기화
│   ├── constants.ts                # ★ 모든 도메인 enum + 한글 라벨 (백엔드와 1:1)
│   ├── format.ts                   # 날짜/숫자/상대시간/UID 축약/날짜입력 변환
│   └── statusTone.ts               # 상태값 → 배지 색상(tone) 매핑
│
├── types/                          # 백엔드 데이터 형태에 맞춘 타입
│   ├── common.ts auth.ts user.ts access.ts economy.ts
│   └── item.ts season.ts guild.ts log.ts system.ts testLab.ts
│
├── services/                       # ★ API 호출 함수 (페이지는 여기만 호출)
│   ├── api.ts                      # fetch 래퍼: 봉투 해석 + ApiError + 쿼리빌더
│   ├── authApi.ts                  # /api/me
│   ├── userApi.ts                  # /api/admin/users (+:uid, :uid/access)
│   ├── accessApi.ts                # /api/admin/access (+update, :uid)
│   ├── economyApi.ts               # /api/admin/users/:uid/(grant|revoke)-(qlcoin|gmtiket)
│   ├── itemApi.ts                  # /api/items, /api/admin/items/grant
│   ├── seasonApi.ts                # /api/admin/seasons (+:id, create/update/end)
│   ├── guildApi.ts                 # /api/admin/guilds (+:id, members, logs, emblem)
│   ├── logApi.ts                   # /api/admin/logs/{qlCoin,gmTiket,guildActions,guildPoints}
│   ├── systemApi.ts                # /api/health
│   └── testLabApi.ts               # 테스트랩 API 명세 레지스트리(백엔드 구현 전 실제 호출 없음)
│
├── contexts/AuthContext.tsx        # 로그인/토큰/역할 게이트(isOperator)
├── layouts/AdminLayout.tsx         # 인증·권한 가드 + 사이드바/헤더 셸
│
├── routes/
│   ├── navItems.ts                 # 메뉴/제목 단일 소스
│   └── adminRoutes.tsx             # /admin 하위 라우트
│
├── components/                     # 재사용 컴포넌트
│   ├── AdminSidebar / AdminHeader
│   ├── DataTable / StatCard / StatusBadge / ToggleSwitch
│   ├── PageSection / QueryState / InlineMessage / Modal / Field / ConfirmButton / CopyableId
│   ├── NotImplementedNotice        # “백엔드 API 필요” 안내 패널
│   ├── EconomyChangeForm / ItemGrantForm        # 재사용 액션 폼
│   └── UserDetailModal / GuildDetailModal / SeasonFormModal   # 도메인 상세/폼
│
└── pages/                          # 각 메뉴 화면 (서비스 호출 + 컴포넌트 조립)
    └── AdminDashboardPage / AdminUsersPage / AdminAccessPage / AdminEconomyPage /
        AdminGuildsPage / AdminSeasonsPage / AdminTestLabPage / AdminItemsPage / AdminNoticePage /
        AdminLogsPage / AdminSystemPage / LoginPage / ForbiddenPage
```

### 아키텍처 규칙(유지보수 시 지켜주세요)
1. **API 호출은 `services/`에만.** 페이지/컴포넌트는 `fetch` 를 직접 쓰지 않는다.
2. **enum/라벨은 `lib/constants.ts`에만.** 화면에 `'pro_max'`, `'banned'` 같은 문자열 하드코딩 금지.
3. **타입은 `types/`에.** 백엔드 응답 형태가 바뀌면 여기부터 고친다.
4. **로딩/에러는 `<QueryState>`로, 폼 결과는 `<InlineMessage>`로** 일관 처리.
5. **백엔드에 없는 기능은 `<NotImplementedNotice>`로** 필요한 API를 명세한다(가짜 구현 금지).

---

## 5. API 목록 & 설명 (연결된 것 = 전부 QLapServices)

> 응답 봉투: 성공 `{ ok:true, ...data }` / 실패 `{ ok:false, errorCode, message }` (+HTTP 상태코드).
> 모든 `/api/admin/*` 는 `Authorization: Bearer <Firebase ID 토큰>` 필요(운영자 권한).
> 날짜 필드는 ISO 문자열로 직렬화되어 내려온다.

### 5.1 본인 / 인증
| Method | Path | 설명 | 콘솔 사용처 |
|---|---|---|---|
| GET | `/api/me` | 로그인 프로필(없으면 생성). `{ user }` | AuthContext |
| GET | `/api/me/access` | 본인 접근 플래그 | (참고용) |
| GET | `/api/health` | 서비스 헬스. 인증 불필요 | 시스템/대시보드 |
| GET/PATCH | `/api/admin/guild/settings` | 길드 생성/가입 전역 조건. QLapGuild가 `guild_settings/current`에서 읽어 실제 생성/가입/가입신청을 검증 | `{ createAllowedPlans, joinAllowedPlans, createAllowedRoles, joinAllowedRoles, createCostQlCoin, joinCostQlCoin, requireKakao/Riot/Discord* }` |

### 5.2 유저
| Method | Path | 설명 | 본문/필터 |
|---|---|---|---|
| GET | `/api/admin/users` | 목록(최신 일부) `{ users }` | `limit`(≤100) |
| POST | `/api/admin/users` | **유저 생성**(super_admin, Firestore 프로필만·로그인 불가) `{ user }` | `{ uid? email? displayName? plan? role? status? identityVerified? identityProvider? riotId? gameName? tagLine? puuid? initialQlCoin? initialGmTiket? }` |
| GET | `/api/admin/users/:uid` | 단건 `{ user }` | — |
| PATCH | `/api/admin/users/:uid/access` | 프로필 부분수정 `{ user }` | `plan? role? status? identityVerified? identityProvider? riotId? gameName? tagLine? puuid?` |
| POST | `/api/admin/users/:uid/grant-qlcoin` | 코인 지급 `{ result }` | `{ amount>0, reason }` |
| POST | `/api/admin/users/:uid/revoke-qlcoin` | 코인 차감 | `{ amount>0, reason }` |
| POST | `/api/admin/users/:uid/grant-gmtiket` | 티켓 지급 | `{ amount>0, reason }` |
| POST | `/api/admin/users/:uid/revoke-gmtiket` | 티켓 차감 | `{ amount>0, reason }` |
| DELETE | `/api/admin/users/:uid` | **완전 삭제**(super_admin). users/지갑/접근/연동 제거 | `{ confirmation:'DELETE USER' }` |

- **소프트 삭제** = `PATCH …/access { status:'deleted' }` (문서 보존, 복구 가능). **완전 삭제** = 위 DELETE(복구 불가, 권한 계정/본인 거부).

- **권한 변경** = `PATCH …/access { role }`. **계정 정지/해제** = `{ status:'banned' | 'active' }`.
- 차감 시 잔액이 음수가 되면 `INSUFFICIENT_BALANCE`/`GMTIKET_REQUIRED` 로 거부된다.
- `result = { logId, user }` — 변경 후 사용자(잔액 포함)와 로그 ID.

### 5.3 접근 권한 (`user_access`)
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/access` | 목록 `{ accessList, count }` (플래그 필터 가능) |
| GET | `/api/admin/access/:uid` | 단건 `{ access }` |
| POST | `/api/admin/access/update` | 수정 `{ access }` · 본문 `{ uid, guildCreate?, guildManage?, aiReport? }` |

### 5.4 재화 로그 / 운영 로그
| Method | Path | 설명 | 필터 |
|---|---|---|---|
| GET | `/api/admin/logs/qlCoin` | 코인 로그 `{ qlCoinLogs }` | `uid guildId seasonId type limit` |
| GET | `/api/admin/logs/gmTiket` | 티켓 로그 `{ gmTiketLogs }` | 〃 |
| GET | `/api/admin/logs/guildActions` | 길드 행동 로그 `{ guildActions }` | 〃 |
| GET | `/api/admin/logs/guildPoints` | 길드 점수 로그 `{ guildPoints }` | 〃 |

- 코인/티켓 로그의 `createdBy` = **조작한 운영자 UID**(또는 system/본인). → 감사의 핵심.

### 5.5 아이템
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/items` | 활성 아이템 목록 `{ items }` (active=true 만) |
| POST | `/api/admin/items/grant` | 지급 `{ userItem, logId }` · 본문 `{ uid, itemId, quantity, reason }` |

### 5.6 시즌
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/seasons` | 목록 `{ seasons }` |
| GET | `/api/admin/seasons/:id` | 단건 `{ season }` |
| POST | `/api/admin/seasons` | 생성 `{ season }` (모든 필드 필수, 날짜 8개 포함) |
| PATCH | `/api/admin/seasons/:id` | 수정 `{ season }` (부분). **종료** = `{ status:'ended' }` |

### 5.7 길드 (조회 + 운영자 변경)
| Method | Path | 설명 | 본문/필터 |
|---|---|---|---|
| GET | `/api/admin/guilds` | 목록 `{ guilds }` | `seasonId status q limit` |
| GET | `/api/admin/guilds/:id` | 단건 `{ guild }` | — |
| GET | `/api/admin/guilds/:id/members` | 길드원 `{ members }` | — |
| GET | `/api/admin/guilds/:id/logs` | 로그 `{ logs:{ guildActions, guildPoints } }` | — |
| POST | `/api/admin/guilds` | **생성**(super_admin) `{ guild }` | `{ seasonId, name, slug?, ownerUid?, maxMembers?, status?, description? }` |
| PATCH | `/api/admin/guilds/:id` | **상태/기본정보 수정**(super_admin). 해체=`{status:'disbanded'}`, 정지=`{status:'banned'}` | `{ status? name? description? maxMembers? }` |
| DELETE | `/api/admin/guilds/:id` | **완전 삭제**(super_admin). 길드+멤버+슬러그 제거 | `{ confirmation:'DELETE GUILD' }` |
| PATCH | `/api/admin/guilds/:id/owner` | **길드장 변경**(super_admin). 기존 길드장은 manager 강등 | `{ newOwnerUid }` |
| POST | `/api/admin/guilds/:id/emblem` | **엠블럼 파일 업로드**(super_admin). R2 저장 후 `guilds.emblemUrl` 교체 | `multipart/form-data file` |
| PATCH | `/api/admin/guilds/:id/emblem` | **엠블럼 URL 수정/제거**(super_admin) | `{ emblemUrl:string|null }` |
| DELETE | `/api/admin/guilds/:id/emblem` | **엠블럼 제거**(super_admin) | — |
| POST | `/api/admin/guilds/:id/points` | **길드 포인트 추가**(super_admin). 길드 총점+시즌 엔트리 갱신, 사유 로그 기록 | `{ amount, reason }` |
| DELETE | `/api/admin/guilds/:id/members/:uid` | **길드원 강퇴**(super_admin, status=kicked). owner 는 불가 | — |

- 변경 계열은 2026-06-03 QLapServices `guildRoutes`+`adminGuildService` 에 추가(super_admin 전용, `byAdmin` 표시로 감사). 포인트 추가는 2026-06-04 추가되었고 `guildPointLogs`, 공개 `guildPoints/{seasonId}/guilds/{guildId}/logs`, `admin_audit_logs`에 사유를 남긴다.

### 자주 보는 에러 코드
`LOGIN_REQUIRED`(401) · `INVALID_AUTH_TOKEN`(401) · `ADMIN_REQUIRED`(403) ·
`USER_NOT_FOUND`/`GUILD_NOT_FOUND`/`SEASON_NOT_FOUND`(404) ·
`INSUFFICIENT_BALANCE`/`GMTIKET_REQUIRED`(400) · `INVALID_REQUEST`(400) ·
`SLUG_ALREADY_EXISTS`(409). 콘솔은 이를 `ApiError(errorCode, message)`로 변환해 화면에 보여준다.

---

## 6. Firestore 컬렉션 설명

> 출처: `QLapServices API/src` (특히 `guildFirestoreService.ts`, `userProfiles.ts`,
> `accessService.ts`, `itemsService.ts`). 콘솔은 이 컬렉션들을 **API 경유로만** 읽고 쓴다.

| 컬렉션 | 용도 | 주요 필드 |
|---|---|---|
| `users` | 사용자 프로필 | uid, email, displayName, riotId, gameName, tagLine, puuid, plan, role, status, identityVerified, identityProvider, createdAt, updatedAt |
| `user_wallets` | 지갑(잔액) | uid, qlcoin, gmTiketBalance, totalCharged, totalSpent, updatedAt |
| `user_access` | 기능 플래그 | uid, guildCreate, guildManage, aiReport |
| `linked_accounts` | 소셜 연동 | discord, kakao, naver, riot |
| `plans` | 요금제 | id(free/pro/pro_max), monthlyQlCoin, monthlyGmTiket, isActive |
| `guildSeasons` | 시즌 | seasonId, title, status, 기간(8개), require*, tournamentRank*, prize* |
| `guildPointRules` | 시즌별 점수 규칙 | soloRank(티어별 점수), flexRankMultiplier, winOnly 등 |
| `guilds` | 길드 | guildId, seasonId, name, slug, ownerUid, status, memberCount/maxMembers, *Point, currentSeasonRank |
| `guilds/{id}/members` | 길드원(서브컬렉션) | uid, riotId, role(owner/manager/member), status, joinedAt |
| `guildSlugs` | 슬러그 유니크 보장 | `{seasonId}_{slug}` → guildId |
| `qlCoinLogs` | 코인 증감 로그 | uid, amount, type, reason, before/afterBalance, createdBy, createdAt |
| `gmTiketLogs` | 티켓 증감 로그 | + seasonId, guildId |
| `guildActionLogs` | 길드 행동 | guildId, uid, action, usedGmTiket, createdAt |
| `guildPointLogs` | 길드 점수 | guildId, source, point, createdAt |
| `monthlyBenefitGrants` | 월간 혜택 멱등키 | `{uid}_{yearMonth}_{plan}` |
| `items` | 상점 아이템 | id, (name/category/price/currency 등 앱 정의), active |
| `user_items` | 보유 아이템 | uid, itemId, quantity, active |
| `item_logs` | 아이템 지급/사용 | uid, itemId, amount, type(ADMIN_GRANT/USE), reason, actorUid |

---

## 7. 연결 안 된 기능 = 필요한 추가 백엔드 API (요구사항 #2)

아래는 운영 요구에는 있지만 **QLapServices Admin API에 엔드포인트가 없어** 콘솔에서 처리할 수 없는
기능과, 그 기능을 켜기 위해 백엔드에 추가해야 할 API다. 콘솔의 해당 화면에도 동일 내용이
`NotImplementedNotice` 로 표시된다.

### 7.1 유저
| 기능 | 필요한 API |
|---|---|
| 메모 작성 | `PATCH /api/admin/users/:uid/memo { memo }` + `users.memo` 필드 |
| 관리자 행동 통합 감사 | `GET /api/admin/audit-logs` + `admin_audit_logs` 컬렉션 (role/status/access/아이템 변경까지 기록) |

> 참고: 현재 “누가 무엇을”의 추적은 **코인/티켓 로그의 `createdBy`**, **아이템 로그의 `actorUid`**
> 로만 가능하다. 권한/상태/요금제 변경은 대상 문서의 `updatedBy` 만 갱신될 뿐 별도 감사 로그가 없다.

### 7.2 상점/아이템
| 기능 | 필요한 API |
|---|---|
| 아이템 추가/수정/비활성/삭제/가격변경 | `POST/PATCH/DELETE /api/admin/items[/:itemId]`, `GET /api/admin/items`(비활성 포함) |
| 아이템 회수 | `POST /api/admin/items/revoke { uid, itemId, quantity, reason }` |

### 7.3 길드 (변경 계열)
| 기능 | API | 상태 |
|---|---|---|
| 생성 | `POST /api/admin/guilds` | ✅ 구현(super_admin) |
| 해체/정지/잠금/활성 | `PATCH /api/admin/guilds/:id { status }` | ✅ 구현(super_admin) |
| 완전 삭제 | `DELETE /api/admin/guilds/:id` | ✅ 구현(super_admin, 확인문구) |
| 길드장 변경 | `PATCH /api/admin/guilds/:id/owner` | ✅ 구현(super_admin) |
| 길드원 강퇴 | `DELETE /api/admin/guilds/:id/members/:uid` | ✅ 구현(super_admin) |
| 엠블럼 보기/수정 | `POST/PATCH/DELETE /api/admin/guilds/:id/emblem` | ✅ 구현(super_admin, R2 업로드/URL수정/제거) |
| 공지/설정/가입신청 관리 | `PATCH …/notice`, `PATCH …/settings`, `GET …/applications` | ⚠ 미구현 |

> 생성/삭제/길드장변경/강퇴는 2026-06-03 QLapServices(`adminGuildService.ts`)에 운영자용으로 추가했다(=권장안 (a) 채택).
> 공지/설정/가입신청 관리는 아직 미구현 — 필요 시 동일 방식으로 QLapServices 에 추가하거나 QLapGuild API 프록시를 검토.

### 7.4 시즌
| 기능 | 필요한 API |
|---|---|
| 랭킹 계산 실행 | `POST /api/admin/seasons/:id/recalculate-rankings` (현재 QLapGuild 워커에만 존재) |
| 테스트용 상태 빠른 변경 | `POST /api/admin/seasons/:id/status { status, reason }` |
| 테스트용 시즌 복제 | `POST /api/admin/seasons/:id/clone { reason }` |

### 7.4.1 테스트랩 (구현 완료)
`/admin/test-lab` 화면은 개발/스테이징/데모 데이터를 빠르게 만들기 위한 운영 도구다.
**super_admin 전용**이며, QLapServices의 `modules/testLab/*` 에 7개 mutation 이 실제 구현되어
콘솔 버튼이 진짜 API를 호출한다. 모든 생성 데이터에는 아래 메타데이터가 저장된다.

- `isTestUser: true` 또는 `isTestGuild: true`
- `seedBatchId` (생성 단위. 시나리오는 한 batchId 로 묶임)
- `source: "test-lab"` (유저/길드/지갑/접근/연동), 로그는 `testLab: true`
- `createdBy`(작업한 super_admin uid) · `reason` · `createdAt`

> 테스트 유저는 **Firestore 문서만** 만든다(`users`/`user_wallets`/`user_access`/`linked_accounts`).
> Firebase Auth 계정은 만들지 않으므로 실제 로그인은 불가하며, 콘솔/길드/랭킹 화면 검증용이다.

| 기능 | 엔드포인트 | 핵심 동작/안전장치 | 상태 |
|---|---|---|---|
| 테스트 요약 | `GET /api/admin/test-lab/summary` | 테스트 유저/길드 수, 최근 seedBatchId, 현재 시즌, 감사로그 5건 (operator-level) | ✅ |
| 테스트 유저 생성 | `POST .../seed-users` | `count` 1~200, 지갑/접근/연동 문서 동시 생성, test 메타데이터 태깅 | ✅ super_admin |
| 테스트 길드 생성 | `POST .../seed-guilds` | seasonId 검증, owner 자동(기존/신규 테스트 유저), guildSlugs 등록 | ✅ super_admin |
| 길드원 자동 배치 | `POST .../assign-guild-members` | 역할 비율 배치, 부족분 자동 생성, 중복 멤버 방지 | ✅ super_admin |
| 길드 포인트 일괄 | `POST .../bulk-guild-points` | even/random/top_heavy 분포, `guildPointLogs`(testLab) 기록, 대상 길드끼리 순위 | ✅ super_admin |
| 재화 일괄 | `POST .../bulk-wallet` | **테스트 유저만** grant/revoke/set, `qlCoinLogs`/`gmTiketLogs`에 createdBy·reason | ✅ super_admin |
| 시나리오 실행 | `POST .../scenario` | starter_demo/guild_ranking/tournament_advance/wallet_shop 프리셋 | ✅ super_admin |
| 테스트 데이터 정리 | `POST .../cleanup` | dryRun 선행, 실제 삭제는 `DELETE TEST DATA` 확인 + `seedBatchId` 범위의 테스트 메타데이터 보유 문서만 | ✅ super_admin |

- 권한: mutation 은 `requireSuperAdmin`(403 `SUPER_ADMIN_REQUIRED`). 모든 변경은 `testLabAuditLogs` 에 기록.
- 성공 후 React Query 무효화: `admin-users`, `admin-guilds`, `seasons`, `logs`, `test-lab-summary`.
- **미구현(범위 밖)**: 시즌 빠른 도구(`/api/admin/seasons/:id/{status,clone,recalculate-rankings}`)는
  시즌 라우트 변경이 필요해 제외했고, 시즌 탭에 `NotImplementedNotice` 로 표시된다.

### 7.5 공지
| 기능 | 필요한 API |
|---|---|
| 작성/수정/삭제/예약 | `GET/POST/PATCH/DELETE /api/admin/notices` + `notices` 컬렉션 |

### 7.6 시스템
| 기능 | 필요한 API |
|---|---|
| 유지보수 모드 / 멀티서비스 상태판 | `GET /api/admin/system/state`, `POST /api/admin/system/maintenance` |

### 7.7 검색(개선)
| 기능 | 필요한 API |
|---|---|
| 유저 서버사이드 검색 | `GET /api/admin/users?q=&by=email|riotId|displayName` (현재는 목록 100명 내 클라이언트 필터) |

---

## 8. 운영 방법 (시나리오별)

> 모든 지급/차감/수정은 **사유(reason)** 와 함께 기록되며, 운영 로그에서 추적 가능하다.

- **유저 찾기**: 유저 관리 → 검색 기준(닉네임/이메일/RiotID/UID) 선택 후 입력.
  목록(최대 100명)에 없으면 “UID로 직접 열기”로 단건 조회.
- **코인/티켓 지급·차감**: 유저 상세 → “재화·아이템” 탭 → 재화/처리(지급·차감)/수량/사유 → 실행.
  (또는 재화 관리 페이지에서 UID 직접 입력)
- **권한 변경**: 유저 상세 → “정보/수정” → 권한/요금제 저장.
- **계정 정지/해제**: 유저 상세 → “정보/수정” 상단 → 정지/해제 버튼(2단계 확인).
- **아이템 지급**: 유저 상세 → “재화·아이템” → 아이템 지급(itemId 자동완성). (회수는 미지원 §7.2)
- **기능 플래그**: 접근 권한 → UID 조회/목록 → 편집 → 토글 → 저장.
- **시즌 생성**: 시즌 관리 → “+ 새 시즌 생성” → 모든 기간/조건 입력. **종료**는 목록의 종료 버튼.
- **길드 점검**: 길드 관리 → 검색 → 행 클릭 → 정보/길드원/로그 확인.
- **테스트랩 준비**: 테스트랩 → 필요한 seed/cleanup/scenario API 명세 확인. 백엔드 구현 전 실행 버튼은 비활성.
- **로그 감사**: 운영 로그 → 종류 탭 + UID/길드/시즌 필터.
- **헬스 체크**: 시스템(30초 자동 갱신).

---

## 9. 자주 묻는 트러블슈팅

- **403 / “권한이 없습니다”**: 콘솔 진입은 `users.role==='super_admin'` && `status==='active'` 여야 한다.
  (operator/admin 은 진입 불가.) 테스트랩 mutation 에서 `SUPER_ADMIN_REQUIRED` 가 나오면 동일 원인.
- **“서버에 연결할 수 없습니다”(NETWORK_ERROR)**: QLapServices(포트 6000)와 nginx(8080) 기동,
  `.env` 의 베이스 URL 확인.
- **목록에 유저/길드가 안 보임**: 백엔드가 최신 일부(≤100)만 주므로 검색 대신 UID/ID 직접 조회 사용.
- **빌드 실패**: `npm run build` 는 `tsc -b` 를 먼저 돈다. 타입 에러 메시지를 따라 `types/`·`services/` 정합성 확인.

---

_백엔드(`PROJECT_SERVER_BACKEND`)는 기본적으로 읽기 전용 참조다. 단, 테스트랩 기능을 위해
**QLapServices API 의 `modules/testLab/*` 와 `server.ts` manifest** 에 한해 7개 mutation 을 구현했다.
그 외 백엔드 서버/모듈은 수정하지 않으며, 콘솔은 위 API를 통해서만 상호작용한다._
