import { NotImplementedNotice } from '../components/NotImplementedNotice';

/**
 * 공지 관리 페이지.
 *
 * QLapServices Admin API 에는 공지(전역 공지/팝업/배너) 관련 엔드포인트가 전혀 없다.
 * 더미로 만들면 "공지가 올라갔다"는 착각을 주므로, 필요한 API 명세만 노출한다.
 */
export function AdminNoticePage() {
  return (
    <div className="flex flex-col gap-4">
      <NotImplementedNotice
        title="공지 관리 (작성 / 수정 / 삭제 / 예약 공지)"
        reason="현재 백엔드(QLapServices Admin API)에 공지 컬렉션과 엔드포인트가 없습니다. 공지를 실제로 운영하려면 아래 API 와 notices 컬렉션을 먼저 구현해야 합니다. 구현되면 이 페이지에 목록/작성 폼을 연결합니다."
        endpoints={[
          { method: 'GET', path: '/api/admin/notices', note: '공지 목록(비활성/예약 포함)' },
          { method: 'POST', path: '/api/admin/notices', note: '공지 작성 { type, title, content, isActive, publishAt?, expiresAt? }' },
          { method: 'PATCH', path: '/api/admin/notices/:id', note: '공지 수정 / 활성 토글 / 예약시간 변경' },
          { method: 'DELETE', path: '/api/admin/notices/:id', note: '공지 삭제' },
          { method: 'GET', path: '/api/notices', note: '(클라이언트용) 노출 중인 공지 조회' },
        ]}
      />
    </div>
  );
}
