import type { PageId } from '../../app/App';

interface Feature {
  icon: string;
  title: string;
  page?: PageId;
  key?: string;
  lines: string[];
}

const FEATURES: Feature[] = [
  {
    icon: '☀️',
    title: '아침 브리핑',
    page: 'briefing',
    key: 'Alt+3',
    lines: ['오늘 일정·안 읽은 메일을 AI가 한 번에 요약.', 'Outlook 연결 필요.'],
  },
  {
    icon: '📅',
    title: '내 일정',
    page: 'schedule',
    key: 'Alt+4',
    lines: ['Outlook 캘린더 일정 조회.', '채팅에서 "내일 3시 회의 잡아줘" → 확인 버튼 누르면 실제 등록·수정.'],
  },
  {
    icon: '💬',
    title: 'AI 채팅',
    page: 'chat',
    key: 'Alt+2',
    lines: [
      '로컬 Ollama 모델과 대화. 인터넷으로 내용 안 보냄.',
      '마크다운·코드 표시, 복사, 재생성, 마지막 메시지 편집, 대화 검색.',
      '"메일 요약해줘", "이번 주 일정" 같은 요청은 메일·일정을 읽어서 답함.',
    ],
  },
  {
    icon: '✉️',
    title: '메일',
    page: 'mail',
    key: 'Alt+5',
    lines: ['Outlook 받은편지함 읽기 전용. 보내기·삭제 불가.'],
  },
  {
    icon: '📚',
    title: '공부 집중',
    page: 'study',
    key: 'Alt+8',
    lines: [
      '웹캠으로 자세·졸음·폰 사용, 화면 캡처로 딴짓 감지 → 경고.',
      '🤖 로봇 / 🧑 인간 토글: 경고 말투 변경.',
      '🍅 뽀모도로: 25분 집중 → 5분 휴식 자동 반복.',
      '하단 통계: 일별·주별 집중 시간, 위반 횟수 그래프.',
    ],
  },
  {
    icon: '📱',
    title: '폰 감시',
    page: 'phone',
    lines: [
      'Android 앱이 폰에서 딴짓 앱(유튜브·인스타 등) 열면 알림.',
      'PC 화면 QR로 연결. 설정 마법사가 권한 순서대로 안내.',
    ],
  },
  {
    icon: '📰',
    title: '새 소식 (웹 스크래핑)',
    page: 'news',
    lines: [
      '카테고리별 게시판 글 모음. 기본: 학사공지(GIST 학사·물리광과학과·AI학과), 공모전(위비티·링커리어).',
      '⚙ 관리: 카테고리·사이트 추가·수정·삭제. 게시판 주소만 넣으면 형식 자동 감지, 미리보기로 확인.',
      '같은 카테고리의 같은 공지는 하나로 합치고 사이트별 링크 모두 표시.',
      '1시간마다 확인 → 새 글 OS 알림. 채팅: "새 학사공지 있어?", "공모전 뭐 있어".',
    ],
  },
  {
    icon: '🧠',
    title: '기억 관리',
    page: 'memory',
    key: 'Alt+6',
    lines: ['취향·사실·프로젝트 정보 저장 → 모든 대화에 자동 반영.', '비밀번호·토큰 저장 금지.'],
  },
  {
    icon: '⚙️',
    title: '설정',
    page: 'settings',
    key: 'Alt+7',
    lines: ['사용할 모델 선택, AI 성격·말투(시스템 프롬프트) 변경.'],
  },
  {
    icon: '🌐',
    title: '웹사이트 바로가기',
    lines: ['로비에서 자주 가는 사이트 등록 (크롬 새 탭처럼).', '＋ 추가, ✎ 수정·삭제, 드래그로 순서 변경. 클릭하면 새 탭.'],
  },
  {
    icon: '🌓',
    title: '화면',
    lines: ['다크 모드: 로비 테마 버튼 또는 Ctrl+Shift+L.', '⏻ 서버 끄기: 로비 상단. PC에서만, 확인 후 백엔드·화면 종료.', '단축키 목록: ? 키.', '모바일 화면 지원.'],
  },
];

export function InfoPage(props: { onBack: () => void; onNavigate: (p: PageId) => void }) {
  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>정보</h1>
      </header>
      <div className="subbody">
        <section className="card">
          <h2>AURA 810</h2>
          <p>내 PC에서 돌아가는 개인 AI 비서. 대화·메일·일정·기억은 PC의 DB에만 저장.</p>
        </section>
        {FEATURES.map((f) => (
          <section key={f.title} className="card">
            <h2>
              {f.icon} {f.title}
              {f.key && (
                <>
                  {' '}
                  <kbd>{f.key}</kbd>
                </>
              )}
            </h2>
            <ul className="info-list">
              {f.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {f.page && (
              <div className="chips">
                <button className="ghost" onClick={() => props.onNavigate(f.page!)}>
                  열기 →
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
