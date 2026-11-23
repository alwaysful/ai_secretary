import { gistAcademic } from './gist-academic';
import { linkareer } from './linkareer';
import { ScrapeSource } from './source';
import { wevity } from './wevity';

/** 등록된 소스. 새 사이트는 여기에 추가. */
export const SOURCES: readonly ScrapeSource[] = [gistAcademic, wevity, linkareer];

export * from './source';
