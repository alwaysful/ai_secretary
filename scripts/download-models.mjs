// 공부 집중 MediaPipe 모델 다운로드 → frontend/public/models/
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const B = 'https://storage.googleapis.com/mediapipe-models';
const FILES = {
  'pose_landmarker_lite.task': `${B}/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`,
  'face_landmarker.task': `${B}/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`,
  'efficientdet_lite0.tflite': `${B}/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite`,
};
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'models');
await mkdir(dir, { recursive: true });
for (const [name, url] of Object.entries(FILES)) {
  const out = join(dir, name);
  if ((await stat(out).catch(() => null))?.size) {
    console.log(`있음: ${name}`);
    continue;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log(`받음: ${name}`);
}
