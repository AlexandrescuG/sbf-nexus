#!/usr/bin/env python3
"""
Убирает из css/styles.css правила для элементов, которых больше нет в
разметке: общий fixed-логотип #sbf-logo и всё, что на нём висело.

Однократный инструмент к коммиту «снят общий логотип». Оставлен в репо,
чтобы было видно, чем именно чистили: правил было ~25, разбросанных по
файлу в 3400 строк, руками их вычищать — верный способ снести соседнее.

Разбор простой: идём по файлу, на каждом правиле (селектор + блок в
скобках) проверяем селектор по списку; @media обходим рекурсивно, а
опустевший @media убираем целиком.
"""
import re, sys
from pathlib import Path

DEAD = re.compile(r'#sbf-logo|#logo-stream|#chart-stream|#chart-logo-canvas|#logo-ring|'
                  r'\.logo-hint|#core-canvas|\.ring-track|\.ring-fill|sbf-heartbeat')

def strip(css):
    out, i, n, removed = [], 0, len(css), 0
    while i < n:
        j = css.find('{', i)
        if j < 0:
            out.append(css[i:]); break
        head = css[i:j]
        # глубина скобок → конец блока
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        # комментарии перед селектором оставляем в head, селектор — последняя часть
        m = re.search(r'(/\*.*?\*/\s*)*$', head, re.S)
        selector = head[:m.start()] if m else head
        selector = re.sub(r'/\*.*?\*/', '', selector, flags=re.S)
        sel_only = selector.split('}')[-1]
        if sel_only.lstrip().startswith('@media') or sel_only.lstrip().startswith('@supports'):
            inner, r = strip(body)
            removed += r
            if inner.strip():
                out.append(head + '{' + inner + '}')
            else:
                out.append(re.sub(r'[^\n]*$', '', head))  # пустой @media — снимаем
                removed += 1
        elif DEAD.search(sel_only) or (sel_only.lstrip().startswith('@keyframes') and DEAD.search(sel_only)):
            # снимаем правило вместе с прилипшим к нему комментарием
            out.append(re.sub(r'(/\*[^*]*\*/\s*)*[^\n{]*$', '', head))
            removed += 1
        else:
            out.append(head + '{' + body + '}')
        i = k
    return ''.join(out), removed


if __name__ == '__main__':
    p = Path(sys.argv[1] if len(sys.argv) > 1 else 'css/styles.css')
    src = p.read_text(encoding='utf-8')
    res, removed = strip(src)
    res = re.sub(r'\n{4,}', '\n\n\n', res)
    p.write_text(res, encoding='utf-8')
    print(f'{p}: снято правил {removed}, строк {len(src.splitlines())} → {len(res.splitlines())}')
