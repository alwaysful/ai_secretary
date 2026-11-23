/**
 * 랜딩 정적 문구·상태. 실제 API 데이터 아님 (데모 그래픽용 임시 값).
 * status: live = 현재 동작, partial = 일부 구현, roadmap = 개발 예정
 */
export type Status = 'live' | 'partial' | 'roadmap';

export const STATUS_LABEL: Record<Status, string> = {
  live: '사용 가능',
  partial: '일부 구현',
  roadmap: '로드맵',
};

export const REPO_URL = 'https://github.com/alwaysful/ai_secretary';
export const CONTACT_URL = `${REPO_URL}/issues`;

export interface TechItem {
  title: string;
  desc: string;
  status: Status;
}

export const TECH: TechItem[] = [
  { title: 'LLM Integration', desc: 'Ollama 로컬 모델 연동. 설정에서 모델 전환.', status: 'live' },
  { title: 'Long-term Memory', desc: '대화에서 사실을 추출해 저장·검색. 기억 관리 화면 제공.', status: 'live' },
  { title: 'Tool Calling', desc: '일정·메일·새 소식 도구 호출. 쓰기 작업은 사용자 확인 후 실행.', status: 'live' },
  { title: 'Context Management', desc: '대화 이력·기억·오늘 일정을 프롬프트 맥락으로 구성.', status: 'live' },
  { title: 'Local / Cloud Hybrid', desc: '현재 로컬 PC + 폰(Tailscale) 구성. 클라우드 모델 연동 예정.', status: 'partial' },
  { title: 'Multi-Agent Architecture', desc: '작업별 전문 에이전트 분리·협업 구조.', status: 'roadmap' },
];

export const STEPS = [
  { key: 'Understand', ko: '이해', desc: '요청과 맥락 파악' },
  { key: 'Remember', ko: '기억', desc: '관련 기억 검색·활용' },
  { key: 'Plan', ko: '계획', desc: '모델·도구 선택, 단계 수립' },
  { key: 'Execute', ko: '실행', desc: '작업 수행, 결과 보고' },
] as const;
