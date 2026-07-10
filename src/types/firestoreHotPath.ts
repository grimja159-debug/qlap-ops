export type FirestoreHotPathStatus = 'PASS' | 'WARN' | 'FAIL';

export interface FirestoreHotPathCheck {
  name: string;
  endpoints: string[];
  status: FirestoreHotPathStatus;
  source: string;
  evidence: string[];
  risk: string | null;
  recommendation: string | null;
}

export interface FirestoreHotPathReport {
  ok: boolean;
  generatedAt: string;
  checked: number;
  pass: number;
  warn: number;
  fail: number;
  hotPaths: FirestoreHotPathCheck[];
}
