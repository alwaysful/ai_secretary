/** 멘트 말투. devil: 기존 비꼬는 멘트, robot: 딱딱한 안내 멘트 */
export type Tone = 'devil' | 'robot';

const KEY = 'aura.study.tone';

function load(): Tone {
  try {
    return localStorage.getItem(KEY) === 'robot' ? 'robot' : 'devil';
  } catch {
    return 'devil';
  }
}

let tone: Tone = load();

export const getTone = (): Tone => tone;
export const isRobot = (): boolean => tone === 'robot';

export function setTone(t: Tone): void {
  tone = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* 저장 실패 무시 */
  }
}

export const pick = (list: string[]): string =>
  list[Math.floor(Math.random() * list.length)];

export const ROBOT = {
  turtle: ['자세를 똑바로 해주세요.', '허리를 펴 주세요.', '고개를 들어 주세요.'],
  phone: ['휴대폰을 사용하지 말아주세요.', '휴대폰을 내려놓아 주세요.'],
  slack: ['공부와 관련 없는 화면입니다. 공부 화면으로 돌아가 주세요.', '딴짓을 멈춰 주세요.'],
  sleep: ['수면이 감지되었습니다. 일어나 주세요.', '졸음이 감지되었습니다. 자세를 바로 해 주세요.'],
  quit: ['공부 시간이 끝나지 않았습니다.', '종료하려면 타이머가 끝날 때까지 기다려 주세요.'],
  quitPrompt: '5분 후에 종료할 수 있습니다.',
  quitDone: '종료할 수 있습니다.',
};
