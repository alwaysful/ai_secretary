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
      '코드 변경: backend/.env 의 ADMIN_CODE.',
    ],
  },
  {
    icon: '🖥️',
    title: '서버 관리하기',
    page: 'admin',
    hint: '상태·로그·백업·권한',
    lines: [
      '서버·DB·Ollama 상태, 메모리, 가동 시간.',
      '데이터 개수, 백업 JSON 저장 (API 키·메일 토큰 제외).',
      'API 사용량 30일, 스크래퍼 사이트별 상태·지금 실행.',
      '권한 강제 변경 (원격 기기에서도 켜기), 데이터 초기화, 서버 로그.',
      '구현 중인 기능 목록.',
    ],
  },
  {
    icon: '💕',
    title: 'AI 여자친구',
    page: 'companion',
    hint: 'Live2D·음성 대화',
    lines: [
      '왼쪽 채팅, 오른쪽 Live2D 캐릭터 자리. 대화는 일반 채팅과 분리 저장.',
      '감정 골라 음성으로 답변 (TTS). 자동 읽기 켜고 끔.',
      '성격·말투: 화면의 성격 버튼 또는 설정 → 관리자.',
    ],
  },
];

export const ADMIN_GUIDE: AdminGuideStep[] = [
  {
    title: '관리자 코드 바꾸기',
    lines: ['backend/.env 에 ADMIN_CODE=새코드 추가.', '백엔드 재시작. 비우면 내장 기본 코드.'],
  },
  {
    title: 'AI 여자친구 준비',
    lines: ['설정 → TTS 엔진 고르기 (edge-tts 무료 권장).', '설정 → 관리자 → 성격·말투 편집.', '로비 💕 AI 여자친구 카드로 시작.'],
  },
  {
    title: '정기 점검',
    lines: ['서버 관리하기 → 스크래퍼 오류 확인.', '서버 로그 "오류" 필터 확인.', '백업 JSON 주기적으로 저장.'],
  },
];

export const IN_PROGRESS: InProgressItem[] = [
  { title: 'Live2D 캐릭터', status: '계획', note: 'AI 여자친구 오른쪽 화면. 모델 파일·입 모양 동기화' },
  { title: '음성 대화', status: '계획', note: '마이크 → STT → 답변 → TTS 연속 대화' },
  { title: 'Multi-agent', status: '계획', note: '작업별 에이전트 분담' },
  { title: '클라우드 LLM 라우팅', status: '일부 완료', note: '기능별 로컬/API 선택 됨. 자동 전환 예정' },
  { title: '관리자 로그 보관', status: '계획', note: '현재 메모리 300줄. 파일 저장 예정' },
];
