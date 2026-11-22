/** 다운로드 화면에 보여줄 Ollama 모델 목록. 크기는 Q4 기본 태그 기준 대략값. */
export interface CatalogModel {
  name: string;
  family: string;
  /** 다운로드 크기 (GB) */
  sizeGb: number;
  /** 권장 RAM (GB) */
  ramGb: number;
  tags: ('한국어' | '경량' | '범용' | '추론' | '코딩' | '비전' | '대형')[];
  /** 1~5 */
  quality: number;
  /** 1~5 (클수록 빠름) */
  speed: number;
  desc: string;
}

export const CATALOG: CatalogModel[] = [
  { name: 'qwen3:1.7b', family: 'Qwen3', sizeGb: 1.4, ramGb: 4, tags: ['경량', '한국어'], quality: 2, speed: 5, desc: '아주 가벼움. 저사양 PC·빠른 응답용.' },
  { name: 'qwen3:4b', family: 'Qwen3', sizeGb: 2.5, ramGb: 8, tags: ['범용', '한국어', '추론'], quality: 3, speed: 4, desc: '기본 모델. 속도·품질 균형. 도구 호출 양호.' },
  { name: 'qwen3:8b', family: 'Qwen3', sizeGb: 5.2, ramGb: 16, tags: ['범용', '한국어', '추론'], quality: 4, speed: 3, desc: '16GB RAM 추천. 한국어·일정 처리 안정적.' },
  { name: 'qwen3:14b', family: 'Qwen3', sizeGb: 9.3, ramGb: 24, tags: ['범용', '한국어', '추론', '대형'], quality: 5, speed: 2, desc: '고품질. GPU 또는 32GB RAM 권장.' },
  { name: 'exaone3.5:2.4b', family: 'EXAONE 3.5 (LG)', sizeGb: 1.6, ramGb: 6, tags: ['한국어', '경량'], quality: 3, speed: 5, desc: '한국어 특화 소형. 자연스러운 한국어.' },
  { name: 'exaone3.5:7.8b', family: 'EXAONE 3.5 (LG)', sizeGb: 4.8, ramGb: 16, tags: ['한국어', '범용'], quality: 4, speed: 3, desc: '한국어 특화. 요약·글쓰기 강점.' },
  { name: 'gemma3:1b', family: 'Gemma 3 (Google)', sizeGb: 0.8, ramGb: 4, tags: ['경량'], quality: 2, speed: 5, desc: '초경량. 간단한 질의응답.' },
  { name: 'gemma3:4b', family: 'Gemma 3 (Google)', sizeGb: 3.3, ramGb: 8, tags: ['범용', '비전', '한국어'], quality: 3, speed: 4, desc: '이미지 입력 지원. 다국어 양호.' },
  { name: 'gemma3:12b', family: 'Gemma 3 (Google)', sizeGb: 8.1, ramGb: 24, tags: ['범용', '비전', '한국어', '대형'], quality: 4, speed: 2, desc: '고품질 다국어·이미지 이해.' },
  { name: 'llama3.2:3b', family: 'Llama 3.2 (Meta)', sizeGb: 2.0, ramGb: 8, tags: ['경량', '범용'], quality: 3, speed: 4, desc: '영어 강점. 한국어는 보통.' },
  { name: 'llama3.1:8b', family: 'Llama 3.1 (Meta)', sizeGb: 4.9, ramGb: 16, tags: ['범용'], quality: 3, speed: 3, desc: '널리 쓰이는 범용 모델. 도구 호출 지원.' },
  { name: 'phi4-mini', family: 'Phi-4 mini (Microsoft)', sizeGb: 2.5, ramGb: 8, tags: ['경량', '추론'], quality: 3, speed: 4, desc: '수학·논리 강점. 한국어 약함.' },
  { name: 'mistral:7b', family: 'Mistral', sizeGb: 4.1, ramGb: 16, tags: ['범용'], quality: 3, speed: 3, desc: '빠른 범용 모델. 영어 위주.' },
  { name: 'deepseek-r1:8b', family: 'DeepSeek-R1', sizeGb: 5.2, ramGb: 16, tags: ['추론'], quality: 4, speed: 2, desc: '단계별 사고. 답이 느리지만 논리 문제 강함.' },
  { name: 'qwen2.5-coder:7b', family: 'Qwen2.5 Coder', sizeGb: 4.7, ramGb: 16, tags: ['코딩'], quality: 4, speed: 3, desc: '코드 작성·설명 특화.' },
  { name: 'qwen2.5vl:7b', family: 'Qwen2.5-VL', sizeGb: 6.0, ramGb: 16, tags: ['비전', '한국어'], quality: 4, speed: 2, desc: '이미지·문서 사진 이해.' },
  { name: 'gpt-oss:20b', family: 'gpt-oss (OpenAI)', sizeGb: 14, ramGb: 32, tags: ['추론', '대형'], quality: 5, speed: 1, desc: '대형 추론 모델. 고사양 GPU 권장.' },
];

/** Ollama 모델명 형식 (예: qwen3:4b, user/model:tag) */
export const MODEL_NAME_RE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?(:[a-z0-9][a-z0-9._-]*)?$/i;
