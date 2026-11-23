"""AURA STT 사이드카. faster-whisper(로컬). stdin/stdout JSON 줄 통신.

요청: {"id":1,"cmd":"transcribe","path":"...","language":"ko"}
응답: {"id":1,"ok":true,"text":"...","language":"ko","duration":3.2}
--check: 설치 확인만.
"""
import json
import os
import sys

MODEL = os.environ.get("STT_MODEL", "small")
DEVICE = os.environ.get("STT_DEVICE", "auto")


def out(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def check():
    try:
        import faster_whisper  # noqa: F401
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"faster-whisper 없음: {e}"}))
        return 1
    print(json.dumps({"ok": True}))
    return 0


def _patch_av():
    """PyAV 15+ 는 av.open(metadata_errors=) 제거. faster-whisper 호환용."""
    import av

    orig = av.open
    if getattr(orig, "_aura", False):
        return

    def _open(*a, **kw):
        try:
            return orig(*a, **kw)
        except TypeError as e:
            if "metadata_errors" not in str(e):
                raise
            kw.pop("metadata_errors", None)
            return orig(*a, **kw)

    _open._aura = True
    av.open = _open


_model = None


def model():
    global _model
    if _model is None:
        _patch_av()
        from faster_whisper import WhisperModel

        try:
            _model = WhisperModel(MODEL, device=DEVICE, compute_type="default")
        except Exception:  # GPU 실패 → CPU int8
            _model = WhisperModel(MODEL, device="cpu", compute_type="int8")
    return _model


def transcribe(req):
    lang = req.get("language") or None
    segs, info = model().transcribe(req["path"], language=lang, vad_filter=True, beam_size=5)
    text = "\n".join(s.text.strip() for s in segs if s.text.strip())
    return {"text": text, "language": info.language, "duration": round(info.duration, 1)}


def main():
    if "--check" in sys.argv:
        sys.exit(check())
    out({"event": "ready"})
    for line in sys.stdin:
        try:
            req = json.loads(line)
        except ValueError:
            continue
        rid = req.get("id")
        cmd = req.get("cmd")
        try:
            if cmd == "quit":
                out({"id": rid, "ok": True})
                return
            if cmd == "transcribe":
                out({"id": rid, "ok": True, **transcribe(req)})
            else:
                out({"id": rid, "ok": False, "error": f"unknown cmd {cmd}"})
        except Exception as e:  # noqa: BLE001
            out({"id": rid, "ok": False, "error": str(e)[:500]})


if __name__ == "__main__":
    main()
