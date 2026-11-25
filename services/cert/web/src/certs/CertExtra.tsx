import { useEffect, useState } from 'react';
import { CertStats, ExamArea, PassYear, certApi } from './certApi';

const fmt = new Intl.NumberFormat('ko-KR');
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const pct = (y: PassYear) => `${Math.round((y.passed / y.applied) * 1000) / 10}%`;

/** 연도별 필기·실기 합격률 표 */
export function PassTable({ pass }: { pass: NonNullable<CertStats['pass']> }) {
  const years = [...new Set([...pass.written, ...pass.practical].map((y) => y.year))].sort();
  if (!years.length) return null;
  const cell = (ys: PassYear[], yr: number) => {
    const y = ys.find((x) => x.year === yr);
    return y ? (
      <td title={`응시 ${fmt.format(y.applied)}명 · 합격 ${fmt.format(y.passed)}명`}>
        {pct(y)}
        <small>{fmt.format(y.applied)}명</small>
      </td>
    ) : (
      <td>-</td>
    );
  };
  return (
    <table className="ca-pass">
      <thead>
        <tr>
          <th>합격률</th>
          {years.map((y) => (
            <th key={y}>{y}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pass.written.length > 0 && (
          <tr>
            <th>필기</th>
            {years.map((y) => cell(pass.written, y))}
          </tr>
        )}
        {pass.practical.length > 0 && (
          <tr>
            <th>실기</th>
            {years.map((y) => cell(pass.practical, y))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** 공개문제 (자격증 서비스가 주 1회 수집한 목록) */
export function OpenQuestions({ data }: { data: NonNullable<CertStats['questions']> }) {
  return (
    <section className="ca-card">
      <h4>📄 공개문제</h4>
      {data.note && <p className="muted">{data.note}</p>}
      {data.items.length > 0 && (
        <ul className="ca-list">
          {data.items.slice(0, 10).map((q) => (
            <li key={q.id || q.title}>
              {q.title}
              {q.date && <small className="muted"> · {q.date}</small>}
            </li>
          ))}
        </ul>
      )}
      <a href={data.url} target="_blank" rel="noreferrer" className="ca-link">
        Q-net 공개문제 ↗
      </a>
    </section>
  );
}

/** 시험장소 (지역 고르면 호출) */
export function ExamPlaces() {
  const [branches, setBranches] = useState<{ code: string; name: string }[]>([]);
  const [brch, setBrch] = useState('');
  const [res, setRes] = useState<{ items: ExamArea[]; note: string | null } | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    certApi.branches().then(setBranches, () => undefined);
  }, []);
  useEffect(() => {
    if (!brch) return;
    setRes(null);
    setErr('');
    certApi.places(brch).then(setRes, (e: unknown) => setErr(errMsg(e)));
  }, [brch]);
  const items = (res?.items ?? []).filter((a) => !q || `${a.name} ${a.address}`.includes(q));
  return (
    <section className="ca-card">
      <h4>📍 시험장소 (국가기술)</h4>
      <div className="ca-row">
        <select value={brch} onChange={(e) => setBrch(e.target.value)} aria-label="지역">
          <option value="">지역 선택</option>
          {branches.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
        {res && res.items.length > 5 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·주소 검색" />}
      </div>
      {brch && !res && !err && <p className="muted">불러오는 중…</p>}
      {err && <p className="muted">{err}</p>}
      {res?.note && <p className="muted">{res.note}</p>}
      {items.length > 0 && (
        <ul className="ca-list">
          {items.slice(0, 30).map((a) => (
            <li key={`${a.name}-${a.address}`}>
              <b>{a.name}</b>
              {a.type && <small className="muted"> · {a.type}</small>}
              <br />
              <small>
                {a.address}
                {a.tel && ` · ${a.tel}`}
              </small>
            </li>
          ))}
        </ul>
      )}
      {items.length > 30 && <small className="muted">외 {items.length - 30}곳. 검색으로 좁히기.</small>}
    </section>
  );
}

/** 민간자격 등록정보 (등록민간·국가공인민간, 30일마다 전체 수집) */
export function PrivateRegistry({ data }: { data: NonNullable<CertStats['registry']> }) {
  const res = data;
  return (
    <section className="ca-card">
      <h4>🏷️ 민간자격 등록정보</h4>
      {res.note && <p className="muted">{res.note}</p>}
      {res.items.map((r) => (
        <div key={r.regNo || r.name} className="ca-item">
          <span className="ca-label">
            {r.name} {r.status && <small className="muted">({r.status})</small>}
          </span>
          <p>
            등록번호 {r.regNo || '-'}
            {r.regDate && ` · 등록 ${r.regDate}`}
            {r.ministry && ` · ${r.ministry}`}
            {r.org && ` · ${r.org}`}
          </p>
          {r.summary && <p className="muted">{r.summary}</p>}
          {r.grades.length > 0 && (
            <ul>
              {r.grades.map((g) => (
                <li key={g.name}>
                  <b>{g.name}</b>
                  {g.isPublic && ' (공인)'}
                  {g.duty && ` · ${g.duty}`}
                </li>
              ))}
            </ul>
          )}
          {r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="ca-link">
              기관 홈페이지 ↗
            </a>
          )}
        </div>
      ))}
    </section>
  );
}
