#!/usr/bin/env python3
"""
Снимает sbfconsult.com на реальных устройствах и проверяет вёрстку.

Зачем отдельный инструмент. Окно управляемого браузера не уменьшается ниже
~1360px, а вкладка в нём почти всегда фоновая — там не идут requestAnimationFrame,
твины GSAP и CSS-переходы. Из-за этого мобильные экраны выходили пустыми, и
проверить их было нечем: приходилось мерить значения вместо того, чтобы смотреть.
Playwright запускает настоящий браузер в переднем плане с честным вьюпортом,
эмуляцией касаний и devicePixelRatio — анимации отрабатывают, скриншот живой.

Playwright уже стоит на диске (1.59, chromium + firefox + webkit).
Если модуля нет:  pip install playwright --break-system-packages && playwright install

Запуск:
    python3 tools/shots.py                  все устройства, все секции
    python3 tools/shots.py --device iphone  одно устройство
    python3 tools/shots.py --section act-grow
    python3 tools/shots.py --engine webkit  движок Safari (то, что реально на iPhone)
    python3 tools/shots.py --url https://sbfconsult.com/

Кладёт PNG в tools/shots/<устройство>/ и печатает отчёт: горизонтальный вылет,
обрезка низом секции, заголовки под шапкой, опорные точки не на месте,
ошибки консоли.
"""

import argparse, sys, json
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit('Playwright не найден: pip install playwright --break-system-packages')

OUT = Path(__file__).parent / 'shots'
DEFAULT_URL = 'http://127.0.0.1:5001/'

# Реальные устройства, а не круглые числа: 390 — iPhone 14/15,
# 375 — SE и всё, что осталось от старого парка, 768 — iPad портрет.
DEVICES = {
    'iphone':    dict(width=390,  height=844,  dsf=3, mobile=True),
    'iphone-se': dict(width=375,  height=667,  dsf=2, mobile=True),
    'ipad':      dict(width=768,  height=1024, dsf=2, mobile=True),
    'laptop':    dict(width=1280, height=800,  dsf=1, mobile=False),
    # Ноутбук с невысоким экраном + панель закладок: типичный случай, когда
    # секция в 100vh с overflow:hidden режет содержимое по нижнему краю.
    'laptop-low': dict(width=1440, height=680, dsf=1, mobile=False),
    'desktop':   dict(width=1600, height=900,  dsf=1, mobile=False),
}

# Проверки выполняются в странице: горизонтальный вылет и заголовки,
# уехавшие под фиксированную шапку.
AUDIT_JS = """
() => {
  const VW = window.innerWidth;
  const nav = document.querySelector('.site-nav');
  const navH = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
  const overflow = [], underNav = [];
  document.querySelectorAll('.snap-stop').forEach(sec => {
    sec.querySelectorAll('*').forEach(e => {
      const r = e.getBoundingClientRect();
      if (!r.width || getComputedStyle(e).position === 'fixed') return;
      // Внутри предка с overflow:hidden вылет не доходит до страницы,
      // а бегущая строка шире экрана по замыслу.
      let p = e.parentElement, clippedByAncestor = false;
      while (p && p !== document.body) {
        const o = getComputedStyle(p).overflow;
        if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') { clippedByAncestor = true; break; }
        p = p.parentElement;
      }
      if (clippedByAncestor || e.closest('.ticker-bar')) return;
      if (r.left < -1 || r.right > VW + 1) {
        const s = sec.id + ' ' + e.tagName.toLowerCase() +
          (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/)[0] : '');
        if (!overflow.includes(s)) overflow.push(s);
      }
    });
  });
  const clipped = [];
  document.querySelectorAll('.snap-stop').forEach(sec => {
    if (getComputedStyle(sec).overflow !== 'hidden') return;
    const h = sec.clientHeight;
    let maxBottom = 0;
    sec.querySelectorAll('*').forEach(e => {
      const cs = getComputedStyle(e);
      if (cs.position === 'fixed' || cs.display === 'none' || cs.opacity === '0') return;
      const b = e.getBoundingClientRect().bottom - sec.getBoundingClientRect().top;
      if (b > maxBottom) maxBottom = b;
    });
    if (maxBottom > h + 2) clipped.push(sec.id + ' (+' + Math.round(maxBottom - h) + 'px)');
  });
  return { VW, navH, overflow, underNav, clipped,
           docW: document.documentElement.scrollWidth,
           hidden: document.hidden };
}
"""

# Опорные точки: элемент не «сломан» по измеримым признакам, но стоит не там.
# Добавлено после того, как правка разметки вложила блок точек навигации
# внутрь <nav class="site-nav">, точки уехали в правый верхний угол, а все
# три прежние проверки остались зелёными — поймал человек глазами.
ANCHORS_JS = """
() => {
  const VW = window.innerWidth, VH = window.innerHeight;
  const out = [];
  const rect = s => { const e = document.querySelector(s); if (!e) return null;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    const r = e.getBoundingClientRect();
    return r.width ? r : null; };

  const nav = rect('.site-nav');
  if (!nav) out.push('шапка не найдена или скрыта');
  else if (nav.top > 2) out.push('шапка не прижата к верху (top=' + Math.round(nav.top) + ')');

  // Точки навигации — вертикальный столбик у правого края, а не в углу
  const dots = rect('#snap-progress');
  if (dots) {
    if (dots.right < VW * 0.8) out.push('точки навигации не у правого края');
    const mid = dots.top + dots.height / 2;
    if (mid < VH * 0.25 || mid > VH * 0.75)
      out.push('точки навигации не по центру по вертикали (центр=' + Math.round(mid) + ' из ' + VH + ')');
  }

  // Знак секции не должен налезать на текст своей секции. Проверяем не
  // только коробку знака, но и его подпись и кольцо: подпись стоит
  // абсолютом ниже коробки и ложилась на абзац, пока коробка была чиста.
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
                         Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  document.querySelectorAll('.sect-mark').forEach(m => {
    const mr = m.getBoundingClientRect();
    if (!mr.width || m.closest('.site-nav')) return;
    const sec = m.closest('.snap-stop');
    if (!sec) return;
    const parts = [{ name: 'знак', r: mr }];
    const ring = mr.width * 0.34;
    parts.push({ name: 'кольцо', r: { left: mr.left - ring, right: mr.right + ring,
                                     top: mr.top - ring, bottom: mr.bottom + ring } });
    m.querySelectorAll('.mark-cap, .mark-lbl').forEach(c => {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.opacity === '0' || !c.textContent.trim()) return;
      const r = c.getBoundingClientRect();
      if (r.width) parts.push({ name: 'подпись знака', r });
    });
    sec.querySelectorAll('h1, h2, h3, h4, p, a, li, .hub-card, .p2-card').forEach(e => {
      if (m.contains(e) || e.contains(m)) return;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.opacity === '0' || !e.textContent.trim()) return;
      const r = e.getBoundingClientRect();
      if (!r.width) return;
      parts.forEach(p => {
        // Кольцо тонкое — считаем только заметное вторжение
        if (area(p.r, r) > (p.name === 'кольцо' ? 1200 : 400)) {
          const what = p.name + ' перекрывает ' + sec.id + ' ' + e.tagName.toLowerCase();
          if (!out.includes(what)) out.push(what);
        }
      });
    });
  });
  return out;
}
"""

HEAD_JS = """
(id) => {
  const sec = document.getElementById(id);
  if (!sec) return null;
  const nav = document.querySelector('.site-nav');
  const navH = nav ? nav.getBoundingClientRect().height : 0;
  const head = sec.querySelector('h1, h2, h3, .eyebrow, .service-num-top, .service-num');
  if (!head) return null;
  const r = head.getBoundingClientRect();
  if (!r.height) return null;
  return { text: head.textContent.trim().slice(0, 40),
           top: Math.round(r.top), navH: Math.round(navH),
           underNav: r.top < navH - 1 };
}
"""


def run(url, engine, devices, only_section):
    OUT.mkdir(parents=True, exist_ok=True)
    problems = []

    with sync_playwright() as pw:
        browser = getattr(pw, engine).launch()
        for name in devices:
            d = DEVICES[name]
            ctx = browser.new_context(
                viewport={'width': d['width'], 'height': d['height']},
                device_scale_factor=d['dsf'],
                is_mobile=d['mobile'],
                has_touch=d['mobile'],
                locale='ru-RU',
            )
            page = ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

            page.goto(url, wait_until='networkidle')
            page.wait_for_timeout(2500)     # карта, шрифты, первая анимация

            audit = page.evaluate(AUDIT_JS)
            for a in page.evaluate(ANCHORS_JS):
                problems.append(f'{name}: {a}')
            if audit['overflow']:
                problems.append(f'{name}: горизонтальный вылет — ' + ', '.join(audit['overflow']))
            if audit.get('clipped'):
                problems.append(f'{name}: содержимое обрезано низом секции — '
                                + ', '.join(audit['clipped']))

            folder = OUT / name
            folder.mkdir(exist_ok=True)

            sections = page.eval_on_selector_all('.snap-stop', 'els => els.map(e => e.id)')
            if only_section:
                sections = [s for s in sections if s == only_section]

            for i, sid in enumerate(sections):
                page.evaluate('id => window.scrollTo(0, document.getElementById(id).offsetTop)', sid)
                page.wait_for_timeout(1600)   # фейды и кольцо успевают доиграть
                page.screenshot(path=str(folder / f'{i:02d}-{sid}.png'))
                h = page.evaluate(HEAD_JS, sid)
                if h and h['underNav']:
                    problems.append(f"{name}/{sid}: заголовок «{h['text']}» под шапкой "
                                    f"({h['top']} < {h['navH']})")

            for e in dict.fromkeys(errors):
                problems.append(f'{name}: ошибка в консоли — {e[:120]}')

            print(f'  {name:10} {d["width"]}×{d["height"]}  секций: {len(sections)}  '
                  f'вылет: {len(audit["overflow"])}  обрезано: {len(audit.get("clipped", []))}  '
                  f'шапка: {audit["navH"]}px')
            ctx.close()
        browser.close()

    print()
    if problems:
        print('НАЙДЕНО:')
        for p in problems:
            print('  ·', p)
    else:
        print('Проблем не найдено.')
    print(f'\nСнимки: {OUT}')
    return 1 if problems else 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=DEFAULT_URL)
    ap.add_argument('--engine', default='chromium', choices=['chromium', 'webkit', 'firefox'])
    ap.add_argument('--device', action='append', choices=list(DEVICES))
    ap.add_argument('--section')
    a = ap.parse_args()
    print(f'{a.url}  движок: {a.engine}\n')
    sys.exit(run(a.url, a.engine, a.device or list(DEVICES), a.section))
