const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g;

/** 외부 텍스트 정리: 제어문자·비가시 문자 제거, 개행 정규화. */
export function cleanText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 외부 데이터가 프롬프트의 구분 태그를 열고 닫지 못하게 꺾쇠를 전각으로 바꾼다. */
export function escapeTags(s: string): string {
  return s.replace(/</g, '＜').replace(/>/g, '＞');
}
