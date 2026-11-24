/**
 * 단어장 JSON 양식 (aura-vocab/1).
 * {
 *   "format": "aura-vocab/1",
 *   "name": "JLPT N3",
 *   "description": "선택",
 *   "language": "ja-JP",
 *   "cards": [{ "front": "勉強", "back": "공부", "reading": "べんきょう", "example": "...", "exampleMeaning": "...", "note": "...", "tags": ["N3"] }]
 * }
 * 카드 배열만 있어도 됨. 별칭: word·term·question → front, meaning·definition·answer → back, furigana·pronunciation → reading.
 */

export const FORMAT_ID = 'aura-vocab/1';
export const MAX_CARDS = 20_000;
const MAX_LEN = 2000;

export interface CardInput {
  front: string;
  back: string;
  reading?: string;
  example?: string;
  exampleMeaning?: string;
  note?: string;
  tags: string[];
}

export interface ParsedDeck {
  name?: string;
  description?: string;
  language?: string;
  cards: CardInput[];
  /** 건너뛴 줄 설명 (최대 20개) */
  errors: string[];
  skipped: number;
}

const ALIASES: Record<keyof Omit<CardInput, 'tags'>, string[]> = {
  front: ['front', 'word', 'term', 'question', 'q', 'kanji', 'expression', '단어', '앞'],
  back: ['back', 'meaning', 'definition', 'answer', 'a', 'mean', '뜻', '뒤'],
  reading: ['reading', 'furigana', 'kana', 'pronunciation', 'pron', 'yomi', '읽기', '발음'],
  example: ['example', 'sentence', 'ex', '예문'],
  exampleMeaning: ['exampleMeaning', 'example_meaning', 'exampleTranslation', 'sentenceMeaning', '예문뜻', '예문해석'],
  note: ['note', 'memo', 'hint', '메모'],
};

const str = (v: unknown): string | undefined => {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, MAX_LEN) : undefined;
};

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = str(o[k]);
    if (v !== undefined) return v;
  }
  return undefined;
};

function tagsOf(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\s]+/) : [];
  return [...new Set(list.map(str).filter((t): t is string => !!t).map((t) => t.slice(0, 40)))].slice(0, 20);
}

/** 업로드 JSON → 카드 목록. 형식이 아예 틀리면 Error */
export function parseDeck(data: unknown): ParsedDeck {
  let root: Record<string, unknown> = {};
  let raw: unknown[];
  if (Array.isArray(data)) raw = data;
  else if (data && typeof data === 'object') {
    root = data as Record<string, unknown>;
    const c = root.cards ?? root.words ?? root.items ?? root.notes;
    if (!Array.isArray(c)) throw new Error('"cards" 배열이 없음');
    raw = c;
  } else throw new Error('JSON 객체 또는 배열이 아님');

  if (raw.length === 0) throw new Error('카드가 0개');
  if (raw.length > MAX_CARDS) throw new Error(`카드가 너무 많음 (최대 ${MAX_CARDS}개)`);

  const errors: string[] = [];
  const cards: CardInput[] = [];
  let skipped = 0;
  raw.forEach((item, i) => {
    let o: Record<string, unknown>;
    if (Array.isArray(item)) o = { front: item[0], back: item[1], reading: item[2], example: item[3], exampleMeaning: item[4] };
    else if (item && typeof item === 'object') o = item as Record<string, unknown>;
    else {
      skipped++;
      if (errors.length < 20) errors.push(`${i + 1}번: 객체 아님`);
      return;
    }
    const front = pick(o, ALIASES.front);
    const back = pick(o, ALIASES.back);
    if (!front || !back) {
      skipped++;
      if (errors.length < 20) errors.push(`${i + 1}번: front·back 필요`);
      return;
    }
    cards.push({
      front,
      back,
      reading: pick(o, ALIASES.reading),
      example: pick(o, ALIASES.example),
      exampleMeaning: pick(o, ALIASES.exampleMeaning),
      note: pick(o, ALIASES.note),
      tags: tagsOf(o.tags ?? o.tag ?? o.level),
    });
  });
  if (cards.length === 0) throw new Error(`쓸 수 있는 카드가 없음. ${errors.slice(0, 3).join(' / ')}`);

  return {
    name: str(root.name ?? root.title)?.slice(0, 100),
    description: str(root.description)?.slice(0, 500),
    language: str(root.language ?? root.lang)?.slice(0, 20),
    cards,
    errors,
    skipped,
  };
}

/** 내보내기용 */
export function toExport(
  deck: { name: string; description: string | null; language: string | null },
  cards: CardInput[],
) {
  return {
    format: FORMAT_ID,
    name: deck.name,
    ...(deck.description ? { description: deck.description } : {}),
    ...(deck.language ? { language: deck.language } : {}),
    cards: cards.map((c) => ({
      front: c.front,
      back: c.back,
      ...(c.reading ? { reading: c.reading } : {}),
      ...(c.example ? { example: c.example } : {}),
      ...(c.exampleMeaning ? { exampleMeaning: c.exampleMeaning } : {}),
      ...(c.note ? { note: c.note } : {}),
      ...(c.tags.length ? { tags: c.tags } : {}),
    })),
  };
}
