import { req } from '../../shared/api';

export interface DeckSummary {
  total: number;
  new: number;
  learning: number;
  review: number;
  today: { new: number; learn: number; review: number; doneNew: number; doneReview: number };
  known: number;
  roundSeen: number;
}

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  newPerDay: number;
  reviewPerDay: number;
  direction: 'front' | 'back';
  round: number;
  createdAt: string;
  updatedAt: string;
  summary: DeckSummary;
}

export interface VCard {
  id: string;
  deckId: string;
  position: number;
  front: string;
  back: string;
  reading: string | null;
  example: string | null;
  exampleMeaning: string | null;
  note: string | null;
  tags: string[];
  state: 'new' | 'learning' | 'review' | 'relearning';
  due: string;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  known: boolean;
  roundSeen: number;
  wrongCount: number;
  starred: boolean;
  /** 복습 큐에서만: 다시·어려움·알맞음·쉬움 다음 간격 (ms) */
  preview?: number[];
}

export interface ImportResult {
  deck: Deck;
  added: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

export interface Queue {
  deck: Deck;
  cards: VCard[];
  nextLearnAt: string | null;
}

export interface Round {
  round: number;
  total: number;
  left: number;
  known: number;
  /** 다시 공부 목록 수 */
  again: number;
  cards: VCard[];
}

export interface QuizQ {
  cardId: string;
  prompt: string;
  reading: string | null;
  hint: string | null;
  choices: string[];
  answer: number;
}

export type QuizDir = 'fb' | 'bf';
export type QuizPool = 'all' | 'wrong' | 'starred' | 'unknown';

export interface VocabStats {
  summary: DeckSummary;
  round: number;
  mature: number;
  young: number;
  starred: number;
  wrong: number;
  dates: string[];
  daily: { srs: number; round: number; quiz: number; correct: number }[];
  total: { srs: number; round: number; quiz: number };
  accuracy: { srs: number | null; round: number | null; quiz: number | null };
  streak: number;
  forecast: number[];
  hardest: { id: string; front: string; back: string; reading: string | null; wrongCount: number; lapses: number }[];
}

export type CardFields = Pick<VCard, 'front' | 'back'> & Partial<Record<'reading' | 'example' | 'exampleMeaning' | 'note', string>> & { tags?: string[] };
export type DeckPatch = Partial<Pick<Deck, 'name' | 'newPerDay' | 'reviewPerDay' | 'direction'>> & { description?: string; language?: string };

const post = <T>(path: string, body: unknown) => req<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const vocab = {
  decks: () => req<Deck[]>('/vocab/decks'),
  deck: (id: string) => req<Deck>(`/vocab/decks/${id}`),
  create: (name: string) => post<Deck>('/vocab/decks', { name }),
  import: (data: unknown, o: { deckId?: string; name?: string } = {}) => post<ImportResult>('/vocab/import', { data, ...o }),
  update: (id: string, p: DeckPatch) => req<Deck>(`/vocab/decks/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
  remove: (id: string) => req<void>(`/vocab/decks/${id}`, { method: 'DELETE' }),
  export: (id: string) => req<unknown>(`/vocab/decks/${id}/export`),
  reset: (id: string, what: 'srs' | 'round' | 'all') => post<Deck>(`/vocab/decks/${id}/reset`, { what }),
  queue: (id: string) => req<Queue>(`/vocab/decks/${id}/queue`),
  review: (cardId: string, grade: 1 | 2 | 3 | 4) => post<VCard>(`/vocab/cards/${cardId}/review`, { grade }),
  round: (id: string, shuffle: boolean) => req<Round>(`/vocab/decks/${id}/round${shuffle ? '?shuffle=1' : ''}`),
  again: (id: string) => req<{ total: number; cards: VCard[] }>(`/vocab/decks/${id}/again`),
  roundAnswer: (cardId: string, known: boolean) => post<VCard>(`/vocab/cards/${cardId}/round`, { known }),
  nextRound: (id: string, unknownOnly: boolean) => post<Round>(`/vocab/decks/${id}/round/next`, { unknownOnly }),
  quiz: (id: string, n: number, dir: QuizDir, pool: QuizPool) => req<QuizQ[]>(`/vocab/decks/${id}/quiz?n=${n}&dir=${dir}&pool=${pool}`),
  quizAnswer: (cardId: string, correct: boolean) => post<{ ok: boolean }>(`/vocab/cards/${cardId}/quiz`, { correct }),
  cards: (id: string, o: { q?: string; filter?: string; skip?: number; take?: number }) => {
    const p = new URLSearchParams();
    if (o.q) p.set('q', o.q);
    if (o.filter) p.set('filter', o.filter);
    p.set('skip', String(o.skip ?? 0));
    p.set('take', String(o.take ?? 50));
    return req<{ items: VCard[]; total: number }>(`/vocab/decks/${id}/cards?${p}`);
  },
  addCard: (id: string, c: CardFields) => post<VCard>(`/vocab/decks/${id}/cards`, c),
  updateCard: (cardId: string, c: Partial<CardFields> & { starred?: boolean; known?: boolean }) =>
    req<VCard>(`/vocab/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify(c) }),
  removeCard: (cardId: string) => req<void>(`/vocab/cards/${cardId}`, { method: 'DELETE' }),
  stats: (id: string, days = 30) => req<VocabStats>(`/vocab/decks/${id}/stats?days=${days}`),
};
