import { usePcRun } from './usePcRun';

/** 실행 중이면 어느 화면이든 위에 정지 바. (Esc는 Python 전역 핫키가 처리: AI가 누른 Esc와 구분) */
export function PcRunBar(props: { onOpen: () => void; hidden?: boolean }) {
  const { run, live, cancel } = usePcRun();
  if (!live || !run || props.hidden) return null;
  const last = run.steps[run.steps.length - 1];
  return (
    <div className="pc-runbar" role="status">
      <span className="pc-dot" />
      <button className="link-btn" onClick={props.onOpen}>
        🖱️ PC 조작 중 · {run.steps.length}단계{last?.action ? ` · ${last.action}` : ''}
      </button>
      <button className="primary danger" onClick={() => void cancel()}>
        ■ 정지
      </button>
    </div>
  );
}
