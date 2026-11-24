/**
 * 관리자 전용 문서. /admin/docs (관리자 세션 필요)로만 제공.
 * 일반 로비의 정보·가이드·설정에는 나오지 않음.
 */
export interface AdminFeatureDoc {
  icon: string;
  title: string;
  /** 프런트 PageId */
  page?: string;
  /** 로비 카드 부제 */
  hint?: string;
  lines: string[];
}

export interface AdminGuideStep {
  title: string;
  lines: string[];
}

export interface InProgressItem {
  title: string;
  status: '계획' | '진행 중' | '일부 완료';
  note: string;
}

export const ADMIN_FEATURES: AdminFeatureDoc[] = [
  {
    icon: '🔐',
    title: '관리자 모드',
    lines: [
      '로비 왼쪽 위 로고 클릭 → 코드 입력. 코드는 서버만 확인.',
      '들어오면 로고가 "AURA is our Life"로 바뀌고 관리자 카드가 추가됨.',
      'Life 로고 클릭 → 잠금. 세션 30분. 5회 틀리면 60초 잠김.',
      '코드 변경: 고급설정 → 🔑 관리자 코드 (backend/.env ADMIN_CODE에 저장).',
    ],
  },
  {
    icon: '🛠️',
    title: '고급설정',
    page: 'admin',
    hint: '상태·로그·백업·권한',
    lines: [
      '서버·DB·Ollama 상태, 메모리, 가동 시간.',
      '🔑 관리자 코드 바꾸기: 지금 코드 + 새 코드. 바로 적용, .env 에 저장.',
      '데이터 개수, 백업 JSON 저장 (API 키·메일 토큰 제외).',
      'API 사용량 30일, 스크래퍼 사이트별 상태·지금 실행.',
      '권한 강제 변경 (원격 기기에서도 켜기), 데이터 초기화, 서버 로그.',
      '⬆ 업데이트: 새 버전 확인(git fetch) → git pull → 의존성 바뀌면 npm install 자동.',
      '🔄 재시작: 새 창에서 start-aura 다시 실행, 기존 창은 자동 종료.',
      '구현 중인 기능 목록.',
    ],
  },
  {
    icon: '💕',
    title: 'AI 친구',
    page: 'companion',
    hint: 'Live2D·음성 대화',
    lines: [
      '왼쪽 채팅, 오른쪽 Live2D 캐릭터. 대화는 일반 채팅과 분리 저장.',
      'Live2D 모델 업로드: Cubism 3 이상 모델 폴더를 zip으로 (*.model3.json 포함). 여러 개 저장·전환.',
      '말할 때 입 움직임, 감정 바꾸면 표정·모션 (모델에 있을 때).',
      '음성 프리셋: 엔진·목소리·속도·감정 묶음. AI 친구 화면에만 적용. 직접 저장 가능.',
      '성격 프리셋: 다정·츤데레·활발·차분·장난꾸러기 + 직접 만든 것.',
    ],
  },
];

export const ADMIN_GUIDE: AdminGuideStep[] = [
  {
    title: 'AI 친구 준비',
    lines: [
      '로비 💕 AI 친구 → 오른쪽 ⚙ 꾸미기.',
      'Live2D: 모델 폴더 zip 업로드 (Cubism 3+, 30MB 이하). 무료 샘플은 Live2D 공식 사이트.',
      '음성 프리셋 고르기 (edge-tts 무료 권장). 성격 프리셋 고르기.',
      '렌더러는 Live2D Cubism Core를 공식 CDN에서 받음 → 인터넷 필요. 오프라인이면 frontend/public/live2dcubismcore.min.js 넣기.',
    ],
  },
  {
    title: '업데이트·재시작',
    lines: [
      '고급설정 → ⬆ 업데이트 확인 → 새 커밋 보이면 업데이트.',
      '로컬에서 고친 파일 있으면 pull 실패할 수 있음 → 목록 확인.',
      '"재시작 필요" 뜨면 🔄 재시작. 새 AURA 창 뜨고 30초쯤 뒤 다시 접속.',
    ],
  },
  {
    title: '정기 점검',
    lines: ['고급설정 → 스크래퍼 오류 확인.', '서버 로그 "오류" 필터 확인.', '백업 JSON 주기적으로 저장.'],
  },
];

export const IN_PROGRESS: InProgressItem[] = [
  { title: 'Live2D 캐릭터', status: '일부 완료', note: '업로드·전환·입 모양 됨. 실제 음성 크기 기반 립싱크·시선 추적 예정' },
  { title: '음성 대화', status: '계획', note: '마이크 → STT → 답변 → TTS 연속 대화' },
  { title: 'Multi-agent', status: '계획', note: '작업별 에이전트 분담' },
  { title: '클라우드 LLM 라우팅', status: '일부 완료', note: '기능별 로컬/API 선택 됨. 자동 전환 예정' },
  { title: '관리자 로그 보관', status: '계획', note: '현재 메모리 300줄. 파일 저장 예정' },
];
