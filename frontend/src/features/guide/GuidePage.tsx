import { ReactNode, useCallback, useEffect, useState } from 'react';
import type { PageId } from '../../app/App';
import { api, ApiError, DeviceLogin, Health, MailStatus, PcCheck, PullJob, SetupJob, SetupTask, Settings, ToolsStatus } from '../../shared/api';
import { CopyButton } from '../../shared/CopyButton';
import { markGuideDone } from './seen';
import { useAdminDocs } from '../admin/useAdminDocs';

type State = 'ok' | 'todo' | 'optional' | 'wait';

const MARK: Record<State, string> = { ok: '✅ 완료', todo: '⚠️ 필요', optional: '⏸ 선택', wait: '⏳ 확인 중' };

interface Snapshot {
  health: Health | null;
  settings: Settings | null;
  mail: MailStatus | null;
  tools: ToolsStatus | null;
  pc: PcCheck | null;
  setup: SetupJob[];
  pulls: PullJob[];
}

/** 「진행」 버튼: 자동으로 할 수 있는 단계만. run 없으면 수동 */
interface Run {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onRun: () => void;
}

const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

function JobLog(props: { job?: SetupJob }) {
  const j = props.job;
  if (!j) return null;
  const tail = j.log.split('\n').filter(Boolean).slice(-6).join('\n');
  return (
    <div className={`guide-log ${j.status}`}>
      <b>{j.status === 'running' ? '⏳ 진행 중…' : j.status === 'done' ? '✅ 자동 진행 완료' : '❌ 실패. 아래 로그 확인 후 수동으로 진행하세요.'}</b>
      <pre>{tail}</pre>
    </div>
  );
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

function Step(props: { n: number; title: string; state: State; run?: Run; children: ReactNode }) {
  const r = props.run;
  return (
    <section className={`card guide-step ${props.state}`}>
      <h2>
        <span>
          {props.n}. {props.title}
        </span>
        <span className="guide-right">
          <span className="guide-mark">{MARK[props.state]}</span>
          {r && props.state !== 'ok' && (
            <button className="primary guide-run no-print" disabled={r.disabled || r.busy} onClick={r.onRun} title="자동으로 가능한 작업 실행">
              {r.busy ? '⏳ 진행 중' : `▶ ${r.label}`}
            </button>
          )}
        </span>
      </h2>
      {props.children}
    </section>
  );
}

/** 첫 실행 가이드: 다운로드 후 처음 켰을 때 설정 순서. 상태는 5초마다 자동 확인 */
export function GuidePage(props: { onBack: () => void; onNavigate: (p: PageId) => void }) {
  const admin = useAdminDocs();
  const [s, setS] = useState<Snapshot | undefined>(undefined);
  const [err, setErr] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [login, setLogin] = useState<DeviceLogin | null>(null);
  const [clientId, setClientId] = useState('');
  const [restarting, setRestarting] = useState(false);

  const load = useCallback(() => {
    void Promise.all([
      settle(api.health()),
      settle(api.settings()),
      settle(api.mailStatus()),
      settle(api.toolsStatus()),
      settle(api.pcCheck()),
      settle(api.setupJobs()),
      settle(api.pullJobs()),
    ]).then(([health, settings, mail, tools, pc, setup, pulls]) =>
      setS({ health, settings, mail, tools, pc, setup: setup ?? [], pulls: pulls ?? [] }),
    );
  }, []);

  const running = !!s && (s.setup.some((j) => j.status === 'running') || s.pulls.some((j) => j.status === 'pulling'));
  useEffect(() => {
    load();
    // 작업 중에는 2초마다
    const t = setInterval(load, running ? 2000 : 5000);
    return () => clearInterval(t);
  }, [load, running]);

  /** 단계 n의 자동 작업 실행 */
  const act = (n: number, fn: () => Promise<unknown>) => () => {
    setErr((e) => ({ ...e, [n]: '' }));
    setBusy((b) => ({ ...b, [n]: true }));
    fn()
      .catch((e: unknown) => setErr((x) => ({ ...x, [n]: errMsg(e) })))
      .finally(() => {
        setBusy((b) => ({ ...b, [n]: false }));
        load();
      });
  };
  const job = (t: SetupTask) => s?.setup.find((j) => j.task === t);
  const jobBusy = (t: SetupTask) => job(t)?.status === 'running';
  const runTask = (n: number, t: SetupTask) => act(n, () => api.setupRun(t));
  const Err = (p: { n: number }) => (err[p.n] ? <p className="error">{err[p.n]}</p> : null);

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
  const pull = h ? s?.pulls.find((j) => j.name === h.model.name) : undefined;

  const state = (ok: boolean, required: boolean): State => (loading ? 'wait' : ok ? 'ok' : required ? 'todo' : 'optional');

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>시작 가이드</h1>
        <button className="ghost info-pdf" onClick={() => window.print()} title="인쇄 창에서 대상: PDF로 저장">
          📄 PDF로 저장
        </button>
      </header>
      <div className="subbody">
        <section className="card">
          <h2>처음 실행했나요?</h2>
          <p>위에서부터 차례로 하면 돼요. 1·2번만 필수, 나머지는 쓸 기능만. 상태는 5초마다 자동 확인돼요.</p>
          <p>오른쪽 「▶」 버튼은 자동으로 가능한 작업을 대신 실행해요. 버튼이 없는 단계는 직접 해야 해요.</p>
          <p className="muted">이 화면은 로비 「🚀 시작 가이드」에서 언제든 다시 열 수 있어요.</p>
        </section>

        <Step
          n={1}
          title="서버·DB 실행"
          state={state(backendOk, true)}
          run={{ label: 'DB 시작', busy: busy[1] || jobBusy('db'), disabled: !h, onRun: runTask(1, 'db') }}
        >
          {backendOk ? (
            <p>백엔드와 DB가 켜져 있어요.</p>
          ) : (
            <>
              <p>{h ? 'DB가 꺼져 있어요.' : '백엔드에 연결이 안 돼요.'} Docker Desktop을 켠 뒤 <code>start-aura.bat</code>를 다시 실행하세요.</p>
              <p className="muted">Docker Desktop이 없으면 docker.com에서 설치. 터미널에서는 아래 명령.</p>
              <Cmd text="npm.cmd start" />
              {h && <p className="muted">「▶ DB 시작」: Docker로 DB를 켜고 테이블을 만들어요. Docker Desktop은 켜져 있어야 해요.</p>}
            </>
          )}
          <JobLog job={job('db')} />
          <Err n={1} />
        </Step>

        <Step
          n={2}
          title="AI 모델 준비"
          state={state(modelOk, true)}
          run={
            h && !h.model.reachable
              ? { label: 'Ollama 켜기', busy: busy[2] || jobBusy('ollama'), onRun: runTask(2, 'ollama') }
              : h
                ? {
                    label: `${h.model.name} 받기`,
                    busy: busy[2] || pull?.status === 'pulling',
                    onRun: act(2, () => api.pullModel(h.model.name)),
                  }
                : undefined
          }
        >
          <p>둘 중 하나만 하면 돼요.</p>
          <ul className="info-list">
            <li>
              <b>A. 내 PC에서 실행 (무료)</b>: Ollama 설치(ollama.com) 후 「⬇️ 모델 받기」에서 채팅 모델 다운로드. 16GB RAM이면 <code>qwen3:4b</code> 추천.
              {h && !h.model.reachable && <span className="error"> · Ollama 꺼져 있음</span>}
              {h && h.model.reachable && h.model.installed === false && <span className="error"> · {h.model.name} 미설치</span>}
              {ollamaOk && <span className="ok-text"> · {h?.model.name} 준비됨</span>}
            </li>
            <li>
              <b>B. API 사용 (유료, PC 느릴 때)</b>: 「⚙️ 설정」 → API 키에 Gemini·Anthropic·OpenAI 키 입력 → 모델에서 AI 채팅을 API로. 「📊 통계」에서 월 비용 한도 정하기 권장.
              {chatApi && apiKeyCount > 0 && <span className="ok-text"> · API 사용 중</span>}
            </li>
          </ul>
          <JobLog job={job('ollama')} />
          {pull && (
            <p className={pull.status === 'error' ? 'error' : 'muted'}>
              {pull.status === 'pulling'
                ? `⏳ ${pull.name} 다운로드 ${pull.total ? Math.round((pull.completed / pull.total) * 100) : 0}% (${pull.phase})`
                : pull.status === 'done'
                  ? `✅ ${pull.name} 다운로드 완료`
                  : `❌ ${pull.error ?? pull.status}`}
            </p>
          )}
          <p className="muted">Ollama가 설치 안 돼 있으면 ollama.com에서 먼저 설치하세요. 「▶」는 실행·다운로드만 해요.</p>
          <Err n={2} />
          <div className="chips no-print">
            <button className="ghost" onClick={go('models')}>
              ⬇️ 모델 받기
            </button>
            <button className="ghost" onClick={go('settings')}>
              ⚙️ 설정
            </button>
          </div>
        </Step>

        <Step
          n={3}
          title="권한 켜기"
          state={state(permsOn.length > 0, false)}
          run={{
            label: '기본 권한 켜기',
            busy: busy[3],
            disabled: !st,
            onRun: act(3, () => api.savePermissions({ screenRead: true, mic: true, webcam: true })),
          }}
        >
          <p>「⚙️ 설정」 → 권한에서 쓸 기능만 켜세요. 언제든 끌 수 있어요.</p>
          <ul className="info-list">
            <li>👁️ 화면 읽기: 공부 집중 딴짓 감시, PC 조작</li>
            <li>🖱️ PC 조작: AI가 마우스·키보드 조작</li>
            <li>🎤 마이크: 도구 탭 음성 → 글자</li>
            <li>📷 웹캠: 공부 집중 자세·졸음 감시</li>
          </ul>
          {permsOn.length > 0 && <p className="ok-text">켜짐: {permsOn.join(', ')}</p>}
          <p className="muted">「▶ 기본 권한 켜기」: 화면 읽기·마이크·웹캠을 켜요. PC 조작은 AI가 마우스를 움직이므로 설정에서 직접 켜세요.</p>
          <Err n={3} />
          <div className="chips no-print">
            <button className="ghost" onClick={go('settings')}>
              ⚙️ 권한 설정
            </button>
          </div>
        </Step>

        <Step
          n={4}
          title="Outlook 연결 (메일·일정·브리핑)"
          state={state(!!mail?.connected, false)}
          run={
            mail?.configured
              ? { label: '로그인 시작', busy: busy[4] || mail.pending, onRun: act(4, () => api.mailStart().then(setLogin)) }
              : mail
                ? {
                    label: '설정 저장 + 재시작',
                    busy: busy[4] || restarting,
                    disabled: !/^[0-9a-f-]{36}$/i.test(clientId.trim()),
                    onRun: act(4, () => api.setupOutlook(clientId.trim()).then(() => setRestarting(true))),
                  }
                : undefined
          }
        >
          {mail?.connected ? (
            <p>연결됨{mail.email ? <code>: ${mail.email}</code> : ''}.</p>
          ) : mail && !mail.configured ? (
            <>
              <p>
                먼저 Azure 앱 등록 (README 「Outlook 연동」). 받은 <b>애플리케이션(클라이언트) ID</b>를 넣고 「▶ 설정 저장 + 재시작」. 암호화 키는 자동 생성.
              </p>
              <input
                className="rename guide-input no-print"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                spellCheck={false}
              />
              {restarting && <p className="muted">⏳ 저장됨. AURA 재시작 중 (새 창). 30초쯤 뒤 이 화면 새로고침 → 「▶ 로그인 시작」.</p>}
            </>
          ) : (
            <p>「▶ 로그인 시작」 → 아래 주소 접속 → 코드 입력. 끝나면 자동으로 ✅.</p>
          )}
          {login && !mail?.connected && (
            <div className="guide-log running">
              <b>
                코드 <code>{login.userCode}</code> 입력:{' '}
                <a href={login.verificationUri} target="_blank" rel="noreferrer">
                  {login.verificationUri}
                </a>
              </b>
            </div>
          )}
          <Err n={4} />
          <div className="chips no-print">
            <button className="ghost" onClick={go('mail')}>
              ✉️ 메일
            </button>
          </div>
        </Step>

        <Step
          n={5}
          title="Python 기능 (음성 → 글자, PC 조작)"
          state={state(sttOk || pcOk, false)}
          run={{ label: 'Python·라이브러리 설치', busy: busy[5] || jobBusy('pip'), disabled: !h, onRun: runTask(5, 'pip') }}
        >
          <p>「▶」 한 번이면 끝: Python 없으면 winget으로 Python 3.12 설치 → 음성·PC 조작·TTS 라이브러리 설치. 직접 하려면 AURA 폴더 터미널에서:</p>
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
          <p className="muted">수 분 걸림. winget 없는 PC면 python.org에서 Python 설치(「Add to PATH」 체크) 후 다시 「▶」. 끝나면 AURA 다시 켜기.</p>
          <JobLog job={job('pip')} />
          <Err n={5} />
        </Step>

        <Step
          n={6}
          title="공부 집중 (웹캠·화면 감시)"
          state={job('mediapipe')?.status === 'done' ? 'ok' : 'optional'}
          run={{ label: '감지 모델 받기', busy: busy[6] || jobBusy('mediapipe'), disabled: !h, onRun: runTask(6, 'mediapipe') }}
        >
          <p>자세·졸음 감지 모델을 받고, 권한에서 웹캠·화면 읽기를 켜세요.</p>
          <Cmd text="npm.cmd run models" />
          <JobLog job={job('mediapipe')} />
          <Err n={6} />
          <p className="muted">화면 딴짓 분석은 비전 모델(예: gemma4:12b)도 필요해요. 「⬇️ 모델 받기」에서 다운로드.</p>
          <div className="chips no-print">
            <button className="ghost" onClick={go('study')}>
              📚 공부 집중
            </button>
          </div>
        </Step>

        <Step n={7} title="폰 연결 (Android)" state="optional">
          <p>폰에서 딴짓 앱을 열면 알림. 「📱 폰 감시」에서 QR로 연결해요. 앱 설치는 README 「Android 앱」 참고.</p>
          <div className="chips no-print">
            <button className="ghost" onClick={go('phone')}>
              📱 폰 감시
            </button>
          </div>
        </Step>

        <Step n={8} title="자격증 시험 일정 자동 수집" state="optional">
          <p>
            공공데이터포털에서 「한국산업인력공단_국가자격 시험일정 조회」 활용신청 → 인증키를 「🎓 자격증」 ⚙ 일정 연동(또는 설정)에 붙여넣기.
            기사·기능사·국가전문 회차 접수·시험일이 하루 1번 자동으로 채워져요. 키 없어도 검색·직접 입력은 가능.
          </p>
          <div className="chips no-print">
            <button className="ghost" onClick={go('certs')}>
              🎓 자격증
            </button>
          </div>
        </Step>

        {admin && (
          <>
            <h2 className="guide-admin-h">관리자 전용</h2>
            {admin.guide.map((g, i) => (
              <section key={g.title} className="card guide-step optional">
                <h2>
                  <span>
                    A{i + 1}. {g.title}
                  </span>
                </h2>
                <ul className="info-list">
                  {g.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </section>
            ))}
            <div className="chips no-print">
              <button className="ghost" onClick={go('admin')}>
                🛠️ 고급설정
              </button>
            </div>
          </>
        )}

        <section className="card">
          <h2>다 했으면</h2>
          <p>기능 설명은 「ℹ️ 정보」, 단축키는 <kbd>?</kbd>. 업데이트는 AURA 폴더에서 <code>git pull</code> 후 다시 실행.</p>
          <div className="chips no-print">
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
