#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_pages.py — страницы о компании: /about, /team, /methodology, /faq × ru/en/ro.

Факты о компании берутся из data/entity.json, о брокерах — из
data/partners_snapshot.json (снимок market-intel/web/data/partners.json).
Тексты — ниже, в одном месте на трёх языках. Руками HTML не правится:
изменил текст или факт — пересобрал.

    python3 tools/build_pages.py                       # собрать 12 страниц
    python3 tools/build_pages.py --partners ../market-intel/web/data/partners.json
                                                       # сначала обновить снимок

Выход: about/, team/, methodology/, faq/ (ru) и en/<страница>/, ro/<страница>/
— каждый index.html, чтобы адрес был /about/ без расширения.
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

КОРЕНЬ = Path(__file__).resolve().parents[1]
E = json.loads((КОРЕНЬ / "data" / "entity.json").read_text(encoding="utf-8"))
СНИМОК = КОРЕНЬ / "data" / "partners_snapshot.json"
ДОМЕН = E["domains"]["company"].rstrip("/")
LP = E["domains"]["terminal"].rstrip("/")
GH = "https://github.com/AlexandrescuG/market-intel/blob/main/"
ЯЗЫКИ = ("ru", "en", "ro")
СТРАНИЦЫ = ("about", "team", "methodology", "faq")
esc = html.escape


def путь(стр: str, яз: str) -> str:
    return f"/{стр}/" if яз == "ru" else f"/{яз}/{стр}/"


def код(p: str, яз: str) -> str:
    """Ссылка «код расчёта» на файл в публичном репозитории market-intel."""
    подпись = {"ru": "код", "en": "code", "ro": "cod"}[яз]
    return f'<span class="src">{подпись}: <a href="{GH}{p}" rel="noopener">{esc(p)}</a></span>'


# ── Общие подписи ────────────────────────────────────────────────────
T = {
    "nav": {
        "ru": {"about": "О компании", "team": "Команда", "methodology": "Методология", "faq": "Вопросы и ответы", "risk": "Риски"},
        "en": {"about": "About", "team": "Team", "methodology": "Methodology", "faq": "FAQ", "risk": "Risks"},
        "ro": {"about": "Despre noi", "team": "Echipa", "methodology": "Metodologie", "faq": "Întrebări frecvente", "risk": "Riscuri"},
    },
    "footer": {
        "ru": "Материалы носят информационный характер и не являются инвестиционной рекомендацией. Торговля CFD и маржинальными инструментами сопряжена с высоким риском быстрой потери средств.",
        "en": "The materials are for information only and are not investment advice. Trading CFDs and margin instruments carries a high risk of losing money rapidly.",
        "ro": "Materialele au caracter informativ și nu constituie o recomandare de investiții. Tranzacționarea CFD și a instrumentelor în marjă implică un risc ridicat de pierdere rapidă a banilor.",
    },
}


def реквизиты_строка(яз: str) -> str:
    ид, hq = E["identifiers"], E["hq"]
    return (f'{esc(E["legal_name"]["short"])}, {esc(hq["street"])}, {esc(hq["postal_code"])} '
            f'{esc(hq["locality"])}, Moldova · IDNO {ид["idno"]} · '
            f'LEI <a href="{ид["lei_url"]}" rel="noopener">{ид["lei"]}</a>')


# ── Брокеры-партнёры из снимка partners.json ─────────────────────────
def партнёры() -> list[dict]:
    return json.loads(СНИМОК.read_text(encoding="utf-8"))["partners"]


def брокер_url(p: dict, яз: str) -> str:
    return f"{LP}/brokers/{p['id']}" if яз == "ru" else f"{LP}/{яз}/brokers/{p['id']}"


НЕ_ЕЭЗ = ("за пределами", "по всему миру", "назначается")


def юрлицо_вне_еэз(p: dict) -> dict | None:
    """Юрлицо, которое по partners.json достаётся клиенту вне ЕЭЗ (в т.ч. из Молдовы)."""
    for e in p["entities"]:
        if any(s in (e.get("serves") or "") for s in НЕ_ЕЭЗ) and e.get("regulator"):
            return e
    return None


ЮРИСД = {"BZ": "Belize", "VG": "BVI", "BS": "Bahamas", "SC": "Seychelles", "CY": "Cyprus",
         "IE": "Ireland", "GB": "UK", "CR": "Costa Rica", "AE-DIFC": "UAE (DIFC)"}


def таблица_партнёров(яз: str) -> str:
    h = {"ru": ("Брокер", "Юрлицо для клиентов вне ЕЭЗ", "Регулятор", "Лицензия"),
         "en": ("Broker", "Entity for clients outside the EEA", "Regulator", "Licence"),
         "ro": ("Broker", "Entitatea pentru clienții din afara SEE", "Autoritate", "Licență")}[яз]
    нет = {"ru": "не публикуется", "en": "not published", "ro": "nepublicată"}[яз]
    строки = []
    for p in партнёры():
        e = юрлицо_вне_еэз(p)
        if not e:
            continue
        строки.append(
            f'<tr><td data-k="{h[0]}"><a href="{брокер_url(p, яз)}">{esc(p["name"])}</a></td>'
            f'<td data-k="{h[1]}">{esc(e["legal_name"])} ({ЮРИСД.get(e["jurisdiction"], e["jurisdiction"])})</td>'
            f'<td data-k="{h[2]}">{esc(e["regulator"])}</td>'
            f'<td data-k="{h[3]}">{esc(e["licence_no"] or нет)}</td></tr>')
    return (f'<table><thead><tr>{"".join(f"<th>{x}</th>" for x in h)}</tr></thead>'
            f'<tbody>{"".join(строки)}</tbody></table>')


def таблица_депозитов(яз: str) -> str:
    h = {"ru": ("Брокер", "Минимальный депозит", "Проверено"),
         "en": ("Broker", "Minimum deposit", "Checked"),
         "ro": ("Broker", "Depozit minim", "Verificat")}[яз]
    нет_мин = {"ru": "фиксированного минимума нет (по данным брокера)",
               "en": "no fixed minimum (per the broker)",
               "ro": "fără minim fix (conform brokerului)"}[яз]
    строки = []
    for p in партнёры():
        md = p["min_deposit"]
        сумма = f'{md["value"]} {md["currency"]}' if md.get("value") is not None else нет_мин
        строки.append(
            f'<tr><td data-k="{h[0]}"><a href="{брокер_url(p, яз)}">{esc(p["name"])}</a></td>'
            f'<td data-k="{h[1]}">{esc(сумма)}</td>'
            f'<td data-k="{h[2]}"><a href="{esc(md.get("source") or "")}" rel="noopener">{esc(md.get("checked") or "")}</a></td></tr>')
    return (f'<table><thead><tr>{"".join(f"<th>{x}</th>" for x in h)}</tr></thead>'
            f'<tbody>{"".join(строки)}</tbody></table>')


def офисы(яз: str) -> str:
    return "<ul>" + "".join(f"<li>{esc(o['address'])}</li>" for o in E["offices"]) + "</ul>"


def не_делаем(яз: str) -> str:
    return "<ul>" + "".join(f"<li>{esc(x)}</li>" for x in E["does_not"][яз]) + "</ul>"


# ── Тексты страниц ───────────────────────────────────────────────────
def about(яз: str) -> dict:
    ид, hq, к = E["identifiers"], E["hq"], E["contacts"]
    реквизиты = {
        "ru": [("Юрлицо", E["legal_name"]["registry"]), ("IDNO", ид["idno"]),
               ("LEI", f'<a href="{ид["lei_url"]}" rel="noopener">{ид["lei"]}</a>'),
               ("Дата регистрации", f'{E["founding_date"]} (по записи LEI)'),
               ("Адрес", f'{hq["office"]}, {hq["street"]}, {hq["postal_code"]} {hq["locality"]}, Moldova'),
               ("Телефон", к["phone_display"]), ("Email", f'<a href="mailto:{к["email"]}">{к["email"]}</a>')],
        "en": [("Legal entity", E["legal_name"]["registry"]), ("IDNO", ид["idno"]),
               ("LEI", f'<a href="{ид["lei_url"]}" rel="noopener">{ид["lei"]}</a>'),
               ("Registered", f'{E["founding_date"]} (per the LEI record)'),
               ("Address", f'{hq["office"]}, {hq["street"]}, {hq["postal_code"]} {hq["locality"]}, Moldova'),
               ("Phone", к["phone_display"]), ("Email", f'<a href="mailto:{к["email"]}">{к["email"]}</a>')],
        "ro": [("Entitate juridică", E["legal_name"]["registry"]), ("IDNO", ид["idno"]),
               ("LEI", f'<a href="{ид["lei_url"]}" rel="noopener">{ид["lei"]}</a>'),
               ("Înregistrată", f'{E["founding_date"]} (conform înregistrării LEI)'),
               ("Adresă", f'{hq["office"]}, {hq["street"]}, {hq["postal_code"]} {hq["locality"]}, Moldova'),
               ("Telefon", к["phone_display"]), ("Email", f'<a href="mailto:{к["email"]}">{к["email"]}</a>')],
    }[яз]
    табл = "<table><tbody>" + "".join(
        f'<tr><th scope="row">{k}</th><td>{v if k in ("LEI", "Email") else esc(v)}</td></tr>' for k, v in реквизиты) + "</tbody></table>"
    t = {
        "ru": dict(
            title="О компании SBF Consult — Кишинёв, Молдова",
            desc="SBF Consult («SBF COMPANY» S.R.L., Кишинёв): анализ рынков, обучение трейдингу, сопровождение счетов у брокеров-партнёров. Реквизиты, IDNO, LEI.",
            h1="О компании SBF Consult",
            sections=[
                ("", f'<p class="lead">{esc(E["description"]["ru"])}</p>'
                     f'<p>SBF Consult — бренд юрлица «SBF COMPANY» S.R.L. '
                     f'Терминал рыночной аналитики компании называется <a href="{LP}/">SBF Intelligence</a>.</p>'),
                ("Реквизиты", табл),
                ("Чем мы занимаемся",
                 "<ul>"
                 f'<li><b>Обучение.</b> Курс «Биржевая торговля» из 15 глав; главы 1–5 открыты без регистрации, 6–15 — с аккаунтом. <a href="{LP}/edu/">Курс</a>.</li>'
                 "<li><b>Сопровождение торгового счёта.</b> Обзор позиций, информационная поддержка, статистические наблюдения. Решения по сделкам принимает клиент. Счёт открывается у брокера-партнёра.</li>"
                 "<li><b>Доверительное управление</b> — только через брокера-партнёра FxPro по партнёрскому контракту. SBF Consult не является лицензированным управляющим активами.</li>"
                 f'<li><b>Терминал SBF Intelligence</b>: утренний бриф, графики, экономический календарь, сравнение брокеров, журнал сделок. <a href="{LP}/">lp.sbfconsult.com</a>.</li>'
                 "</ul>"),
                ("Как мы зарабатываем",
                 "<p>Для клиента сопровождение бесплатно: SBF Consult получает вознаграждение от брокера-партнёра за приведённый счёт. Мы раскрываем это прямо, чтобы было понятно, в чём наш интерес.</p>"),
                ("Чего мы не делаем", не_делаем("ru")),
                ("Брокеры-партнёры",
                 "<p>Юрлицо брокера и регулятор зависят от страны клиента. Клиент из Молдовы и других стран вне Европейской экономической зоны получает счёт у юрлица, указанного ниже, — не у европейского юрлица того же бренда. У европейских юрлиц другие условия (плечо, компенсационный фонд). Полные данные по каждому юрлицу — на <a href=\"" + LP + "/brokers\">странице сравнения брокеров</a>.</p>"
                 + таблица_партнёров("ru")),
                ("Офисы", офисы("ru")),
            ]),
        "en": dict(
            title="About SBF Consult — Chișinău, Moldova",
            desc="SBF Consult (SBF COMPANY S.R.L., Chișinău): market analysis, trading education, support for accounts at partner brokers. Registration details, IDNO, LEI.",
            h1="About SBF Consult",
            sections=[
                ("", f'<p class="lead">{esc(E["description"]["en"])}</p>'
                     f'<p>SBF Consult is the brand of the legal entity «SBF COMPANY» S.R.L. '
                     f'The company’s market analytics terminal is called <a href="{LP}/en/">SBF Intelligence</a>.</p>'),
                ("Company details", табл),
                ("What we do",
                 "<ul>"
                 f'<li><b>Education.</b> A 15-chapter trading course; chapters 1–5 are open without registration, 6–15 require an account. <a href="{LP}/en/edu/">Course</a>.</li>'
                 "<li><b>Trading account support.</b> Position reviews, information support, statistical observations. The client makes all trading decisions. The account is opened with a partner broker.</li>"
                 "<li><b>Discretionary management</b> — only through the partner broker FxPro under a partnership agreement. SBF Consult is not a licensed asset manager.</li>"
                 f'<li><b>SBF Intelligence terminal</b>: morning brief, charts, economic calendar, broker comparison, trade journal. <a href="{LP}/en/">lp.sbfconsult.com</a>.</li>'
                 "</ul>"),
                ("How we earn",
                 "<p>Account support is free for the client: SBF Consult receives a fee from the partner broker for a referred account. We disclose this openly so that our interest is clear.</p>"),
                ("What we do not do", не_делаем("en")),
                ("Partner brokers",
                 "<p>The broker’s legal entity and regulator depend on the client’s country. A client from Moldova or another country outside the European Economic Area gets an account with the entity listed below — not with the same brand’s European entity, which has different terms (leverage, compensation fund). Full details for each entity are on the <a href=\"" + LP + "/en/brokers\">broker comparison page</a>.</p>"
                 + таблица_партнёров("en")),
                ("Offices", офисы("en")),
            ]),
        "ro": dict(
            title="Despre SBF Consult — Chișinău, Moldova",
            desc="SBF Consult (SBF COMPANY S.R.L., Chișinău): analiza piețelor, educație în trading, suport pentru conturi la brokeri parteneri. Date, IDNO, LEI.",
            h1="Despre SBF Consult",
            sections=[
                ("", f'<p class="lead">{esc(E["description"]["ro"])}</p>'
                     f'<p>SBF Consult este brandul entității juridice «SBF COMPANY» S.R.L. '
                     f'Terminalul de analiză a pieței al companiei se numește <a href="{LP}/ro/">SBF Intelligence</a>.</p>'),
                ("Date de identificare", табл),
                ("Ce facem",
                 "<ul>"
                 f'<li><b>Educație.</b> Cursul de tranzacționare are 15 capitole; capitolele 1–5 sunt deschise fără înregistrare, 6–15 necesită cont. <a href="{LP}/ro/edu/">Curs</a>.</li>'
                 "<li><b>Suport pentru contul de tranzacționare.</b> Analiza pozițiilor, suport informativ, observații statistice. Deciziile de tranzacționare le ia clientul. Contul se deschide la un broker partener.</li>"
                 "<li><b>Administrare discreționară</b> — doar prin brokerul partener FxPro, pe baza unui contract de parteneriat. SBF Consult nu este un administrator de active licențiat.</li>"
                 f'<li><b>Terminalul SBF Intelligence</b>: brief de dimineață, grafice, calendar economic, comparația brokerilor, jurnal de tranzacții. <a href="{LP}/ro/">lp.sbfconsult.com</a>.</li>'
                 "</ul>"),
                ("Cum câștigăm",
                 "<p>Pentru client suportul este gratuit: SBF Consult primește o remunerație de la brokerul partener pentru contul adus. Spunem asta deschis, ca să fie clar care este interesul nostru.</p>"),
                ("Ce nu facem", не_делаем("ro")),
                ("Brokeri parteneri",
                 "<p>Entitatea juridică a brokerului și autoritatea de supraveghere depind de țara clientului. Un client din Moldova sau din altă țară din afara Spațiului Economic European primește cont la entitatea de mai jos — nu la entitatea europeană a aceluiași brand, care are alte condiții (efect de levier, fond de compensare). Detaliile complete sunt pe <a href=\"" + LP + "/ro/brokers\">pagina de comparație a brokerilor</a>.</p>"
                 + таблица_партнёров("ro")),
                ("Birouri", офисы("ro")),
            ]),
    }[яз]
    t["schema_type"] = "AboutPage"
    return t


РОЛИ = {
    "ru": ["Quant-стратегия", "Архитектура риска", "Макро-аналитика", "Операционная торговля", "Управление портфелями",
           "Технологическая платформа", "Анализ деривативов", "Валютные операции", "Сырьевые рынки",
           "Алгоритмическая торговля", "Инфраструктурная безопасность"],
    "en": ["Quant strategy", "Risk architecture", "Macro analysis", "Trading operations", "Portfolio management",
           "Technology platform", "Derivatives analysis", "FX operations", "Commodity markets",
           "Algorithmic trading", "Infrastructure security"],
    "ro": ["Strategie cantitativă", "Arhitectura riscului", "Analiză macro", "Operațiuni de tranzacționare", "Administrarea portofoliilor",
           "Platforma tehnologică", "Analiza derivatelor", "Operațiuni valutare", "Piețe de mărfuri",
           "Tranzacționare algoritmică", "Securitatea infrastructurii"],
}


def team(яз: str) -> dict:
    роли = "<ul>" + "".join(f"<li>{esc(r)}</li>" for r in РОЛИ[яз]) + "</ul>"
    t = {
        "ru": dict(
            title="Команда SBF Consult",
            desc="Направления работы команды SBF Consult и кто отвечает за услуги компании. Решения по сделкам клиента принимает сам клиент.",
            h1="Команда SBF Consult",
            sections=[
                ("Направления работы", "<p>Команда SBF Consult работает по направлениям:</p>" + роли),
                ("Кто отвечает за услуги",
                 f"<p>Имена сотрудников на сайте сейчас не публикуются. Юридическую ответственность за услуги несёт «SBF COMPANY» S.R.L. — реквизиты на странице <a href=\"{путь('about', 'ru')}\">«О компании»</a>.</p>"
                 "<p>Решения по сделкам на счёте клиента принимает клиент. Доверительное управление осуществляется только через брокера-партнёра по партнёрскому контракту.</p>"),
            ]),
        "en": dict(
            title="SBF Consult team",
            desc="The areas the SBF Consult team works in and who is responsible for the company’s services. Trading decisions on a client account are made by the client.",
            h1="SBF Consult team",
            sections=[
                ("Areas of work", "<p>The SBF Consult team works in these areas:</p>" + роли),
                ("Who is responsible for the services",
                 f"<p>Staff names are not published on the site at the moment. Legal responsibility for the services lies with «SBF COMPANY» S.R.L. — see the details on the <a href=\"{путь('about', 'en')}\">About</a> page.</p>"
                 "<p>Trading decisions on a client’s account are made by the client. Discretionary management is carried out only through the partner broker under a partnership agreement.</p>"),
            ]),
        "ro": dict(
            title="Echipa SBF Consult",
            desc="Direcțiile în care lucrează echipa SBF Consult și cine răspunde de serviciile companiei. Deciziile de tranzacționare le ia clientul.",
            h1="Echipa SBF Consult",
            sections=[
                ("Direcții de lucru", "<p>Echipa SBF Consult lucrează pe direcțiile:</p>" + роли),
                ("Cine răspunde de servicii",
                 f"<p>Numele angajaților nu sunt publicate deocamdată pe site. Răspunderea juridică pentru servicii o poartă «SBF COMPANY» S.R.L. — datele sunt pe pagina <a href=\"{путь('about', 'ro')}\">Despre noi</a>.</p>"
                 "<p>Deciziile de tranzacționare pe contul clientului le ia clientul. Administrarea discreționară se face doar prin brokerul partener, pe baza unui contract de parteneriat.</p>"),
            ]),
    }[яз]
    t["schema_type"] = "WebPage"
    return t


def methodology(яз: str) -> dict:
    к = lambda p: код(p, яз)  # noqa: E731
    t = {
        "ru": dict(
            title="Методология SBF Intelligence — как мы считаем",
            desc="Как SBF Intelligence считает реакцию рынка на события, норму волатильности и статистику паттернов: данные, пороги и ограничения.",
            h1="Методология SBF Intelligence",
            sections=[
                ("", "<p class=\"lead\">Все числа в брифе и на терминале считает код по ценовым данным. Языковая модель пишет только заголовок и три пункта контекста к уже посчитанному брифу — чисел она не добавляет и не меняет. "
                     + к("analyze/llm_context.py") + "</p>"
                     "<p>Ниже — что именно считается, по каким данным и с какими порогами. У каждого пункта ссылка на код расчёта.</p>"),
                ("Данные",
                 "<ul>"
                 "<li>Цены: минутные и дневные бары из торгового терминала MT5 (история с июля 2021 года). Строка котировок обновляется каждые 15 секунд. " + к("quotes_loop.py") + "</li>"
                 "<li>Макроэкономика: ряды ФРБ Сент-Луиса (FRED) — инфляция CPI, безработица, ставка ФРС, спред 10y–2y, инфляционные ожидания, нефть WTI, торгово-взвешенный доллар. " + к("core/fred.py") + "</li>"
                 "<li>Экономический календарь: официальные источники, ForexFactory и TradingView; одна публикация из разных источников считается один раз. " + к("event_reactions_job.py") + "</li>"
                 "<li>Новостной фон: RSS-ленты, X и Telegram-канал SBF Economics. " + к("news_burst_job.py") + "</li>"
                 "</ul>"),
                ("Реакция рынка на событие",
                 "<p>Для каждого типа события (например, решение по ставке) и каждого связанного с ним инструмента берутся прошлые публикации. Ход за 30 минут — модуль разницы между открытием и закрытием 30-минутного бара, начинающегося в момент публикации.</p>"
                 "<p>По всем прошлым случаям берётся медиана и делится на дневной ATR(14) инструмента — так ход сравним между инструментами. Отдельно ход сравнивается с типичным ходом того же часа суток: 38 пунктов в 15:30 UTC и в 03:00 UTC — разные события. " + к("event_reactions_job.py") + "</p>"
                 "<p>В брифе число показывается, только если прошлых выходов не меньше пяти; иначе пишем «прошлых выходов пока мало». " + к("analyze/build_brief_v2.py") + "</p>"),
                ("Кто ходил шире обычного",
                 "<p>Для каждого инструмента ход последнего закрытого дня делится на его собственную норму — средний истинный диапазон по Уайлдеру за 14 дней (ATR14). Отношение больше единицы — ход шире обычного. Данные старше трёх дней не берутся: это не «вчера», а пропуск в данных. "
                 + к("core/movers.py") + " " + к("core/focus.py") + "</p>"),
                ("Статистика паттернов",
                 "<p>Паттерны ищутся по всей доступной истории на таймфреймах H1, H4 и D1. Для каждого случая проверяется, пошла ли цена в сторону паттерна через 3, 5 и 10 свечей. Случаи ближе шести свечей друг к другу считаются одним. Пересчёт — раз в неделю. "
                 + к("pattern_stats_job.py") + "</p>"
                 "<p>В брифе паттерн показывается только со статистикой не меньше 15 случаев. " + к("analyze/build_brief_v2.py") + "</p>"
                 "<p>Что показали наши замеры: согласованность классических свечных и графических паттернов с направлением следующих пяти баров — 46,8–51,3% по инструментам, статистически неотличимо от 50%. Мы показываем это в курсе, а не прячем. "
                 + к("tools/edu_build/pattern_reality.py") + "</p>"),
                ("Всплески новостей",
                 "<p>Всплеск — когда за последний час об инструменте вышло не меньше пяти новостей и не меньше чем втрое больше, чем в среднем за час за последние семь дней. Проверка каждые 15 минут. Это внимание, а не цена. "
                 + к("news_burst_job.py") + "</p>"),
                ("Насколько можно верить пункту брифа",
                 "<p>Каждый пункт контекста в брифе помечен источником: «из котировок» — видно в ценах; «из СМИ» — со ссылкой на издание; «из соцсетей, не проверено» — показываем, потому что рынок на это реагирует, но не подтверждаем. " + к("analyze/prompt.md") + "</p>"),
                ("Ограничения",
                 "<ul><li>Историческая статистика описывает прошлое и не гарантирует будущих результатов.</li>"
                 "<li>Малые выборки дают широкий разброс; поэтому у всех чисел есть пороги по числу случаев.</li>"
                 "<li>Пропуски в ценовых данных возможны; устаревшие данные не выдаются за вчерашние.</li>"
                 "<li>Ничто из этого не является инвестиционной рекомендацией: решение о сделке принимаете вы.</li></ul>"),
            ]),
        "en": dict(
            title="SBF Intelligence methodology — how we measure",
            desc="How SBF Intelligence measures market reaction to events, normal volatility and pattern statistics: data, thresholds and limitations.",
            h1="SBF Intelligence methodology",
            sections=[
                ("", "<p class=\"lead\">Every number in the brief and on the terminal is computed by code from price data. A language model writes only the headline and three context points for an already computed brief — it adds and changes no numbers. "
                     + к("analyze/llm_context.py") + "</p>"
                     "<p>Below is what exactly is measured, from which data and with which thresholds. Each item links to the code that computes it.</p>"),
                ("Data",
                 "<ul>"
                 "<li>Prices: intraday and daily bars from the MT5 trading terminal (history since July 2021). The quote line refreshes every 15 seconds. " + к("quotes_loop.py") + "</li>"
                 "<li>Macro: Federal Reserve Bank of St. Louis (FRED) series — CPI inflation, unemployment, Fed funds rate, 10y–2y spread, breakeven inflation, WTI oil, trade-weighted dollar. " + к("core/fred.py") + "</li>"
                 "<li>Economic calendar: official sources, ForexFactory and TradingView; one release seen in several sources is counted once. " + к("event_reactions_job.py") + "</li>"
                 "<li>News flow: RSS feeds, X and the SBF Economics Telegram channel. " + к("news_burst_job.py") + "</li>"
                 "</ul>"),
                ("Market reaction to an event",
                 "<p>For each event type (for example, a rate decision) and each related instrument we take past releases. The 30-minute move is the absolute difference between the open and close of the 30-minute bar starting at the release time.</p>"
                 "<p>We take the median over all past cases and divide it by the instrument’s daily ATR(14), so moves are comparable across instruments. The move is also compared with the typical move of the same hour of day: 38 points at 15:30 UTC and at 03:00 UTC are different events. " + к("event_reactions_job.py") + "</p>"
                 "<p>The brief shows the number only if there are at least five past releases; otherwise it says “too few past releases yet”. " + к("analyze/build_brief_v2.py") + "</p>"),
                ("Who moved wider than usual",
                 "<p>For each instrument the move of the last closed day is divided by its own norm — Wilder’s 14-day average true range (ATR14). A ratio above one means a wider-than-usual move. Data older than three days is not used: that is a data gap, not “yesterday”. "
                 + к("core/movers.py") + " " + к("core/focus.py") + "</p>"),
                ("Pattern statistics",
                 "<p>Patterns are searched over the full available history on the H1, H4 and D1 timeframes. For each case we check whether price moved in the pattern’s direction after 3, 5 and 10 candles. Cases closer than six candles to each other count as one. Recomputed weekly. "
                 + к("pattern_stats_job.py") + "</p>"
                 "<p>The brief shows a pattern only with statistics of at least 15 cases. " + к("analyze/build_brief_v2.py") + "</p>"
                 "<p>What our measurements showed: agreement of classic candlestick and chart patterns with the direction of the next five bars is 46.8–51.3% across instruments, statistically indistinguishable from 50%. We show this in the course rather than hide it. "
                 + к("tools/edu_build/pattern_reality.py") + "</p>"),
                ("News bursts",
                 "<p>A burst is when at least five news items about an instrument appeared in the last hour, and at least three times the average hourly count over the last seven days. Checked every 15 minutes. This is attention, not price. "
                 + к("news_burst_job.py") + "</p>"),
                ("How far to trust an item in the brief",
                 "<p>Each context item in the brief is labelled with its source: “from quotes” — visible in prices; “from media” — with a link to the outlet; “from social media, unverified” — shown because the market reacts to it, but not confirmed. " + к("analyze/prompt.md") + "</p>"),
                ("Limitations",
                 "<ul><li>Historical statistics describe the past and do not guarantee future results.</li>"
                 "<li>Small samples give a wide spread, so every number has a minimum-cases threshold.</li>"
                 "<li>Gaps in price data are possible; stale data is never presented as yesterday’s.</li>"
                 "<li>None of this is investment advice: the trading decision is yours.</li></ul>"),
            ]),
        "ro": dict(
            title="Metodologia SBF Intelligence — cum măsurăm",
            desc="Cum măsoară SBF Intelligence reacția pieței la evenimente, volatilitatea normală și statistica tiparelor: date, praguri și limitări.",
            h1="Metodologia SBF Intelligence",
            sections=[
                ("", "<p class=\"lead\">Toate cifrele din brief și din terminal sunt calculate de cod pe baza datelor de preț. Modelul lingvistic scrie doar titlul și trei puncte de context pentru un brief deja calculat — nu adaugă și nu modifică cifre. "
                     + к("analyze/llm_context.py") + "</p>"
                     "<p>Mai jos — ce anume se măsoară, pe ce date și cu ce praguri. Fiecare punct are un link la codul de calcul.</p>"),
                ("Date",
                 "<ul>"
                 "<li>Prețuri: bare intraday și zilnice din terminalul de tranzacționare MT5 (istoric din iulie 2021). Linia de cotații se actualizează la fiecare 15 secunde. " + к("quotes_loop.py") + "</li>"
                 "<li>Macroeconomie: serii ale Băncii Rezervei Federale din St. Louis (FRED) — inflația CPI, șomajul, rata Fed, spread-ul 10y–2y, inflația așteptată, petrolul WTI, dolarul ponderat comercial. " + к("core/fred.py") + "</li>"
                 "<li>Calendar economic: surse oficiale, ForexFactory și TradingView; o publicare văzută în mai multe surse se numără o singură dată. " + к("event_reactions_job.py") + "</li>"
                 "<li>Fluxul de știri: fluxuri RSS, X și canalul Telegram SBF Economics. " + к("news_burst_job.py") + "</li>"
                 "</ul>"),
                ("Reacția pieței la un eveniment",
                 "<p>Pentru fiecare tip de eveniment (de exemplu, decizia privind rata) și fiecare instrument legat de el se iau publicările anterioare. Mișcarea în 30 de minute este diferența absolută dintre deschiderea și închiderea barei de 30 de minute care începe la momentul publicării.</p>"
                 "<p>Se ia mediana tuturor cazurilor anterioare și se împarte la ATR(14) zilnic al instrumentului, ca mișcările să fie comparabile între instrumente. Mișcarea se compară și cu mișcarea tipică a aceleiași ore din zi: 38 de puncte la 15:30 UTC și la 03:00 UTC sunt evenimente diferite. " + к("event_reactions_job.py") + "</p>"
                 "<p>În brief cifra apare doar dacă există cel puțin cinci publicări anterioare; altfel scriem „prea puține publicări anterioare deocamdată”. " + к("analyze/build_brief_v2.py") + "</p>"),
                ("Cine s-a mișcat mai larg decât de obicei",
                 "<p>Pentru fiecare instrument mișcarea ultimei zile închise se împarte la propria normă — intervalul real mediu Wilder pe 14 zile (ATR14). Un raport peste unu înseamnă o mișcare mai largă decât de obicei. Datele mai vechi de trei zile nu se folosesc: este o lipsă în date, nu „ieri”. "
                 + к("core/movers.py") + " " + к("core/focus.py") + "</p>"),
                ("Statistica tiparelor",
                 "<p>Tiparele se caută pe tot istoricul disponibil pe intervalele H1, H4 și D1. Pentru fiecare caz se verifică dacă prețul a mers în direcția tiparului după 3, 5 și 10 lumânări. Cazurile mai apropiate de șase lumânări unul de altul se numără ca unul. Recalculare săptămânală. "
                 + к("pattern_stats_job.py") + "</p>"
                 "<p>În brief un tipar apare doar cu o statistică de cel puțin 15 cazuri. " + к("analyze/build_brief_v2.py") + "</p>"
                 "<p>Ce au arătat măsurătorile noastre: concordanța tiparelor clasice de lumânări și grafice cu direcția următoarelor cinci bare este de 46,8–51,3% pe instrumente, indistinctă statistic de 50%. O arătăm în curs, nu o ascundem. "
                 + к("tools/edu_build/pattern_reality.py") + "</p>"),
                ("Valuri de știri",
                 "<p>Un val este atunci când în ultima oră au apărut cel puțin cinci știri despre un instrument și de cel puțin trei ori mai multe decât media orară din ultimele șapte zile. Verificare la fiecare 15 minute. Este atenție, nu preț. "
                 + к("news_burst_job.py") + "</p>"),
                ("Cât de mult poți avea încredere într-un punct din brief",
                 "<p>Fiecare punct de context din brief este marcat cu sursa: „din cotații” — se vede în prețuri; „din presă” — cu link la publicație; „din rețele sociale, neverificat” — îl arătăm pentru că piața reacționează, dar nu îl confirmăm. " + к("analyze/prompt.md") + "</p>"),
                ("Limitări",
                 "<ul><li>Statistica istorică descrie trecutul și nu garantează rezultate viitoare.</li>"
                 "<li>Eșantioanele mici dau o dispersie mare, de aceea fiecare cifră are un prag minim de cazuri.</li>"
                 "<li>Lipsurile în datele de preț sunt posibile; datele vechi nu sunt prezentate drept ale zilei de ieri.</li>"
                 "<li>Nimic din acestea nu este o recomandare de investiții: decizia de tranzacționare îți aparține.</li></ul>"),
            ]),
    }[яз]
    t["schema_type"] = "TechArticle"
    return t


def faq(яз: str) -> dict:
    ид = E["identifiers"]
    about = путь("about", яз)
    meth = путь("methodology", яз)
    lp_lang = "" if яз == "ru" else f"/{яз}"
    qa = {
        "ru": [
            ("Что такое SBF Consult?", f"<p>{esc(E['description']['ru'])} Юрлицо — «SBF COMPANY» S.R.L., IDNO {ид['idno']}, LEI {ид['lei']}. Подробнее — <a href=\"{about}\">о компании</a>.</p>"),
            ("SBF Consult — брокер? Вы храните деньги клиентов?", "<p>Нет. SBF Consult не брокер и не лицензированный управляющий активами. Мы не принимаем и не храним средства клиентов: счёт открывается у брокера-партнёра, деньги находятся у него.</p>"),
            ("Как SBF Consult зарабатывает?", "<p>Для клиента сопровождение бесплатно: SBF Consult получает вознаграждение от брокера-партнёра за приведённый счёт.</p>"),
            ("Сколько стоит обучение?", f"<p>Утренний бриф, графики, котировки и главы 1–5 курса открыты без регистрации. Полный курс (главы 1–15) и журнал сделок входят в PRO; 30 дней PRO даются за короткий опрос, без карты и без автосписаний. <a href=\"{LP}{lp_lang}/edu/\">Курс</a>.</p>"),
            ("Можно ли начать без опыта?", f"<p>Да: курс начинается с основ, и первые пять глав открыты всем. <a href=\"{LP}{lp_lang}/edu/\">Начать с главы 1</a>.</p>"),
            ("Когда я начну зарабатывать?", "<p>Сроков и прибыли мы не обещаем. Результат в трейдинге зависит от капитала, риска и дисциплины; историческая статистика не гарантирует будущих результатов.</p>"),
            ("Безопасны ли ваши брокеры-партнёры?", f"<p>Все партнёры регулируются, но юрлицо и регулятор зависят от страны клиента. Клиент из Молдовы и других стран вне ЕЭЗ получает счёт у такого юрлица:</p>{таблица_партнёров('ru')}<p>Номер лицензии можно проверить в реестре регулятора. Полные данные — на <a href=\"{LP}/brokers\">странице сравнения брокеров</a>.</p>"),
            ("Какая минимальная сумма для старта?", f"<p>Минимальный депозит устанавливает брокер:</p>{таблица_депозитов('ru')}<p>Способ оплаты может иметь свой минимум.</p>"),
            ("Что такое утренний бриф?", f"<p>Сводка по рынкам до открытия европейской сессии: котировки, события дня и как рынок реагировал на них раньше, инструменты, ходившие шире обычного, новостной фон с пометкой достоверности. У каждого выпуска свой адрес и дата — <a href=\"/brief/\">архив брифов</a>. Как считаются числа — в <a href=\"{meth}\">методологии</a>. Бриф не является рекомендацией.</p>"),
            ("Вы продаёте сигналы или даёте рекомендации?", не_делаем("ru")),
            ("На каких языках работает компания?", "<p>Сайт и терминал — на русском, румынском и английском.</p>"),
            ("Где находится компания?", f"<p>Головной офис — {esc(E['hq']['office'])}, {esc(E['hq']['street'])}, {esc(E['hq']['postal_code'])} {esc(E['hq']['locality'])}, Молдова. Офисы:</p>{офисы('ru')}"),
        ],
        "en": [
            ("What is SBF Consult?", f"<p>{esc(E['description']['en'])} Legal entity: «SBF COMPANY» S.R.L., IDNO {ид['idno']}, LEI {ид['lei']}. More on the <a href=\"{about}\">About</a> page.</p>"),
            ("Is SBF Consult a broker? Do you hold client money?", "<p>No. SBF Consult is neither a broker nor a licensed asset manager. We do not accept or hold client funds: the account is opened with a partner broker, and the money stays there.</p>"),
            ("How does SBF Consult earn?", "<p>Account support is free for the client: SBF Consult receives a fee from the partner broker for a referred account.</p>"),
            ("How much does the education cost?", f"<p>The morning brief, charts, quotes and chapters 1–5 of the course are open without registration. The full course (chapters 1–15) and the trade journal are part of PRO; 30 days of PRO are given for a short survey, with no card and no auto-renewal. <a href=\"{LP}/en/edu/\">Course</a>.</p>"),
            ("Can I start without experience?", f"<p>Yes: the course starts from the basics, and the first five chapters are open to everyone. <a href=\"{LP}/en/edu/\">Start with chapter 1</a>.</p>"),
            ("When will I start earning?", "<p>We promise neither timelines nor profit. Trading results depend on capital, risk and discipline; historical statistics do not guarantee future results.</p>"),
            ("Are your partner brokers safe?", f"<p>All partners are regulated, but the legal entity and regulator depend on the client’s country. A client from Moldova or another country outside the EEA gets an account with this entity:</p>{таблица_партнёров('en')}<p>The licence number can be checked in the regulator’s register. Full details are on the <a href=\"{LP}/en/brokers\">broker comparison page</a>.</p>"),
            ("What is the minimum amount to start?", f"<p>The minimum deposit is set by the broker:</p>{таблица_депозитов('en')}<p>A payment method may have its own minimum.</p>"),
            ("What is the morning brief?", f"<p>A market summary before the European session opens: quotes, the day’s events and how the market reacted to them before, instruments that moved wider than usual, and the news flow labelled by reliability. Each issue has its own address and date — <a href=\"/brief/\">brief archive</a>. How the numbers are computed is described in the <a href=\"{meth}\">methodology</a>. The brief is not a recommendation.</p>"),
            ("Do you sell signals or give recommendations?", не_делаем("en")),
            ("Which languages does the company work in?", "<p>The site and the terminal are in Russian, Romanian and English.</p>"),
            ("Where is the company located?", f"<p>Head office: {esc(E['hq']['office'])}, {esc(E['hq']['street'])}, {esc(E['hq']['postal_code'])} {esc(E['hq']['locality'])}, Moldova. Offices:</p>{офисы('en')}"),
        ],
        "ro": [
            ("Ce este SBF Consult?", f"<p>{esc(E['description']['ro'])} Entitatea juridică: «SBF COMPANY» S.R.L., IDNO {ид['idno']}, LEI {ид['lei']}. Detalii pe pagina <a href=\"{about}\">Despre noi</a>.</p>"),
            ("SBF Consult este broker? Păstrați banii clienților?", "<p>Nu. SBF Consult nu este broker și nici administrator de active licențiat. Nu acceptăm și nu păstrăm fondurile clienților: contul se deschide la un broker partener, iar banii rămân la el.</p>"),
            ("Cum câștigă SBF Consult?", "<p>Pentru client suportul este gratuit: SBF Consult primește o remunerație de la brokerul partener pentru contul adus.</p>"),
            ("Cât costă educația?", f"<p>Brief-ul de dimineață, graficele, cotațiile și capitolele 1–5 ale cursului sunt deschise fără înregistrare. Cursul complet (capitolele 1–15) și jurnalul de tranzacții fac parte din PRO; 30 de zile PRO se oferă pentru un scurt chestionar, fără card și fără reînnoire automată. <a href=\"{LP}/ro/edu/\">Curs</a>.</p>"),
            ("Pot începe fără experiență?", f"<p>Da: cursul începe de la bază, iar primele cinci capitole sunt deschise tuturor. <a href=\"{LP}/ro/edu/\">Începe cu capitolul 1</a>.</p>"),
            ("Când voi începe să câștig?", "<p>Nu promitem nici termene, nici profit. Rezultatele în trading depind de capital, risc și disciplină; statistica istorică nu garantează rezultate viitoare.</p>"),
            ("Sunt siguri brokerii parteneri?", f"<p>Toți partenerii sunt reglementați, dar entitatea juridică și autoritatea depind de țara clientului. Un client din Moldova sau din altă țară din afara SEE primește cont la această entitate:</p>{таблица_партнёров('ro')}<p>Numărul licenței poate fi verificat în registrul autorității. Detaliile complete sunt pe <a href=\"{LP}/ro/brokers\">pagina de comparație a brokerilor</a>.</p>"),
            ("Care este suma minimă pentru start?", f"<p>Depozitul minim îl stabilește brokerul:</p>{таблица_депозитов('ro')}<p>Metoda de plată poate avea propriul minim.</p>"),
            ("Ce este brief-ul de dimineață?", f"<p>Un rezumat al piețelor înainte de deschiderea sesiunii europene: cotații, evenimentele zilei și cum a reacționat piața la ele anterior, instrumentele care s-au mișcat mai larg decât de obicei și fluxul de știri marcat după credibilitate. Fiecare ediție are adresa și data sa — <a href=\"/brief/\">arhiva brief-urilor</a>. Cum se calculează cifrele — în <a href=\"{meth}\">metodologie</a>. Brief-ul nu este o recomandare.</p>"),
            ("Vindeți semnale sau dați recomandări?", не_делаем("ro")),
            ("În ce limbi lucrează compania?", "<p>Site-ul și terminalul sunt în rusă, română și engleză.</p>"),
            ("Unde se află compania?", f"<p>Sediul central: {esc(E['hq']['office'])}, {esc(E['hq']['street'])}, {esc(E['hq']['postal_code'])} {esc(E['hq']['locality'])}, Moldova. Birouri:</p>{офисы('ro')}"),
        ],
    }[яз]
    head = {
        "ru": dict(title="Вопросы и ответы — SBF Consult",
                   desc="Ответы на частые вопросы о SBF Consult: кто мы, как зарабатываем, брокеры-партнёры, минимальный депозит, обучение и утренний бриф.",
                   h1="Вопросы и ответы"),
        "en": dict(title="Frequently asked questions — SBF Consult",
                   desc="Answers to common questions about SBF Consult: who we are, how we earn, partner brokers, minimum deposit, education and the morning brief.",
                   h1="Frequently asked questions"),
        "ro": dict(title="Întrebări frecvente — SBF Consult",
                   desc="Răspunsuri la întrebările frecvente despre SBF Consult: cine suntem, cum câștigăm, brokeri parteneri, depozit minim, educație și brief.",
                   h1="Întrebări frecvente"),
    }[яз]
    head["sections"] = [("", "".join(f"<details><summary>{esc(q)}</summary>{a}</details>" for q, a in qa))]
    head["qa"] = qa
    head["schema_type"] = "FAQPage"
    return head


СОБРАТЬ = {"about": about, "team": team, "methodology": methodology, "faq": faq}


# ── Сборка страницы ──────────────────────────────────────────────────
def jsonld(стр: str, яз: str, t: dict) -> str:
    url = ДОМЕН + путь(стр, яз)
    узел = {
        "@context": "https://schema.org",
        "@type": t["schema_type"],
        "@id": url + "#page",
        "url": url,
        "name": t["title"],
        "description": t["desc"],
        "inLanguage": яз,
        "isPartOf": {"@id": ДОМЕН + "/#website"},
        "publisher": {"@id": ДОМЕН + "/#org"},
    }
    if стр == "about":
        узел["about"] = {"@id": ДОМЕН + "/#org"}
    if стр == "methodology":
        узел["headline"] = t["h1"]
        узел["author"] = {"@id": ДОМЕН + "/#org"}
    if стр == "faq":
        import re as _re
        узел["mainEntity"] = [{"@type": "Question", "name": q,
                               "acceptedAnswer": {"@type": "Answer",
                                                  "text": _re.sub(r"\s+", " ", _re.sub(r"<[^>]+>", " ", a)).strip()}}
                              for q, a in t["qa"]]
    return json.dumps(узел, ensure_ascii=False, indent=1)


def страница(стр: str, яз: str) -> str:
    t = СОБРАТЬ[стр](яз)
    assert len(t["title"]) <= 60, (стр, яз, len(t["title"]))
    assert 25 <= len(t["desc"]) <= 160, (стр, яз, len(t["desc"]))
    assert '"' not in t["desc"] and "'" not in t["desc"], (стр, яз, "кавычка ломает щуп description")
    nav = T["nav"][яз]
    alt = "".join(f'<link rel="alternate" hreflang="{л}" href="{ДОМЕН}{путь(стр, л)}">' for л in ЯЗЫКИ)
    alt += f'<link rel="alternate" hreflang="x-default" href="{ДОМЕН}{путь(стр, "ru")}">'
    тек_яз, тек_стр = ' aria-current="true"', ' aria-current="page"'
    языки = "".join(f'<a href="{путь(стр, л)}" hreflang="{л}" lang="{л}"'
                    f'{тек_яз if л == яз else ""}>{л.upper()}</a>' for л in ЯЗЫКИ)
    меню = "".join(f'<a href="{путь(s, яз)}"{тек_стр if s == стр else ""}>{nav[s]}</a>' for s in СТРАНИЦЫ)
    меню += f'<a href="/risk.html">{nav["risk"]}</a>'
    тело = []
    for h2, body in t["sections"]:
        if h2:
            тело.append(f"<h2>{esc(h2)}</h2>")
        тело.append(body)
    главная = "/" if яз == "ru" else f"/?lang={яз}"
    return f"""<!DOCTYPE html>
<html lang="{яз}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(t["title"])}</title>
<meta name="description" content="{esc(t["desc"], quote=False)}">
<link rel="canonical" href="{ДОМЕН}{путь(стр, яз)}">
{alt}
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SBF Consult">
<meta property="og:title" content="{esc(t["title"])}">
<meta property="og:description" content="{esc(t["desc"], quote=False)}">
<meta property="og:url" content="{ДОМЕН}{путь(стр, яз)}">
<link rel="icon" href="/assets/logo/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/pages.css">
<script type="application/ld+json">
{jsonld(стр, яз, t)}
</script>
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="{главная}">SBF <span>Consult</span></a><span class="langs">{языки}</span></header>
<nav class="pages" aria-label="SBF Consult">{меню}</nav>
<main>
<h1>{esc(t["h1"])}</h1>
{"".join(тело)}
</main>
<footer><p>{T["footer"][яз]}</p><p>{реквизиты_строка(яз)}</p></footer>
</div>
</body>
</html>
"""


def обновить_снимок(src: Path) -> None:
    d = json.loads(src.read_text(encoding="utf-8"))
    out = {"_meta": {"note": "Снимок полей из market-intel/web/data/partners.json для страниц /about и /faq. "
                             "Источник истины — partners.json; пересобирать tools/build_pages.py --partners <путь>."},
           "partners": []}
    for p in d["partners"]:
        md = p.get("min_deposit") or {}
        out["partners"].append({
            "id": p["id"], "name": p["name"], "lp_url": f"{LP}/brokers/{p['id']}",
            "min_deposit": {k: md.get(k) for k in ("value", "currency", "published", "checked", "source")},
            "entities": [{k: e.get(k) for k in ("legal_name", "jurisdiction", "regulator", "licence_no", "serves")}
                         for e in p.get("entities", [])]})
    СНИМОК.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


def main() -> int:
    р = argparse.ArgumentParser()
    р.add_argument("--partners", type=Path, help="путь к market-intel/web/data/partners.json — обновить снимок")
    а = р.parse_args()
    if а.partners:
        обновить_снимок(а.partners)
    n = 0
    for стр in СТРАНИЦЫ:
        for яз in ЯЗЫКИ:
            выход = КОРЕНЬ / путь(стр, яз).strip("/") / "index.html"
            выход.parent.mkdir(parents=True, exist_ok=True)
            выход.write_text(страница(стр, яз), encoding="utf-8")
            n += 1
    print(f"собрано страниц: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
