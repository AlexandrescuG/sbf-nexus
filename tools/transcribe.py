#!/usr/bin/env python3
"""Расшифровка голосового сообщения — локально, без отправки наружу.

Голос руководителя и владельца — не тот материал, который стоит гонять
через сторонний сервис ради удобства. faster-whisper уже стоит в системе.

    python3 tools/transcribe.py путь/к/файлу.ogg [ru]
"""
import sys
from faster_whisper import WhisperModel

path = sys.argv[1]
lang = sys.argv[2] if len(sys.argv) > 2 else 'ru'
model = WhisperModel('small', device='cpu', compute_type='int8')
segments, info = model.transcribe(path, language=lang, vad_filter=True)
print('длительность %.0f с, язык %s' % (info.duration, info.language))
for s in segments:
    print('[%5.1f] %s' % (s.start, s.text.strip()))
