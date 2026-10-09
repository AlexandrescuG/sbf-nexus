#!/usr/bin/env python3
"""Пересчёт страниц реакции по расписанию.

Зачем отдельный файл. Сборщик статистики и сборщик страниц были написаны
30 сентября и до 9 октября не запускались ни разу: ни юнита, ни крона, ни
вызова откуда-либо. На страницах при этом стояло «страница обновляется» и
«Пересчитано 30 сентября» — сайт обещал то, чего не делал, а это ровно то
единственное, ради чего эти страницы и существуют.

За девять дней данные успели заметно уйти: у отчёта по занятости стало
10 публикаций вместо 9, у заявок на пособие 41 вместо 39, у инфляции
еврозоны 19 вместо 18, и медианы вслед за ними сдвинулись.

Класс ошибки знакомый: генератор написан и подключён к пустоте. Такой же
был, когда сервис попал в скрипт запуска, а его данные остались в кроне.

Почему без своего таймера. Сборщик архива брифов и так идёт каждые
пятнадцать минут вместе с лентой первого экрана. Новый юнит — это ещё
одна сущность, которую надо не забыть включить, не забыть вписать в
units.txt и которая тихо отвалится после перезагрузки, если забыть
enable. Дешевле и надёжнее повесить проверку на то, что уже работает.

Раз в неделю, а не ежедневно: недельные события (заявки на пособие,
запасы нефти) дают новое наблюдение раз в семь дней, месячные — реже.
Ежедневный пересчёт тратил бы время и писал бы в карту сайта одно и то
же. В самой карте у этих страниц стоит changefreq weekly — расписание и
обещание должны совпадать.
"""
import datetime
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
STATS = ROOT / 'reaction-stats.json'
MAX_AGE_DAYS = 7


def age_days():
    """Сколько дней назад собирали. None — файла нет или он нечитаем."""
    try:
        built = json.loads(STATS.read_text(encoding='utf-8'))['built_at']
        # Метка в файле — UTC с суффиксом Z, и сравнивать её надо с UTC.
        # utcnow() здесь не годится: он отдаёт наивное время и на Python
        # 3.14 уже помечен к удалению.
        d = datetime.datetime.strptime(built, '%Y-%m-%dT%H:%M:%SZ').replace(
            tzinfo=datetime.timezone.utc)
        return (datetime.datetime.now(datetime.timezone.utc) - d).days
    except Exception:
        return None


def maybe_refresh(max_age_days=MAX_AGE_DAYS, force=False, quiet=False):
    """Пересчитать, если пора. Ничего не поднимает наверх.

    Пересчёт страниц реакции не входит в выпуск брифа и не должен его
    ронять: если сборка упадёт, на сайте просто останутся прежние
    страницы — честные, но недельной давности. Это хуже свежих и намного
    лучше отсутствующих."""
    try:
        age = age_days()
        if age is None:
            if not quiet:
                print('  реакция: нет %s — собираем впервые' % STATS.name)
        elif age < max_age_days and not force:
            return False
        elif not quiet:
            print('  реакция: пересчёт, прошло дней — %d' % age)

        for script in ('build_reaction_stats.py', 'build_reaction_pages.py'):
            r = subprocess.run([sys.executable, str(HERE / script)],
                               capture_output=True, text=True, timeout=600)
            tail = (r.stdout or r.stderr or '').strip().splitlines()
            if not quiet:
                print('    %s: %s' % (script, tail[-1] if tail else
                                      'код %d' % r.returncode))
            if r.returncode != 0:
                if not quiet:
                    print('    дальше не идём, страницы остались прежними')
                return False
        return True
    except Exception as exc:
        if not quiet:
            print('  реакция: пересчёт не вышел (%s) — '
                  'прежние страницы на месте' % str(exc)[:60])
        return False


if __name__ == '__main__':
    force = '--force' in sys.argv
    a = age_days()
    print('последний пересчёт: %s' %
          ('никогда' if a is None else '%d дн. назад' % a))
    done = maybe_refresh(force=force)
    print('пересчитано' if done else 'пересчёт не потребовался')
