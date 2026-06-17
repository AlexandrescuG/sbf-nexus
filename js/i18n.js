/**
 * i18n.js — Двуязычная система SBF (RU / EN).
 * Инициализируется синхронно, применяет переводы после DOMContentLoaded.
 * Автоопределение по navigator.language, ручное — localStorage.
 */

/* ── Локали ─────────────────────────────────────────────── */
const _LOCALES = {

/* ═══════════════════════════════ РУССКИЙ ════════════════════════════════ */
ru: {
  page_title: 'SBF Consult — Мы вычленяем сигналы',
  nav: {
    analytics: 'Аналитика',
    trading:   'Торговля',
    team:      'Команда',
    contacts:  'Контакты',
    menu_aria: 'Меню',
    nav_aria:  'Навигация по разделам',
  },
  dots: ['Карта','События','Подход','Память рынков','Обучение','Сопровождение','Управление','Команда','Контакты'],
  hero: {
    headline:  'Мир генерирует шум.<br><em>Мы распознаём закономерности</em>.',
    subline:   'SBF Company SRL · Кишинёв<br>Анализ от экспертов, сопровождение торговых счетов, доверительное управление через партнёров с лицензиями ЕС.',
    trust:     'Bloomberg LEI · Эксперты с опытом 10–25 лет · Партнёры с лицензиями ЕС',
    cta1:      'Связаться',
    cta2:      'Архив прогнозов →',
    scroll:    'Прокрутите вниз',
  },
  grow: {
    eyebrow: 'ПРОВЕРЯЕМЫЙ ТРЕК-РЕКОРД',
    heading: 'Результаты экспертов',
    fc1: {
      asset: 'СЕРЕБРО · XAG/USD',
      date:  'прогноз от 16 января 2026',
      price: 'Цена на момент',
      fore:  'Прогноз на год',
      res:   'Через 2 недели',
      note:  'Годовая цель — в процессе.',
    },
    fc2: {
      asset: 'ЗОЛОТО · XAU/USD',
      date:  'прогноз от декабря 2025',
      price: 'Цена на момент',
      cons:  'Консервативно',
      bull:  'Бычий сценарий',
      res:   'Факт — максимум',
      note:  'Превышен даже бычий сценарий.',
    },
    fc3: {
      asset:  'ИНВЕСТ-ПРОГНОЗ 2026',
      sub:    '10 структурных идей',
      item1:  'Энергетический голод · атомная энергетика',
      item2:  'Медный дефицит · металл ИИ',
      item3:  'Европейская оборона',
      item4:  '…и ещё 7 идей',
      note:   'Полный разбор — в нашем боте.',
    },
    cta: 'Архив прогнозов и аналитики →',
  },
  approach: {
    eyebrow: 'Комплексный подход',
    heading: 'Индивидуальные финансовые решения для вашего будущего',
    p1: 'Наша команда с международным опытом предоставляет услуги финансового обучения на всех видах рынков: фондовых, валютных, товарных, а также рынке деривативов и криптовалют.',
    p2: 'Мы предлагаем инструменты и стратегии, учитывая индивидуальные цели клиентов. Особый акцент делается на анализе рынков и профессиональном обучении для уверенных финансовых решений.',
  },
  market: {
    eyebrow: 'ПАМЯТЬ РЫНКОВ',
    heading: 'Каждое движение оставляет паттерн',
    prev:    'Предыдущий кейс',
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
      note:    'Двойной ложный пробой верхней границы канала с возвратом — статистически значимый сигнал ослабления тренда. Два подтверждения повышают надёжность паттерна.',
    },
  },
  svc: {
    target_label:    'КОМУ ПОДХОДИТ',
    partner_label:   'ПАРТНЁРЫ УРОВНЯ',
    partner_label_s: 'ПАРТНЁР УРОВНЯ',
    s1: {
      title:           'Обучение',
      target:          'Для тех, кто разбирается в инструментах рынка самостоятельно',
      desc:            'Образовательные программы и аналитические материалы: основы рынков, выбор брокерской инфраструктуры, разбор торговых подходов. Без инвестиционных рекомендаций.',
      avatrade_meta:   'MT4 · MT5 · Встроенное обучение',
      capex_meta:      'MT5 · TradingView · WebTrader',
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
    lead:        'Международный опыт + системы машинного обучения, работающие 24/7. Каждое решение проходит через двойной фильтр.',
    mob_heading: 'Эксперты,<br>усиленные ИИ',
  },
  contact: {
    ch:      'Швейцария',
    pt:      'Португалия',
    md:      'Молдова',
    ae:      'ОАЭ',
    eyebrow: 'СВЯЖИТЕСЬ С НАМИ',
    heading: 'Готовы обсудить ваш капитал',
    phone:   'Телефон',
    email:   'Email',
    cta:     'ОСТАВИТЬ ЗАЯВКУ',
  },
  sticky: 'Связаться',
  modal: {
    eyebrow:     'ОСТАВИТЬ ЗАЯВКУ',
    heading:     'Наш специалист свяжется с вами в течение часа',
    close_aria:  'Закрыть',
    name:        'Имя',
    phone:       'Телефон',
    gdpr:        'Согласен на обработку персональных данных',
    submit:      'ОТПРАВИТЬ ЗАЯВКУ',
    submitting:  'ОТПРАВКА…',
    divider:     'или напишите напрямую',
    tg:          '✈ НАПИСАТЬ В TELEGRAM',
    success_h:   'Заявка отправлена',
    success_p:   'Мы свяжемся с вами в течение часа',
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
        licenses:     ['Central Bank of Ireland — № C53877','ASIC (Австралия) — № 406684','FSCA (ЮАР) — № 45984','FSC (Британские Виргинские о-ва) — № SIBA/L/13/1049','JFSA (Япония) — № 1662 + FFAJ № 1574','ADGM (ОАЭ), KNF (Польша), ISA (Израиль)'],
        platforms:    'MT4, MT5, AvaTradeGO, AvaSocial',
        minDeposit:   '$100',
        maxLeverage:  'до 1:400 (в зависимости от юрисдикции)',
        spreads:      'от 0.9 пунктов EUR/USD',
        funding:      'Банковские карты, банковский перевод, Skrill, Neteller, PerfectMoney',
        inactivityFee:'$50 после 3 месяцев бездействия',
      },
      capex: {
        tagline:     'Мультирегулируемый брокер группы Key Way',
        founded:     '2016 (Key Way Investments Ltd)',
        hq:          'Лимасол, Кипр',
        licenses:    ['CySEC (Кипр) — № 292/16','FSCA (ЮАР) — № 37166','ADGM FSRA (ОАЭ) — № 190005','FSA (Сейшелы) — № SD020','Регистрация: ASF (Румыния), CNMV (Испания)'],
        platforms:   'MT5, WebTrader, TradingView',
        minDeposit:  '€100 (Essential)',
        maxLeverage: 'до 1:30 (EU) / выше за пределами EU',
        spreads:     'плавающие',
        funding:     'Банковские карты, банковский перевод, электронные кошельки',
        instruments: '2 100+ инструментов: Forex, акции, индексы, сырьё, крипто-CFD',
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
        hq:          'Лимасол, Кипр (EU) / Сент-Винсент и Гренадины (международно)',
        licenses:    ['CySEC (Кипр) — № 266/15 (Instant Trading EU Ltd)','BVI FSC (Британские Виргинские о-ва) — № SIBA/L/14/1082','Регистрация: ЦБ Чехии, ЦБ Словакии, KNF (Польша)'],
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
  page_title: 'SBF Consult — We filter the signal',
  nav: {
    analytics: 'Analytics',
    trading:   'Trading',
    team:      'Team',
    contacts:  'Contacts',
    menu_aria: 'Menu',
    nav_aria:  'Section navigation',
  },
  dots: ['Map','Events','Approach','Market Memory','Education','Account Support','Management','Team','Contacts'],
  hero: {
    headline:  'The world generates noise.<br><em>We recognise patterns</em>.',
    subline:   'SBF Company SRL · Chișinău<br>Expert analysis, trading account support, and discretionary management through EU-licensed partners.',
    trust:     'Bloomberg LEI · Experts with 10–25 years of experience · EU-licensed partners',
    cta1:      'Contact Us',
    cta2:      'Forecast Archive →',
    scroll:    'Scroll down',
  },
  grow: {
    eyebrow: 'VERIFIABLE TRACK RECORD',
    heading: 'Expert Results',
    fc1: {
      asset: 'SILVER · XAG/USD',
      date:  'forecast from January 16, 2026',
      price: 'Price at the time',
      fore:  'Annual forecast',
      res:   'After 2 weeks',
      note:  'Annual target — in progress.',
    },
    fc2: {
      asset: 'GOLD · XAU/USD',
      date:  'forecast from December 2025',
      price: 'Price at the time',
      cons:  'Conservative',
      bull:  'Bull scenario',
      res:   'Actual — peak',
      note:  'Exceeded even the bull scenario.',
    },
    fc3: {
      asset:  'INVESTMENT FORECAST 2026',
      sub:    '10 structural ideas',
      item1:  'Energy shortage · nuclear power',
      item2:  'Copper deficit · the AI metal',
      item3:  'European defence',
      item4:  '…and 7 more ideas',
      note:   'Full breakdown — in our bot.',
    },
    cta: 'Forecast & Analytics Archive →',
  },
  approach: {
    eyebrow: 'Comprehensive Approach',
    heading: 'Individual financial solutions for your future',
    p1: 'Our internationally experienced team provides financial education services across equity, currency, commodity, derivative, and cryptocurrency markets.',
    p2: 'We offer tools and strategies tailored to individual client goals, with a strong emphasis on market analysis and professional education for confident financial decisions.',
  },
  market: {
    eyebrow: 'MARKET MEMORY',
    heading: 'Every move leaves a pattern',
    prev:    'Previous case',
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
      note:    'A double false breakout of the channel\'s upper boundary with a return — a statistically significant signal of trend weakening. Two confirmations increase pattern reliability.',
    },
  },
  svc: {
    target_label:    'WHO IT\'S FOR',
    partner_label:   'LEVEL PARTNERS',
    partner_label_s: 'LEVEL PARTNER',
    s1: {
      title:           'Education',
      target:          'For those who learn the markets independently',
      desc:            'Educational programmes and analytical materials: market fundamentals, choosing brokerage infrastructure, review of trading approaches. No investment recommendations.',
      avatrade_meta:   'MT4 · MT5 · Built-in education',
      capex_meta:      'MT5 · TradingView · WebTrader',
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
    lead:        'International experience + machine learning systems operating 24/7. Every decision passes through a double filter.',
    mob_heading: 'Experts<br>amplified by AI',
  },
  contact: {
    ch:      'Switzerland',
    pt:      'Portugal',
    md:      'Moldova',
    ae:      'UAE',
    eyebrow: 'CONTACT US',
    heading: 'Ready to discuss your capital',
    phone:   'Phone',
    email:   'Email',
    cta:     'REQUEST A CALLBACK',
  },
  sticky: 'Contact',
  modal: {
    eyebrow:     'REQUEST A CALLBACK',
    heading:     'Our specialist will contact you within an hour',
    close_aria:  'Close',
    name:        'Name',
    phone:       'Phone',
    gdpr:        'I consent to the processing of personal data',
    submit:      'SEND REQUEST',
    submitting:  'SENDING…',
    divider:     'or write to us directly',
    tg:          '✈ WRITE ON TELEGRAM',
    success_h:   'Request sent',
    success_p:   'We will contact you within an hour',
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
        licenses:     ['Central Bank of Ireland — № C53877','ASIC (Australia) — № 406684','FSCA (South Africa) — № 45984','FSC (British Virgin Islands) — № SIBA/L/13/1049','JFSA (Japan) — № 1662 + FFAJ № 1574','ADGM (UAE), KNF (Poland), ISA (Israel)'],
        platforms:    'MT4, MT5, AvaTradeGO, AvaSocial',
        minDeposit:   '$100',
        maxLeverage:  'up to 1:400 (jurisdiction-dependent)',
        spreads:      'from 0.9 pips EUR/USD',
        funding:      'Bank cards, wire transfer, Skrill, Neteller, PerfectMoney',
        inactivityFee:'$50 after 3 months of inactivity',
      },
      capex: {
        tagline:     'Multi-regulated broker of the Key Way Group',
        founded:     '2016 (Key Way Investments Ltd)',
        hq:          'Limassol, Cyprus',
        licenses:    ['CySEC (Cyprus) — № 292/16','FSCA (South Africa) — № 37166','ADGM FSRA (UAE) — № 190005','FSA (Seychelles) — № SD020','Registered: ASF (Romania), CNMV (Spain)'],
        platforms:   'MT5, WebTrader, TradingView',
        minDeposit:  '€100 (Essential)',
        maxLeverage: 'up to 1:30 (EU) / higher outside EU',
        spreads:     'floating',
        funding:     'Bank cards, wire transfer, e-wallets',
        instruments: '2,100+ instruments: Forex, equities, indices, commodities, crypto-CFDs',
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
        hq:          'Limassol, Cyprus (EU) / Saint Vincent and the Grenadines (international)',
        licenses:    ['CySEC (Cyprus) — № 266/15 (Instant Trading EU Ltd)','BVI FSC (British Virgin Islands) — № SIBA/L/14/1082','Registered: CNB (Czech Republic), NBS (Slovakia), KNF (Poland)'],
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
     English по умолчанию, Russian — для языков бывшего СССР (кроме молдавского/ro) */
  const _CIS_LANGS = ['ru','uk','be','kk','uz','az','ka','hy','tk','tg','ky','lt','lv','et'];
  const saved = localStorage.getItem('sbf_lang');
  const _userLang = (navigator.language || '').toLowerCase().split(/[-_]/)[0];
  const auto  = _CIS_LANGS.includes(_userLang) ? 'ru' : 'en';
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
