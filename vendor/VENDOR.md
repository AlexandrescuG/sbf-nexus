# vendor/ — сторонние библиотеки, лежащие в репозитории намеренно

Первый экран не должен зависеть от чужого CDN: если unpkg или jsdelivr
недоступны, герой превращается в пустой градиент. Поэтому карта мира и всё,
что её рисует, лежит здесь.

| Файл | Версия | Откуда |
|---|---|---|
| `d3.min.js` | 7.9.0 | npm `d3` |
| `topojson-client.min.js` | 3.1.0 | npm `topojson-client` |
| `countries-110m.json` | 2.0.2 | npm `world-atlas` |
| `three.min.js` | r128 | глобус на последнем экране |
| `leaflet.js` | — | карты в контактах |

Обновление:

```bash
cd /tmp && npm init -y && npm i d3@7.9.0 topojson-client@3.1.0 world-atlas@2.0.2
cp node_modules/d3/dist/d3.min.js \
   node_modules/topojson-client/dist/topojson-client.min.js \
   node_modules/world-atlas/countries-110m.json \
   /mnt/sbfdata/sbf-nexus/vendor/
```

После обновления — обязательно живой прогон первого экрана: карта рисуется
на канвасе, молча отвалиться она может только визуально, ошибки в консоли
при этом не будет.
