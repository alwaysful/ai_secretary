import type { PageId } from '../../app/App';
import { useAdminDocs } from '../admin/useAdminDocs';

interface Feature {
  icon: string;
  title: string;
  page?: PageId;
  key?: string;
  lines: string[];
}

const FEATURES: Feature[] = [
  {
    icon: '🚀',
    title: '처음 쓸 때',
    page: 'guide',
    lines: [
      '🚀 시작 가이드: 설치 상태를 자동 확인하며 순서대로 안내.',
      '⚙️ 설정 → 권한: 화면 읽기·PC 조작·마이크·웹캠 중 쓸 것만 켜기.',
      '⬇️ 모델 받기: 채팅 모델(예: qwen3:4b) 1개 이상 다운로드.',
      '✉️ 메일 화면에서 Outlook 연결 → 일정·메일·브리핑 사용 가능.',
      '자세한 설치 방법은 저장소 README.',
    ],
  },
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
      '기본은 로컬 Ollama 모델. 설정에서 Gemini·Claude·OpenAI API로 바꿀 수 있음.',
      '마크다운·코드 표시, 복사, 재생성, 마지막 메시지 편집, 대화 검색.',
      '"메일 요약해줘", "이번 주 일정", "공모전 뭐 있어" 같은 요청은 해당 데이터를 읽어서 답함.',
      '"PC: 할 일" 로 시작하면 PC 조작 실행.',
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
    icon: '📰',
    title: '새 소식 (공지·공모전)',
    page: 'news',
    lines: [
      '카테고리별 게시판 글 모음. 기본: GIST 학사공지, 공모전(위비티·링커리어 등).',
      '공모전은 #분야 태그로 거르기. ☰ 목록 / 📅 달력(접수기간 막대) 보기 전환.',
      '글마다 📅 버튼: 구글 캘린더에 접수 시작·마감 일정 추가.',
      '⚙ 관리: 카테고리·사이트 추가·수정·삭제. 게시판 주소만 넣으면 형식 자동 감지.',
      '1시간마다 확인 → 새 글 알림.',
    ],
  },
  {
    icon: '🎓',
    title: '자격증 검색',
    page: 'certs',
    lines: [
      '자격증 150여 개 기본 목록. 공모전처럼 #분야 태그·종류(국가기술·국가전문·민간·어학)·★관심으로 거르기.',
      '☰ 목록: 이름·주관 · 가장 가까운 접수기간 · 그 회차 시험일 · 평균 준비기간 · 응시료. 📅 달력: 접수·시험·발표 막대.',
      '준비기간·응시료는 참고값. ✎로 직접 수정.',
      '자격증 목록은 DB에 저장. 새 종목만 주 1번 Q-net 종목 목록과 비교해 추가(N 표시).',
      '⚙ 일정 연동: 공공데이터포털 Q-net 시험일정 API 키 넣으면 기사·기능사·국가전문 회차 하루 1번 자동 수집.',
      '그 밖의 자격증(어학·민간): ＋일정으로 직접 입력. ＋자격증으로 목록에 없는 것 추가.',
      '회차마다 구글 캘린더 접수·시험 일정 추가 버튼.',
    ],
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
      '웹캠·화면 읽기 권한이 켜져 있어야 함.',
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
    icon: '🖱️',
    title: 'PC 조작',
    page: 'pc',
    lines: [
      'AI가 화면을 보고 마우스·키보드를 직접 조작. 할 일 입력 → 확인 → 시작.',
      '중지: Esc · Ctrl+Alt+X · 마우스를 화면 모서리로 · ■ 정지 버튼.',
      'PC에서만. Python + 비전 모델 필요. 설정에서 PC 조작 권한 켜기.',
    ],
  },
  {
    icon: '📇',
    title: '단어장 (Anki·회독)',
    page: 'vocab',
    lines: [
      '단어장 파일(.json, aura-vocab 양식) 업로드 → 바로 학습. 텍스트(.txt/.tsv/.csv)·Anki 텍스트 내보내기도 가능.',
      '🔁 복습: Anki 방식 간격 반복. 다시·어려움·알맞음·쉬움 → 잊을 때쯤 다시 보여줌. 하루 새 카드·복습 수 조절.',
      '📖 회독: 단어마다 🔊 발음 보기 · 👁 정답 보기 · 🔁 다시 공부하기 · ✅ 알고 있음. 한 바퀴 다 보면 「다시 공부하기」 단어만 랜덤 순서로 반복, 다 외우면 끝.',
      '❓ 퀴즈: 4지선다 (단어→뜻, 뜻→단어). 전체·모르는 것·틀린 것·별표만 골라 풀기.',
      '📋 단어 목록: 검색·별표·수정·추가. 📊 통계: 진도·정답률·7일 복습 예정·자주 틀리는 단어.',
      '🔊 발음: 브라우저 음성 (단어장 언어 설정). 단축키 Space·1~4·←/→·S.',
      '양식 설명·예시 파일은 단어장 화면 아래 「📄 단어장 파일 양식」.',
    ],
  },
  {
    icon: '🛠️',
    title: '도구',
    page: 'tools',
    lines: [
      'STT: 마이크 녹음·음성 파일 → 글자 (Whisper). 마이크 권한 필요.',
      'OCR: 이미지 끌어놓기·Ctrl+V → 글자.',
      '둘 다 설정에서 로컬 또는 API 선택 가능.',
      '내 사이트: 로비와 별도 바로가기 목록.',
    ],
  },
  {
    icon: '🔊',
    title: 'TTS 읽어주기',
    page: 'tts',
    lines: [
      '글 → 음성. 감정(기쁨·슬픔·화남·차분·설렘·다정) 골라 읽기.',
      '엔진: 브라우저(무료·오프라인), edge-tts(무료·자연스러움), OpenAI·Gemini(감정 연기, 과금).',
      'AI 채팅 답변마다 🔊 버튼. 설정에서 자동 읽기 가능.',
    ],
  },
  {
    icon: '📊',
    title: '통계',
    page: 'stats',
    lines: [
      '공부 집중 시간·위반 횟수, 채팅 사용량, 공지·공모전 수.',
      '🔑 API 사용량·비용: 공급자별 토큰·예상 금액. 단가 직접 수정 가능.',
      '💰 월 비용 한도: 경고 비율(%) 넘으면 경고, 차단 켜면 한도 넘을 때 API 호출 멈춤.',
      '🗝 API 키 관리: 통계 화면에서도 키 입력·테스트·삭제.',
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
    lines: [
      '권한: 화면 읽기·PC 조작·마이크·웹캠 각각 켜기/끄기.',
      '모델: 채팅·OCR·STT 기능마다 로컬 / API(Gemini·Anthropic·OpenAI) 선택.',
      '🔑 API 키: 공급자 키 입력. PC에 암호화 저장.',
      '시스템 프롬프트: AI 성격·말투 변경.',
    ],
  },
  {
    icon: '⬇️',
    title: '모델 받기',
    page: 'models',
    key: 'Alt+0',
    lines: [
      '분류별 목록: 🦙 Ollama, 🤗 Hugging Face(GGUF), 🎙 Whisper(음성), 🧩 다른 로컬 AI 앱.',
      '크기·권장 RAM·품질 비교 후 바로 다운로드. 받은 모델은 설정 모델 선택에 표시.',
    ],
  },
  {
    icon: '🏠',
    title: '로비',
    lines: [
      '위젯: 오늘 일정, 안 읽은 메일, 새 소식.',
      '🌐 웹사이트 바로가기: ＋ 추가, ✎ 수정·삭제, 드래그로 순서 변경.',
      '기능 카드를 눌러 각 화면으로 이동.',
      '⏻ 서버 끄기: PC에서만, 확인 후 백엔드·화면 종료.',
    ],
  },
  {
    icon: '🌓',
    title: '화면',
    lines: [
      '다크 모드: 로비 테마 버튼 또는 Ctrl+Shift+L.',
      '단축키 목록: ? 키.',
      '소개 페이지: 처음 접속 시 표시. 다시 보기는 주소 끝에 #landing.',
      '모바일 화면 지원.',
    ],
  },
];

export function InfoPage(props: { onBack: () => void; onNavigate: (p: PageId) => void }) {
  const admin = useAdminDocs();
  // 관리자 모드: 관리자 전용 기능도 포함
  const list: Feature[] = admin ? [...admin.features.map((f) => ({ ...f, page: f.page as PageId | undefined })), ...FEATURES] : FEATURES;
  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>정보</h1>
        <button className="ghost info-pdf" onClick={() => window.print()} title="인쇄 창에서 대상: PDF로 저장">
          📄 PDF로 저장
        </button>
      </header>
      <div className="subbody info-page">
        <section className="card">
          <h2>AURA 810</h2>
          <p>내 PC에서 돌아가는 개인 AI 비서. 대화·메일·일정·기억은 PC의 DB에만 저장.</p>
        </section>
        {list.map((f) => (
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
              <div className="chips no-print">
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
