import { useState } from 'react';
import { copyText } from './copy';

export function CopyButton(props: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await copyText(props.text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* 무시 */
    }
  };
  return (
    <button type="button" className={props.className ?? 'tool'} onClick={() => void onClick()} aria-live="polite">
      {done ? '복사됨' : (props.label ?? '복사')}
    </button>
  );
}
