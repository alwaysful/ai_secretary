import { Bot, Brain, Check, Cloud, Cpu, ListChecks, Loader2, MessageSquare, Network, Plug, SlidersHorizontal, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { STATUS_LABEL, type Status } from '../content';

function Card(props: { cls: string; icon: ReactNode; title: string; desc: string; status?: Status; children: ReactNode }) {
  return (
    <article className={`lp-card ${props.cls}`} data-reveal>
      <div className="lp-card-visual" aria-hidden="true">
        {props.children}
      </div>
      <div className="lp-card-text">
        <h3>
          <span className="lp-ico">{props.icon}</span>
          {props.title}
          {props.status && <span className={`lp-badge ${props.status}`}>{STATUS_LABEL[props.status]}</span>}
        </h3>
        <p>{props.desc}</p>
      </div>
    </article>
  );
}

/* 예시 데이터: 그래픽 표현용. 실제 사용자 데이터 아님 */
const MEMORIES = [
  { t: '3주 전', text: '알고리즘 과제 금요일 마감 선호' },
  { t: '2주 전', text: '오전 9시 이전 일정 피함' },
  { t: '지난주', text: '공모전 · AI 분야 관심' },
  { t: '오늘', text: '물리 실험 보고서 진행 중' },
];

function MemoryVisual() {
  return (
    <div className="v-mem">
      <div className="v-mem-bars">
        {[28, 40, 52, 46, 64, 72, 70, 86, 92, 100].map((h, i) => (
          <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <ul className="v-mem-list">
        {MEMORIES.map((m, i) => (
          <li key={m.t} style={{ animationDelay: `${i * 0.9}s` }}>
            <time>{m.t}</time>
            <span>{m.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatVisual() {
  return (
    <div className="v-chat">
      <div className="b user">내일 오후 일정 비는 시간 알려줘</div>
      <div className="b ai">
        <span className="v-intent">의도: 일정 조회 · 내일 12–18시</span>
        14:00–16:00 비어 있음. 스터디 잡을까요?
      </div>
      <div className="b ai typing">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function TaskVisual() {
  const steps: [string, 'done' | 'run' | 'wait'][] = [
    ['요청 분석', 'done'],
    ['캘린더 조회', 'done'],
    ['일정 초안 작성', 'run'],
    ['사용자 확인', 'wait'],
  ];
  return (
    <div className="v-task">
      <div className="v-prog">
        <span />
      </div>
      <ul>
        {steps.map(([s, st]) => (
          <li key={s} className={st}>
            <span className="v-st">{st === 'done' ? <Check size={11} /> : st === 'run' ? <Loader2 size={11} /> : null}</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgentVisual() {
  const nodes = [
    { x: 50, y: 50, r: 9, main: true },
    { x: 16, y: 24, r: 6 },
    { x: 84, y: 22, r: 6 },
    { x: 14, y: 78, r: 6 },
    { x: 86, y: 76, r: 6 },
    { x: 50, y: 10, r: 4 },
    { x: 50, y: 92, r: 4 },
  ];
  return (
    <svg className="v-agent" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      {nodes.slice(1).map((n, i) => (
        <line key={i} x1={50} y1={50} x2={n.x} y2={n.y} style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      <line className="side" x1={16} y1={24} x2={84} y2={22} />
      <line className="side" x1={14} y1={78} x2={86} y2={76} />
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} className={n.main ? 'main' : ''} style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
    </svg>
  );
}

function PersonalVisual() {
  const rows: [string, boolean][] = [
    ['아침 브리핑', true],
    ['공모전 알림', true],
    ['격식체 답변', false],
  ];
  return (
    <div className="v-pers">
      <div className="v-avatar">
        <User size={18} />
      </div>
      <ul>
        {rows.map(([l, on]) => (
          <li key={l}>
            {l}
            <span className={`v-tg${on ? ' on' : ''}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModelVisual() {
  return (
    <div className="v-model">
      <div className="v-hub">
        <Cpu size={18} />
        <small>Ollama</small>
      </div>
      <div className="v-spokes">
        {['Calendar', 'Mail', 'News', 'Memory'].map((t, i) => (
          <span key={t} className="v-tool" style={{ animationDelay: `${i * 0.5}s` }}>
            <Plug size={11} /> {t}
          </span>
        ))}
        <span className="v-tool soon">
          <Cloud size={11} /> Cloud LLM · 예정
        </span>
      </div>
    </div>
  );
}

export function Bento() {
  return (
    <section className="lp-section" id="features">
      <header className="lp-head" data-reveal>
        <span className="lp-eyebrow">Core Features</span>
        <h2>하나의 비서, 연결된 능력.</h2>
        <p>대화 · 기억 · 실행이 하나로 이어집니다. 카드 속 그래픽은 예시 데이터입니다.</p>
      </header>
      <div className="lp-bento">
        <Card cls="c-mem" icon={<Brain size={16} />} title="Long-term Memory" desc="대화 속 정보를 장기 기억으로 축적. 시간이 지날수록 더 잘 아는 비서." status="live">
          <MemoryVisual />
        </Card>
        <Card cls="c-chat" icon={<MessageSquare size={16} />} title="Smart Conversation" desc="자연어로 묻고 답하기. 의도와 맥락을 파악해 응답." status="live">
          <ChatVisual />
        </Card>
        <Card cls="c-task" icon={<ListChecks size={16} />} title="Autonomous Tasks" desc="요청 분석 → 단계 실행. 쓰기 작업은 확인 후 진행." status="partial">
          <TaskVisual />
        </Card>
        <Card cls="c-pers" icon={<SlidersHorizontal size={16} />} title="Personalization" desc="모델·프롬프트·알림을 나에게 맞게." status="live">
          <PersonalVisual />
        </Card>
        <Card cls="c-agent" icon={<Network size={16} />} title="Multi-Agent System" desc="여러 모델·에이전트가 역할을 나눠 협업하는 구조." status="roadmap">
          <AgentVisual />
        </Card>
        <Card cls="c-model" icon={<Bot size={16} />} title="AI Model Integration" desc="로컬 LLM과 외부 도구를 하나의 흐름으로 통합." status="partial">
          <ModelVisual />
        </Card>
      </div>
    </section>
  );
}
