import { ReactNode, useCallback, useEffect, useState } from 'react';
import type { PageId } from '../../app/App';
import { api, Health, MailStatus, PcCheck, Settings, ToolsStatus } from '../../shared/api';
import { CopyButton } from '../../shared/CopyButton';
import { markGuideDone } from './seen';

type State = 'ok' | 'todo' | 'optional' | 'wait';

const MARK: Record<State, string> = { ok: '✅ 완료', todo: '⚠️ 필요', optional: '⏸ 선택', wait: '⏳ 확인 중' };

interface Snapshot {
  health: Health | null;
  settings: Settings | null;
  mail: MailStatus | null;
  tools: ToolsStatus | null;
  pc: PcCheck | null;
}

const settle = <T,>(p: Promise<T>) => p.then((v) => v as T | null, () => null);

function Cmd(props: { text: string }) {
  return (
    <div className="guide-cmd">
      <code>{props.text}</code>
      <CopyButton text={props.text} />
    </div>
  );
}

function Step(props: { n: number; title: string; state: State; children: ReactNode }) {
  return (
    <section className={`card guide-step ${props.state}`}>
      <h2>
        <span>
          {props.n}. {props.title}
        </span>
        <span className="guide-mark">{MARK[props.state]}</span>
      </h2>
      {props.children}
    </section>
  );
}

/** 첫 실행 가이드: 다운로드 후 처음 켰을 때 설정 순서. 상태는 5초마다 자동 확인 */
export function GuidePage(props: { onBack: () => void; onNavigate: (p: PageId) => void }) {
  const [s, setS] = useState<Snapshot | undefined>(undefined);

  const load = useCallback(() => {
    void Promise.all([
      settle(api.health()),
      settle(api.settings()),
      settle(api.mailStatus()),
      settle(api.toolsStatus()),
      settle(api.pcCheck()),
    ]).then(([health, settings, mail, tools, pc]) => setS({ health, settings, mail, tools, pc }));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const go = (p: PageId) => () => props.onNavigate(p);
  const finish = () => {
    markGuideDone();
    props.onBack();
  };

  const loading = s === undefined;
  const h = s?.health ?? null;
  const st = s?.settings ?? null;
  const backendOk = !!h && h.db === 'ok';
  const ollamaOk = !!h && h.model.reachable && h.model.installed !== false;
  const chatApi = st?.routes.chat.source === 'api';
  const apiKeyCount = st ? Object.values(st.apiKeys).filter((k) => k.set).length : 0;
  const modelOk = ollamaOk || (chatApi && apiKeyCount > 0);
  const permsOn = st ? [st.screenRead && '화면 읽기', st.pcControl && 'PC 조작', st.mic && '마이크', st.webcam && '웹캠'].filter(Boolean) : [];
  const mail = s?.mail ?? null;
  const sttOk = !!s?.tools?.stt.ok;
  const pcOk = !!s?.pc?.ok;

  const state = (ok: boolean, required: boolean): State => (loading ? 'wait' : ok ? 'ok' : required ? 'todo' : 'optional');

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>시작 가이드</h1>
      </header>
      <div className="subbody">
        <section className="card">
          <h2>처음 실행했나요?</h2>
          <p>위에서부터 차례로 하면 돼요. 1·2번만 필수, 나머지는 쓸 기능만. 상태는 5초마다 자동 확인돼요.</p>
          <p className="muted">이 화면은 로비 「🚀 시작 가이드」에서 언제든 다시 열 수 있어요.</p>
        </section>

        <Step n={1} title="서버·DB 실행" state={state(backendOk, true)}>
          {backendOk ? (
            <p>백엔드와 DB가 켜져 있어요.</p>
          ) : (
            <>
              <p>{h ? 'DB가 꺼져 있어요.' : '백엔드에 연결이 안 돼요.'} Docker Desktop을 켠 뒤 <code>start-aura.bat</code>를 다시 실행하세요.</p>
              <p className="muted">Docker Desktop이 없으면 docker.com에서 설치. 터미널에서는 아래 명령.</p>
              <Cmd text="npm.cmd start" />
            </>
          )}
        </Step>

        <Step n={2} title="AI 모델 준비" state={state(modelOk, true)}>
          <p>둘 중 하나만 하면 돼요.</p>
          <ul className="info-list">
            <li>
              <b>A. 내 PC에서 실행 (무료)</b>: Ollama 설치(ollama.com) 후 「⬇️ 모델 받기」에서 채팅 모델 다운로드. 16GB RAM이면 <code>qwen3:4b</code> 추천.
              {h && !h.model.reachable && <span className="error"> · Ollama 꺼져 있음</span>}
              {h && h.model.reachable && h.model.installed === false && <span className="error"> · {h.model.name} 미설치</span>}
              {ollamaOk && <span className="ok-text"> · {h?.model.name} 준비됨</span>}
            </li>
            <li>
              <b>B. API 사용 (유료, PC 느릴 때)</b>: 「⚙️ 설정」 → API 키에 Gemini·Anthropic·OpenAI 키 입력 → 모델에서 AI 채팅을 API로.
              {chatApi && apiKeyCount > 0 && <span className="ok-text"> · API 사용 중</span>}
            </li>
          </ul>
          <div className="chips">
            <button className="ghost" onClick={go('models')}>
              ⬇️ 모델 받기
            </button>
            <button className="ghost" onClick={go('settings')}>
              ⚙️ 설정
            </button>
          </div>
        </Step>

        <Step n={3} title="권한 켜기" state={state(permsOn.length > 0, false)}>
          <p>「⚙️ 설정」 → 권한에서 쓸 기능만 켜세요. 언제든 끌 수 있어요.</p>
          <ul className="info-list">
            <li>👁️ 화면 읽기: 공부 집중 딴짓 감시, PC 조작</li>
            <li>🖱️ PC 조작: AI가 마우스·키보드 조작</li>
            <li>🎤 마이크: 도구 탭 음성 → 글자</li>
            <li>📷 웹캠: 공부 집중 자세·졸음 감시</li>
          </ul>
          {permsOn.length > 0 && <p className="ok-text">켜짐: {permsOn.join(', ')}</p>}
          <div className="chips">
            <button className="ghost" onClick={go('settings')}>
              ⚙️ 권한 설정
            </button>
          </div>
        </Step>

        <Step n={4} title="Outlook 연결 (메일·일정·브리핑)" state={state(!!mail?.connected, false)}>
          {mail?.connected ? (
            <p>연결됨{mail.email ? <code>: ${mail.email}</code> : ''}.</p>
          ) : mail && !mail.configured ? (
            <>
              <p>먼저 Azure 앱 등록이 필요해요. README 「Outlook 연동」을 따라 <code>backend/.env</code>에 아래 두 줄을 넣고 서버를 다시 켜세요.</p>
              <Cmd text="MS_CLIENT_ID=앱_클라이언트_ID" />
              <Cmd text="TOKEN_ENC_KEY=64자리_키" />
              <p className="muted">키 만들기:</p>
              <Cmd text={`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`} />
            </>
          ) : (
            <p>「✉️ 메일」에서 Outlook 연결 → 표시된 주소 접속 → 코드 입력.</p>
          )}
          <div className="chips">
            <button className="ghost" onClick={go('mail')}>
              ✉️ 메일
            </button>
          </div>
        </Step>

        <Step n={5} title="Python 기능 (음성 → 글자, PC 조작)" state={state(sttOk || pcOk, false)}>
          <p>python.org에서 Python 3.10 이상 설치 (설치 화면에서 「Add to PATH」 체크). 그다음 AURA 폴더 터미널에서:</p>
          <Cmd text="python -m pip install -r pc-agent\requirements-stt.txt" />
          <Cmd text="python -m pip install -r pc-agent\requirements.txt" />
          <ul className="info-list">
            <li>
              🎙️ 음성 → 글자: {sttOk ? <span className="ok-text">준비됨</span> : <span className="muted">{s?.tools?.stt.detail || '미설치'}</span>}
            </li>
            <li>
              🖱️ PC 조작: {pcOk ? <span className="ok-text">준비됨</span> : <span className="muted">{s?.pc?.detail || '미설치'}</span>}
              {' '}
              <span className="muted">(비전 모델 <code>qwen2.5vl:7b</code> 필요)</span>
            </li>
          </ul>
          <p className="muted"><code>start-aura.bat</code>는 Python이 있으면 자동 설치를 시도해요. 설치 후 AURA를 다시 켜세요.</p>
        </Step>

        <Step n={6} title="공부 집중 (웹캠·화면 감시)" state="optional">
          <p>자세·졸음 감지 모델을 받고, 권한에서 웹캠·화면 읽기를 켜세요.</p>
          <Cmd text="npm.cmd run models" />
          <p className="muted">화면 딴짓 분석은 비전 모델(예: gemma4:12b)도 필요해요. 「⬇️ 모델 받기」에서 다운로드.</p>
          <div className="chips">
            <button className="ghost" onClick={go('study')}>
              📚 공부 집중
            </button>
          </div>
        </Step>

        <Step n={7} title="폰 연결 (Android)" state="optional">
          <p>폰에서 딴짓 앱을 열면 알림. 「📱 폰 감시」에서 QR로 연결해요. 앱 설치는 README 「Android 앱」 참고.</p>
          <div className="chips">
            <button className="ghost" onClick={go('phone')}>
              📱 폰 감시
            </button>
          </div>
        </Step>

        <section className="card">
          <h2>다 했으면</h2>
          <p>기능 설명은 「ℹ️ 정보」, 단축키는 <kbd>?</kbd>. 업데이트는 AURA 폴더에서 <code>git pull</code> 후 다시 실행.</p>
          <div className="chips">
            <button className="primary" onClick={finish}>
              시작하기 →
            </button>
            <button className="ghost" onClick={go('info')}>
              ℹ️ 정보
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
