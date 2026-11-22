/** FIFO 상호배제. 16GB RAM 제약상 모델 추론을 한 번에 하나만 실행하기 위해 사용. */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const prev = this.tail;
    this.tail = prev.then(() => next);
    return prev.then(() => release);
  }
}
