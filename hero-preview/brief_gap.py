#!/usr/bin/env python3
"""Долгая тишина в архиве брифов должна быть слышна.

Зачем. С 17 по 29 сентября в архиве не появилось ни одного выпуска, и об
этом никто не узнал. Сборщик печатал строку в /tmp/hero-feed.log, а /tmp
чистится при перезагрузке — она и уехала. Юнит при этом числился
успешным: писать было нечего, и он честно ничего не писал.

Отсюда правило: у того, что обязано выходить каждый день, отсутствие —
это событие, а не просто отсутствие записи.

Как устроено. Отдельного таймера не заводим: сборщик архива и так
запускается каждые пятнадцать минут вместе с лентой первого экрана.
Он же и проверяет — после 07:00 по Кишинёву, потому что бриф выходит до
открытия европейской сессии, и до этого часа пустота нормальна.

Сообщение отправляется не чаще раза в сутки. Алерт, приходящий каждые
пятнадцать минут, за день перестают читать — и тогда он хуже, чем его
отсутствие: создаёт ощущение, что за системой следят.

Канал уведомлений живёт в market_intel (зелёная зона) вместе с токеном
бота; здесь он только вызывается. Своей копии токена тут быть не должно.
"""
import datetime
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / 'brief'
STATE = ROOT / 'hero-preview' / '.brief-gap-state.json'
NOTIFY = pathlib.Path('/mnt/sbfdata/sbf-platform/market_intel'
                      '/analyze/notify_degraded.py')

# Бриф выходит до открытия европейской сессии. Раньше этого часа выпуска
# нет по расписанию, а не по поломке.
DEADLINE_HOUR = 7


def _today():
    """Сегодня по Кишинёву — по нему живёт выпуск, а не по UTC."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo('Europe/Chisinau'))
    except Exception:
        # Без базы часовых поясов лучше локальное время, чем отказ:
        # проверка про «вышел ли сегодня выпуск» не стоит падения сборки.
        return datetime.datetime.now()


def missing_days(today):
    """Сколько дней подряд нет выпуска, считая сегодняшний."""
    have = {p.stem for p in ARCHIVE.glob('*.html') if p.stem != 'index'}
    n = 0
    d = today.date()
    while d.isoformat() not in have:
        n += 1
        d -= datetime.timedelta(days=1)
        if n > 60:
            break
    return n


def _state():
    try:
        return json.loads(STATE.read_text(encoding='utf-8'))
    except Exception:
        return {}


def check(quiet=False):
    """Вернуть число пропущенных дней и, если надо, дать знать.

    Ничего не поднимает наверх: это наблюдатель, а не часть выпуска.
    Сломанный наблюдатель не должен мешать публикации."""
    try:
        now = _today()
        if not ARCHIVE.is_dir():
            return 0
        gap = missing_days(now)
        if gap == 0:
            # Выпуск за сегодня есть — забываем, что жаловались.
            if _state():
                STATE.write_text('{}', encoding='utf-8')
            return 0
        if gap == 1 and now.hour < DEADLINE_HOUR:
            return 0          # ещё рано, это не пропуск

        word = 'день' if gap == 1 else ('дня' if 2 <= gap <= 4 else 'дней')
        msg = ('выпуска брифа нет %d %s подряд (последний в архиве — %s)'
               % (gap, word,
                  max((p.stem for p in ARCHIVE.glob('*.html')
                       if p.stem != 'index'), default='ни одного')))
        if not quiet:
            print('  ВНИМАНИЕ: %s' % msg)

        # Не чаще раза в сутки.
        st = _state()
        if st.get('last') == now.date().isoformat():
            return gap
        STATE.write_text(json.dumps({'last': now.date().isoformat(),
                                     'gap': gap}, ensure_ascii=False),
                         encoding='utf-8')
        if NOTIFY.exists():
            try:
                subprocess.run([sys.executable, str(NOTIFY),
                                '--reason', 'Архив брифов: ' + msg],
                               capture_output=True, timeout=30)
                if not quiet:
                    print('  сообщение отправлено')
            except Exception as exc:
                if not quiet:
                    print('  сообщить не удалось (%s)' % str(exc)[:50])
        elif not quiet:
            print('  канал уведомлений не найден (%s)' % NOTIFY)
        return gap
    except Exception as exc:
        if not quiet:
            print('  проверка пропусков не сработала (%s)' % str(exc)[:60])
        return 0


if __name__ == '__main__':
    g = check()
    print('пропущено дней подряд: %d' % g)
    sys.exit(1 if g else 0)
