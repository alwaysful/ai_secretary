import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EnvVars } from '../config/env';
import { PcAgentProcess } from '../pc-control/pc-agent.process';
import { SettingsService } from '../settings/settings.service';
import { ModelError } from '../ai/models/base-model';
import { apiTranscribe, apiVision, PROVIDER_LABEL } from '../ai/providers/api-providers';

const OCR_TIMEOUT_MS = 180_000;
const STT_TIMEOUT_MS = 15 * 60_000;
const STT_IDLE_MS = 10 * 60_000;

const OCR_SYSTEM = [
  'You are an OCR engine.',
  'Transcribe ALL visible text in the image exactly as written, keeping the original language (Korean stays Korean).',
  'Keep line breaks and reading order. Tables: one row per line, cells separated by " | ".',
  'Do not translate, summarize, explain or add anything. If no text, output nothing.',
].join(' ');

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** base64 앞의 data:...;base64, 제거 */
export function stripDataUrl(b64: string): string {
  const i = b64.indexOf('base64,');
  return (i >= 0 ? b64.slice(i + 7) : b64).replace(/\s/g, '');
}

/** 모델 출력에서 ``` 펜스 제거 */
export function cleanOcr(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^\s*```[a-z]*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/** 도구 탭: OCR(Ollama 비전 모델), STT(faster-whisper 사이드카) */
@Injectable()
export class ToolsService implements OnModuleDestroy {
  private readonly log = new Logger(ToolsService.name);
  private readonly baseUrl: string;
  private readonly python: string;
  private readonly script: string;
  private stt: PcAgentProcess | null = null;
  private starting: Promise<PcAgentProcess> | null = null;
  private idle?: NodeJS.Timeout;
  private queue: Promise<unknown> = Promise.resolve();
  private checkCache: { at: number; ok: boolean; detail: string } | null = null;

  constructor(
    config: ConfigService<EnvVars, true>,
    private readonly settings: SettingsService,
  ) {
    this.baseUrl = config.get('OLLAMA_BASE_URL', { infer: true }).replace(/\/$/, '');
    this.python = config.get('PC_PYTHON', { infer: true }) || (process.platform === 'win32' ? 'python' : 'python3');
    const candidates = [resolve(process.cwd(), '..', 'pc-agent', 'stt.py'), resolve(process.cwd(), 'pc-agent', 'stt.py')];
    this.script = candidates.find((p) => existsSync(p)) ?? candidates[0];
  }

  onModuleDestroy(): void {
    this.stopStt();
  }

  /** STT 설치 확인(30초 캐시) + 모델 이름 */
  async status() {
    const ocrApi = this.settings.aiApi('ocr');
    const sttApi = this.settings.aiApi('stt');
    const stt = sttApi
      ? { ok: !!sttApi.key, detail: sttApi.key ? '' : `${PROVIDER_LABEL[sttApi.provider]} API 키 없음` }
      : await this.checkStt();
    return {
      ocr: { model: ocrApi ? `${ocrApi.provider}:${ocrApi.model}` : this.settings.ocrModel(), source: ocrApi ? 'api' : 'local' },
      stt: { ...stt, model: sttApi ? `${sttApi.provider}:${sttApi.model}` : this.settings.sttModel(), source: sttApi ? 'api' : 'local' },
      mic: this.settings.mic(),
    };
  }

  private apiFail(e: unknown, code: string): Error {
    const msg = e instanceof ModelError || e instanceof Error ? e.message : String(e);
    return new ServiceUnavailableException({ code, message: msg });
  }

  private checkStt(): Promise<{ ok: boolean; detail: string }> {
    const c = this.checkCache;
    if (c && Date.now() - c.at < 30_000) return Promise.resolve({ ok: c.ok, detail: c.detail });
    return new Promise((done) => {
      execFile(this.python, [this.script, '--check'], { timeout: 20_000, windowsHide: true }, (err, stdout, stderr) => {
        let ok = false;
        let detail = '';
        try {
          const r = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { ok?: boolean; error?: string };
          ok = !!r.ok;
          detail = r.error ?? '';
        } catch {
          detail = (stderr || err?.message || 'Python 실행 실패').trim().split('\n').slice(-2).join(' ').slice(0, 300);
        }
        if (!ok && !detail) detail = 'faster-whisper 없음';
        this.checkCache = { at: Date.now(), ok, detail };
        done({ ok, detail });
      });
    });
  }

  async ocr(image: string, hint?: string): Promise<{ text: string; model: string; ms: number }> {
    const img = stripDataUrl(image);
    if (!img) throw new BadRequestException({ code: 'NO_IMAGE', message: '이미지 없음' });
    const t0 = Date.now();
    const prompt = hint?.trim() ? `이미지의 글자를 그대로 옮겨 적어. 추가 지시: ${hint.trim()}` : '이미지의 글자를 그대로 옮겨 적어.';
    const api = this.settings.aiApi('ocr');
    if (api) {
      if (!api.key) throw new BadRequestException({ code: 'NO_API_KEY', message: `${PROVIDER_LABEL[api.provider]} API 키 없음 (설정 → 모델)` });
      try {
        const text = await apiVision(api.provider, api.key, api.model, OCR_SYSTEM, prompt, img, { timeoutMs: OCR_TIMEOUT_MS, maxTokens: 8192 });
        return { text: cleanOcr(text), model: `${api.provider}:${api.model}`, ms: Date.now() - t0 };
      } catch (e) {
        throw this.apiFail(e, 'OCR_FAILED');
      }
    }
    const model = this.settings.ocrModel();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          keep_alive: '5m',
          options: { temperature: 0, num_predict: 4096, num_ctx: 8192 },
          messages: [
            { role: 'system', content: OCR_SYSTEM },
            {
              role: 'user',
              content: prompt,
              images: [img],
            },
          ],
        }),
      });
    } catch (e) {
      throw new ServiceUnavailableException({ code: 'OLLAMA_DOWN', message: `Ollama 연결 실패: ${(e as Error).message}` });
    }
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 200);
      const missing = res.status === 404 ? ` (ollama pull ${model})` : '';
      throw new ServiceUnavailableException({ code: 'OCR_FAILED', message: `Ollama ${res.status}${missing}: ${body}` });
    }
    const data = (await res.json()) as { message?: { content?: string } };
    return { text: cleanOcr(data.message?.content ?? ''), model, ms: Date.now() - t0 };
  }

  /** source=mic 이면 마이크 스위치 확인 */
  async transcribe(audio: string, mime: string, language?: string, source: 'mic' | 'file' = 'file') {
    if (source === 'mic' && !this.settings.mic()) {
      throw new ForbiddenException({ code: 'MIC_OFF', message: '마이크 꺼짐 (설정 → 권한에서 켜기)' });
    }
    const api = this.settings.aiApi('stt');
    if (api) {
      if (!api.key) throw new BadRequestException({ code: 'NO_API_KEY', message: `${PROVIDER_LABEL[api.provider]} API 키 없음 (설정 → 모델)` });
      const buf = Buffer.from(stripDataUrl(audio), 'base64');
      if (buf.length < 100) throw new BadRequestException({ code: 'NO_AUDIO', message: '음성 없음' });
      const clean = mime.split(';')[0].trim().toLowerCase();
      const t0 = Date.now();
      try {
        const r = await apiTranscribe(api.provider, api.key, api.model, buf, clean, EXT[clean] ?? 'webm', language || undefined, { timeoutMs: STT_TIMEOUT_MS });
        return { text: r.text, language: r.language, duration: 0, model: `${api.provider}:${api.model}`, ms: Date.now() - t0 };
      } catch (e) {
        throw this.apiFail(e, 'STT_FAILED');
      }
    }
    const check = await this.checkStt();
    if (!check.ok) {
      throw new ServiceUnavailableException({
        code: 'STT_NOT_INSTALLED',
        message: `STT 미설치: ${check.detail}. 설치: python -m pip install -r pc-agent/requirements-stt.txt`,
      });
    }
    const buf = Buffer.from(stripDataUrl(audio), 'base64');
    if (buf.length < 100) throw new BadRequestException({ code: 'NO_AUDIO', message: '음성 없음' });
    const ext = EXT[mime.split(';')[0].trim().toLowerCase()] ?? 'bin';
    const path = join(tmpdir(), `aura-stt-${randomUUID()}.${ext}`);
    await writeFile(path, buf);
    // 한 번에 하나씩
    const job = this.queue.then(async () => {
      const t0 = Date.now();
      const agent = await this.agent();
      clearTimeout(this.idle);
      const model = this.settings.sttModel();
      try {
        const r = await agent.send('transcribe', { path, language: language || null, model }, STT_TIMEOUT_MS);
        return {
          text: String(r.text ?? ''),
          language: String(r.language ?? ''),
          duration: Number(r.duration ?? 0),
          model,
          ms: Date.now() - t0,
        };
      } finally {
        this.idle = setTimeout(() => this.stopStt(), STT_IDLE_MS);
        this.idle.unref();
      }
    });
    this.queue = job.catch(() => undefined);
    try {
      return await job;
    } catch (e) {
      throw new ServiceUnavailableException({ code: 'STT_FAILED', message: `STT 실패: ${(e as Error).message}` });
    } finally {
      unlink(path).catch(() => undefined);
    }
  }

  /** 사이드카는 첫 요청 때 켜고, 10분 놀면 끔(메모리 반환) */
  private agent(): Promise<PcAgentProcess> {
    if (this.stt) return Promise.resolve(this.stt);
    if (this.starting) return this.starting;
    const proc = new PcAgentProcess(this.python, this.script, () => undefined);
    this.starting = proc
      .start(30_000)
      .then(() => {
        this.stt = proc;
        this.log.log('STT 사이드카 시작');
        return proc;
      })
      .finally(() => (this.starting = null));
    return this.starting;
  }

  private stopStt(): void {
    clearTimeout(this.idle);
    this.stt?.stop();
    this.stt = null;
  }
}
