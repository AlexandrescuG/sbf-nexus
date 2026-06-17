# SBF Nexus — Corporate Website

Frontend корпоративного сайта [sbfconsult.com](https://sbfconsult.com). Статический HTML/CSS/JS без фреймворков и сборщиков. Двуязычный (RU/EN), snap-скроллинг по секциям, интерактивный 3D-глобус.

## Stack

- **Vanilla HTML + CSS + JavaScript** — без фреймворков
- **Three.js** — 3D-глобус с SVG-текстурой карты мира
- **Leaflet.js** — интерактивная карта с маркерами
- **Lenis** — плавный кинетический скролл

## Features

- Snap-скроллинг по секциям (100vh каждая) с восстановлением позиции при reload
- 3D-глобус: контуры материков из SVG, gold-цвет, автовращение, drag-to-rotate (desktop)
- Интерактивная карта с flash-маркерами рыночных сигналов (Leaflet)
- Двуязычный интерфейс RU / EN через `i18n.js` + `localStorage`
- Mobile-first адаптив: отдельная оптимизированная логика глобуса для мобильных
- Лид-форма для захвата контактов
- CSV-кейсы исторических рыночных ситуаций (медь, EURUSD, NatGas, XAUUSD, USDJPY)

## Structure

```
sbf-nexus/
├── index.html
├── css/styles.css
├── js/
│   ├── globe3d.js            # Three.js глобус (desktop)
│   ├── globe-mobile.js       # Упрощённый глобус для mobile
│   ├── core-engine.js        # Snap-движок, анимации, секции
│   ├── i18n.js               # Переводы RU/EN
│   ├── snap-navigator.js     # Навигация между секциями
│   ├── lead-modal.js         # Форма захвата лида
│   ├── acts/                 # Логика по секциям (approach, market, team, contact)
│   └── data/                 # Данные: города, команда, сигналы, AI-узлы
├── assets/
│   ├── data/*.csv            # Исторические кейсы рынка
│   ├── logo/                 # SVG / PNG логотип
│   ├── team/                 # Фото команды
│   ├── historic/             # Иллюстрации кейсов
│   └── finale/world-map.svg  # SVG карта мира для глобуса
├── vendor/                   # leaflet.js, three.min.js, lenis.js
└── server.py                 # Простой dev-сервер
```

## Run Locally

```bash
# Python dev-сервер (уже включён):
python3 server.py

# Или любой статический сервер:
npx serve .
python3 -m http.server 8080
```

Открой `http://localhost:8080` в браузере.
