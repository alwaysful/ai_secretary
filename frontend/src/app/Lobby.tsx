import { useEffect, useState } from 'react';
import { isNative } from '../shared/backend';
import type { PageId } from './App';
import { api, ApiError, CalendarEvent, Health, NewsUnread } from '../shared/api';
import { ThemeButton } from '../shared/theme';
import { WebShortcuts } from './WebShortcuts';
import { AdminGate } from '../features/admin/AdminGate';
import { currentToken, setAdminToken } from '../features/admin/session';

interface Item {
  id: PageId | null;
  icon: string;
  label: string;
  hint?: string;
}

const MAIN: Item[] = [
  { id: 'briefing', icon: '☀️', label: '아침 브리핑', hint: '요약' },
  { id: 'schedule', icon: '📅', label: '내 일정 보기' },
  { id: 'chat', icon: '💬', label: 'AI 채팅하기' },
  { id: 'mail', icon: '✉️', label: '메일 확인', hint: '읽기 전용' },
  { id: 'news', icon: '📰', label: '새 소식', hint: '공지·공모전 모음' },
  { id: 'certs', icon: '🎓', label: '자격증', hint: '분야별 검색·시험 일정' },
  { id: 'study', icon: '📚', label: '공부 집중', hint: '웹캠·화면 감시' },
  { id: 'vocab', icon: '📇', label: '단어장', hint: 'Anki 복습·회독·퀴즈' },
  { id: 'phone', icon: '📱', label: '폰 감시', hint: 'Android 앱' },
  { id: 'pc', icon: '🖱️', label: 'PC 조작', hint: 'AI가 마우스·키보드' },
  { id: 'memory', icon: '🧠', label: '기억 관리', hint: '장기 기억' },
  { id: 'settings', icon: '⚙️', label: '설정', hint: '모델·시스템 프롬프트' },
  { id: 'models', icon: '⬇️', label: '모델 받기', hint: 'Ollama·HF·Whisper' },
  { id: 'tools', icon: '🛠️', label: '도구', hint: 'STT·OCR·사이트' },
  { id: 'tts', icon: '🔊', label: 'TTS 읽어주기', hint: '글 → 음성 · 감정 선택' },
  { id: 'stats', icon: '📊', label: '통계', hint: '공부·채팅·API 비용' },
  { id: 'info', icon: 'ℹ️', label: '정보', hint: '기능 설명' },
  { id: 'guide', icon: '🚀', label: '시작 가이드', hint: '처음 설정 순서' },
];

const SOON: Item[] = [
  { id: null, icon: '🎙️', label: '음성', hint: '준비 중' },
];

/** 도구 탭과 같은 카드 그리드 */
function Features(props: { items: Item[]; onNavigate: (p: PageId) => void }) {
  return (
    <div className="tool-grid feat-grid">
      {props.items.map((it) => (
        <button
          key={it.label}
          className={`card tool-card feat${it.id === null ? ' soon' : ''}`}
          disabled={it.id === null}
          onClick={() => it.id && props.onNavigate(it.id)}
        >
          <h2>
            <span className="ic">{it.icon}</span> {it.label}
          </h2>
          {it.hint && <p className="muted">{it.hint}</p>}
        </button>
      ))}
    </div>
  );
}

type Load<T> = { state: 'loading' } | { state: 'ok'; value: T } | { state: 'error'; message: string };

const errText = (e: unknown) =>
  e instanceof ApiError && e.code === 'BACKEND_DOWN' ? '백엔드 연결 안 됨' : e instanceof Error ? e.message : String(e);

const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 오늘 일정·안 읽은 메일 수. 5분마다 갱신 */
function Widgets(props: { onNavigate: (p: PageId) => void }) {
  const [events, setEvents] = useState<Load<CalendarEvent[]>>({ state: 'loading' });
  const [unread, setUnread] = useState<Load<number>>({ state: 'loading' });
  const [news, setNews] = useState<Load<NewsUnread>>({ state: 'loading' });

  useEffect(() => {
    const load = () => {
      api.today().then(
        (v) => setEvents({ state: 'ok', value: v }),
        (e: unknown) => setEvents({ state: 'error', message: errText(e) }),
      );
      api.unreadCount().then(
        (v) => setUnread({ state: 'ok', value: v.count }),
        (e: unknown) => setUnread({ state: 'error', message: errText(e) }),
      );
      api.newsUnread().then(
        (v) => setNews({ state: 'ok', value: v }),
        (e: unknown) => setNews({ state: 'error', message: errText(e) }),
      );
    };
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const now = nowLocal();
  return (
    <div className="widgets">
      <button className="widget" onClick={() => props.onNavigate('schedule')} aria-label="오늘 일정, 일정 화면 열기">
        <h3>
          <span>📅 오늘 일정</span>
          {events.state === 'ok' && <span>{events.value.length}건</span>}
        </h3>
        {events.state === 'loading' && <p className="muted">불러오는 중…</p>}
        {events.state === 'error' && <p className="muted">{events.message}</p>}
        {events.state === 'ok' && events.value.length === 0 && <p className="muted">오늘 일정 없음</p>}
        {events.state === 'ok' && events.value.length > 0 && (
          <ul>
            {events.value.slice(0, 5).map((e) => {
              const past = !e.isAllDay && e.end.slice(0, 16) <= now;
              const live = !e.isAllDay && e.start.slice(0, 16) <= now && now < e.end.slice(0, 16);
              return (
                <li key={e.id} className={live ? 'now' : past ? 'past' : ''}>
                  <time>{e.isAllDay ? '종일' : `${e.start.slice(11, 16)}–${e.end.slice(11, 16)}`}</time>
                  <span>
                    {e.subject}
                    {live && ' · 진행 중'}
                  </span>
                </li>
              );
            })}
            {events.value.length > 5 && <li className="muted">외 {events.value.length - 5}건</li>}
          </ul>
        )}
      </button>
      <button className="widget" onClick={() => props.onNavigate('mail')} aria-label="안 읽은 메일, 메일 화면 열기">
        <h3>
          <span>✉️ 안 읽은 메일</span>
        </h3>
        {unread.state === 'loading' && <p className="muted">불러오는 중…</p>}
        {unread.state === 'error' && <p className="muted">{unread.message}</p>}
        {unread.state === 'ok' && (
          <div className="big">
            {unread.value}
            <small>통</small>
          </div>
        )}
      </button>
      <button className="widget" onClick={() => props.onNavigate('news')} aria-label="새 소식, 학사공지·공모전 화면 열기">
        <h3>
          <span>📰 새 소식</span>
        </h3>
        {news.state === 'loading' && <p className="muted">불러오는 중…</p>}
        {news.state === 'error' && <p className="muted">{news.message}</p>}
        {news.state === 'ok' && (
          <>
            <div className="big">
              {news.value.total}
              <small>개</small>
            </div>
            <p className="muted">
              {news.value.byCategory.map((c) => `${c.name} ${c.count}`).join(' · ') || '카테고리 없음'}
            </p>
          </>
        )}
      </button>
    </div>
  );
}

/** PC에서만 표시. 확인 후 백엔드·프론트 종료 → 꺼짐 화면 */
function PowerButton(props: { onOff: () => void }) {
  const [busy, setBusy] = useState(false);
  if (isNative()) return null;
  const off = async () => {
    if (!window.confirm('AURA 서버(백엔드·화면)를 끌까요?\n다시 켜려면 start-aura.bat 실행.')) return;
    setBusy(true);
    try {
      await api.shutdown();
      props.onOff();
    } catch (e) {
      setBusy(false);
      window.alert(`끄기 실패: ${errText(e)}`);
    }
  };
  return (
    <button className="ghost" onClick={off} disabled={busy} title="서버 끄기">
      ⏻ 서버 끄기
    </button>
  );
}

function OffScreen() {
  return (
    <div className="lobby-page off-screen">
      <div className="lobby-in">
        <h1 className="title">서버 꺼짐</h1>
        <p>AURA 백엔드와 화면 서버를 종료함. 이 탭은 닫아도 됨.</p>
        <p className="muted">다시 켜기: start-aura.bat 실행.</p>
      </div>
    </div>
  );
}

export function Lobby(props: { onNavigate: (p: PageId) => void }) {
  const [off, setOff] = useState(false);
  const [admin, setAdmin] = useState(() => !!currentToken());
  const [adminItems, setAdminItems] = useState<Item[]>([]);

  // 서버 세션 만료 시 일반 로비로
  useEffect(() => {
    const t = currentToken();
    if (!admin || !t) return;
    // 관리자 카드는 서버가 세션 확인 후 내려줌
    api.adminDocs(t).then(
      (d) => setAdminItems(d.features.filter((f) => f.page).map((f) => ({ id: f.page as PageId, icon: f.icon, label: f.title, hint: f.hint }))),
      (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          setAdminToken(null);
          setAdmin(false);
        }
      },
    );
  }, [admin]);
  const [pcOn, setPcOn] = useState(false);
  useEffect(() => {
    if (isNative()) return;
    api.settings().then(
      (s) => setPcOn(s.pcControl && s.screenRead),
      () => setPcOn(false),
    );
  }, []);
  const [health, setHealth] = useState<Health | null | undefined>(undefined);

  useEffect(() => {
    if (off) return;
    const poll = () =>
      api
        .health()
        .then(setHealth)
        .catch(() => setHealth(null));
    poll();
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  }, [off]);

  if (off) return <OffScreen />;

  const dot = health === undefined ? 'warn' : health && health.db === 'ok' ? 'ok' : health ? 'warn' : 'down';
  const status =
    health === undefined ? '확인 중' : health ? `DB ${health.db} · ${health.model.name} ${health.model.state}` : '백엔드 연결 안 됨';
  const today = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date());

  return (
    <div className="lobby-page">
      <div className="lobby-in">
        <AdminGate admin={admin} onEnter={() => setAdmin(true)} onLock={() => setAdmin(false)} />
        <div className="meta">
          <span className="status">
            <span className={`dot ${dot}`} />
            {status}
          </span>
          <span>{today}</span>
          <ThemeButton />
          <button className="ghost" onClick={() => props.onNavigate('info')}>
            ℹ️ 정보
          </button>
          <button className="ghost" onClick={() => props.onNavigate('landing')}>
            ✦ 소개
          </button>
          <PowerButton onOff={() => setOff(true)} />
          <span className="muted">
            단축키 <kbd>?</kbd>
          </span>
        </div>
        <h1 className="title">AURA 810</h1>
        <Widgets onNavigate={props.onNavigate} />
        <WebShortcuts />
        <section className="feats">
          <h2>기능</h2>
          <Features items={[...(admin ? adminItems : []), ...(pcOn ? MAIN : MAIN.filter((i) => i.id !== 'pc')), ...SOON]} onNavigate={props.onNavigate} />
        </section>
      </div>
    </div>
  );
}
