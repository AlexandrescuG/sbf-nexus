#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_entity.py — JSON-LD и секция llms.txt из data/entity.json.

Факты о компании жили в четырёх местах (JSON-LD в index.html, llms.txt,
тексты страниц, тексты бота) и уже разошлись. Теперь они правятся в одном
файле — data/entity.json, — а этот скрипт собирает из него остальное.

    python3 tools/build_entity.py jsonld [--lang ru|en|ro]   # JSON-LD в stdout
    python3 tools/build_entity.py llms   [--lang ru|en|ro]   # секция «кто мы» для llms.txt
    python3 tools/build_entity.py check  <файл.html>         # сравнить с JSON-LD в HTML

check находит в HTML блок <script type="application/ld+json"> с организацией
(@type Organization/FinancialService) и перечисляет расхождения по смыслу:
разные значения, отсутствующие и лишние поля. Код выхода 1, если есть отличия.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

КОРЕНЬ = Path(__file__).resolve().parents[1]
ИСТОЧНИК = КОРЕНЬ / "data" / "entity.json"


def загрузить() -> dict:
    return json.loads(ИСТОЧНИК.read_text(encoding="utf-8"))


def jsonld(e: dict, язык: str = "ru") -> dict:
    """Организация для sbfconsult.com. @id общий для всех страниц сайта."""
    hq = e["hq"]
    return {
        "@context": "https://schema.org",
        "@type": "FinancialService",
        "@id": e["domains"]["company"] + "#org",
        "name": e["brand"],
        "legalName": e["legal_name"]["registry"],
        "alternateName": [e["legal_name"]["short"], e["legal_name"]["latin"], *e["former_names"]],
        "url": e["domains"]["company"],
        "logo": e["logo"],
        "description": e["description"][язык],
        "foundingDate": e["founding_date"],
        "areaServed": e["area_served"],
        "availableLanguage": e["languages"],
        "leiCode": e["identifiers"]["lei"],
        "identifier": [
            {"@type": "PropertyValue", "propertyID": "LEI", "value": e["identifiers"]["lei"]},
            {"@type": "PropertyValue", "propertyID": "IDNO", "value": e["identifiers"]["idno"]},
        ],
        "address": {
            "@type": "PostalAddress",
            "streetAddress": hq["street"],
            "addressLocality": hq["locality"],
            "postalCode": hq["postal_code"],
            "addressCountry": hq["country"],
        },
        "geo": {"@type": "GeoCoordinates", "latitude": hq["geo"]["lat"], "longitude": hq["geo"]["lng"]},
        "telephone": e["contacts"]["phone"],
        "email": e["contacts"]["email"],
        "sameAs": [
            e["domains"]["terminal"],
            e["domains"]["legal_entity_site"],
            e["social"]["telegram_channel"],
            e["identifiers"]["lei_url"],
        ],
    }


ЗАГОЛОВКИ = {
    "ru": ("Кто мы", "Юрлицо", "Офисы", "Чего мы НЕ делаем", "Прежнее название бренда"),
    "en": ("Who we are", "Legal entity", "Offices", "What we do NOT do", "Former brand name"),
    "ro": ("Cine suntem", "Entitate juridică", "Birouri", "Ce NU facem", "Denumirea anterioară a brandului"),
}


def llms(e: dict, язык: str = "ru") -> str:
    кто, юр, оф, не_делаем, прежнее = ЗАГОЛОВКИ[язык]
    ид = e["identifiers"]
    строки = [
        f"# {e['brand']}",
        "",
        f"> {e['description'][язык]}",
        "",
        f"## {кто}",
        "",
        f"- {юр}: {e['legal_name']['short']} ({e['legal_name']['registry']}), "
        f"IDNO {ид['idno']}, LEI {ид['lei']} ({ид['lei_url']})",
        f"- {прежнее}: {', '.join(e['former_names'])}",
        f"- Сайт компании / Company site: {e['domains']['company']}; "
        f"{e['product']['name']}: {e['product']['url']}",
        f"- Email: {e['contacts']['email']}, tel. {e['contacts']['phone_display']}",
        "",
        f"## {оф}",
        "",
    ]
    for о in e["offices"]:
        строки.append(f"- {о['country']} — {о['address']}")
    строки += ["", f"## {не_делаем}", ""]
    строки += [f"- {п}" for п in e["does_not"][язык]]
    return "\n".join(строки) + "\n"


def организация_из_html(html: str) -> dict | None:
    for блок in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            d = json.loads(блок)
        except json.JSONDecodeError:
            continue
        for узел in d.get("@graph", [d]) if isinstance(d, dict) else d:
            тип = узел.get("@type")
            типы = тип if isinstance(тип, list) else [тип]
            if {"Organization", "FinancialService"} & set(типы):
                return узел
    return None


def нормализовать(v):
    """Сравнение по смыслу: порядок в списках и регистр кода страны не важны."""
    if isinstance(v, dict):
        return {k: нормализовать(x) for k, x in v.items() if k != "@context"}
    if isinstance(v, list):
        return sorted((нормализовать(x) for x in v), key=lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True))
    return v


def сравнить(ожид: dict, факт: dict, путь: str = "") -> list[str]:
    отличия = []
    for k in sorted(set(ожид) | set(факт)):
        if k == "@context":
            continue
        п = f"{путь}.{k}" if путь else k
        if k not in факт:
            отличия.append(f"нет в HTML:      {п} = {json.dumps(ожид[k], ensure_ascii=False)[:120]}")
        elif k not in ожид:
            отличия.append(f"нет в entity:    {п} = {json.dumps(факт[k], ensure_ascii=False)[:120]}")
        elif isinstance(ожид[k], dict) and isinstance(факт[k], dict):
            отличия += сравнить(ожид[k], факт[k], п)
        elif нормализовать(ожид[k]) != нормализовать(факт[k]):
            отличия.append(f"разное значение: {п}\n      entity: {json.dumps(ожид[k], ensure_ascii=False)[:160]}"
                           f"\n      HTML:   {json.dumps(факт[k], ensure_ascii=False)[:160]}")
    return отличия


def main() -> int:
    р = argparse.ArgumentParser()
    р.add_argument("что", choices=("jsonld", "llms", "check"))
    р.add_argument("файл", nargs="?")
    р.add_argument("--lang", default="ru", choices=("ru", "en", "ro"))
    а = р.parse_args()
    e = загрузить()
    if а.что == "jsonld":
        print(json.dumps(jsonld(e, а.lang), ensure_ascii=False, indent=2))
        return 0
    if а.что == "llms":
        sys.stdout.write(llms(e, а.lang))
        return 0
    if not а.файл:
        р.error("check: укажите HTML-файл")
    факт = организация_из_html(Path(а.файл).read_text(encoding="utf-8"))
    if факт is None:
        print(f"✗ в {а.файл} нет JSON-LD организации")
        return 1
    отличия = сравнить(jsonld(e, а.lang), факт)
    print(f"{'✓' if not отличия else '✗'} {а.файл}: {len(отличия)} расхождений")
    for о in отличия:
        print("  " + о)
    return 1 if отличия else 0


if __name__ == "__main__":
    sys.exit(main())
