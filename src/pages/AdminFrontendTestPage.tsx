import { useMemo, useState } from 'react';
import { SelectField, TextField } from '../components/Field';
import { InlineMessage } from '../components/InlineMessage';
import { PageSection } from '../components/PageSection';
import { getDevOnlyEnvValue } from '../services/apiBase';

const MOCK_API_BASE_URL = (
  getDevOnlyEnvValue(['VITE', 'QLAP', 'MOCK', 'API', 'BASE', 'URL']) ??
  (import.meta.env.DEV ? 'http://127.0.0.1:6300' : 'https://api.qlapgg.com/mock')
).replace(/\/+$/, '');

const QLAPGG_FRONTEND_BASE_URL = (
  getDevOnlyEnvValue(['VITE', 'QLAPGG', 'FRONTEND', 'MOCK', 'URL']) ??
  getDevOnlyEnvValue(['VITE', 'QLAPGG', 'FRONTEND', 'BASE', 'URL']) ??
  (import.meta.env.DEV ? 'http://127.0.0.1:5174' : 'https://qlapgg.com')
).replace(/\/+$/, '');

const mockApiHint = import.meta.env.DEV ? '기본값: http://127.0.0.1:6300' : '운영 번들 기본값: https://api.qlapgg.com/mock';

const SCENARIOS = [
  { value: 'free-user', label: 'free-user' },
  { value: 'pro-user', label: 'pro-user' },
  { value: 'no-riot-user', label: 'no-riot-user' },
  { value: 'no-guild-user', label: 'no-guild-user' },
  { value: 'guild-member', label: 'guild-member' },
  { value: 'live-cw-eligible', label: 'live-cw-eligible' },
  { value: 'live-cw-blocked', label: 'live-cw-blocked' },
  { value: 'tournament-eligible', label: 'tournament-eligible' },
  { value: 'tournament-blocked', label: 'tournament-blocked' },
] as const;

const START_PATHS = [
  { value: '/my-info', label: '/my-info' },
  { value: '/guild', label: '/guild' },
  { value: '/qlapgg-live-cw', label: '/qlapgg-live-cw' },
  { value: '/qlapgg-ranking', label: '/qlapgg-ranking' },
  { value: '/qstargram', label: '/qstargram' },
  { value: '/billing', label: '/billing' },
] as const;

type MockStatus = {
  ok?: boolean;
  service?: string;
  status?: string;
  activeScenario?: string;
  selectedScenario?: string;
  firestore?: string;
  scenarios?: string[];
};

function statusText(status: MockStatus | null) {
  if (!status) return '아직 확인하지 않았습니다.';
  return `${status.service ?? 'QLapMock API'} · ${status.status ?? 'unknown'} · activeScenario=${status.activeScenario ?? '-'}`;
}

export function AdminFrontendTestPage() {
  const [scenario, setScenario] = useState('free-user');
  const [startPath, setStartPath] = useState('/my-info');
  const [mockApiBaseUrl, setMockApiBaseUrl] = useState(MOCK_API_BASE_URL);
  const [qlapggBaseUrl, setQlapggBaseUrl] = useState(QLAPGG_FRONTEND_BASE_URL);
  const [status, setStatus] = useState<MockStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewUrl = useMemo(() => {
    const url = new URL(startPath, qlapggBaseUrl.replace(/\/+$/, '') + '/');
    url.searchParams.set('scenario', scenario);
    url.searchParams.set('mockApi', mockApiBaseUrl.replace(/\/+$/, ''));
    return url.toString();
  }, [mockApiBaseUrl, qlapggBaseUrl, scenario, startPath]);

  async function checkStatus() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${mockApiBaseUrl.replace(/\/+$/, '')}/health`, { headers: { 'content-type': 'application/json' } });
      const body = (await response.json()) as MockStatus & { message?: string };
      if (!response.ok || body.ok === false) throw new Error(body.message || `Mock API status ${response.status}`);
      setStatus(body);
      setMessage('Mock API 서버 상태를 확인했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mock API 서버 상태 확인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function openFrontendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${mockApiBaseUrl.replace(/\/+$/, '')}/mock/scenario`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const body = (await response.json()) as MockStatus & { message?: string };
      if (!response.ok || body.ok === false) throw new Error(body.message || `Mock scenario set failed (${response.status})`);
      setStatus(body);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      setMessage('선택한 시나리오를 Mock API 서버에 적용하고 QLapGG 프론트엔드를 열었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'QLapGG 프론트엔드 테스트 열기에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title="QLapGG 프론트엔드 테스트"
        description="실제 QLapGG 프론트엔드를 Mock API 서버에 연결해 Firestore write 없이 UI 클릭 흐름을 확인합니다."
        accent
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <TextField
            label="Mock API base URL"
            value={mockApiBaseUrl}
            onChange={setMockApiBaseUrl}
            hint={mockApiHint}
          />
          <TextField
            label="QLapGG frontend URL"
            value={qlapggBaseUrl}
            onChange={setQlapggBaseUrl}
            hint="mock API base URL로 실행 중인 qlapgg dev server 주소"
          />
          <SelectField label="시나리오" value={scenario} onChange={setScenario} options={SCENARIOS} />
          <SelectField label="시작 화면" value={startPath} onChange={setStartPath} options={START_PATHS} />
        </div>

        <div className="mt-4 rounded border border-zinc-700 bg-zinc-950/50 p-3">
          <p className="text-xs text-zinc-500">QLapGG mock URL preview</p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-300">{previewUrl}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={checkStatus}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-400 disabled:opacity-50"
          >
            Mock API 서버 상태 확인
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={openFrontendTest}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            QLapGG 프론트엔드 테스트 열기
          </button>
        </div>

        <div className="mt-4">
          <InlineMessage kind={message?.includes('실패') || message?.includes('failed') ? 'error' : 'info'}>
            {message ?? statusText(status)}
          </InlineMessage>
        </div>
      </PageSection>

      <PageSection title="실행 전 확인" description="qlapgg 소스는 수정하지 않고 실행 환경만 mock API로 바꿉니다.">
        <div className="grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
          <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
            <p className="font-semibold text-zinc-200">Mock API</p>
            <p className="mt-2 font-mono text-xs text-zinc-500">cd /d "%QLAP_DATA_ROOT%\tools\QLapMock API"</p>
            <p className="font-mono text-xs text-zinc-500">npm.cmd run dev</p>
          </div>
          <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
            <p className="font-semibold text-zinc-200">QLapGG frontend</p>
            <p className="mt-2 font-mono text-xs text-zinc-500">$env:VITE_API_BASE_URL='http://localhost:6300'</p>
            <p className="font-mono text-xs text-zinc-500">pnpm dev --host localhost --port 5174</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          이 화면은 실제 QLapGG 프론트엔드를 사용하지만 API는 QLapMock API를 사용합니다. Mock API는 Firestore SDK를 사용하지 않으며 POST/PATCH/DELETE도 실제 저장 없이 mock 응답만 반환합니다.
        </p>
      </PageSection>
    </div>
  );
}
