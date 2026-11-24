import { parseDeck } from '../../src/vocab/format';
import { dayStart, schedule } from '../../src/vocab/srs';

const DAY = 86_400_000;
const now = new Date('2026-11-24T12:00:00');
const base = { state: 'new', due: now, interval: 0, ease: 2.5, step: 0 };

describe('srs', () => {
  it('new: good → learning step 1 (10분)', () => {
    const n = schedule(base, 3, now);
    expect(n.state).toBe('learning');
    expect(n.due.getTime() - now.getTime()).toBe(10 * 60_000);
  });
  it('learning last step: good → review 1일', () => {
    const n = schedule({ ...base, state: 'learning', step: 1 }, 3, now);
    expect(n).toMatchObject({ state: 'review', interval: 1 });
  });
  it('new: easy → review 4일', () => {
    expect(schedule(base, 4, now)).toMatchObject({ state: 'review', interval: 4 });
  });
  it('review: good → interval × ease', () => {
    const n = schedule({ ...base, state: 'review', interval: 10 }, 3, now);
    expect(n.interval).toBe(25);
    expect(n.due.getTime() - now.getTime()).toBe(25 * DAY);
  });
  it('review: again → relearning, ease 감소', () => {
    const n = schedule({ ...base, state: 'review', interval: 10 }, 1, now);
    expect(n).toMatchObject({ state: 'relearning', interval: 5, ease: 2.3 });
  });
  it('relearning: good → review', () => {
    expect(schedule({ ...base, state: 'relearning', interval: 5 }, 3, now)).toMatchObject({ state: 'review', interval: 5 });
  });
  it('하루 시작 새벽 4시', () => {
    expect(dayStart(new Date('2026-11-24T03:00:00')).getDate()).toBe(23);
    expect(dayStart(new Date('2026-11-24T05:00:00')).getHours()).toBe(4);
  });
});

describe('format', () => {
  it('정식 양식', () => {
    const d = parseDeck({ format: 'aura-vocab/1', name: 'N3', language: 'ja-JP', cards: [{ front: '勉強', back: '공부', reading: 'べんきょう', tags: ['N3'] }] });
    expect(d).toMatchObject({ name: 'N3', language: 'ja-JP', cards: [{ front: '勉強', back: '공부', reading: 'べんきょう', tags: ['N3'] }] });
  });
  it('배열·별칭·잘못된 줄 건너뜀', () => {
    const d = parseDeck([{ word: 'apple', meaning: '사과' }, ['dog', '개'], { word: 'x' }, 3]);
    expect(d.cards.map((c) => c.front)).toEqual(['apple', 'dog']);
    expect(d.skipped).toBe(2);
  });
  it('cards 없으면 오류', () => {
    expect(() => parseDeck({ name: 'x' })).toThrow();
    expect(() => parseDeck([])).toThrow();
  });
});
