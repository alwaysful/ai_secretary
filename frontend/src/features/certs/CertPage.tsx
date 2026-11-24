import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { gcalUrl } from '../news/gcal';
import { CertAbout } from './CertAbout';
import { CertCalendar } from './CertCalendar';
import { CertKeyBox } from './CertKeyBox';
import { Cert, CertExam, CertFilter, CertInput, CertMeta, certApi, ExamInput } from './certApi';
import './certs.css';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const day = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' });
const ymd = new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' });

function range(from: string | null, to: string | null) {
  if (!from && !to) return <span className="muted">-</span>;
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : null;
  const fmt = (f ?? t)!.getFullYear() !== new Date().getFullYear() ? ymd : day;
  if (f && t && f.toDateString() === t.toDateString()) return <span>{fmt.format(t)}</span>;
  return (
    <span>
      {f ? fmt.format(f) : '?'} ~ {t ? fmt.format(t) : '?'}
    </span>
  );
}

/** 날짜까지 남은 일수 */
function dday(iso: string | null, endIso: string | null): string | null {
  if (!iso && !endIso) return null;
  const now = Date.now();
  const s = new Date(iso ?? endIso!).getTime();
  const e = new Date(endIso ?? iso!).getTime() + 86_400_000;
  if (now >= s && now < e) return '진행 중';
  if (now >= e) return '끝';
  const d = Math.ceil((s - now) / 86_400_000);
  return d === 0 ? 'D-day' : `D-${d}`;
}

const examName = (e: CertExam) => `${e.phase ? `${e.phase} ` : ''}${e.title}`;

/** 회차 → 구글 캘린더 접수·시험 링크 */
function gcal(c: Cert, e: CertExam) {
  const body = [c.org, c.url, e.note].filter(Boolean).join('\n');
  const out: { label: string; url: string }[] = [];
  if (e.regStart || e.regEnd) out.push({ label: '접수', url: gcalUrl(`[접수] ${c.name} ${e.phase ?? ''}`.trim(), new Date(e.regStart ?? e.regEnd!), new Date(e.regEnd ?? e.regStart!), body) });
  if (e.examStart || e.examEnd) out.push({ label: '시험', url: gcalUrl(`[시험] ${c.name} ${e.phase ?? ''}`.trim(), new Date(e.examStart ?? e.examEnd!), new Date(e.examEnd ?? e.examStart!), body) });
  return out;
}

/** 가장 가까운 접수: 접수 마감 안 지난 첫 회차, 없으면 첫 회차 */
function nearest(c: Cert): CertExam | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return c.exams.find((e) => {
    const end = e.regEnd ?? e.regStart;
    return end && new Date(end) >= today;
  }) ?? c.exams[0];
}

/** 준비기간·응시료 고치기 (빈칸 저장 = 기본값) */
function PrepFeeForm(props: { cert: Cert; onDone: (c?: Cert) => void }) {
  const [prep, setPrep] = useState(props.cert.prep ?? '');
  const [fee, setFee] = useState(props.cert.fee ?? '');
  const [validity, setValidity] = useState(props.cert.validity ?? '');
  const [score, setScore] = useState(String(props.cert.score));
  const [error, setError] = useState('');
  const save = (b: { prep: string | null; fee: string | null; validity: string | null; score: number | null }) =>
    certApi.update(props.cert.id, b).then(
      (c) => props.onDone(c),
      (e: unknown) => setError(errMsg(e)),
    );
  return (
    <div className="cert-exam-form">
      <div className="cert-form-grid">
        <label>
          평균 준비기간
          <input value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="예: 2~3개월" />
        </label>
        <label>
          응시료
          <input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="예: 필기 19,400원" />
        </label>
        <label>
          유효기간
          <input value={validity} onChange={(e) => setValidity(e.target.value)} placeholder="예: 2년, 평생" />
        </label>
        <label>
          유용도 (0~10)
          <input type="number" min={0} max={10} step={0.1} value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="cert-form-btns">
        <button
          onClick={() => {
            const n = Math.round(Number(score) * 10) / 10;
            if (score.trim() === '' || !Number.isFinite(n) || n < 0 || n > 10) return setError('유용도는 0~10 사이 숫자');
            void save({ prep, fee, validity, score: n === props.cert.score && !props.cert.scoreEdited ? null : n });
          }}
        >
          저장
        </button>
        {(props.cert.prepEdited || props.cert.feeEdited || props.cert.validityEdited || props.cert.scoreEdited) && (
          <button className="ghost" onClick={() => void save({ prep: null, fee: null, validity: null, score: null })}>
            기본값으로
          </button>
        )}
        <button className="ghost" onClick={() => props.onDone()}>
          취소
        </button>
      </div>
    </div>
  );
}

const searchUrl = (name: string) => `https://search.naver.com/search.naver?query=${encodeURIComponent(`${name} 시험일정`)}`;

/** 자격증 추가 (직접) */
function CertForm(props: { meta: CertMeta; field: string; onDone: (c?: Cert) => void }) {
  const [b, setB] = useState<CertInput & { name: string }>({ name: '', field: props.field || '기타', kind: '민간', org: '', url: '', grade: '', summary: '' });
  const [error, setError] = useState('');
  const set = (k: keyof CertInput) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value });
  const save = () =>
    certApi.create(b).then(
      (c) => props.onDone(c),
      (e: unknown) => setError(errMsg(e)),
    );
  return (
    <div className="card cert-form">
      <h3>＋ 자격증 직접 추가</h3>
      <div className="cert-form-grid">
        <input placeholder="이름 *" value={b.name} onChange={set('name')} />
        <select value={b.field} onChange={set('field')}>
          {props.meta.fields.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select value={b.kind} onChange={set('kind')}>
          {props.meta.kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input placeholder="등급 (선택)" value={b.grade ?? ''} onChange={set('grade')} />
        <input placeholder="시행기관" value={b.org} onChange={set('org')} />
        <input placeholder="공식 사이트 https://…" value={b.url ?? ''} onChange={set('url')} />
        <input placeholder="유효기간 (예: 2년)" value={b.validity ?? ''} onChange={set('validity')} />
        <input className="wide" placeholder="메모 (선택)" value={b.summary ?? ''} onChange={set('summary')} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="cert-form-btns">
        <button disabled={!b.name.trim()} onClick={() => void save()}>
          추가
        </button>
        <button className="ghost" onClick={() => props.onDone()}>
          취소
        </button>
      </div>
    </div>
  );
}

/** 회차 직접 입력 */
function ExamForm(props: { cert: Cert; onDone: (c?: Cert) => void }) {
  const [b, setB] = useState<ExamInput>({ title: `${new Date().getFullYear()}년 회차`, phase: '' });
  const [error, setError] = useState('');
  const set = (k: keyof ExamInput) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value });
  const date = (k: keyof ExamInput, label: string) => (
    <label>
      {label}
      <input type="date" value={(b[k] as string) ?? ''} onChange={set(k)} />
    </label>
  );
  const save = () =>
    certApi.addExam(props.cert.id, b).then(
      (c) => props.onDone(c),
      (e: unknown) => setError(errMsg(e)),
    );
  return (
    <div className="cert-exam-form">
      <div className="cert-form-grid">
        <input placeholder="회차 이름 *" value={b.title} onChange={set('title')} />
        <input placeholder="구분 (필기·실기 등)" value={b.phase ?? ''} onChange={set('phase')} />
        {date('regStart', '접수 시작')}
        {date('regEnd', '접수 마감')}
        {date('examStart', '시험일')}
        {date('examEnd', '시험 끝 (선택)')}
        {date('resultAt', '발표일')}
        <input placeholder="메모" value={b.note ?? ''} onChange={set('note')} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="cert-form-btns">
        <button disabled={!b.title.trim()} onClick={() => void save()}>
          일정 추가
        </button>
        <button className="ghost" onClick={() => props.onDone()}>
          취소
        </button>
      </div>
    </div>
  );
}

/** 자격증 검색: 분야별 목록 + 시험 일정 (공모전 탭과 같은 양식) */
export function CertPage(props: { onBack: () => void }) {
  const [meta, setMeta] = useState<CertMeta | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [field, setField] = useState('');
  const [kind, setKind] = useState('');
  const [starred, setStarred] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Cert[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [examFor, setExamFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [keyBox, setKeyBox] = useState(false);
  const [error, setError] = useState('');
  /** 한 번에 보여줄 줄 수 (500개 넘어서 나눠 그림) */
  const [shown, setShown] = useState(100);
  /** 유용도 높은 순 정렬 */
  const [byScore, setByScore] = useState(false);
  /** 설명 펼친 자격증 */
  const [about, setAbout] = useState<string | null>(null);
  const rows = useMemo(() => (items && byScore ? [...items].sort((a, b) => b.score - a.score) : items), [items, byScore]);

  const filter: CertFilter = { field: field || undefined, kind: kind || undefined, starred, q: q.trim() || undefined };

  const load = useCallback(
    () =>
      Promise.all([certApi.list(filter), certApi.fields(filter)]).then(
        ([l, c]) => {
          setItems(l);
          setCounts(c);
          setError('');
        },
        (e: unknown) => setError(errMsg(e)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field, kind, starred, q],
  );

  useEffect(() => {
    certApi.meta().then(setMeta, (e: unknown) => setError(errMsg(e)));
  }, []);

  useEffect(() => setShown(100), [field, kind, starred, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const replace = (c: Cert) => setItems((xs) => xs?.map((x) => (x.id === c.id ? c : x)) ?? xs);

  const star = (c: Cert) =>
    certApi.update(c.id, { starred: !c.starred }).then(
      (n) => (starred && !n.starred ? void load() : replace(n)),
      (e: unknown) => setError(errMsg(e)),
    );

  const removeCert = (c: Cert) => {
    if (!confirm(`'${c.name}' 삭제?`)) return;
    certApi.remove(c.id).then(load, (e: unknown) => setError(errMsg(e)));
  };

  const removeExam = (c: Cert, e: CertExam) =>
    certApi.removeExam(e.id).then(
      () => replace({ ...c, exams: c.exams.filter((x) => x.id !== e.id) }),
      (err: unknown) => setError(errMsg(err)),
    );

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="subpage">
      <header className="bar">
        <button className="ghost" onClick={props.onBack}>
          ← 로비
        </button>
        <h1>자격증</h1>
        <button className="ghost news-manage-btn" onClick={() => setKeyBox(!keyBox)}>
          ⚙ 일정 연동
        </button>
      </header>
      <div className="subbody cert-body">
        {keyBox && (
          <div className="card">
            <CertKeyBox onSynced={() => void load()} />
          </div>
        )}
        <div className="news-tabs" role="tablist" aria-label="종류">
          <button role="tab" aria-selected={!kind && !starred} className={!kind && !starred ? 'on' : ''} onClick={() => { setKind(''); setStarred(false); }}>
            전체
          </button>
          <button role="tab" aria-selected={starred} className={starred ? 'on' : ''} onClick={() => { setStarred(true); setKind(''); }}>
            ★ 관심
          </button>
          {meta?.kinds.map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setStarred(false); }}>
              {k}
            </button>
          ))}
        </div>
        <div className="news-tags" role="tablist" aria-label="분야">
          <button className={field === '' ? 'on' : ''} onClick={() => setField('')}>
            # 전체 분야 <small>{total}</small>
          </button>
          {meta?.fields.map((f) => (
            <button key={f} className={`${field === f ? 'on' : ''}${counts[f] ? '' : ' empty'}`} onClick={() => setField(field === f ? '' : f)}>
              #{f} <small>{counts[f] ?? 0}</small>
            </button>
          ))}
        </div>
        <div className="news-tools">
          <div className="news-view" role="tablist" aria-label="보기">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
              ☰ 목록
            </button>
            <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>
              📅 달력
            </button>
          </div>
          <input className="news-search" placeholder="자격증·기관 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ghost" onClick={() => setAdding(!adding)}>
            ＋ 자격증 추가
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {adding && meta && (
          <CertForm
            meta={meta}
            field={field}
            onDone={(c) => {
              setAdding(false);
              if (c) void load();
            }}
          />
        )}
        {view === 'list' && <p className="muted cert-note">준비기간·응시료·유효기간·유용도(0~10)는 참고값(해마다 바뀜). 정확한 값은 공식 사이트 확인, ✎로 직접 수정 가능.</p>}
        {view === 'calendar' && <CertCalendar filter={filter} />}
        {view === 'list' && items === null && !error && <p className="muted">불러오는 중…</p>}
        {view === 'list' && items?.length === 0 && <p className="muted">없음. ＋ 자격증 추가로 직접 등록.</p>}
        {view === 'list' && items && items.length > 0 && (
          <table className="news-table cert-table">
            <thead>
              <tr>
                <th>자격증 · 내용</th>
                <th>
                  <button className={`cert-sort${byScore ? ' on' : ''}`} onClick={() => setByScore(!byScore)} title="유용도 높은 순 정렬 (다시 누르면 기본 순서)">
                    유용도 {byScore ? '▼' : '↕'}
                  </button>
                </th>
                <th>가장 가까운 접수</th>
                <th>시험일</th>
                <th>준비기간</th>
                <th>응시료</th>
                <th>유효기간</th>
                <th>캘린더</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).slice(0, shown).map((c) => {
                const next = nearest(c);
                const expanded = open === c.id;
                return (
                  <Fragment key={c.id}>
                  <tr className={c.starred ? 'starred' : ''}>
                    <td className="nt-main">
                      <div className="cert-head">
                        <button className={`cert-star${c.starred ? ' on' : ''}`} onClick={() => void star(c)} aria-label={c.starred ? '관심 해제' : '관심 등록'} title="관심">
                          {c.starred ? '★' : '☆'}
                        </button>
                        <button className="news-main" onClick={() => setOpen(expanded ? null : c.id)}>
                          <span className="news-title">
                            {c.name}
                            {c.grade && !c.name.includes(c.grade) && <small className="muted"> {c.grade}</small>}
                            {c.isNew && <b className="news-dot">N</b>}
                          </span>
                        </button>
                      </div>
                      {c.summary && <p className="nt-summary">{c.summary}</p>}
                      <span className="news-meta">
                        <span className="news-tag">#{c.field}</span>
                        <span>{c.kind}</span>
                        {c.publicGrades && c.publicGrades !== '등급 없음' && <span className="cert-public">공인 {c.publicGrades}</span>}
                        <span>주관 {c.org}</span>
                        {c.seriesLabel && <span>{c.seriesLabel}</span>}
                        {c.custom && <span>직접 추가</span>}
                      </span>
                      <span className="news-links">
                        <button className={`cert-about-btn${about === c.id ? ' on' : ''}`} onClick={() => setAbout(about === c.id ? null : c.id)} aria-expanded={about === c.id}>
                          ⓘ 설명
                        </button>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer">
                            공식 사이트 ↗
                          </a>
                        )}
                        <a href={searchUrl(c.name)} target="_blank" rel="noreferrer">
                          일정 검색 ↗
                        </a>
                        <button className="link-like" onClick={() => setOpen(expanded ? null : c.id)}>
                          {expanded ? '접기' : `일정 ${c.exams.length}건`}
                        </button>
                        <button className="link-like" onClick={() => { setOpen(c.id); setExamFor(c.id); }}>
                          ＋일정
                        </button>
                        <button className="link-like" onClick={() => { setOpen(c.id); setEditFor(c.id); }}>
                          ✎ 준비기간·응시료·유효기간·유용도
                        </button>
                        {c.custom && (
                          <button className="link-like danger" onClick={() => removeCert(c)}>
                            삭제
                          </button>
                        )}
                      </span>
                      {expanded && (
                        <div className="cert-exams">
                          {c.exams.length === 0 && (
                            <p className="muted">
                              {c.series === 'qnet-상시'
                                ? '상시 시험: Q-net에서 원하는 날 접수.'
                                : c.series
                                  ? '일정 없음. ⚙ 일정 연동에서 Q-net 키 등록 시 자동 수집.'
                                  : '일정 없음. 공식 사이트 확인 후 ＋일정으로 직접 추가.'}
                            </p>
                          )}
                          {c.exams.map((e) => (
                            <div key={e.id} className="cert-exam">
                              <b>{examName(e)}</b>
                              <span>접수 {range(e.regStart, e.regEnd)}</span>
                              <span>시험 {range(e.examStart, e.examEnd)}</span>
                              {e.resultAt && <span>발표 {range(e.resultAt, e.resultAt)}</span>}
                              <small className="muted">{e.source === 'qnet' ? 'Q-net 자동' : '직접 입력'}</small>
                              {e.note && <small className="muted">{e.note}</small>}
                              {e.source === 'manual' && (
                                <button className="link-like danger" onClick={() => void removeExam(c, e)}>
                                  삭제
                                </button>
                              )}
                            </div>
                          ))}
                          {editFor === c.id && (
                            <PrepFeeForm
                              cert={c}
                              onDone={(n) => {
                                setEditFor(null);
                                if (n) replace(n);
                              }}
                            />
                          )}
                          {examFor === c.id && (
                            <ExamForm
                              cert={c}
                              onDone={(n) => {
                                setExamFor(null);
                                if (n) replace(n);
                              }}
                            />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="cert-score" data-label="유용도" title={c.scoreEdited ? '직접 매긴 값' : '참고값 (✎로 수정)'}>
                      <b style={{ ['--s' as string]: c.score }}>{c.score.toFixed(1)}</b>
                      {c.scoreEdited && <small className="muted"> ✎</small>}
                    </td>
                    <td className="nt-period" data-label="접수">
                      {next ? (
                        <>
                          {range(next.regStart, next.regEnd)}
                          {dday(next.regStart, next.regEnd) && <span className="news-dday"> {dday(next.regStart, next.regEnd)}</span>}
                          <small className="muted cert-next">{examName(next)}</small>
                        </>
                      ) : (
                        <span className="muted">{c.series === 'qnet-상시' ? '상시' : '-'}</span>
                      )}
                    </td>
                    <td className="nt-period" data-label="시험">
                      {next ? range(next.examStart, next.examEnd) : <span className="muted">-</span>}
                    </td>
                    <td className="cert-info" data-label="준비">
                      {c.prep ?? <span className="muted">-</span>}
                      {c.prepEdited && <small className="muted"> ✎</small>}
                    </td>
                    <td className="cert-info" data-label="응시료">
                      {c.fee ?? <span className="muted">공식 확인</span>}
                      {c.feeEdited && <small className="muted"> ✎</small>}
                    </td>
                    <td className="cert-info" data-label="유효기간">
                      {c.validity ?? <span className="muted">-</span>}
                      {c.validityEdited && <small className="muted"> ✎</small>}
                    </td>
                    <td className="nt-cal">
                      {next &&
                        gcal(c, next).map((g) => (
                          <a key={g.label} className="ghost nt-gcal" href={g.url} target="_blank" rel="noreferrer" title={`구글 캘린더에 ${g.label} 일정 추가`}>
                            ＋{g.label}
                          </a>
                        ))}
                    </td>
                  </tr>
                  {about === c.id && (
                    <tr className="ca-row">
                      <td colSpan={8}>
                        <CertAbout cert={c} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {view === 'list' && items && items.length > shown && (
          <button className="ghost cert-more" onClick={() => setShown(shown + 200)}>
            더 보기 ({shown} / {items.length})
          </button>
        )}
      </div>
    </div>
  );
}
