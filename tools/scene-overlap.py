#!/usr/bin/env python3
"""Рисует ли сцена поверх текста — по каждому акту, на узком экране.

Жалоба повторялась дважды: сначала логотип ложился на текст, потом кольцо
с подписями «МЫ / ВЫ» — на дисклеймер, кнопку и заголовки. Оба раза это
находили глазами по видеозаписи, и оба раза правку проверяли снимками —
то есть выборочно.

Здесь проверка сплошная. Первая версия смотрела на альфу — мол, где не
рисовали, там прозрачно; вышло 100% «нарисовано» на всех двенадцати
актах. Сцена заливает тон по всему холсту, и прозрачных мест у неё нет
вовсе. Поэтому считаем иначе: берём самый частый цвет холста за фон и
меряем долю пикселей внутри колонки, которые от него заметно отличаются.

Обязательный контроль — та же доля в рамке САМОГО ЗНАКА. Там сцена
рисует наверняка, и если щуп не видит рисунка и там, значит он слеп, а
не колонка чиста.

    python3 tools/scene-overlap.py            # 390x844
    python3 tools/scene-overlap.py 360 780
"""
import sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
# Насколько пиксель должен отличаться от фона, чтобы считаться рисунком
# (квадрат расстояния в RGB). 2500 — это 50 ступеней, то есть примерно
# четверть непрозрачности: фактура под текстом столько не даёт, линия и
# свеча в полную силу дают.
#
# Порог поднят с 900 осознанно и проверен обратным ходом: со старым
# значением прозрачности ленты (0.34) щуп по-прежнему объявляет «линзу»
# дефектом, с новым (0.13) — нет. Порог, подобранный до молчания,
# перестал бы ловить и настоящие случаи, поэтому такую проверку надо
# делать каждый раз, когда его трогают.
TOL = 2500
SHARE = 0.02      # доля таких пикселей в рамке колонки
# Контроль: столько рисунка должно найтись в рамке знака, иначе щуп слеп.
# 5% стояло впритык к разбросу между прогонами — у «линзы» выходило то
# 4.95, то 5.03, и один и тот же акт объявлялся то проверенным, то нет.
# Контроль отвечает на грубый вопрос «видно ли хоть что-то», и 1.5% на
# него отвечают: при настоящей слепоте там нули.
MARK_MIN = 0.015

# Два акта, у которых рисунок и ЕСТЬ фон во весь кадр: карта мира на
# первом экране и шар в финале. Текст там лежит на них по замыслу, и
# плотность в рамке колонки у них высокая всегда — этот щуп на такое не
# отвечает, он меряет «сколько нарисовано», а не «читается ли буква».
# Читаемость этих двух проверяет tools/contrast-check.py, по настоящим
# пикселям текста и его фона; на 16.09 оба прошли.
#
# Список именной и с причиной, а не порог побольше: порог, поднятый до
# молчания, перестал бы ловить и настоящие случаи — ровно тот, что был
# найден в «линзе».
BACKDROP = {'act-map': 'карта мира — фон первого экрана',
            'act-contact': 'шар — фон финала'}

SCAN = """(tol) => {
  const cv = document.querySelector('.scene-layer canvas');
  if (!cv) return null;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const k = cv.width / innerWidth;

  /* Фон кадра — самый частый цвет холста. Огрубляем до шестнадцати
     ступеней на канал: градиент неба даёт тысячи близких оттенков, и
     без огрубления «самым частым» оказался бы случайный из них. */
  const all = g.getImageData(0, 0, cv.width, cv.height).data;
  const hist = new Map();
  for (let i = 0; i < all.length; i += 16) {
    const key = ((all[i] >> 4) << 8) | ((all[i+1] >> 4) << 4) | (all[i+2] >> 4);
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  let best = 0, bestN = -1;
  for (const [key, n] of hist) if (n > bestN) { bestN = n; best = key; }
  const bg = [((best >> 8) & 15) * 17, ((best >> 4) & 15) * 17, (best & 15) * 17];

  /* skip — круг знака в координатах окна. Его исключаем из подсчёта.
     Знак по замыслу лежит подложкой под текстом во ВСЕХ актах, это
     грамматика сцены, а не дефект; оставив его в счёте, мы мерили бы
     одно и то же во всех двенадцати и не увидели бы того, что рисует
     сам акт. Именно из-за этого «линза» оставалась выше порога уже
     после того, как ленту приглушили и она стала фактурой. */
  function share(box, skip, myTol) {
    const lim = myTol == null ? tol : myTol;
    const x = Math.max(0, Math.round(box[0] * k));
    const y = Math.max(0, Math.round(box[1] * k));
    const w = Math.min(cv.width - x, Math.round((box[2] - box[0]) * k));
    const h = Math.min(cv.height - y, Math.round((box[3] - box[1]) * k));
    if (w < 4 || h < 4) return null;
    const d = g.getImageData(x, y, w, h).data;
    let ink = 0, seen = 0;
    const sx = skip ? skip[0] * k : 0, sy = skip ? skip[1] * k : 0;
    const sr = skip ? (skip[2] * k) * (skip[2] * k) : -1;
    for (let i = 0; i < d.length; i += 4) {
      const px = i / 4;
      if (skip) {
        const ax = x + (px % w) - sx, ay = y + Math.floor(px / w) - sy;
        if (ax * ax + ay * ay < sr) continue;
      }
      seen++;
      const dr = d[i] - bg[0], dg2 = d[i+1] - bg[1], db = d[i+2] - bg[2];
      if (dr*dr + dg2*dg2 + db*db > lim) ink++;
    }
    return seen ? ink / seen : null;
  }

  const out = [];
  for (const el of document.querySelectorAll('.act')) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const c = el.querySelector('.act-col');
    if (!c) continue;
    const b = c.getBoundingClientRect();
    /* Контроль: рамка знака. Сцена там рисует всегда. */
    const S = window.SBF_SCENE;
    let mark = null, skip = null;
    if (S && S.view && S.mark) {
      const m = S.mark.geometry(S.view);
      /* Контроль меряем мягким порогом, а не рабочим: он отвечает на
         вопрос «щуп вообще что-нибудь видит», и глиф знака нарисован
         вполсилы — при рабочем пороге контроль молчал в пяти актах из
         двенадцати и объявлял непроверенным ровно то, что проверялось. */
      mark = share([m.cx - m.r, m.cy - m.r, m.cx + m.r, m.cy + m.r], null, 400);
      /* Круг знака с запасом: кольцо линзы и её подложка чуть шире
         самого знака. */
      skip = [m.cx, m.cy, m.r * 1.25];
    }
    const col = share([b.left, Math.max(0, b.top), b.right,
                       Math.min(innerHeight, b.bottom)], skip);
    out.push({ act: el.dataset.act, id: el.id, col: col, mark: mark,
               bg: bg });
  }
  return out;
}"""

GO = """(id) => {
  const el = document.getElementById(id);
  const r = el.getBoundingClientRect();
  scrollTo({ top: r.top + scrollY + r.height * 0.35 - innerHeight * 0.35,
             behavior: 'instant' });
}"""


def main():
    args = [a for a in sys.argv[1:] if a.isdigit()]
    w, h = (int(args[0]), int(args[1])) if len(args) >= 2 else (390, 844)
    bad = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=True,
                            has_touch=True, device_scale_factor=2)
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(1500)
        ids = p.eval_on_selector_all(
            '.act', '(els) => els.map(e => e.id)')
        print('%dx%d  порог по колонке %.1f%%, контроль по знаку %.1f%%'
              % (w, h, SHARE * 100, MARK_MIN * 100))
        blind = []
        for i in ids:
            p.evaluate(GO, i)
            p.wait_for_timeout(700)
            rows = p.evaluate(SCAN, TOL) or []
            row = next((r for r in rows if r['id'] == i), None)
            if not row or row['col'] is None:
                continue
            note = ''
            if i in BACKDROP:
                note = '   (фон во весь кадр: %s)' % BACKDROP[i]
            elif row['col'] > SHARE:
                note = '   ← РИСУЕТ ПО ТЕКСТУ'
                bad.append(i)
            mk = row['mark']
            if mk is not None and mk < MARK_MIN:
                # Не приговор щупу: часть актов у знака действительно
                # ничего не рисует — на телефоне «память» отдаёт графики
                # карточкам и сама выходит из кадра сразу. Но и вывод по
                # такому акту делать нельзя: пусто в колонке и слепой щуп
                # выглядят одинаково. Говорим об этом вслух.
                note += '   (нечем свериться: у знака тоже пусто)'
                blind.append(i)
            print('  %-16s %-9s колонка %5.2f%%   знак %5.2f%%%s'
                  % (i, row['act'], row['col'] * 100,
                     -1 if mk is None else mk * 100, note))
        b.close()
    print()
    if blind:
        print('не проверено (сцена у знака не рисует, сверить не с чем): '
              + ', '.join(blind))
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        sys.exit(1)
    print('хорошо: в проверенных актах сцена на колонку не ложится')


if __name__ == '__main__':
    main()
