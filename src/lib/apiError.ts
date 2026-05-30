import { ApiError } from '../services/api';

/**
 * mutation/요청 에러를 사용자에게 보여줄 한 줄 메시지로 변환.
 * ApiError 면 errorCode 를 함께 노출해 운영자가 백엔드 원인을 바로 파악하게 한다.
 *
 * (컴포넌트가 아닌 순수 함수라 별도 파일로 둔다 — react-refresh 규칙상 컴포넌트 파일과 섞지 않는다.)
 */
export function errorToMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} (${error.errorCode})`;
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}
