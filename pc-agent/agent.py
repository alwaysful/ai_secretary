"""AURA PC 조작 사이드카. 백엔드가 실행. stdin/stdout JSON 줄 통신.

취소: Esc / Ctrl+Alt+X (전역 핫키), 마우스를 화면 모서리로 (failsafe).
취소되면 이후 모든 동작 거부. reset 명령 전까지 유지.
"""
import base64
import io
import json
import sys
import threading
import time

if sys.platform == "win32":
    import ctypes

    try:  # 고DPI: 스크린샷 픽셀 = 마우스 좌표
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

import pyautogui
import pyperclip
from PIL import ImageDraw, ImageGrab
from pynput import keyboard

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05

MAX_W = 1280
GRID = 100
CORNER = 3

_out_lock = threading.Lock()
cancelled = threading.Event()
cancel_reason = ""
_self_key_until = 0.0  # 우리가 보낸 키 입력 무시 구간 (injected 미지원 대비)


def send(obj):
    with _out_lock:
        sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def cancel(reason):
    global cancel_reason
    if cancelled.is_set():
        return
    cancel_reason = reason
    cancelled.set()
    send({"event": "cancelled", "reason": reason})


# ---------- 전역 핫키 ----------
_mods = set()
CTRL = {keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r}
ALT = {keyboard.Key.alt, keyboard.Key.alt_l, keyboard.Key.alt_r, keyboard.Key.alt_gr}


def _on_press(key, injected=False):
    if injected or time.time() < _self_key_until:
        return
    if key in CTRL:
        _mods.add("ctrl")
    elif key in ALT:
        _mods.add("alt")
    elif key == keyboard.Key.esc:
        cancel("Esc")
    else:
        ch = getattr(key, "char", None)
        vk = getattr(key, "vk", None)
        if {"ctrl", "alt"} <= _mods and (ch in ("x", "X", "\x18") or vk == 0x58):
            cancel("Ctrl+Alt+X")


def _on_release(key, injected=False):
    if key in CTRL:
        _mods.discard("ctrl")
    elif key in ALT:
        _mods.discard("alt")


def start_hotkeys():
    listener = keyboard.Listener(on_press=_on_press, on_release=_on_release)
    listener.daemon = True
    listener.start()


# ---------- 모서리 감시 ----------
def corner_watch():
    while True:
        try:
            x, y = pyautogui.position()
            w, h = pyautogui.size()
            if (x <= CORNER or x >= w - 1 - CORNER) and (y <= CORNER or y >= h - 1 - CORNER):
                cancel("마우스 모서리")
        except Exception:
            pass
        time.sleep(0.1)


# ---------- 명령 ----------
def screenshot():
    img = ImageGrab.grab()
    w, h = img.size
    scale = min(1.0, MAX_W / w)
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)))
    sw, sh = img.size
    d = ImageDraw.Draw(img)
    for gx in range(GRID, sw, GRID):
        d.line([(gx, 0), (gx, sh)], fill=(255, 0, 255), width=1)
        d.text((gx + 2, 2), str(gx), fill=(255, 0, 255))
    for gy in range(GRID, sh, GRID):
        d.line([(0, gy), (sw, gy)], fill=(255, 0, 255), width=1)
        d.text((2, gy + 2), str(gy), fill=(255, 0, 255))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=70)
    return {
        "image": base64.b64encode(buf.getvalue()).decode(),
        "width": sw,
        "height": sh,
        "scale": scale,
    }


def _pt(a, scale):
    w, h = pyautogui.size()
    x = int(round(float(a["x"]) / scale))
    y = int(round(float(a["y"]) / scale))
    # 모서리 피함 (failsafe 오작동 방지)
    return min(max(x, CORNER + 2), w - CORNER - 3), min(max(y, CORNER + 2), h - CORNER - 3)


def _guard():
    if cancelled.is_set():
        raise RuntimeError(f"취소됨 ({cancel_reason})")


def _keys_mark(sec=0.5):
    global _self_key_until
    _self_key_until = time.time() + sec


def _type(text):
    old = None
    if not text.isascii():
        try:
            old = pyperclip.paste()
        except Exception:
            old = None
    try:
        _type_chunks(text)
    finally:
        if old is not None:
            time.sleep(0.1)
            pyperclip.copy(old)  # 사용자 클립보드 복원


def _type_chunks(text):
    for i in range(0, len(text), 20):
        _guard()
        chunk = text[i : i + 20]
        _keys_mark()
        if chunk.isascii():
            pyautogui.write(chunk, interval=0.02)
        else:  # 한글 등: 클립보드 붙여넣기
            pyperclip.copy(chunk)
            pyautogui.hotkey("ctrl", "v")
            time.sleep(0.05)


def act(a, scale):
    _guard()
    kind = a.get("action")
    if kind in ("click", "double_click", "right_click", "move"):
        x, y = _pt(a, scale)
        pyautogui.moveTo(x, y, duration=0.25)
        _guard()
        if kind == "click":
            pyautogui.click()
        elif kind == "double_click":
            pyautogui.doubleClick()
        elif kind == "right_click":
            pyautogui.rightClick()
    elif kind == "drag":
        x, y = _pt(a, scale)
        x2, y2 = _pt({"x": a["x2"], "y": a["y2"]}, scale)
        pyautogui.moveTo(x, y, duration=0.25)
        _guard()
        pyautogui.dragTo(x2, y2, duration=0.5, button="left")
    elif kind == "scroll":
        if "x" in a and "y" in a:
            pyautogui.moveTo(*_pt(a, scale), duration=0.2)
        _guard()
        pyautogui.scroll(int(a.get("amount", -5)) * 100)
    elif kind == "type":
        _type(str(a.get("text", "")))
    elif kind == "key":
        keys = [k.strip().lower() for k in str(a.get("keys", "")).split("+") if k.strip()]
        bad = [k for k in keys if k not in pyautogui.KEYBOARD_KEYS]
        if not keys or bad:
            raise ValueError(f"모르는 키: {bad or a.get('keys')}")
        _keys_mark()
        pyautogui.hotkey(*keys)
    elif kind == "wait":
        end = time.time() + min(float(a.get("seconds", 1)), 10)
        while time.time() < end:
            _guard()
            time.sleep(0.1)
    else:
        raise ValueError(f"모르는 동작: {kind}")
    _guard()


def main():
    if "--check" in sys.argv:
        w, h = pyautogui.size()
        print(json.dumps({"ok": True, "screen": [w, h], "python": sys.version.split()[0]}))
        return
    start_hotkeys()
    threading.Thread(target=corner_watch, daemon=True).start()
    scale = 1.0
    send({"event": "ready"})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        rid = msg.get("id")
        cmd = msg.get("cmd")
        try:
            if cmd == "screenshot":
                r = screenshot()
                scale = r["scale"]
                send({"id": rid, "ok": True, **r})
            elif cmd == "act":
                act(msg.get("action") or {}, scale)
                send({"id": rid, "ok": True})
            elif cmd == "cancel":
                cancel(msg.get("reason") or "앱에서 정지")
                send({"id": rid, "ok": True})
            elif cmd == "reset":
                cancelled.clear()
                send({"id": rid, "ok": True})
            elif cmd == "quit":
                send({"id": rid, "ok": True})
                break
            else:
                send({"id": rid, "ok": False, "error": f"unknown cmd {cmd}"})
        except pyautogui.FailSafeException:
            cancel("마우스 모서리")
            send({"id": rid, "ok": False, "error": "취소됨 (마우스 모서리)"})
        except Exception as e:  # noqa: BLE001
            send({"id": rid, "ok": False, "error": str(e)})


if __name__ == "__main__":
    main()
