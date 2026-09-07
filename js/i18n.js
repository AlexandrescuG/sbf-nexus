/**
 * i18n.js — Двуязычная система SBF (RU / EN).
 * Инициализируется синхронно, применяет переводы после DOMContentLoaded.
 * Автоопределение по navigator.language, ручное — localStorage.
 */

/* ── Локали ─────────────────────────────────────────────── */
const _LOCALES = {

/* ═══════════════════════════════ РУССКИЙ ════════════════════════════════ */
ru: {
  page_title: 'SBF Consult — Мы распознаём закономерности',
  nav: {
    analytics: 'Аналитика',
    trading:   'Торговля',
    team:      'Команда',
    contacts:  'Контакты',
    platform:  'Платформа',
    menu_aria: 'Меню',
    nav_aria:  'Навигация по разделам',
  },
  dots: ['Карта','Платформа','Подход','Платформа','PRO-оффер','Память рынков','Обучение','Сопровождение','Управление','Контакты'],
  ticker: { loading: 'Рыночная сводка обновляется' },
  hero: {
    headline:  'Мир генерирует шум.<br><em>Мы распознаём закономерности</em>.',
    subline:   'SBF Company SRL · Кишинёв<br>Анализ от экспертов, сопровождение торговых счетов, доверительное управление через партнёров с лицензиями ЕС.',
    trust:     'Bloomberg LEI · Эксперты с опытом 10–25 лет · Партнёры с лицензиями ЕС',
    cta1:        'Открыть платформу →',
    cta2:        'Связаться',
    promo_badge: 'БЕСПЛАТНАЯ РЕГИСТРАЦИЯ · 30 ДНЕЙ PRO ЗА ОПРОС ТРЕЙДЕРА · БЕЗ АВТОСПИСАНИЯ',
    scroll:      'Прокрутите вниз',
    kicker:      'SBF Company SRL · Кишинёв',
    sub:         'Анализ от экспертов, сопровождение торговых счетов, доверительное управление через партнёров с лицензиями ЕС.',
    side_t:      'Старт без риска',
    side_h:      'Опрос трейдера — 30 дней PRO',
    side_p:      'Карта не нужна. Автосписания нет. ~3 минуты.',
    side_go:     'Начать →',
  },
  grow: {
    eyebrow:  'ПЛАТФОРМА · LP.SBFCONSULT.COM',
    heading:  'Что выходит из шума',
    lead:     'Первый экран — поток мировых событий. Здесь — то, во что он превращается.',
    c1: { tag: 'КАЖДОЕ УТРО',    title: 'Утренний бриф',        desc: 'Сводка по рынкам до открытия европейской сессии: что случилось за ночь и на что это влияет.' },
    c2: { tag: 'ПО ИНСТРУМЕНТУ', title: 'Анализ актива',        desc: 'Уровни, паттерны и структура рынка по выбранному инструменту — на всех таймфреймах от M1 до W1.' },
    c3: { tag: 'С ИСТОРИЕЙ',     title: 'Библиотека паттернов', desc: 'Каждый паттерн — с посчитанной статистикой срабатываний, а не с картинкой из учебника.' },
    c4: { tag: 'ВАШИ СДЕЛКИ',    title: 'Журнал сделок',        desc: 'Дисциплин-скор, контроль риска на сделку и разбор ошибок. Лидерборд по XP — не по прибыли.' },
    open_h:    'Терминал открыт весь. Аккаунт добавляет своё',
    open_p:    'Котировки, графики и библиотека паттернов работают без регистрации и останутся такими.',
    logo_hint: 'Нажмите на знак — откроется платформа',
    cta:       'Открыть платформу →',
  },
  approach: {
    lens_cap: 'Снаружи — шум. Внутри — уровни, средняя, паттерн',
    eyebrow: 'Комплексный подход',
    heading: 'Индивидуальные финансовые решения для вашего будущего',
    p1: 'Наша команда с международным опытом предоставляет услуги финансового обучения на всех видах рынков: фондовых, валютных, товарных, а также рынке деривативов и криптовалют.',
    p2: 'Мы предлагаем инструменты и стратегии, учитывая индивидуальные цели клиентов. Особый акцент делается на анализе рынков и профессиональном обучении для уверенных финансовых решений.',
  },
  platform: {
    cta: 'ОТКРЫТЬ ПЛАТФОРМУ →',
    p1: {
      key_cap: 'Знак — вход. Нажмите, чтобы открыть терминал',
      eyebrow: 'ПЛАТФОРМА · LP.SBFCONSULT.COM',
      heading: 'Терминал, журнал и академия — в одном месте',
      lead:    'Рабочее пространство трейдера: утренний рыночный синтез, журнал сделок с аналитикой дисциплины, учебная программа и цели. Без рекомендаций — только структура и данные для ваших собственных решений.',
      f1t: 'Журнал сделок',       f1d: 'Статистика, сезоны торговли с итоговыми отчётами, разбор ошибок.',
      f2t: 'Утренний синтез',     f2d: 'Аналитическая сводка по рынкам каждое утро до открытия европейской сессии.',
      f3t: 'SBF Academy',         f3d: 'Учебные главы от основ до продвинутых тем. Прогресс сохраняется.',
      f4t: 'Цели и дисциплина',   f4d: 'Стрики ведения журнала, контроль риска на сделку, дисциплин-скор. Лидерборд по XP — не по прибыли.',
    },
    p2: {
      eyebrow: 'СТАРТ БЕЗ РИСКА',
      heading: 'Пройди опрос трейдера — получи 30 дней PRO',
      body:    'Расскажи о своём опыте, целях и отношении к риску — платформа персонализирует рекомендации по обучению, а PRO-доступ активируется на 30 дней. Карта не нужна. Автосписания нет.',
      s1:      'Регистрация — 2 шага, email + пароль.',
      s2:      'Опрос — блоки «Опыт · Цели · Риск», ~3 минуты.',
      s3:      '«Твой путь» — персональные рекомендации + бейдж PRO.',
      cta:     'НАЧАТЬ →',
      fine:    'Сервис доступен пользователям 18+. PRO-доступ активируется однократно за прохождение опроса.',
      ref:     'Реферальный код — в профиле. Пригласи трейдера — обоим +7 дней PRO.',
    },
  },
  market: {
    eyebrow:        'ПАМЯТЬ РЫНКОВ',
    heading:        'Каждое движение оставляет паттерн',
    cta_platform:   'Смотреть живую аналитику →',
    hist_disclaimer:'Историческая статистика не гарантирует будущих результатов и не является рекомендацией.',
    prev:           'Предыдущий кейс',
    next:    'Следующий кейс',
    eurusd: {
      meta:    'EUR/USD · FOREX · 30M',
      title:   'EUR/USD — Выходной гэп',
      desc:    'Май 2026. Пятница 22 мая: закрытие 1.1605. Понедельник 26 мая: открытие 1.1644. Гэп +39 пунктов — постепенное закрытие за 1,5 недели.',
      pattern: 'ПАТТЕРН: GAP & FILL',
      note:    'Выходные гэпы на ликвидных форекс-парах закрываются в ~75% случаев в течение 1–2 недель. Устойчивый среднесрочный статистический паттерн.',
    },
    gold_tri: {
      meta:    'XAU/USD · COMEX · 1H',
      title:   'Золото — Пробой треугольника',
      desc:    'Май 2026. Симметричное сжатие 20–27 мая, апекс треугольника на ~$4,440. Пробой вверх 28 мая с ускорением к $4,627.',
      pattern: 'ПАТТЕРН: СИММЕТРИЧНЫЙ ТРЕУГОЛЬНИК',
      note:    'Заужение ценового диапазона с пробоем апекса формирует направленный импульс. Паттерн накопления с измеримой проекцией движения.',
    },
    gold_bol: {
      meta:    'XAU/USD · COMEX · 1H',
      title:   'Золото — Сжатие Боллинджера',
      desc:    'Май 2026. После консолидации полосы Боллинджера сжались до минимума на ~$4,700. Двойной пробой вниз к $4,395.',
      pattern: 'ПАТТЕРН: BOLLINGER SQUEEZE',
      note:    'Заужение полос Боллинджера предшествует направленному движению. Сторона пробоя определяет направление импульса. Исторический пример нисходящего сценария.',
    },
    jpy: {
      meta:    'USD/JPY · FOREX · 30M',
      title:   'Иена — Зона интервенции',
      desc:    'Июнь 2026. USD/JPY достигла уровня 160.09 — исторической зоны интервенций Банка Японии. Разворот от круглого сопротивления.',
      pattern: 'ПАТТЕРН: КРУГЛЫЙ УРОВЕНЬ + РАЗВОРОТ',
      note:    'Уровень 160 — зона исторической активности BOJ. Коррекция 50–70% от предшествующего движения наблюдается как историческая закономерность у таких уровней.',
    },
    copper: {
      meta:    'COPPER · CME · 4H',
      title:   'Медь — Пробой восходящего канала',
      desc:    'Март–июнь 2026. Восходящий канал с 18 марта. Ложные пробои 10 апреля и 11 мая с возвратом в канал.',
      pattern: 'ПАТТЕРН: ЦЕНОВОЙ КАНАЛ + ЛОЖНЫЙ ПРОБОЙ',
      note:    'Двойной ложный пробой верхней границы канала с возвратом — статистически значимый признак ослабления тренда. Два подтверждения повышают надёжность паттерна.',
    },
  },
  svc: {
    logo_issue: 'Знак замыкает круг — опрос превращается в доступ',
    logo_lvl1:  'Треть кольца — столько работы на нашей стороне',
    logo_lvl2:  'Две трети — счёт ведём мы, решения за вами',
    logo_lvl3:  'Кольцо замкнуто — управление на нашей стороне',
    target_label:    'КОМУ ПОДХОДИТ',
    partner_label:   'ПАРТНЁРЫ УРОВНЯ',
    partner_label_s: 'ПАРТНЁР УРОВНЯ',
    s1: {
      title:           'Обучение',
      target:          'Для тех, кто разбирается в инструментах рынка самостоятельно',
      desc:            'Образовательные программы и аналитические материалы: основы рынков, выбор брокерской инфраструктуры, разбор торговых подходов. Без инвестиционных рекомендаций.',
      avatrade_meta:   'MT4 · MT5 · Встроенное обучение',
      xm_meta:         'MT4 · MT5 · WebTrader',
      cta_platform:    'Открыть платформу обучения →',
    },
    s2: {
      title:           'Сопровождение счёта',
      target:          'Для активных клиентов с собственным капиталом',
      desc:            'Сопровождение торгового счёта клиента: обзор позиций, информационная поддержка, статистические наблюдения. Решения принимает клиент.',
      naga_meta:       'CySEC · MT4/MT5 · 4000+ инструментов',
      instaforex_meta: 'CySEC · MT4/MT5 · от $100 депозит',
    },
    s3: {
      title:           'Доверительное управление',
      target:          'Для тех, кто доверяет управление профессионалам',
      desc:            'Полное управление капиталом по согласованной с клиентом стратегии в рамках партнёрского контракта с брокером. Прозрачная отчётность, согласованный риск-профиль, регулярные ревизии.',
      desc_m:          'Полное управление капиталом по согласованной стратегии в рамках партнёрского контракта с брокером. Прозрачная отчётность, регулярные ревизии.',
      fxpro_meta:      'FCA · CySEC · 5 регуляторов',
    },
  },
  team: {
    eyebrow:     'КОМАНДА И НЕЙРО-ИИ',
    heading:     'Эксперты, усиленные искусственным интеллектом',
    lead:        'Международный опыт аналитиков + собственный мультимодельный аналитический контур, работающий 24/7. Каждый материал проходит двойную верификацию: модели → человек.',
    mob_heading: 'Эксперты,<br>усиленные ИИ',
  },
  contact: {
    ch:      'Швейцария',
    pt:      'Португалия',
    md:      'Молдова',
    ae:      'ОАЭ',
    eyebrow:      'СВЯЖИТЕСЬ С НАМИ',
    heading:      'Готовы обсудить ваш капитал',
    phone:        'Телефон',
    email:        'Email',
    cta:          'ОСТАВИТЬ ЗАЯВКУ',
    platform_cta: 'Работать с платформой самостоятельно →',
  },
  svc_du_disclaimer: 'SBF Company SRL не является лицензированным управляющим активами. Услуга реализуется исключительно через партнёров, регулируемых в ЕС (FCA, CySEC). SBF выступает консультантом и не принимает клиентские средства на свои счета.',
  risk_warning: 'Торговля CFD и маржинальными инструментами сопряжена с высоким риском потери капитала и подходит не всем инвесторам.',
  sticky: 'Связаться',
  modal: {
    eyebrow:     'ОСТАВИТЬ ЗАЯВКУ',
    heading:     'Наш специалист свяжется с вами в течение часа',
    close_aria:  'Закрыть',
    name:        'Имя',
    email:       'Email',
    phone:       'Телефон — необязательно',
    gdpr:        'Согласен на обработку персональных данных',
    submit:      'ОТПРАВИТЬ ЗАЯВКУ',
    submitting:  'ОТПРАВКА…',
    divider:     'или напишите напрямую',
    tg:          '✈ НАПИСАТЬ В TELEGRAM',
    success_h:   'Заявка отправлена',
    success_p:   'Мы свяжемся с вами в течение часа',
    book_btn:    '📖 Скачать книгу по трейдингу',
    error_p:     'Не удалось отправить. Напишите напрямую:',
  },
  partner: {
    goto:      'Перейти на сайт →',
    section1:  'Основные сведения',
    section2:  'Лицензии и регулирование',
    section3:  'Торговая инфраструктура',
    section4:  'Пополнение и хранение средств',
    founded:   'Год основания',
    hq:        'Штаб-квартира',
    clients:   'Клиентская база',
    platforms: 'Платформы',
    deposit:   'Минимальный депозит',
    leverage:  'Максимальное плечо',
    spreads:   'Спреды',
    instr:     'Инструменты',
    methods:   'Методы пополнения',
    inactivity:'Комиссия за неактивность',
    custody:   'Хранение средств',
    data: {
      avatrade: {
        tagline:      'Один из крупнейших регулируемых брокеров мира',
        founded:      '2006',
        hq:           'Дублин, Ирландия',
        licenses:     ['Central Bank of Ireland — № C53877','ASIC (Австралия) — № 406684','FSCA (ЮАР) — № 45984','FSC (Британские Виргинские о-ва) — Ava Trade Markets Ltd (номер лицензии реестром не публикуется)','JFSA (Япония) — № 1662 + FFAJ № 1574','ADGM (ОАЭ), KNF (Польша), ISA (Израиль)'],
        platforms:    'MT4, MT5, AvaTradeGO, AvaSocial',
        minDeposit:   '$100',
        maxLeverage:  '1:30 (ЕС) / до 1:400 (БВО)',
        spreads:      'от 0.9 пунктов EUR/USD',
        funding:      'Банковские карты, банковский перевод, Skrill, Neteller, PerfectMoney',
        inactivityFee:'$50 после 3 месяцев бездействия',
      },
      xm: {
        tagline:     'Группа с лицензией CySEC с 2010 года',
        founded:     '2010 (дата лицензии CySEC 120/10)',
        hq:          'Лимасол, Кипр (ЕС) / Белиз-Сити (международно)',
        licenses:    ['CySEC (Кипр) — № 120/10, Trading Point of Financial Instruments Ltd','DFSA (ОАЭ, DIFC) — № F003484, Trading Point MENA Ltd','FSC (Белиз) — № 8557558, XM Global Ltd (по данным брокера)'],
        platforms:   'MT4, MT5, MT5 WebTrader, XM App',
        minDeposit:  '$5 (Standard, Ultra Low)',
        maxLeverage: '1:30 (ЕС) / до 1:1000 (Белиз)',
        spreads:     'средний 2,0 пункта EUR/USD (Standard, по данным XM)',
        inactivityFee: '$5 в месяц после 90 дней бездействия',
      },
      naga: {
        tagline:     'Немецкая fintech-платформа, листинг на Frankfurt Stock Exchange',
        founded:     '2015 (NAGA Group AG)',
        hq:          'Гамбург, Германия / Лимасол, Кипр',
        licenses:    ['CySEC (Кипр) — № 204/13','FSA (Сейшелы) — № SD026 (NAGA Capital Ltd)','Публичная компания на Frankfurt Stock Exchange (тикер N4G)'],
        platforms:   'MT4, MT5, NAGA App, веб-платформа',
        minDeposit:  '$250',
        maxLeverage: '1:30 (EU) / до 1:1000 (международно)',
        spreads:     'от 0.9 пунктов EUR/USD',
        funding:     'Банковские карты, банковский перевод, Skrill, Neteller, крипто',
        instruments: '4 000+ инструментов, социальный трейдинг',
      },
      instaforex: {
        tagline:     '7+ миллионов клиентов в 190 странах',
        founded:     '2007',
        hq:          'Лимасол, Кипр (EU) / Британские Виргинские о-ва (международно)',
        licenses:    ['CySEC (Кипр) — № 266/15 (Instant Trading EU Ltd)','BVI FSC (Британские Виргинские о-ва) — № SIBA/L/14/1082 (InstaFinance Ltd)','Регистрация: ЦБ Чехии, ЦБ Словакии, KNF (Польша)'],
        platforms:   'MT4, MT5, WebTrader, MultiTerminal',
        minDeposit:  'от $100',
        maxLeverage: '1:30 (EU) / до 1:1000 (BVI)',
        spreads:     'от 3 пунктов EUR/USD (стандартный счёт)',
        funding:     'Банковские карты, банковский перевод, Skrill, Neteller, крипто, локальные методы',
        instruments: 'Forex, акции, индексы, металлы, энергия, крипто',
      },
      fxpro: {
        tagline:     'Регулируется пятью авторитетными юрисдикциями',
        founded:     '2006',
        hq:          'Лимасол, Кипр',
        licenses:    ['FCA (Великобритания) — № 509956','CySEC (Кипр) — № 078/07','FSCA (ЮАР) — FSP № 45052','SCB (Багамы) — № SIA-F184','FSA (Сейшелы) — № SD120'],
        platforms:   'FxPro Platform, MT4, MT5, cTrader',
        minDeposit:  '$100',
        maxLeverage: '1:30 (FCA/CySEC) / до 1:200 (SCB/FSA)',
        spreads:     'от 0.6 пунктов EUR/USD (Raw+)',
        funding:     'Банковские карты, банковский перевод, Skrill, Neteller, PayPal',
        funds:       'Клиентские средства хранятся в Barclays Bank, Julius Baer, Royal Bank of Scotland',
        clients:     '800 000+ клиентов',
      },
    },
  },
},

/* ══════════════════════════════ ENGLISH ════════════════════════════════ */
en: {
  page_title: 'SBF Consult — We recognise patterns',
  nav: {
    analytics: 'Analytics',
    trading:   'Trading',
    team:      'Team',
    contacts:  'Contacts',
    platform:  'Platform',
    menu_aria: 'Menu',
    nav_aria:  'Section navigation',
  },
  dots: ['Map','Platform','Approach','Platform','PRO Offer','Market Memory','Education','Account Support','Management','Contacts'],
  ticker: { loading: 'Market summary is updating' },
  hero: {
    headline:  'The world generates noise.<br><em>We recognise patterns</em>.',
    subline:   'SBF Company SRL · Chișinău<br>Expert analysis, trading account support, and discretionary management through EU-licensed partners.',
    trust:     'Bloomberg LEI · Experts with 10–25 years of experience · EU-licensed partners',
    cta1:        'Open Platform →',
    cta2:        'Contact Us',
    promo_badge: 'FREE REGISTRATION · 30 DAYS PRO FOR TRADER SURVEY · NO AUTO-CHARGE',
    scroll:      'Scroll down',
    kicker:      'SBF Company SRL · Chișinău',
    sub:         'Expert analysis, trading account support, and discretionary management through EU-licensed partners.',
    side_t:      'Risk-free start',
    side_h:      'Trader survey — 30 days PRO',
    side_p:      'No card needed. No auto-charge. ~3 minutes.',
    side_go:     'Start →',
  },
  grow: {
    eyebrow:  'PLATFORM · LP.SBFCONSULT.COM',
    heading:  'What comes out of the noise',
    lead:     'The first screen is a stream of world events. This is what it turns into.',
    c1: { tag: 'EVERY MORNING',  title: 'Morning brief',   desc: 'A market summary before the European session opens: what happened overnight and what it affects.' },
    c2: { tag: 'PER INSTRUMENT', title: 'Asset analysis',  desc: 'Levels, patterns and market structure for the chosen instrument — across every timeframe from M1 to W1.' },
    c3: { tag: 'WITH HISTORY',   title: 'Pattern library', desc: 'Every pattern comes with measured hit statistics, not a textbook picture.' },
    c4: { tag: 'YOUR TRADES',    title: 'Trading journal', desc: 'Discipline score, per-trade risk control and mistake review. The leaderboard runs on XP, not profit.' },
    open_h:    'The terminal is fully open. An account adds to it',
    open_p:    'Quotes, charts and the pattern library work without registration — and will stay that way.',
    logo_hint: 'Click the mark — the platform opens',
    cta:       'Open the platform →',
  },
  approach: {
    lens_cap: 'Outside — noise. Inside — levels, average, pattern',
    eyebrow: 'Comprehensive Approach',
    heading: 'Individual financial solutions for your future',
    p1: 'Our internationally experienced team provides financial education services across equity, currency, commodity, derivative, and cryptocurrency markets.',
    p2: 'We offer tools and strategies tailored to individual client goals, with a strong emphasis on market analysis and professional education for confident financial decisions.',
  },
  platform: {
    cta: 'OPEN PLATFORM →',
    p1: {
      key_cap: 'The mark is the entrance. Click to open the terminal',
      eyebrow: 'PLATFORM · LP.SBFCONSULT.COM',
      heading: 'Terminal, journal and academy — in one place',
      lead:    'Trader\'s workspace: morning market synthesis, trade journal with discipline analytics, study programme and goals. No recommendations — only structure and data for your own decisions.',
      f1t: 'Trade Journal',       f1d: 'Statistics, trading seasons with summary reports, error analysis.',
      f2t: 'Morning Synthesis',   f2d: 'Analytical market briefing every morning before the European session opens.',
      f3t: 'SBF Academy',         f3d: 'Educational chapters from basics to advanced topics. Progress is saved.',
      f4t: 'Goals & Discipline',  f4d: 'Journal streaks, per-trade risk control, discipline score. Leaderboard by XP — not by profit.',
    },
    p2: {
      eyebrow: 'RISK-FREE START',
      heading: 'Complete the trader survey — get 30 days PRO',
      body:    'Tell us about your experience, goals and risk attitude — the platform personalises learning recommendations, and PRO access is activated for 30 days. No card required. No auto-charge.',
      s1:      'Registration — 2 steps, email + password.',
      s2:      'Survey — blocks «Experience · Goals · Risk», ~3 minutes.',
      s3:      '«Your Path» — personalised recommendations + PRO badge.',
      cta:     'GET STARTED →',
      fine:    'Service available to users 18+. PRO access activated once per survey completion.',
      ref:     'Referral code — in your profile. Invite a trader — both get +7 days PRO.',
    },
  },
  market: {
    eyebrow:        'MARKET MEMORY',
    heading:        'Every move leaves a pattern',
    cta_platform:   'View live analytics →',
    hist_disclaimer:'Past statistical patterns do not guarantee future results and do not constitute a recommendation.',
    prev:           'Previous case',
    next:    'Next case',
    eurusd: {
      meta:    'EUR/USD · FOREX · 30M',
      title:   'EUR/USD — Weekend Gap',
      desc:    'May 2026. Friday 22 May close: 1.1605. Monday 26 May open: 1.1644. Gap +39 pips — gradual fill over 1.5 weeks.',
      pattern: 'PATTERN: GAP & FILL',
      note:    'Weekend gaps on liquid forex pairs close in ~75% of cases within 1–2 weeks. A reliable medium-term statistical pattern.',
    },
    gold_tri: {
      meta:    'XAU/USD · COMEX · 1H',
      title:   'Gold — Triangle Breakout',
      desc:    'May 2026. Symmetrical squeeze 20–27 May, triangle apex at ~$4,440. Upside breakout 28 May with acceleration to $4,627.',
      pattern: 'PATTERN: SYMMETRICAL TRIANGLE',
      note:    'Price range contraction with an apex breakout creates a directional impulse. An accumulation pattern with a measurable projection.',
    },
    gold_bol: {
      meta:    'XAU/USD · COMEX · 1H',
      title:   'Gold — Bollinger Squeeze',
      desc:    'May 2026. Following consolidation, Bollinger Bands squeezed to a minimum at ~$4,700. Double downside breakout to $4,395.',
      pattern: 'PATTERN: BOLLINGER SQUEEZE',
      note:    'Bollinger Band contraction precedes directional movement. The breakout side determines the direction of the impulse. A historical example of a bearish scenario.',
    },
    jpy: {
      meta:    'USD/JPY · FOREX · 30M',
      title:   'Yen — Intervention Zone',
      desc:    'June 2026. USD/JPY reached 160.09 — the Bank of Japan\'s historical intervention zone. Reversal from round-number resistance.',
      pattern: 'PATTERN: ROUND LEVEL + REVERSAL',
      note:    'The 160 level is a zone of historical BOJ activity. A 50–70% retracement of the preceding move has been observed as a historical tendency at such levels.',
    },
    copper: {
      meta:    'COPPER · CME · 4H',
      title:   'Copper — Ascending Channel Breakout',
      desc:    'March–June 2026. Ascending channel since 18 March. False breakouts on 10 April and 11 May with return into the channel.',
      pattern: 'PATTERN: PRICE CHANNEL + FALSE BREAKOUT',
      note:    'A double false breakout of the channel\'s upper boundary with a return — a statistically significant indicator of trend weakening. Two confirmations increase pattern reliability.',
    },
  },
  svc: {
    logo_issue: 'The mark closes the circle — the survey becomes access',
    logo_lvl1:  'A third of the ring — that much is on our side',
    logo_lvl2:  'Two thirds — we run the account, you make the calls',
    logo_lvl3:  'The ring is closed — management is on our side',
    target_label:    'WHO IT\'S FOR',
    partner_label:   'LEVEL PARTNERS',
    partner_label_s: 'LEVEL PARTNER',
    s1: {
      title:           'Education',
      target:          'For those who learn the markets independently',
      desc:            'Educational programmes and analytical materials: market fundamentals, choosing brokerage infrastructure, review of trading approaches. No investment recommendations.',
      avatrade_meta:   'MT4 · MT5 · Built-in education',
      xm_meta:         'MT4 · MT5 · WebTrader',
      cta_platform:    'Open learning platform →',
    },
    s2: {
      title:           'Account Support',
      target:          'For active clients with their own capital',
      desc:            'Trading account support: position review, informational support, statistical observations. The client makes all decisions.',
      naga_meta:       'CySEC · MT4/MT5 · 4,000+ instruments',
      instaforex_meta: 'CySEC · MT4/MT5 · from $100 deposit',
    },
    s3: {
      title:           'Discretionary Management',
      target:          'For those who entrust management to professionals',
      desc:            'Full capital management under a client-agreed strategy within a partnership contract with the broker. Transparent reporting, agreed risk profile, regular reviews.',
      desc_m:          'Full capital management under an agreed strategy within a partnership contract with the broker. Transparent reporting, regular reviews.',
      fxpro_meta:      'FCA · CySEC · 5 regulators',
    },
  },
  team: {
    eyebrow:     'TEAM & NEURO-AI',
    heading:     'Experts amplified by artificial intelligence',
    lead:        'International experience of analysts + proprietary multi-model analytical layer operating 24/7. Every piece of content passes dual verification: models → human.',
    mob_heading: 'Experts<br>amplified by AI',
  },
  contact: {
    ch:      'Switzerland',
    pt:      'Portugal',
    md:      'Moldova',
    ae:      'UAE',
    eyebrow:      'CONTACT US',
    heading:      'Ready to discuss your capital',
    phone:        'Phone',
    email:        'Email',
    cta:          'REQUEST A CALLBACK',
    platform_cta: 'Self-service on the platform →',
  },
  svc_du_disclaimer: 'SBF Company SRL is not a licensed asset manager. The service is provided exclusively through EU-regulated partners (FCA, CySEC). SBF acts as a consultant and does not accept client funds into its own accounts.',
  risk_warning: 'Trading CFDs and margined instruments carries a high risk of capital loss and may not be suitable for all investors.',
  sticky: 'Contact',
  modal: {
    eyebrow:     'REQUEST A CALLBACK',
    heading:     'Our specialist will contact you within an hour',
    close_aria:  'Close',
    name:        'Name',
    email:       'Email',
    phone:       'Phone — optional',
    gdpr:        'I consent to the processing of personal data',
    submit:      'SEND REQUEST',
    submitting:  'SENDING…',
    divider:     'or write to us directly',
    tg:          '✈ WRITE ON TELEGRAM',
    success_h:   'Request sent',
    success_p:   'We will contact you within an hour',
    book_btn:    '📖 Download Trading Book',
    error_p:     'Failed to send. Please contact us directly:',
  },
  partner: {
    goto:      'Visit website →',
    section1:  'Key Facts',
    section2:  'Licences & Regulation',
    section3:  'Trading Infrastructure',
    section4:  'Funding & Custody',
    founded:   'Founded',
    hq:        'Headquarters',
    clients:   'Client Base',
    platforms: 'Platforms',
    deposit:   'Minimum Deposit',
    leverage:  'Maximum Leverage',
    spreads:   'Spreads',
    instr:     'Instruments',
    methods:   'Funding Methods',
    inactivity:'Inactivity Fee',
    custody:   'Fund Custody',
    data: {
      avatrade: {
        tagline:      'One of the world\'s largest regulated brokers',
        founded:      '2006',
        hq:           'Dublin, Ireland',
        licenses:     ['Central Bank of Ireland — № C53877','ASIC (Australia) — № 406684','FSCA (South Africa) — № 45984','FSC (British Virgin Islands) — Ava Trade Markets Ltd (licence number not published by the registry)','JFSA (Japan) — № 1662 + FFAJ № 1574','ADGM (UAE), KNF (Poland), ISA (Israel)'],
        platforms:    'MT4, MT5, AvaTradeGO, AvaSocial',
        minDeposit:   '$100',
        maxLeverage:  '1:30 (EU) / up to 1:400 (BVI)',
        spreads:      'from 0.9 pips EUR/USD',
        funding:      'Bank cards, wire transfer, Skrill, Neteller, PerfectMoney',
        inactivityFee:'$50 after 3 months of inactivity',
      },
      xm: {
        tagline:     'Group licensed by CySEC since 2010',
        founded:     '2010 (CySEC licence 120/10 date)',
        hq:          'Limassol, Cyprus (EU) / Belize City (international)',
        licenses:    ['CySEC (Cyprus) — № 120/10, Trading Point of Financial Instruments Ltd','DFSA (UAE, DIFC) — № F003484, Trading Point MENA Ltd','FSC (Belize) — № 8557558, XM Global Ltd (per broker)'],
        platforms:   'MT4, MT5, MT5 WebTrader, XM App',
        minDeposit:  '$5 (Standard, Ultra Low)',
        maxLeverage: '1:30 (EU) / up to 1:1000 (Belize)',
        spreads:     'average 2.0 pips EUR/USD (Standard, per XM)',
        inactivityFee: '$5/month after 90 days of inactivity',
      },
      naga: {
        tagline:     'German fintech platform listed on Frankfurt Stock Exchange',
        founded:     '2015 (NAGA Group AG)',
        hq:          'Hamburg, Germany / Limassol, Cyprus',
        licenses:    ['CySEC (Cyprus) — № 204/13','FSA (Seychelles) — № SD026 (NAGA Capital Ltd)','Public company on Frankfurt Stock Exchange (ticker N4G)'],
        platforms:   'MT4, MT5, NAGA App, web platform',
        minDeposit:  '$250',
        maxLeverage: '1:30 (EU) / up to 1:1000 (international)',
        spreads:     'from 0.9 pips EUR/USD',
        funding:     'Bank cards, wire transfer, Skrill, Neteller, crypto',
        instruments: '4,000+ instruments, social trading',
      },
      instaforex: {
        tagline:     '7+ million clients in 190 countries',
        founded:     '2007',
        hq:          'Limassol, Cyprus (EU) / British Virgin Islands (international)',
        licenses:    ['CySEC (Cyprus) — № 266/15 (Instant Trading EU Ltd)','BVI FSC (British Virgin Islands) — № SIBA/L/14/1082 (InstaFinance Ltd)','Registered: CNB (Czech Republic), NBS (Slovakia), KNF (Poland)'],
        platforms:   'MT4, MT5, WebTrader, MultiTerminal',
        minDeposit:  'from $100',
        maxLeverage: '1:30 (EU) / up to 1:1000 (BVI)',
        spreads:     'from 3 pips EUR/USD (standard account)',
        funding:     'Bank cards, wire transfer, Skrill, Neteller, crypto, local payment methods',
        instruments: 'Forex, equities, indices, metals, energy, crypto',
      },
      fxpro: {
        tagline:     'Regulated in five authoritative jurisdictions',
        founded:     '2006',
        hq:          'Limassol, Cyprus',
        licenses:    ['FCA (United Kingdom) — № 509956','CySEC (Cyprus) — № 078/07','FSCA (South Africa) — FSP № 45052','SCB (Bahamas) — № SIA-F184','FSA (Seychelles) — № SD120'],
        platforms:   'FxPro Platform, MT4, MT5, cTrader',
        minDeposit:  '$100',
        maxLeverage: '1:30 (FCA/CySEC) / up to 1:200 (SCB/FSA)',
        spreads:     'from 0.6 pips EUR/USD (Raw+)',
        funding:     'Bank cards, wire transfer, Skrill, Neteller, PayPal',
        funds:       'Client funds held at Barclays Bank, Julius Baer, Royal Bank of Scotland',
        clients:     '800,000+ clients',
      },
    },
  },
},

/* ══════════════════════════════ ROMÂNĂ ════════════════════════════════ */
ro: {
  page_title: 'SBF Consult — Recunoaștem tipare',
  nav: {
    analytics: 'Analiză',
    trading:   'Tranzacționare',
    team:      'Echipă',
    contacts:  'Contacte',
    platform:  'Platformă',
    menu_aria: 'Meniu',
    nav_aria:  'Navigare pe secțiuni',
  },
  dots: ['Hartă','Platformă','Abordare','Platformă','Ofertă PRO','Memoria Piețelor','Educație','Suport Cont','Management','Contacte'],
  ticker: { loading: 'Sinteza pieței se actualizează' },
  hero: {
    headline:    'Lumea generează zgomot.<br><em>Noi recunoaștem tipare</em>.',
    subline:     'SBF Company SRL · Chișinău<br>Analiză de specialitate, suport pentru conturi de tranzacționare și management discreționare prin parteneri autorizați UE.',
    trust:       'Bloomberg LEI · Experți cu 10–25 ani experiență · Parteneri licențiați UE',
    cta1:        'Deschide Platforma →',
    cta2:        'Contactează-ne',
    promo_badge: 'ÎNREGISTRARE GRATUITĂ · 30 ZILE PRO PENTRU SONDAJ TRADER · FĂRĂ ABONAMENT AUTO',
    scroll:      'Derulați în jos',
    kicker:      'SBF Company SRL · Chișinău',
    sub:         'Analiză de la experți, asistență pentru conturi de tranzacționare și administrare discreționară prin parteneri licențiați în UE.',
    side_t:      'Start fără risc',
    side_h:      'Chestionar trader — 30 de zile PRO',
    side_p:      'Fără card. Fără debitare automată. ~3 minute.',
    side_go:     'Începe →',
  },
  grow: {
    eyebrow:  'PLATFORMA · LP.SBFCONSULT.COM',
    heading:  'Ce iese din zgomot',
    lead:     'Primul ecran este fluxul evenimentelor mondiale. Aici este ceea ce devine el.',
    c1: { tag: 'ÎN FIECARE DIMINEAȚĂ', title: 'Brief de dimineață',     desc: 'Sinteza piețelor înainte de deschiderea sesiunii europene: ce s-a întâmplat peste noapte și ce influențează.' },
    c2: { tag: 'PE INSTRUMENT',        title: 'Analiza activului',      desc: 'Niveluri, tipare și structura pieței pentru instrumentul ales — pe toate intervalele, de la M1 la W1.' },
    c3: { tag: 'CU ISTORIC',           title: 'Biblioteca de tipare',   desc: 'Fiecare tipar vine cu statistica măsurată a declanșărilor, nu cu o imagine din manual.' },
    c4: { tag: 'TRANZACȚIILE TALE',    title: 'Jurnalul de tranzacții', desc: 'Scor de disciplină, control al riscului pe tranzacție și analiza greșelilor. Clasamentul merge pe XP, nu pe profit.' },
    open_h:    'Terminalul este deschis integral. Contul adaugă ceva în plus',
    open_p:    'Cotațiile, graficele și biblioteca de tipare funcționează fără înregistrare și așa vor rămâne.',
    logo_hint: 'Apasă pe semn — se deschide platforma',
    cta:       'Deschide platforma →',
  },
  approach: {
    lens_cap: 'În afară — zgomot. Înăuntru — niveluri, medie, tipar',
    eyebrow: 'Abordare Complexă',
    heading: 'Soluții financiare personalizate pentru viitorul tău',
    p1: 'Echipa noastră cu experiență internațională oferă servicii de educație financiară pe toate tipurile de piețe: acțiuni, valutare, mărfuri, derivate și criptomonede.',
    p2: 'Oferim instrumente și strategii adaptate obiectivelor individuale ale clienților. Accentul special se pune pe analiza piețelor și formarea profesională pentru decizii financiare sigure.',
  },
  platform: {
    cta: 'DESCHIDE PLATFORMA →',
    p1: {
      key_cap: 'Semnul este intrarea. Apasă pentru a deschide terminalul',
      eyebrow: 'PLATFORMĂ · LP.SBFCONSULT.COM',
      heading: 'Terminal, jurnal și academie — într-un singur loc',
      lead:    'Spațiu de lucru pentru trader: sinteză de piață matinală, jurnal de tranzacții cu analitică a disciplinei, program de studiu și obiective. Fără recomandări — doar structură și date pentru propriile tale decizii.',
      f1t: 'Jurnal de Tranzacții',    f1d: 'Statistici, sezoane de tranzacționare cu rapoarte finale, analiza erorilor.',
      f2t: 'Sinteză Matinală',        f2d: 'Buletin analitic de piață în fiecare dimineață înainte de deschiderea sesiunii europene.',
      f3t: 'SBF Academy',             f3d: 'Capitole educaționale de la noțiuni de bază la subiecte avansate. Progresul este salvat.',
      f4t: 'Obiective și Disciplină', f4d: 'Serii de jurnalizare, controlul riscului per tranzacție, scor de disciplină. Clasament după XP — nu după profit.',
    },
    p2: {
      eyebrow: 'START FĂRĂ RISC',
      heading: 'Completează sondajul pentru traderi — primești 30 de zile PRO',
      body:    'Povestește despre experiența, obiectivele și atitudinea ta față de risc — platforma personalizează recomandările de învățare, iar accesul PRO se activează timp de 30 de zile. Nu este necesar un card. Fără abonament auto.',
      s1:      'Înregistrare — 2 pași, email + parolă.',
      s2:      'Sondaj — blocuri «Experiență · Obiective · Risc», ~3 minute.',
      s3:      '«Calea Ta» — recomandări personalizate + insignă PRO.',
      cta:     'ÎNCEPE →',
      fine:    'Serviciul este disponibil utilizatorilor de 18+. Accesul PRO se activează o singură dată pentru completarea sondajului.',
      ref:     'Cod de referință — în profil. Invită un trader — ambii primesc +7 zile PRO.',
    },
  },
  market: {
    eyebrow:         'MEMORIA PIEȚELOR',
    heading:         'Fiecare mișcare lasă un tipar',
    cta_platform:    'Vezi analize în timp real →',
    hist_disclaimer: 'Tiparele statistice istorice nu garantează rezultatele viitoare și nu constituie o recomandare.',
    prev:            'Cazul anterior',
    next:            'Cazul următor',
    eurusd: {
      meta:    'EUR/USD · FOREX · 30M',
      title:   'EUR/USD — Gap de Weekend',
      desc:    'Mai 2026. Vineri 22 mai închidere: 1.1605. Luni 26 mai deschidere: 1.1644. Gap +39 pips — umplere treptată în 1,5 săptămâni.',
      pattern: 'TIPAR: GAP & FILL',
      note:    'Gap-urile de weekend pe perechile forex lichide se umplu în ~75% din cazuri în 1–2 săptămâni. Un tipar statistic stabil pe termen mediu.',
    },
    gold_tri: {
      meta:    'XAU/USD · COMEX · 1H',
      title:   'Aur — Spargere din Triunghi',
      desc:    'Mai 2026. Compresie simetrică 20–27 mai, apex triunghi la ~$4.440. Spargere în sus pe 28 mai cu accelerare la $4.627.',
      pattern: 'TIPAR: TRIUNGHI SIMETRIC',
      note:    'Contracția intervalului de preț cu spargere la apex creează un impuls direcțional. Tipar de acumulare cu proiecție de mișcare măsurabilă.',
    },
    gold_bol: {
      meta:    'XAU/USD · COMEX · 1H',
      title:   'Aur — Compresie Bollinger',
      desc:    'Mai 2026. După consolidare, benzile Bollinger s-au comprimat la minimum la ~$4.700. Dublă spargere în jos la $4.395.',
      pattern: 'TIPAR: BOLLINGER SQUEEZE',
      note:    'Compresia benzilor Bollinger precedă mișcarea direcțională. Latura spargerii determină direcția impulsului. Exemplu istoric de scenariu descendent.',
    },
    jpy: {
      meta:    'USD/JPY · FOREX · 30M',
      title:   'Yen — Zona de Intervenție',
      desc:    'Iunie 2026. USD/JPY a atins 160.09 — zona istorică de intervenții a Băncii Japoniei. Inversare de la rezistența nivelului rotund.',
      pattern: 'TIPAR: NIVEL ROTUND + INVERSARE',
      note:    'Nivelul 160 este o zonă de activitate istorică a BOJ. O retragere de 50–70% din mișcarea anterioară a fost observată ca tendință istorică la astfel de niveluri.',
    },
    copper: {
      meta:    'COPPER · CME · 4H',
      title:   'Cupru — Spargere din Canal Ascendent',
      desc:    'Martie–Iunie 2026. Canal ascendent din 18 martie. Spargeri false pe 10 aprilie și 11 mai cu revenire în canal.',
      pattern: 'TIPAR: CANAL DE PREȚ + SPARGERE FALSĂ',
      note:    'Dublă spargere falsă a graniței superioare a canalului cu revenire — indicator statistic semnificativ al slăbirii trendului. Două confirmări cresc fiabilitatea tiparului.',
    },
  },
  svc: {
    logo_issue: 'Semnul închide cercul — chestionarul devine acces',
    logo_lvl1:  'O treime din inel — atât este de partea noastră',
    logo_lvl2:  'Două treimi — noi ținem contul, deciziile sunt ale tale',
    logo_lvl3:  'Inelul este închis — administrarea este de partea noastră',
    target_label:    'PENTRU CINE ESTE',
    partner_label:   'PARTENERI NIVEL',
    partner_label_s: 'PARTENER NIVEL',
    s1: {
      title:           'Educație',
      target:          'Pentru cei care înțeleg piețele independent',
      desc:            'Programe educaționale și materiale analitice: noțiuni de bază ale piețelor, alegerea infrastructurii de brokeraj, analiza abordărilor de tranzacționare. Fără recomandări de investiții.',
      avatrade_meta:   'MT4 · MT5 · Educație integrată',
      xm_meta:         'MT4 · MT5 · WebTrader',
      cta_platform:    'Deschide platforma de educație →',
    },
    s2: {
      title:           'Suport Cont',
      target:          'Pentru clienții activi cu capital propriu',
      desc:            'Suport pentru contul de tranzacționare al clientului: revizuirea pozițiilor, suport informațional, observații statistice. Deciziile le ia clientul.',
      naga_meta:       'CySEC · MT4/MT5 · 4.000+ instrumente',
      instaforex_meta: 'CySEC · MT4/MT5 · de la $100 depozit',
    },
    s3: {
      title:           'Management Discreționare',
      target:          'Pentru cei care încredințează managementul profesioniștilor',
      desc:            'Management complet al capitalului conform strategiei agreate cu clientul în cadrul contractului de parteneriat cu brokerul. Raportare transparentă, profil de risc agreat, revizuiri periodice.',
      desc_m:          'Management complet al capitalului conform strategiei agreate în cadrul contractului de parteneriat cu brokerul. Raportare transparentă, revizuiri periodice.',
      fxpro_meta:      'FCA · CySEC · 5 regulatori',
    },
  },
  team: {
    eyebrow:     'ECHIPA ȘI NEURO-AI',
    heading:     'Experți amplificați de inteligența artificială',
    lead:        'Experiența internațională a analiștilor + strat analitic multi-model propriu, funcționând 24/7. Fiecare conținut trece prin verificare dublă: modele → om.',
    mob_heading: 'Experți<br>amplificați de AI',
  },
  contact: {
    ch:      'Elveția',
    pt:      'Portugalia',
    md:      'Moldova',
    ae:      'EAU',
    eyebrow:      'CONTACTAȚI-NE',
    heading:      'Suntem gata să discutăm capitalul dvs.',
    phone:        'Telefon',
    email:        'Email',
    cta:          'SOLICITAȚI UN APEL',
    platform_cta: 'Lucrați pe platformă independent →',
  },
  svc_du_disclaimer: 'SBF Company SRL nu este un administrator de active licențiat. Serviciul este furnizat exclusiv prin parteneri reglementați în UE (FCA, CySEC). SBF acționează ca consultant și nu acceptă fonduri ale clienților în propriile conturi.',
  risk_warning: 'Tranzacționarea cu CFD-uri și instrumente cu marjă implică un risc ridicat de pierdere a capitalului și poate să nu fie potrivită pentru toți investitorii.',
  sticky: 'Contact',
  modal: {
    eyebrow:    'SOLICITAȚI UN APEL',
    heading:    'Specialistul nostru vă va contacta în decurs de o oră',
    close_aria: 'Închide',
    name:       'Nume',
    email:      'Email',
    phone:      'Telefon — opțional',
    gdpr:       'Sunt de acord cu prelucrarea datelor personale',
    submit:     'TRIMITEȚI CEREREA',
    submitting: 'SE TRIMITE…',
    divider:    'sau scrieți-ne direct',
    tg:         '✈ SCRIEȚI PE TELEGRAM',
    success_h:  'Cerere trimisă',
    success_p:  'Vă vom contacta în decurs de o oră',
    book_btn:   '📖 Descărcați cartea de tranzacționare',
    error_p:    'Trimitere eșuată. Contactați-ne direct:',
  },
  partner: {
    goto:      'Vizitați site-ul →',
    section1:  'Date Cheie',
    section2:  'Licențe și Reglementare',
    section3:  'Infrastructură de Tranzacționare',
    section4:  'Finanțare și Custodie',
    founded:   'Fondat',
    hq:        'Sediu Central',
    clients:   'Baza de Clienți',
    platforms: 'Platforme',
    deposit:   'Depozit Minim',
    leverage:  'Levier Maxim',
    spreads:   'Spread-uri',
    instr:     'Instrumente',
    methods:   'Metode de Finanțare',
    inactivity:'Comision de Inactivitate',
    custody:   'Custodia Fondurilor',
    data: {
      avatrade: {
        tagline:      'Unul dintre cei mai mari brokeri reglementați din lume',
        founded:      '2006',
        hq:           'Dublin, Irlanda',
        licenses:     ['Central Bank of Ireland — № C53877','ASIC (Australia) — № 406684','FSCA (Africa de Sud) — № 45984','FSC (Insulele Virgine Britanice) — Ava Trade Markets Ltd (numărul licenței nu este publicat de registru)','JFSA (Japonia) — № 1662 + FFAJ № 1574','ADGM (EAU), KNF (Polonia), ISA (Israel)'],
        platforms:    'MT4, MT5, AvaTradeGO, AvaSocial',
        minDeposit:   '$100',
        maxLeverage:  '1:30 (UE) / până la 1:400 (BVI)',
        spreads:      'de la 0,9 pips EUR/USD',
        funding:      'Carduri bancare, transfer bancar, Skrill, Neteller, PerfectMoney',
        inactivityFee:'$50 după 3 luni de inactivitate',
      },
      xm: {
        tagline:     'Grup licențiat CySEC din 2010',
        founded:     '2010 (data licenței CySEC 120/10)',
        hq:          'Limassol, Cipru (UE) / Belize City (internațional)',
        licenses:    ['CySEC (Cipru) — № 120/10, Trading Point of Financial Instruments Ltd','DFSA (EAU, DIFC) — № F003484, Trading Point MENA Ltd','FSC (Belize) — № 8557558, XM Global Ltd (conform brokerului)'],
        platforms:   'MT4, MT5, MT5 WebTrader, XM App',
        minDeposit:  '$5 (Standard, Ultra Low)',
        maxLeverage: '1:30 (UE) / până la 1:1000 (Belize)',
        spreads:     'medie 2,0 pips EUR/USD (Standard, conform XM)',
        inactivityFee: '$5/lună după 90 de zile de inactivitate',
      },
      naga: {
        tagline:     'Platformă fintech germană listată la Frankfurt Stock Exchange',
        founded:     '2015 (NAGA Group AG)',
        hq:          'Hamburg, Germania / Limassol, Cipru',
        licenses:    ['CySEC (Cipru) — № 204/13','FSA (Seychelles) — № SD026 (NAGA Capital Ltd)','Companie publică la Frankfurt Stock Exchange (ticker N4G)'],
        platforms:   'MT4, MT5, NAGA App, platformă web',
        minDeposit:  '$250',
        maxLeverage: '1:30 (UE) / până la 1:1000 (internațional)',
        spreads:     'de la 0,9 pips EUR/USD',
        funding:     'Carduri bancare, transfer bancar, Skrill, Neteller, cripto',
        instruments: '4.000+ instrumente, tranzacționare socială',
      },
      instaforex: {
        tagline:     '7+ milioane de clienți în 190 de țări',
        founded:     '2007',
        hq:          'Limassol, Cipru (UE) / Insulele Virgine Britanice (internațional)',
        licenses:    ['CySEC (Cipru) — № 266/15 (Instant Trading EU Ltd)','BVI FSC (Insulele Virgine Britanice) — № SIBA/L/14/1082 (InstaFinance Ltd)','Înregistrat: CNB (Republica Cehă), NBS (Slovacia), KNF (Polonia)'],
        platforms:   'MT4, MT5, WebTrader, MultiTerminal',
        minDeposit:  'de la $100',
        maxLeverage: '1:30 (UE) / până la 1:1000 (BVI)',
        spreads:     'de la 3 pips EUR/USD (cont standard)',
        funding:     'Carduri bancare, transfer bancar, Skrill, Neteller, cripto, metode locale de plată',
        instruments: 'Forex, acțiuni, indici, metale, energie, cripto',
      },
      fxpro: {
        tagline:     'Reglementat în cinci jurisdicții de autoritate',
        founded:     '2006',
        hq:          'Limassol, Cipru',
        licenses:    ['FCA (Regatul Unit) — № 509956','CySEC (Cipru) — № 078/07','FSCA (Africa de Sud) — FSP № 45052','SCB (Bahamas) — № SIA-F184','FSA (Seychelles) — № SD120'],
        platforms:   'FxPro Platform, MT4, MT5, cTrader',
        minDeposit:  '$100',
        maxLeverage: '1:30 (FCA/CySEC) / până la 1:200 (SCB/FSA)',
        spreads:     'de la 0,6 pips EUR/USD (Raw+)',
        funding:     'Carduri bancare, transfer bancar, Skrill, Neteller, PayPal',
        funds:       'Fondurile clienților sunt păstrate la Barclays Bank, Julius Baer, Royal Bank of Scotland',
        clients:     '800.000+ clienți',
      },
    },
  },
},

}; /* end _LOCALES */

/* ── Движок ─────────────────────────────────────────────── */
(function () {
  let _lang = 'ru';

  /* Доступ по dot-notation: 'nav.analytics' → value */
  function t(key) {
    const parts = key.split('.');
    let obj = _LOCALES[_lang];
    for (const p of parts) {
      if (obj == null || typeof obj !== 'object') return key;
      obj = obj[p];
    }
    return (obj != null && typeof obj !== 'object') ? obj : key;
  }

  /* Массив по dot-notation (для licenses) */
  function ta(key) {
    const parts = key.split('.');
    let obj = _LOCALES[_lang];
    for (const p of parts) {
      if (obj == null) return [];
      obj = obj[p];
    }
    return Array.isArray(obj) ? obj : [];
  }

  function applyTranslations() {
    document.title = t('page_title');
    document.documentElement.lang = _lang;

    /* Простой текст */
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t(el.dataset.i18n);
      if (v !== el.dataset.i18n) el.textContent = v;
    });

    /* HTML-контент (br, em и т.п.) */
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const v = t(el.dataset.i18nHtml);
      if (v !== el.dataset.i18nHtml) el.innerHTML = v;
    });

    /* placeholder */
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });

    /* aria-label */
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });

    /* title attr (snap dots) */
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.dataset.i18nTitle));
    });

    /* Кнопки переключателя */
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === _lang);
    });

    /* Перерисовать партнёрский модал если открыт */
    if (window._currentPartner && typeof renderPartnerModal === 'function') {
      renderPartnerModal(window._currentPartner);
    }

    /* Обновить роли в десктопном орбитале */
    document.querySelectorAll('[data-role-ru]').forEach(el => {
      el.textContent = _lang === 'en' ? (el.dataset.roleEn || el.dataset.roleRu) : el.dataset.roleRu;
    });

    /* Перерисовать грид команды на мобиле */
    if (window.IS_MOBILE && typeof window.initTeamGrid === 'function') {
      const grid = document.getElementById('act-team-grid');
      if (grid) { grid.innerHTML = ''; window.initTeamGrid(); }
    }

    /* Событие для блоков, которые рисуют текст сами и не размечены data-i18n
       (сейчас — подписи новостей на карте первого экрана). */
    document.dispatchEvent(new CustomEvent('sbf:langchange', { detail: { lang: _lang } }));
  }

  function setLang(lang) {
    if (!_LOCALES[lang]) return;
    _lang = lang;
    localStorage.setItem('sbf_lang', lang);
    applyTranslations();
  }

  function getLang() { return _lang; }

  /* Партнёрские данные на текущем языке */
  function partnerData(id) {
    return _LOCALES[_lang]?.partner?.data?.[id] || _LOCALES.ru.partner.data[id] || {};
  }

  /* Автоопределение языка:
     Russian — для языков бывшего СССР; Romanian — для ro; English — по умолчанию */
  const _CIS_LANGS = ['ru','uk','be','kk','uz','az','ka','hy','tk','tg','ky','lt','lv','et'];
  const saved = localStorage.getItem('sbf_lang');
  const _userLang = (navigator.language || '').toLowerCase().split(/[-_]/)[0];
  const auto  = _CIS_LANGS.includes(_userLang) ? 'ru' : (_userLang === 'ro' ? 'ro' : 'en');
  _lang = _LOCALES[saved] ? saved : auto;

  window.i18n = { t, ta, setLang, getLang, partnerData, apply: applyTranslations };

  /* Применяем после готовности DOM */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }

  /* Клики по переключателю языка */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.lang-btn');
    if (btn?.dataset?.lang) setLang(btn.dataset.lang);
  });
})();
