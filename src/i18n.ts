import type {
  GraphEdge,
  GraphNode,
  ImpactDirection,
  ImpactStrength,
  Language,
  NodeStatus,
  ScenarioPreset,
  ScenarioStep,
} from './types'

type ScenarioText = {
  title: string
  subtitle: string
  summary: string
  nodes: Record<string, Pick<GraphNode, 'question' | 'category'>>
  edges: Record<string, Pick<GraphEdge, 'explanation'>>
  steps: Record<string, Pick<ScenarioStep, 'title' | 'narrative'>>
}

export const uiText = {
  en: {
    brandEyebrow: 'Polymarket causal intelligence',
    brandTitle: 'Event Propagation Engine',
    graphEyebrow: 'Dynamic market graph',
    scenarioRun: 'Scenario run',
    agentChain: 'Agent chain',
    demoScenarios: 'Demo scenarios',
    agentPipeline: 'Agent pipeline',
    clickToStart: 'Click the root node or press play',
    initialNarrative:
      'The graph is staged as a causal market propagation. The highlighted root condition starts the scenario, then downstream markets reprice layer by layer.',
    probabilityRises: 'Probability rises',
    probabilityFalls: 'Probability falls',
    mixedSignal: 'Mixed / weak signal',
    confidence: 'confidence',
    strength: 'strength',
    source: 'source',
    evidenceSource: 'Evidence source',
    controls: 'Scenario playback controls',
    replay: 'Replay scenario',
    previous: 'Previous step',
    play: 'Play scenario',
    pause: 'Pause scenario',
    next: 'Next step',
    ready: 'Ready',
    step: 'Step',
    awaitingTrigger: 'Awaiting trigger',
    up: 'Up',
    down: 'Down',
    uncertain: 'Uncertain',
    base: 'base',
    mixed: 'mixed',
    points: 'pts',
    to: 'to',
    volume: 'vol',
    agents: ['Parser', 'Evidence', 'Relation', 'Skeptic', 'Impact', 'Narrative'],
    status: {
      idle: 'watching',
      active: 'condition',
      impacted: 'repriced',
      muted: 'muted',
    } satisfies Record<NodeStatus, string>,
    strengthLabel: {
      weak: 'weak',
      medium: 'medium',
      strong: 'strong',
    } satisfies Record<ImpactStrength, string>,
  },
  zh: {
    brandEyebrow: 'Polymarket 因果智能',
    brandTitle: '事件推演引擎',
    graphEyebrow: '动态市场图谱',
    scenarioRun: '推演场景',
    agentChain: 'Agent 链',
    demoScenarios: '演示场景',
    agentPipeline: 'Agent 流程',
    clickToStart: '点击根节点或按播放开始',
    initialNarrative:
      '图谱按市场因果传播来编排。高亮的根条件会启动场景，然后下游市场按层级逐步重新定价。',
    probabilityRises: '概率上升',
    probabilityFalls: '概率下降',
    mixedSignal: '混合 / 弱信号',
    confidence: '置信度',
    strength: '强度',
    source: '来源',
    evidenceSource: '证据来源',
    controls: '场景播放控制',
    replay: '重播场景',
    previous: '上一步',
    play: '播放场景',
    pause: '暂停场景',
    next: '下一步',
    ready: '就绪',
    step: '步骤',
    awaitingTrigger: '等待触发',
    up: '上升',
    down: '下降',
    uncertain: '不确定',
    base: '基准',
    mixed: '混合',
    points: '点',
    to: '至',
    volume: '成交量',
    agents: ['解析', '证据', '关系', '反证', '影响', '叙事'],
    status: {
      idle: '观察',
      active: '条件',
      impacted: '重定价',
      muted: '弱化',
    } satisfies Record<NodeStatus, string>,
    strengthLabel: {
      weak: '弱',
      medium: '中',
      strong: '强',
    } satisfies Record<ImpactStrength, string>,
  },
} as const

const zhScenarios: Record<string, ScenarioText> = {
  'trump-tariff': {
    title: '特朗普关税冲击',
    subtitle: '贸易政策会重新定价通胀、美联储路径、中国风险和美股尾部事件。',
    summary: '广泛关税会直接推高进口成本，提高报复性关税风险，并削弱近期降息概率。',
    nodes: {
      'tariff-yes': {
        question: '特朗普会在 7 月前宣布普遍进口关税吗？',
        category: '政治',
      },
      'inflation-3': {
        question: '美国 8 月 CPI 同比会高于 3.0% 吗？',
        category: '宏观',
      },
      'fed-cut': {
        question: '美联储会在 9 月 FOMC 会议降息吗？',
        category: '利率',
      },
      'china-retaliates': {
        question: '中国会在 30 天内宣布报复性关税吗？',
        category: '地缘政治',
      },
      'sp500-correction': {
        question: '标普 500 会在 10 月前较 2026 年高点回落 10% 吗？',
        category: '股票',
      },
      manufacturing: {
        question: '美国制造业 PMI 会连续两个月低于 50 吗？',
        category: '经济',
      },
    },
    edges: {
      'tariff-inflation': {
        explanation:
          '普遍关税会直接抬高到岸成本。零售商可以吸收部分利润压力，但广泛政策会提高 CPI 传导可见化的概率。',
      },
      'inflation-fed': {
        explanation:
          '偏热的 CPI 会削弱宽松理由。除非就业数据明显恶化，市场会提高 9 月降息的门槛。',
      },
      'tariff-china': {
        explanation:
          '政策目标很可能覆盖对中国敏感的品类，因此相比狭窄行业关税，更容易触发对等回应。',
      },
      'china-sp500': {
        explanation:
          '报复措施会增加跨国企业盈利不确定性，并提升避险交易概率，尤其是在通胀仍然黏性的背景下。',
      },
      'tariff-manufacturing': {
        explanation:
          '保护政策可能帮助部分本土生产商，但更高投入成本和更弱出口需求会抵消该渠道，净影响并不清晰。',
      },
    },
    steps: {
      'tariff-step-1': {
        title: '政策冲击进入通胀市场',
        narrative:
          '关税节点成为活跃条件。最强的一阶渠道是进口价格传导，同时报复风险上升，制造业影响则保持折价。',
      },
      'tariff-step-2': {
        title: '通胀重新定价美联储分支',
        narrative:
          '当 CPI 风险上移后，降息市场吸收二阶影响。模型压低降息概率，因为黏性通胀限制政策空间。',
      },
      'tariff-step-3': {
        title: '报复分支外溢到股票尾部风险',
        narrative:
          '报复路径增加盈利和情绪压力。标普回调节点上升，但置信度保持中等，因为股票结果仍取决于估值和盈利环境。',
      },
    },
  },
  'fed-rate-cut': {
    title: '美联储降息级联',
    subtitle: '鸽派 FOMC 结果会传导到衰退、房贷、美股和美元市场。',
    summary: '确认降息通常利好流动性敏感资产，但降息原因会决定衰退市场是上升还是下降。',
    nodes: {
      'fed-cut-june': {
        question: '美联储会在 6 月会议至少降息 25 个基点吗？',
        category: '利率',
      },
      'nasdaq-ath': {
        question: '纳斯达克 100 会在 45 天内创历史新高吗？',
        category: '股票',
      },
      'mortgage-6': {
        question: '美国 30 年期房贷利率会在年底前跌破 6.0% 吗？',
        category: '住房',
      },
      'recession-2026': {
        question: 'NBER 会认定 2026 年开始衰退吗？',
        category: '经济',
      },
      'dxy-down': {
        question: 'DXY 会在 9 月前跌破 98 吗？',
        category: '外汇',
      },
      'gold-ath': {
        question: '黄金会在本季度创历史新高吗？',
        category: '大宗商品',
      },
    },
    edges: {
      'fed-nasdaq': {
        explanation:
          '更低贴现率支撑长久期股票，尤其是市场把降息理解为保险式降息而非衰退应对时。',
      },
      'fed-mortgage': {
        explanation:
          '政策宽松会拉低短端利率，如果期限溢价没有抵消，也可能带动房贷利率下行。',
      },
      'fed-recession': {
        explanation:
          '方向取决于动机。保险式降息降低衰退风险，而紧急式降息则暗示美联储看到了下行压力。',
      },
      'fed-dxy': {
        explanation:
          '更软的美国利率路径会削弱美元利差支撑，尤其是在其他央行没有同样鸽派时。',
      },
      'dxy-gold': {
        explanation:
          '美元走弱和实际利率预期下降有利于黄金，但仓位拥挤可能限制后续涨幅。',
      },
    },
    steps: {
      'fed-step-1': {
        title: '鸽派利率冲击进入风险资产',
        narrative:
          '第一层分裂到流动性敏感市场。纳指、房贷和美元结果方向清晰，衰退风险保持黄色，因为解释方式很关键。',
      },
      'fed-step-2': {
        title: '美元走弱传导到大宗商品',
        narrative:
          '美元走弱分支传导到黄金。模型给出中等概率上调，因为黄金同时受益于更低实际利率和更弱美元定价。',
      },
    },
  },
  'btc-regulation': {
    title: 'BTC 监管破局',
    subtitle: '加密政策头条会传播到 ETF 资金流、BTC 价格、交易所股票和稳定币风险。',
    summary: '建设性的美国加密法案会改善机构准入和现货 BTC 需求，同时降低交易所执法冲击概率。',
    nodes: {
      'crypto-bill': {
        question: '美国会在 2026 年通过综合加密市场结构法案吗？',
        category: '政策',
      },
      'btc-150k': {
        question: '比特币会在 12 月 31 日前突破 150,000 美元吗？',
        category: '加密',
      },
      'etf-inflows': {
        question: '美国现货 BTC ETF 单季度净流入会达到 200 亿美元吗？',
        category: 'ETF',
      },
      'sec-enforcement': {
        question: 'SEC 会对头部交易所发起重大执法行动吗？',
        category: '监管',
      },
      'stablecoin-bill': {
        question: '美国稳定币框架会在年底前成为法律吗？',
        category: '政策',
      },
      'coinbase-ath': {
        question: 'Coinbase 股价今年会创历史新高吗？',
        category: '股票',
      },
    },
    edges: {
      'bill-etf': {
        explanation:
          '清晰的联邦框架会降低机构配置者的合规不确定性，使 ETF 需求更容易被投资委员会接受。',
      },
      'etf-btc': {
        explanation:
          '大规模 ETF 流入会形成现货需求并强化动量叙事。BTC 价格市场获得最大的二阶上调。',
      },
      'bill-sec': {
        explanation:
          '更明确的法定管辖权会降低政策争议通过突发执法行动解决的概率。',
      },
      'bill-stablecoin': {
        explanation:
          '市场结构进展意味着立法带宽和联盟协调改善，也会帮助稳定币框架推进。',
      },
      'btc-coinbase': {
        explanation:
          '更高 BTC 价格会提升交易活跃度、托管余额和对上市加密基础设施公司的情绪。',
      },
    },
    steps: {
      'btc-step-1': {
        title: '政策清晰度改变需求路径',
        narrative:
          '监管节点激活三条分支：ETF 流入概率跳升，交易所执法风险下降，稳定币立法更可能推进。',
      },
      'btc-step-2': {
        title: 'ETF 需求推升 BTC 尾部行情',
        narrative:
          '随着 ETF 流入被上调，BTC 价格目标获得最大的正向 delta。这条路径依赖现货需求，而不是单纯杠杆。',
      },
      'btc-step-3': {
        title: 'BTC 强势传导到上市加密 beta',
        narrative:
          '更高 BTC 分支外溢到交易所股票，渠道包括交易量、托管和情绪。置信度中等，因为股票估值可能滞后于代币动量。',
      },
    },
  },
}

export const translateScenario = (scenario: ScenarioPreset, language: Language): ScenarioPreset => {
  if (language === 'en') return scenario

  const text = zhScenarios[scenario.id]
  if (!text) return scenario

  return {
    ...scenario,
    title: text.title,
    subtitle: text.subtitle,
    summary: text.summary,
    nodes: scenario.nodes.map((node) => ({
      ...node,
      ...(text.nodes[node.id] ?? {}),
    })),
    edges: scenario.edges.map((edge) => ({
      ...edge,
      ...(text.edges[edge.id] ?? {}),
    })),
    steps: scenario.steps.map((step) => ({
      ...step,
      ...(text.steps[step.id] ?? {}),
    })),
  }
}

export const directionLabel = (direction: ImpactDirection, language: Language) => {
  if (direction === 'up') return uiText[language].probabilityRises
  if (direction === 'down') return uiText[language].probabilityFalls
  return uiText[language].mixedSignal
}
