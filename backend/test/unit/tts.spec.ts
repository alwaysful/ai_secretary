import { pcmToWav } from '../../src/ai/providers/tts';

describe('pcmToWav', () => {
  it('writes 44-byte RIFF header', () => {
    const wav = pcmToWav(Buffer.alloc(100), 24000);
    expect(wav.length).toBe(144);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(40)).toBe(100);
  });
});
