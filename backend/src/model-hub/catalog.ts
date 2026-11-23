/** 모델 출처. hf = Hugging Face GGUF (Ollama가 hf.co/... 로 직접 받음) */
export type CatalogSource = 'ollama' | 'hf';

/** 다운로드 화면에 보여줄 모델 목록. 크기는 Q4 기본 태그 기준 대략값. */
export interface CatalogModel {
  name: string;
  source: CatalogSource;
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
  { source: 'ollama', name: 'qwen3:1.7b', family: 'Qwen3', sizeGb: 1.4, ramGb: 4, tags: ['경량', '한국어'], quality: 2, speed: 5, desc: '아주 가벼움. 저사양 PC·빠른 응답용.' },
  { source: 'ollama', name: 'qwen3:4b', family: 'Qwen3', sizeGb: 2.5, ramGb: 8, tags: ['범용', '한국어', '추론'], quality: 3, speed: 4, desc: '기본 모델. 속도·품질 균형. 도구 호출 양호.' },
  { source: 'ollama', name: 'qwen3:8b', family: 'Qwen3', sizeGb: 5.2, ramGb: 16, tags: ['범용', '한국어', '추론'], quality: 4, speed: 3, desc: '16GB RAM 추천. 한국어·일정 처리 안정적.' },
  { source: 'ollama', name: 'qwen3:14b', family: 'Qwen3', sizeGb: 9.3, ramGb: 24, tags: ['범용', '한국어', '추론', '대형'], quality: 5, speed: 2, desc: '고품질. GPU 또는 32GB RAM 권장.' },
  { source: 'ollama', name: 'exaone3.5:2.4b', family: 'EXAONE 3.5 (LG)', sizeGb: 1.6, ramGb: 6, tags: ['한국어', '경량'], quality: 3, speed: 5, desc: '한국어 특화 소형. 자연스러운 한국어.' },
  { source: 'ollama', name: 'exaone3.5:7.8b', family: 'EXAONE 3.5 (LG)', sizeGb: 4.8, ramGb: 16, tags: ['한국어', '범용'], quality: 4, speed: 3, desc: '한국어 특화. 요약·글쓰기 강점.' },
  { source: 'ollama', name: 'gemma3:1b', family: 'Gemma 3 (Google)', sizeGb: 0.8, ramGb: 4, tags: ['경량'], quality: 2, speed: 5, desc: '초경량. 간단한 질의응답.' },
  { source: 'ollama', name: 'gemma3:4b', family: 'Gemma 3 (Google)', sizeGb: 3.3, ramGb: 8, tags: ['범용', '비전', '한국어'], quality: 3, speed: 4, desc: '이미지 입력 지원. 다국어 양호.' },
  { source: 'ollama', name: 'gemma3:12b', family: 'Gemma 3 (Google)', sizeGb: 8.1, ramGb: 24, tags: ['범용', '비전', '한국어', '대형'], quality: 4, speed: 2, desc: '고품질 다국어·이미지 이해.' },
  { source: 'ollama', name: 'llama3.2:3b', family: 'Llama 3.2 (Meta)', sizeGb: 2.0, ramGb: 8, tags: ['경량', '범용'], quality: 3, speed: 4, desc: '영어 강점. 한국어는 보통.' },
  { source: 'ollama', name: 'llama3.1:8b', family: 'Llama 3.1 (Meta)', sizeGb: 4.9, ramGb: 16, tags: ['범용'], quality: 3, speed: 3, desc: '널리 쓰이는 범용 모델. 도구 호출 지원.' },
  { source: 'ollama', name: 'phi4-mini', family: 'Phi-4 mini (Microsoft)', sizeGb: 2.5, ramGb: 8, tags: ['경량', '추론'], quality: 3, speed: 4, desc: '수학·논리 강점. 한국어 약함.' },
  { source: 'ollama', name: 'mistral:7b', family: 'Mistral', sizeGb: 4.1, ramGb: 16, tags: ['범용'], quality: 3, speed: 3, desc: '빠른 범용 모델. 영어 위주.' },
  { source: 'ollama', name: 'deepseek-r1:8b', family: 'DeepSeek-R1', sizeGb: 5.2, ramGb: 16, tags: ['추론'], quality: 4, speed: 2, desc: '단계별 사고. 답이 느리지만 논리 문제 강함.' },
  { source: 'ollama', name: 'qwen2.5-coder:7b', family: 'Qwen2.5 Coder', sizeGb: 4.7, ramGb: 16, tags: ['코딩'], quality: 4, speed: 3, desc: '코드 작성·설명 특화.' },
  { source: 'ollama', name: 'qwen2.5vl:7b', family: 'Qwen2.5-VL', sizeGb: 6.0, ramGb: 16, tags: ['비전', '한국어'], quality: 4, speed: 2, desc: '이미지·문서 사진 이해.' },
  { source: 'ollama', name: 'gpt-oss:20b', family: 'gpt-oss (OpenAI)', sizeGb: 14, ramGb: 32, tags: ['추론', '대형'], quality: 5, speed: 1, desc: '대형 추론 모델. 고사양 GPU 권장.' },
  // Hugging Face GGUF. Ollama 0.3.13+ 에서 hf.co/{user}/{repo}:{quant} 로 pull 가능
  { source: 'hf', name: 'hf.co/Qwen/Qwen3-8B-GGUF:Q4_K_M', family: 'Qwen3 (공식 GGUF)', sizeGb: 5.0, ramGb: 16, tags: ['범용', '한국어', '추론'], quality: 4, speed: 3, desc: 'Qwen 공식 GGUF. Ollama 라이브러리판과 동급.' },
  { source: 'hf', name: 'hf.co/LGAI-EXAONE/EXAONE-3.5-2.4B-Instruct-GGUF:Q4_K_M', family: 'EXAONE 3.5 (LG 공식)', sizeGb: 1.6, ramGb: 6, tags: ['한국어', '경량'], quality: 3, speed: 5, desc: 'LG 공식 GGUF. 한국어 소형.' },
  { source: 'hf', name: 'hf.co/LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct-GGUF:Q4_K_M', family: 'EXAONE 3.5 (LG 공식)', sizeGb: 4.8, ramGb: 16, tags: ['한국어', '범용'], quality: 4, speed: 3, desc: 'LG 공식 GGUF. 한국어 요약·글쓰기.' },
  { source: 'hf', name: 'hf.co/unsloth/gemma-3-4b-it-GGUF:Q4_K_M', family: 'Gemma 3 (unsloth)', sizeGb: 2.5, ramGb: 8, tags: ['범용', '한국어'], quality: 3, speed: 4, desc: 'unsloth 양자화. 가벼운 다국어.' },
  { source: 'hf', name: 'hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M', family: 'Llama 3.2 (bartowski)', sizeGb: 2.0, ramGb: 8, tags: ['경량', '범용'], quality: 3, speed: 4, desc: '인기 양자화본. 영어 강점.' },
  { source: 'hf', name: 'hf.co/bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M', family: 'Qwen2.5 (bartowski)', sizeGb: 4.7, ramGb: 16, tags: ['범용', '한국어'], quality: 4, speed: 3, desc: '검증된 범용 모델. 도구 호출 양호.' },
  { source: 'hf', name: 'hf.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF:Q4_K_M', family: 'Mistral Nemo 12B', sizeGb: 7.5, ramGb: 24, tags: ['범용', '대형'], quality: 4, speed: 2, desc: '긴 문맥(128K). 다국어 양호.' },
  { source: 'hf', name: 'hf.co/unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF:Q4_K_M', family: 'DeepSeek-R1 Distill', sizeGb: 4.7, ramGb: 16, tags: ['추론'], quality: 4, speed: 2, desc: '단계별 사고 증류 모델.' },
  { source: 'hf', name: 'hf.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M', family: 'Qwen2.5 Coder (bartowski)', sizeGb: 4.7, ramGb: 16, tags: ['코딩'], quality: 4, speed: 3, desc: '코드 특화 양자화본.' },
];

/** Ollama 모델명 형식 (예: qwen3:4b, user/model:tag, hf.co/user/repo:Q4_K_M) */
export const MODEL_NAME_RE =
  /^(?:(?:hf\.co|huggingface\.co)\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)?)(?::[a-z0-9][a-z0-9._-]*)?$/i;
