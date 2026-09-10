/* registry.js — какие акты есть в сцене и в каком порядке.

   Порядок берётся из разметки (секции `.act` идут сверху вниз), здесь —
   только соответствие id → модуль и роль знака в этом акте.

   Роли: принимает (intake) → обрабатывает (process) → выдаёт (output).
   Это та же грамматика знака, что была разложена по секциям 07.09, только
   теперь она непрерывна. */

import { world }    from './world.js';
import { stream }   from './stream.js';
import { lens }     from './lens.js';
import { terminal } from './terminal.js';
import { memory }   from './memory.js';
import { ladder }   from './ladder.js';
import { globe }    from './globe.js';

export const ACTS = {
  world:    world,      /* мир шумит — знак принимает */
  stream:   stream,     /* из шума выходит продукт — выдаёт */
  lens:     lens,       /* лента сквозь знак — обрабатывает */
  terminal: terminal,   /* платформа и PRO — выдаёт */
  memory:   memory,     /* память рынков — обрабатывает */
  ladder:   ladder,     /* услуги, кольцо «вы / мы» — обрабатывает */
  globe:    globe,      /* финал: где мы есть — выдаёт */
};
