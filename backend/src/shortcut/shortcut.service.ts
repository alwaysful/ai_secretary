import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_SHORTCUTS = 30;
export const SECTIONS = ['lobby', 'tools'] as const;
export type Section = (typeof SECTIONS)[number];

/** "naver.com" → "https://naver.com". http(s)만 허용 */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new BadRequestException({ code: 'BAD_URL', message: `잘못된 URL: ${raw}` });
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BadRequestException({ code: 'BAD_URL', message: 'http/https 주소만 가능' });
  }
  return u.toString();
}

/** 제목 비면 도메인 (www. 제거) */
function titleOf(title: string | undefined, url: string): string {
  const t = title?.trim();
  return t || new URL(url).hostname.replace(/^www\./, '');
}

@Injectable()
export class ShortcutService {
  constructor(private readonly prisma: PrismaService) {}

  list(section: Section = 'lobby') {
    return this.prisma.webShortcut.findMany({ where: { section }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  }

  async create(input: { title?: string; url: string; section?: Section }) {
    const section = input.section ?? 'lobby';
    const count = await this.prisma.webShortcut.count({ where: { section } });
    if (count >= MAX_SHORTCUTS) {
      throw new BadRequestException({ code: 'TOO_MANY', message: `바로가기는 최대 ${MAX_SHORTCUTS}개` });
    }
    const url = normalizeUrl(input.url);
    const last = await this.prisma.webShortcut.aggregate({ where: { section }, _max: { position: true } });
    return this.prisma.webShortcut.create({
      data: { url, section, title: titleOf(input.title, url), position: (last._max.position ?? -1) + 1 },
    });
  }

  async update(id: string, input: { title?: string; url?: string }) {
    const cur = await this.prisma.webShortcut.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('shortcut not found');
    const url = input.url !== undefined ? normalizeUrl(input.url) : cur.url;
    const title = input.title !== undefined ? titleOf(input.title, url) : cur.title;
    return this.prisma.webShortcut.update({ where: { id }, data: { url, title } });
  }

  /** ids 순서대로 position 재배치 */
  async reorder(ids: string[], section: Section = 'lobby') {
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.webShortcut.updateMany({ where: { id, section }, data: { position: i } })),
    );
    return this.list(section);
  }

  async remove(id: string): Promise<void> {
    const r = await this.prisma.webShortcut.deleteMany({ where: { id } });
    if (r.count === 0) throw new NotFoundException('shortcut not found');
  }
}
