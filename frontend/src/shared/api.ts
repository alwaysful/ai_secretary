import { apiBase } from './backend';
import { currentToken } from './adminToken';

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'SYSTEM' | 'USER' | 'ASSISTANT';
  content: string;
  model?: string | null;
  durationMs?: number | null;
  /** 사용자가 중단한 응답 */
  stopped?: boolean;
  createdAt: string;
}

export interface EventDraft {
  subject: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location: string;
}

/** 사용자 확인을 기다리는 작업 (일정 등록·변경) */
export interface PendingAction {
  id: string;
  kind: 'calendar.create' | 'calendar.update' | 'memory.create' | 'memory.delete' | 'pc.run';
  conversationId: string | null;
  summary: string;
  draft?: EventDraft;
  memory?: { id?: string; content: string; category?: string | null };
  eventId?: string;
  before?: CalendarEvent;
  expiresAt: string;
}

/** AI PC 조작 실행 */
export interface PcStep {
  n: number;
  thought: string;
  action: string;
  error?: string;
  at: string;
}
export interface PcRun {
  id: string;
  goal: string;
  status: 'starting' | 'running' | 'done' | 'cancelled' | 'failed';
  steps: PcStep[];
  message: string;
  startedAt: string;
  endedAt: string | null;
}
export interface PcCheck {
  ok: boolean;
  detail: string;
  model: string;
}

export interface Memory {
  id: string;
  content: string;
  category: string | null;
  enabled: boolean;
  source: 'manual' | 'chat';
  createdAt: string;
  updatedAt: string;
}

export type ShortcutSection = 'lobby' | 'tools';

export interface ToolsStatus {
  ocr: { model: string; source?: AiSource };
  stt: { ok: boolean; detail: string; model: string; source?: AiSource };
  /** 마이크 허용 */
  mic: boolean;
}

export interface OcrResult {
  text: string;
  model: string;
  ms: number;
}

export interface SttResult {
  text: string;
  language: string;
  duration: number;
  model: string;
  ms: number;
}

export interface WebShortcut {
  id: string;
  title: string;
  url: string;
  position: number;
}

/** 새 소식: 합쳐진 글의 사이트별 링크 */
export interface NewsLink {
  id: string;
  siteId: string;
  siteName: string;
  url: string;
}

/** 카테고리 안 중복을 합친 글 */
export interface NewsItem {
  key: string;
  title: string;
  unread: boolean;
  links: NewsLink[];
  category: string | null;
  author: string | null;
  postedAt: string | null;
  deadline: string | null;
  /** 접수 시작일 (공모전) */
  startsAt: string | null;
  /** 행사·활동 진행 기간 */
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  /** 간단한 내용 */
  summary: string | null;
  createdAt: string;
  categoryId: string | null;
  /** 공모전 분야 태그 */
  tags: string[];
}

export interface NewsSite {
  id: string;
  name: string;
  url: string;
  parser: string;
  itemSelector: string | null;
  categoryId: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  lastNew: number;
  unread: number;
}

export interface NewsCategory {
  /** null = 미분류 */
  id: string | null;
  name: string;
  sites: NewsSite[];
}

export interface NewsUnread {
  total: number;
  byCategory: { id: string | null; name: string; count: number }[];
  latest: string | null;
}

export interface NewsSiteInput {
  name?: string;
  url?: string;
  parser?: string;
  itemSelector?: string | null;
  categoryId?: string | null;
  enabled?: boolean;
}

export interface NewsPreview {
  parser: string;
  parserLabel: string;
  count: number;
  items: { title: string; url: string; postedAt?: string; deadline?: string }[];
}

export interface Settings {
  model: string;
  systemPrompt: string;
  /** AI PC 조작 허용 */
  pcControl: boolean;
  /** 화면 읽기(스크린샷 분석) 허용 */
  screenRead: boolean;
  /** 마이크 허용 */
  mic: boolean;
  /** 웹캠 허용 */
  webcam: boolean;
  /** OCR 비전 모델 */
  ocrModel: string;
  /** STT whisper 모델 */
  sttModel: string;
  defaults: { model: string; systemPrompt: string; ocrModel: string; sttModel: string };
  /** 기능별 로컬/API */
  routes: Record<AiFeature, AiRoute>;
  /** API 키 등록 여부 (마스킹) */
  apiKeys: Record<ApiProvider, { set: boolean; hint: string | null }>;
  providers: { id: ApiProvider; label: string; features: AiFeature[] }[];
  tts: TtsSettings;
}

export type TtsEngine = 'browser' | 'edge' | 'openai' | 'gemini';
export interface TtsSettings {
  engine: TtsEngine;
  model: string | null;
  voice: string | null;
  rate: number;
  autoRead: boolean;
}
export interface TtsOptions {
  models: string[];
  voices: string[];
  live: boolean;
  keySet: boolean;
  error?: string;
}
export interface TtsAudio {
  audio: string;
  mime: string;
  engine: TtsEngine;
  voice: string;
  ms: number;
}
export type Persona = 'girlfriend';
export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'calm' | 'excited' | 'tender';

export type AiFeature = 'chat' | 'ocr' | 'stt';
export type AiSource = 'local' | 'api';
export type ApiProvider = 'gemini' | 'anthropic' | 'openai';
export interface AiRoute {
  source: AiSource;
  provider: ApiProvider | null;
  model: string | null;
}

export interface BriefingData {
  date: string;
  events: CalendarEvent[];
  mails: MailSummary[];
  errors: { calendar?: string; mail?: string };
}

export interface Health {
  status: string;
  db: 'ok' | 'down';
  model: {
    name: string;
    state: 'unloaded' | 'loading' | 'ready' | 'error';
    /** Ollama 접속 가능 */
    reachable: boolean;
    /** 모델 pull 여부 (null: 모름) */
    installed: boolean | null;
    /** 메모리 적재 여부 (null: 모름) */
    loaded: boolean | null;
  };
}

/** 백엔드 오류 코드 + 프론트 전용 BACKEND_DOWN */
export type ErrorCode =
  | 'BACKEND_DOWN'
  | 'DB_DOWN'
  | 'OLLAMA_DOWN'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_TIMEOUT'
  | 'MODEL_ERROR'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'INTERNAL';

export type StreamPhase = 'tools' | 'queued' | 'loading' | 'generating';

export interface MailStatus {
  configured: boolean;
  connected: boolean;
  pending: boolean;
  email: string | null;
}

export interface DeviceLogin {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  /** 로컬 시각 `YYYY-MM-DDTHH:mm:ss` */
  start: string;
  end: string;
  isAllDay: boolean;
  location: string;
}

export interface MailSummary {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  isRead: boolean;
  preview: string;
  important?: boolean;
}

export interface HubModel {
  name: string;
  source: 'ollama' | 'hf';
  family: string;
  sizeGb: number;
  ramGb: number;
  tags: string[];
  quality: number;
  speed: number;
  desc: string;
  installed: boolean;
  bytes?: number;
}

export type SetupTask = 'db' | 'ollama' | 'pip' | 'mediapipe';

export interface SetupJob {
  task: SetupTask;
  status: 'running' | 'done' | 'error';
  log: string;
  startedAt: string;
  endedAt: string | null;
}

export interface PullJob {
  name: string;
  status: 'pulling' | 'done' | 'error' | 'canceled';
  phase: string;
  completed: number;
  total: number;
  error?: string;
}

export interface ModelHub {
  reachable: boolean;
  current: string;
  items: HubModel[];
  others: { name: string; bytes: number }[];
  jobs: PullJob[];
}


export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: ErrorCode = 'INTERNAL',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const backendDown = () => new ApiError(0, '백엔드 서버에 연결할 수 없음', 'BACKEND_DOWN');

async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    message?: string | string[];
    code?: ErrorCode;
    /** 메일·일정 오류 코드 (NOT_CONNECTED 등) */
    error?: string;
  } | null;
  // Vite 프록시가 백엔드에 못 붙으면 JSON 없는 5xx를 돌려준다
  if (!body && res.status >= 500) return backendDown();
  const m = body?.message;
  const code = body?.code ?? (res.status === 404 ? 'NOT_FOUND' : res.status < 500 ? 'BAD_REQUEST' : 'INTERNAL');
  const text = Array.isArray(m) ? m.join(', ') : (m ?? `HTTP ${res.status}`);
  if (body?.error === 'NOT_CONNECTED') return new ApiError(res.status, 'Outlook 재로그인 필요 (일정 쓰기 권한 추가됨)', code);
  if (body?.error === 'NOT_CONFIGURED') return new ApiError(res.status, 'Outlook 설정 없음 (backend/.env)', code);
  return new ApiError(res.status, text, code);
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(apiBase() + path, init);
  } catch (e) {
    if (init?.signal?.aborted) throw e;
    throw backendDown();
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await call(path, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) throw await failure(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export type Ranked = { name: string; count: number }[];

export interface StatsOverview {
  days: number;
  dates: string[];
  study: {
    focusSec: number;
    pomodoros: number;
    sessions: number;
    longestSec: number;
    studiedDays: number;
    avgPerDaySec: number;
    streak: number;
    daily: number[];
    violations: { posture: number; phone: number; slack: number; sleep: number };
    phoneApps: number;
    topApps: Ranked;
  };
  chat: {
    conversations: number;
    conversationsAll: number;
    userMessages: number;
    aiMessages: number;
    stopped: number;
    tokens: number;
    avgReplyMs: number;
    daily: number[];
    hours: number[];
    models: Ranked;
  };
  news: { newPosts: number; unread: number; daily: number[]; bySite: Ranked; deadlines: { id: string; title: string; url: string; deadline: string }[] };
  memory: { total: number; enabled: number };
  shortcuts: number;
  calendar: { connected: boolean; today: number; week: number; error?: string };
}

export interface UsageAgg {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  audioSec: number;
  cost: number;
}

export interface ApiUsageStats {
  month: string;
  prevMonth: string;
  total: UsageAgg;
  prevCost: number;
  projected: number;
  providers: (UsageAgg & { provider: string })[];
  models: (UsageAgg & { provider: string; model: string; price: { input: number; output: number }; custom: boolean })[];
  features: (UsageAgg & { feature: string })[];
  daily: Record<string, number>[];
}

export interface AdminOverview {
  server: { uptimeSec: number; node: string; platform: string; pid: number; rssMb: number; heapMb: number; loadAvg: number[]; freeMemMb: number; totalMemMb: number };
  db: 'ok' | 'down';
  model: { name: string; state: string; reachable: boolean; installed?: boolean; loaded?: boolean };
  counts: Record<'conversations' | 'messages' | 'memories' | 'news' | 'study' | 'phone' | 'apiUsage', number> | null;
  scrape: { id: string; name: string; enabled: boolean; lastRunAt: string | null; lastOkAt: string | null; lastError: string | null }[];
  apiUsage30d: { provider: string; calls: number; inputTokens: number; outputTokens: number }[];
  permissions: { pcControl: boolean; screenRead: boolean; mic: boolean; webcam: boolean };
}
export interface AdminLog {
  at: string;
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';
  context: string;
  message: string;
}
export interface BudgetStatus {
  limitUsd: number | null;
  warnPct: number;
  block: boolean;
  month: string;
  costUsd: number;
  pct: number | null;
  level: 'none' | 'ok' | 'warn' | 'over';
}
export interface VoicePreset {
  id: string;
  name: string;
  engine: TtsEngine;
  model?: string | null;
  voice?: string | null;
  rate: number;
  emotion: string;
  builtin?: boolean;
}
export interface PersonaPreset {
  id: string;
  name: string;
  prompt: string;
  builtin?: boolean;
}
export interface Live2dModel {
  id: string;
  name: string;
  entry: string;
  files: number;
  bytes: number;
  createdAt: string;
}
export interface CompanionView {
  prompt: string;
  default: string;
  voice: VoicePreset | null;
  model: string | null;
  personas: PersonaPreset[];
  voices: VoicePreset[];
  models: Live2dModel[];
}
export interface UpdateStatus {
  branch: string;
  commit: string;
  subject: string;
  behind: number;
  ahead: number;
  dirty: string[];
  incoming: string[];
  error?: string;
}
export interface UpdateResult {
  ok: boolean;
  log: string;
  changed: string[];
  installed: string[];
  restartNeeded: boolean;
}
export interface AdminDocs {
  features: { icon: string; title: string; page?: string; hint?: string; lines: string[] }[];
  guide: { title: string; lines: string[] }[];
  inProgress: { title: string; status: string; note: string }[];
}
export type AdminResetKind = 'conversations' | 'memories' | 'news' | 'study' | 'phone' | 'apiUsage';

const adminH = (t: string) => ({ Authorization: `Bearer ${t}` });
/** 관리자 세션 있으면 헤더 첨부 (persona 대화용) */
const maybeAdminH = (): Record<string, string> => {
  const t = currentToken();
  return t ? adminH(t) : {};
};

export const api = {
  health: () => req<Health>('/health'),
  adminLogin: (code: string) => req<{ token: string; expiresAt: string }>('/admin/login', { method: 'POST', body: JSON.stringify({ code }) }),
  adminLogout: (t: string) => req<void>('/admin/logout', { method: 'POST', headers: adminH(t) }),
  adminSession: (t: string) => req<{ ok: boolean }>('/admin/session', { headers: adminH(t) }),
  adminOverview: (t: string) => req<AdminOverview>('/admin/overview', { headers: adminH(t) }),
  adminLogs: (t: string, level?: string) => req<AdminLog[]>(`/admin/logs?limit=150${level ? `&level=${level}` : ''}`, { headers: adminH(t) }),
  adminRefreshNews: (t: string) => req<{ ok: boolean }>('/admin/scrape/refresh', { method: 'POST', headers: adminH(t) }),
  adminPermissions: (t: string, p: Partial<AdminOverview['permissions']>) =>
    req<unknown>('/admin/permissions', { method: 'PUT', headers: adminH(t), body: JSON.stringify(p) }),
  adminReset: (t: string, kind: AdminResetKind) =>
    req<{ deleted: number }>(`/admin/data/${kind}?confirm=${kind}`, { method: 'DELETE', headers: adminH(t) }),
  adminBackup: (t: string) => req<unknown>('/admin/backup', { headers: adminH(t) }),
  adminDocs: (t: string) => req<AdminDocs>('/admin/docs', { headers: adminH(t) }),
  adminCompanion: (t: string) => req<CompanionView>('/admin/companion', { headers: adminH(t) }),
  adminSetCompanion: (t: string, prompt: string) =>
    req<CompanionView>('/admin/companion', { method: 'PUT', headers: adminH(t), body: JSON.stringify({ prompt }) }),
  adminSetCompanionVoice: (t: string, voice: Omit<VoicePreset, 'id' | 'builtin'> | null) =>
    req<CompanionView>('/admin/companion/voice', { method: 'PUT', headers: adminH(t), body: JSON.stringify({ voice }) }),
  adminSetCompanionModel: (t: string, id: string | null) =>
    req<CompanionView>('/admin/companion/model', { method: 'PUT', headers: adminH(t), body: JSON.stringify({ id }) }),
  adminAddPersona: (t: string, name: string, prompt: string) =>
    req<CompanionView>('/admin/companion/presets/persona', { method: 'POST', headers: adminH(t), body: JSON.stringify({ name, prompt }) }),
  adminAddVoice: (t: string, v: Omit<VoicePreset, 'id' | 'builtin'>) =>
    req<CompanionView>('/admin/companion/presets/voice', { method: 'POST', headers: adminH(t), body: JSON.stringify(v) }),
  adminDeletePreset: (t: string, kind: 'persona' | 'voice', id: string) =>
    req<CompanionView>(`/admin/companion/presets/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: adminH(t) }),
  adminUploadLive2d: (t: string, name: string, zip: string) =>
    req<Live2dModel>('/admin/live2d', { method: 'POST', headers: adminH(t), body: JSON.stringify({ name, zip }) }),
  adminDeleteLive2d: (t: string, id: string) => req<CompanionView>(`/admin/live2d/${id}`, { method: 'DELETE', headers: adminH(t) }),
  adminUpdateStatus: (t: string) => req<UpdateStatus>('/admin/update', { headers: adminH(t) }),
  adminUpdate: (t: string) => req<UpdateResult>('/admin/update', { method: 'POST', headers: adminH(t) }),
  adminRestart: (t: string) => req<{ ok: boolean }>('/admin/restart', { method: 'POST', headers: adminH(t) }),
  warmup: () => req<{ state: string }>('/health/warmup', { method: 'POST' }),
  conversations: (q?: string, persona?: Persona) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (persona) p.set('persona', persona);
    const qs = p.toString();
    return req<Conversation[]>(qs ? `/conversations?${qs}` : '/conversations', persona ? { headers: maybeAdminH() } : undefined);
  },
  renameConversation: (id: string, title: string) =>
    req<Conversation>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => req<void>(`/conversations/${id}`, { method: 'DELETE' }),
  createConversation: (title?: string, persona?: Persona) =>
    req<Conversation>('/conversations', { method: 'POST', headers: persona ? maybeAdminH() : {}, body: JSON.stringify({ title, ...(persona ? { persona } : {}) }) }),
  messages: (id: string) => req<Message[]>(`/conversations/${id}/messages`),
  mailStatus: () => req<MailStatus>('/mail/auth/status'),
  mailStart: () => req<DeviceLogin>('/mail/auth/start', { method: 'POST' }),
  mailDisconnect: () => req<void>('/mail/auth', { method: 'DELETE' }),
  mailList: (unreadOnly: boolean) => req<MailSummary[]>(`/mail/messages?top=15&unreadOnly=${unreadOnly}`),
  settings: () => req<Settings>('/settings'),
  saveTts: (t: Partial<Omit<TtsSettings, 'model' | 'voice'>> & { model?: string; voice?: string }) =>
    req<Settings>('/settings/tts', { method: 'PUT', body: JSON.stringify(t) }),
  ttsOptions: (engine: Exclude<TtsEngine, 'browser'>) => req<TtsOptions>(`/settings/tts-options?engine=${engine}`),
  tts: (text: string, o: { engine?: TtsEngine; model?: string; voice?: string; rate?: number; emotion?: Emotion } = {}) =>
    req<TtsAudio>('/tools/tts', { method: 'POST', body: JSON.stringify({ text, ...o }) }),
  saveSettings: (s: { model?: string; systemPrompt?: string; ocrModel?: string; sttModel?: string }) =>
    req<Settings>('/settings', { method: 'PUT', body: JSON.stringify(s) }),
  savePermissions: (p: Partial<Pick<Settings, 'pcControl' | 'screenRead' | 'mic' | 'webcam'>>) =>
    req<Settings>('/settings/permissions', { method: 'PUT', body: JSON.stringify(p) }),
  models: () => req<string[]>('/settings/models'),
  visionModels: () => req<string[]>('/settings/vision-models'),
  sttModels: () => req<string[]>('/settings/stt-models'),
  saveRoute: (feature: AiFeature, r: { source: AiSource; provider?: ApiProvider; model?: string }) =>
    req<Settings>('/settings/route', { method: 'PUT', body: JSON.stringify({ feature, ...r }) }),
  apiModels: (provider: ApiProvider, feature: AiFeature) =>
    req<{ models: string[]; live: boolean; error?: string }>(`/settings/api-models?provider=${provider}&feature=${feature}`),
  saveApiKey: (provider: ApiProvider, key: string) =>
    req<Settings>(`/settings/api-keys/${provider}`, { method: 'PUT', body: JSON.stringify({ key }) }),
  deleteApiKey: (provider: ApiProvider) => req<Settings>(`/settings/api-keys/${provider}`, { method: 'DELETE' }),
  testApiKey: (provider: ApiProvider, key?: string) =>
    req<{ ok: boolean; message: string }>(`/settings/api-keys/${provider}/test`, { method: 'POST', body: JSON.stringify(key ? { key } : {}) }),
  actions: (conversationId: string) => req<PendingAction[]>(`/actions?conversationId=${conversationId}`),
  memories: (q?: string) => req<Memory[]>(q ? `/memories?q=${encodeURIComponent(q)}` : '/memories'),
  createMemory: (m: { content: string; category?: string }) =>
    req<Memory>('/memories', { method: 'POST', body: JSON.stringify(m) }),
  updateMemory: (id: string, m: { content?: string; category?: string; enabled?: boolean }) =>
    req<Memory>(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(m) }),
  deleteMemory: (id: string) => req<void>(`/memories/${id}`, { method: 'DELETE' }),
  pcCheck: () => req<PcCheck>('/pc-control/check'),
  pcCurrent: () => req<{ run: PcRun | null }>('/pc-control/runs/current'),
  pcStart: (goal: string) => req<PcRun>('/pc-control/runs', { method: 'POST', body: JSON.stringify({ goal, confirm: true }) }),
  pcCancel: () => req<{ run: PcRun | null }>('/pc-control/runs/current/cancel', { method: 'POST' }),
  shutdown: () => req<{ status: string }>('/system/shutdown', { method: 'POST', headers: { 'X-Aura-Shutdown': '1' } }),
  newsFeed: (q: { categoryId?: string; tag?: string; unread?: boolean; q?: string; limit?: number } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== false) p.set(k, String(v));
    return req<NewsItem[]>(`/scrape/feed?${p}`);
  },
  newsCalendar: (q: { from: Date; to: Date; categoryId?: string; tag?: string }) => {
    const p = new URLSearchParams({ from: q.from.toISOString(), to: q.to.toISOString() });
    if (q.categoryId) p.set('categoryId', q.categoryId);
    if (q.tag) p.set('tag', q.tag);
    return req<NewsItem[]>(`/scrape/calendar?${p}`);
  },
  newsTags: () => req<string[]>('/scrape/tags'),
  newsUnread: () => req<NewsUnread>('/scrape/unread'),
  newsCategories: () => req<NewsCategory[]>('/scrape/categories'),
  newsParsers: () => req<{ id: string; label: string }[]>('/scrape/parsers'),
  newsRefresh: (site?: string) =>
    req<NewsCategory[]>(`/scrape/refresh${site ? `?site=${encodeURIComponent(site)}` : ''}`, { method: 'POST' }),
  newsSeen: (b: { ids?: string[]; categoryId?: string }) =>
    req<{ count: number }>('/scrape/seen', { method: 'POST', body: JSON.stringify(b) }),
  newsCreateCategory: (name: string) =>
    req<NewsCategory[]>('/scrape/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  newsUpdateCategory: (id: string, b: { name?: string; position?: number }) =>
    req<NewsCategory[]>(`/scrape/categories/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  newsDeleteCategory: (id: string) => req<NewsCategory[]>(`/scrape/categories/${id}`, { method: 'DELETE' }),
  newsCreateSite: (b: NewsSiteInput & { url: string }) =>
    req<NewsCategory[]>('/scrape/sites', { method: 'POST', body: JSON.stringify(b) }),
  newsUpdateSite: (id: string, b: NewsSiteInput) =>
    req<NewsCategory[]>(`/scrape/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(b) }),
  newsDeleteSite: (id: string) => req<NewsCategory[]>(`/scrape/sites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  newsPreview: (b: { url: string; parser?: string; itemSelector?: string | null }) =>
    req<NewsPreview>('/scrape/preview', { method: 'POST', body: JSON.stringify(b) }),
  shortcuts: (section: ShortcutSection = 'lobby') => req<WebShortcut[]>(`/shortcuts?section=${section}`),
  createShortcut: (s: { url: string; title?: string; section?: ShortcutSection }) =>
    req<WebShortcut>('/shortcuts', { method: 'POST', body: JSON.stringify(s) }),
  updateShortcut: (id: string, s: { url?: string; title?: string }) =>
    req<WebShortcut>(`/shortcuts/${id}`, { method: 'PATCH', body: JSON.stringify(s) }),
  deleteShortcut: (id: string) => req<void>(`/shortcuts/${id}`, { method: 'DELETE' }),
  reorderShortcuts: (ids: string[], section: ShortcutSection = 'lobby') =>
    req<WebShortcut[]>('/shortcuts/order', { method: 'PUT', body: JSON.stringify({ ids, section }) }),
  toolsStatus: () => req<ToolsStatus>('/tools/status'),
  statsOverview: (days: 7 | 30) => req<StatsOverview>(`/stats/overview?days=${days}`),
  statsApi: (month?: string) => req<ApiUsageStats>(month ? `/stats/api?month=${month}` : '/stats/api'),
  setApiPrice: (model: string, input: number, output: number) =>
    req<unknown>(`/stats/prices/${encodeURIComponent(model)}`, { method: 'PUT', body: JSON.stringify({ input, output }) }),
  budget: () => req<BudgetStatus>('/stats/budget'),
  setBudget: (b: Pick<BudgetStatus, 'limitUsd' | 'warnPct' | 'block'>) => req<BudgetStatus>('/stats/budget', { method: 'PUT', body: JSON.stringify(b) }),
  resetApiPrice: (model: string) => req<void>(`/stats/prices/${encodeURIComponent(model)}`, { method: 'DELETE' }),
  ocr: (image: string, hint?: string) =>
    req<OcrResult>('/tools/ocr', { method: 'POST', body: JSON.stringify({ image, ...(hint ? { hint } : {}) }) }),
  stt: (audio: string, mime: string, language?: string, source: 'mic' | 'file' = 'file') =>
    req<SttResult>('/tools/stt', { method: 'POST', body: JSON.stringify({ audio, mime, source, ...(language ? { language } : {}) }) }),
  deleteAllMemories: () => req<{ deleted: number }>('/memories?confirm=all', { method: 'DELETE' }),
  confirmAction: (id: string) => req<{ subject?: string; content?: string; deleted?: string }>(`/actions/${id}/confirm`, { method: 'POST' }),
  cancelAction: (id: string) => req<void>(`/actions/${id}`, { method: 'DELETE' }),
  today: () => req<CalendarEvent[]>('/calendar/today'),
  unreadCount: () => req<{ count: number }>('/mail/unread-count'),
  modelHub: () => req<ModelHub>('/model-hub'),
  setupJobs: () => req<SetupJob[]>('/setup/jobs'),
  setupOutlook: (clientId: string) =>
    req<{ ok: boolean }>('/setup/outlook', { method: 'POST', headers: { 'X-Aura-Setup': '1' }, body: JSON.stringify({ clientId }) }),
  adminChangeCode: (t: string, current: string, next: string) =>
    req<{ ok: boolean }>('/admin/code', { method: 'PUT', headers: adminH(t), body: JSON.stringify({ current, next }) }),
  setupRun: (task: SetupTask) => req<SetupJob>(`/setup/run/${task}`, { method: 'POST', headers: { 'X-Aura-Setup': '1' } }),
  pullJobs: () => req<PullJob[]>('/model-hub/jobs'),
  pullModel: (name: string) => req<PullJob>('/model-hub/pull', { method: 'POST', body: JSON.stringify({ name }) }),
  cancelPull: (name: string) => req<void>(`/model-hub/pull/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  deleteModel: (name: string) => req<void>(`/model-hub/models/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  events: (days: number) => req<CalendarEvent[]>(`/calendar/events?days=${days}`),
};

export interface StreamHandlers {
  onToken: (t: string) => void;
  onStatus?: (p: StreamPhase) => void;
  onAction?: (a: PendingAction) => void;
  /** 브리핑 원자료 */
  onData?: (d: BriefingData) => void;
}

/** 아침 브리핑 (원자료 → 요약 토큰) */
export const streamBriefing = (h: StreamHandlers, signal: AbortSignal) => streamSse('/briefing/stream', undefined, h, signal);

/** 새 메시지 전송 */
export const streamMessage = (id: string, content: string, h: StreamHandlers, signal: AbortSignal) =>
  streamSse(`/conversations/${id}/messages/stream`, { content }, h, signal);

/** 마지막 응답 재생성 */
export const streamRegenerate = (id: string, h: StreamHandlers, signal: AbortSignal) =>
  streamSse(`/conversations/${id}/regenerate/stream`, undefined, h, signal);

/** 마지막 질문 수정 후 재생성 */
export const streamEditLast = (id: string, content: string, h: StreamHandlers, signal: AbortSignal) =>
  streamSse(`/conversations/${id}/edit-last/stream`, { content }, h, signal);

/** SSE(POST)를 fetch로 읽는다. data:{"token"} → onToken, event:status → onStatus, event:error → throw. */
async function streamSse(path: string, body: unknown, h: StreamHandlers, signal: AbortSignal): Promise<void> {
  const res = await call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (signal.aborted) throw e;
      throw backendDown();
    }
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      const parsed = JSON.parse(data) as {
        token?: string;
        message?: string;
        code?: ErrorCode;
        phase?: StreamPhase;
      } & Record<string, unknown>;
      if (event === 'error') throw new ApiError(500, parsed.message ?? 'stream error', parsed.code ?? 'INTERNAL');
      if (event === 'done') return;
      if (event === 'action') {
        h.onAction?.(parsed as unknown as PendingAction);
        continue;
      }
      if (event === 'data') {
        h.onData?.(parsed as unknown as BriefingData);
        continue;
      }
      if (event === 'status') {
        if (parsed.phase) h.onStatus?.(parsed.phase);
        continue;
      }
      if (parsed.token) h.onToken(parsed.token);
    }
  }
  // done 없이 끊김 = 백엔드 중단
  if (!signal.aborted) throw backendDown();
}
