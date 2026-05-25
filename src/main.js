import "./styles.css";
import whitepaperEN from "../docs/whitepaper/Causeway_Technical_Economic_Whitepaper_v0.6_EN.html?raw";
import whitepaperES from "../docs/whitepaper/Causeway_Technical_Economic_Whitepaper_v0.6_ES.html?raw";
import whitepaperFR from "../docs/whitepaper/Causeway_Technical_Economic_Whitepaper_v0.6_FR.html?raw";
import whitepaperKO from "../docs/whitepaper/Causeway_Technical_Economic_Whitepaper_v0.6_KO.html?raw";
import whitepaperZH from "../docs/whitepaper/Causeway_Technical_Economic_Whitepaper_v0.6_ZH.html?raw";

document.body.classList.add("intro-playing");

const recipes = [
  {
    icon: "01",
    title: "Election Market Chain",
    body: "Start from one election outcome and review the second-order markets it may affect before building any order.",
    tags: ["Politics", "Outcome Token"],
  },
  {
    icon: "02",
    title: "Macro Shock Script",
    body: "Trace how rates, CPI, commodities, crypto, and policy markets connect through a single market thesis.",
    tags: ["Macro", "Causal Graph"],
  },
  {
    icon: "03",
    title: "Sports Event Basket",
    body: "Choose a team or match outcome, then keep every related market and outcome visible for manual review.",
    tags: ["Sports", "Market Network"],
  },
  {
    icon: "04",
    title: "Open Vault Preview",
    body: "Package rule-based probability exposure with eligibility, risk budgets, and NAV-style reporting logic.",
    tags: ["Vaults", "Risk Budget"],
  },
];

const quickStart = [
  ["01", "SELECT ROOT MARKET", "Start with a real Polymarket market and result condition, not a loose market title.", "root: market + result"],
  ["02", "BUILD MARKET GRAPH", "Causeway maps related markets, semantic relationships, and possible second-order effects.", "graph: relevance | direction | confidence"],
  ["03", "SCORE THE OPPORTUNITY", "Compare market pricing with AI-estimated probability, then account for fees, slippage, liquidity, rules, and source risk.", "score = probability gap - costs - risk"],
  ["04", "PREVIEW AND REVIEW", "Turn the signal into a user-reviewed action plan with optional audit records when stronger traceability is needed.", "gate: preview | review | confirm"],
];

const dappHref = "/#quickstart";
const docsHref = "/docs";

const heroMarkets = [
  { label: "Fed rate > 5.25%", icon: "FED", meta: "Root market", odds: "41%", x: 50, y: 50, center: true },
  { label: "CPI print", icon: "CPI", meta: "18 markets", odds: "+0.7%", x: 28, y: 22 },
  { label: "BTC weekly close", icon: "BTC", meta: "31 markets", odds: "-1.8%", x: 64, y: 18 },
  { label: "Treasury auction", icon: "UST", meta: "12 markets", odds: "+2.1%", x: 78, y: 34 },
  { label: "FOMC wording", icon: "DOC", meta: "9 markets", odds: "VERIFY", x: 80, y: 62 },
  { label: "Dollar index", icon: "DXY", meta: "14 markets", odds: "+3.4%", x: 62, y: 82 },
  { label: "Gold reaction", icon: "GLD", meta: "11 markets", odds: "-0.9%", x: 35, y: 80 },
  { label: "Election economy", icon: "POL", meta: "24 markets", odds: "+1.2%", x: 18, y: 58 },
  { label: "Bank stress", icon: "BNK", meta: "7 markets", odds: "WATCH", x: 20, y: 38 },
];

const docLanguages = [
  ["EN", "English"],
  ["ZH", "中文"],
  ["KO", "한국어"],
  ["ES", "Español"],
  ["FR", "Français"],
];

const whitepaperRaw = {
  EN: whitepaperEN,
  ZH: whitepaperZH,
  KO: whitepaperKO,
  ES: whitepaperES,
  FR: whitepaperFR,
};

const docCopy = {
  EN: {
    eyebrow: "- DOCS / WHITEPAPER",
    title: "Whitepaper v0.6, rebuilt as browsable docs.",
    body: "The whitepaper now lives inside the site as a chaptered product document. Switch language, scan the thesis, and open the sections that matter without downloading a PDF.",
    toc: "Chapter Index",
    reading: "Reading view",
  },
  ZH: {
    eyebrow: "- 文档 / 白皮书",
    title: "v0.6 白皮书，改为站内章节文档。",
    body: "白皮书不再作为主入口 PDF，而是在页面中按章节组织。你可以切换语言、浏览核心论点，并直接阅读需要的章节。",
    toc: "章节目录",
    reading: "阅读区",
  },
  KO: {
    eyebrow: "- 문서 / 백서",
    title: "v0.6 백서를 탐색 가능한 문서로 재구성했습니다.",
    body: "백서는 PDF 다운로드가 아니라 사이트 안의 장별 문서로 제공됩니다. 언어를 전환하고 핵심 논지를 빠르게 확인할 수 있습니다.",
    toc: "장 색인",
    reading: "읽기 화면",
  },
  ES: {
    eyebrow: "- DOCS / WHITEPAPER",
    title: "Whitepaper v0.6 convertido en documentación navegable.",
    body: "El whitepaper vive dentro del sitio como un documento por capítulos. Cambia el idioma, revisa la tesis y abre la sección que necesites sin descargar un PDF.",
    toc: "Índice de capítulos",
    reading: "Vista de lectura",
  },
  FR: {
    eyebrow: "- DOCS / LIVRE BLANC",
    title: "Le livre blanc v0.6 devient une documentation navigable.",
    body: "Le livre blanc est intégré au site sous forme de chapitres. Changez de langue, parcourez la thèse et ouvrez les sections utiles sans télécharger de PDF.",
    toc: "Index des chapitres",
    reading: "Vue de lecture",
  },
};

const docChapters = [
  {
    id: "01",
    title: {
      EN: "Executive Summary",
      ZH: "执行摘要",
      KO: "요약",
      ES: "Resumen ejecutivo",
      FR: "Résumé exécutif",
    },
    body: {
      EN: "Causeway is an AI trading-intelligence and verifiable reasoning layer for prediction markets. It turns Polymarket market data into market graphs, fair odds, edgeNet, risk previews, user-confirmed action, Arc proof, and signal track records.",
      ZH: "Causeway 是面向预测市场的 AI 交易智能与可验证推理层。它把 Polymarket 市场数据转化为市场图谱、公允概率、edgeNet、风险预览、用户确认、Arc proof 和信号记录。",
      KO: "Causeway는 예측 시장을 위한 AI 거래 인텔리전스와 검증 가능한 추론 레이어입니다. Polymarket 데이터를 시장 그래프, 공정 확률, edgeNet, 위험 미리보기, 사용자 확인, Arc proof 및 신호 기록으로 전환합니다.",
      ES: "Causeway es una capa de inteligencia de trading y razonamiento verificable para mercados de predicción. Convierte datos de Polymarket en grafos de mercado, probabilidades justas, edgeNet, vista de riesgo, confirmación del usuario, Arc proof y registro de señales.",
      FR: "Causeway est une couche d'intelligence de trading et de raisonnement vérifiable pour les marchés de prédiction. Elle transforme les données Polymarket en graphes de marché, cotes justes, edgeNet, aperçu du risque, confirmation utilisateur, Arc proof et historique des signaux.",
    },
  },
  {
    id: "02",
    title: { EN: "Market Context", ZH: "市场背景", KO: "시장 배경", ES: "Contexto de mercado", FR: "Contexte de marché" },
    body: {
      EN: "Prediction markets are shifting from event-betting pages into probability infrastructure. As liquidity and market count grow, users need systems that explain relationships, latency, source quality, and execution constraints.",
      ZH: "预测市场正在从事件下注页面转向概率基础设施。随着流动性和市场数量增长，用户需要系统解释市场关系、信息滞后、来源质量和执行约束。",
      KO: "예측 시장은 이벤트 베팅 페이지에서 확률 인프라로 이동하고 있습니다. 유동성과 시장 수가 증가하면서 관계, 지연, 출처 품질, 실행 제약을 설명하는 시스템이 필요합니다.",
      ES: "Los mercados de predicción pasan de páginas de apuestas sobre eventos a infraestructura de probabilidad. Al crecer liquidez y número de mercados, se necesitan sistemas que expliquen relaciones, latencia, fuentes y ejecución.",
      FR: "Les marchés de prédiction passent de pages de pari événementiel à une infrastructure de probabilités. Avec la croissance de la liquidité et des marchés, il faut expliquer relations, latence, sources et contraintes d'exécution.",
    },
  },
  {
    id: "03",
    title: { EN: "Problem", ZH: "核心问题", KO: "핵심 문제", ES: "Problema", FR: "Problème" },
    body: {
      EN: "Markets are networks, but most interfaces still show lists. AI answers often lack snapshots, token mapping, risk gates, proof, and performance records.",
      ZH: "市场是网络，但多数界面仍是列表。普通 AI 回答缺少快照、token 映射、风险门控、证明和绩效记录。",
      KO: "시장은 네트워크이지만 대부분의 인터페이스는 여전히 목록입니다. 일반 AI 답변에는 스냅샷, 토큰 매핑, 위험 게이트, proof, 성과 기록이 부족합니다.",
      ES: "Los mercados son redes, pero muchas interfaces siguen siendo listas. Las respuestas de IA suelen carecer de snapshots, mapeo de tokens, control de riesgo, prueba y rendimiento.",
      FR: "Les marchés sont des réseaux, mais beaucoup d'interfaces restent des listes. Les réponses IA manquent souvent de snapshots, mapping de tokens, garde-fous, preuve et performance.",
    },
  },
  {
    id: "04",
    title: { EN: "Academic Foundation", ZH: "学术基础", KO: "학술 기반", ES: "Base académica", FR: "Fondation académique" },
    body: {
      EN: "The model separates market-implied probability from executable probability, then applies transaction friction, source risk, semantic relationships, conservative Kelly sizing, Brier score, log loss, and calibration.",
      ZH: "模型区分市场隐含概率与可执行概率，并加入交易摩擦、来源风险、语义关系、保守 Kelly 仓位、Brier Score、Log Loss 和校准指标。",
      KO: "모델은 시장 내재 확률과 실행 가능 확률을 구분하고 거래 마찰, 출처 위험, 의미 관계, 보수적 Kelly sizing, Brier score, log loss, calibration을 적용합니다.",
      ES: "El modelo separa probabilidad implícita y ejecutable, y aplica fricción, riesgo de fuente, relaciones semánticas, Kelly conservador, Brier score, log loss y calibración.",
      FR: "Le modèle distingue probabilité implicite et probabilité exécutable, puis ajoute friction, risque de source, relations sémantiques, Kelly conservateur, Brier score, log loss et calibration.",
    },
  },
  {
    id: "05",
    title: { EN: "Product Definition", ZH: "产品定义", KO: "제품 정의", ES: "Definición del producto", FR: "Définition produit" },
    body: {
      EN: "Causeway is a Trader Intelligence Layer: market data base, market graph, AI reasoning engine, trading intelligence, order preview, Arc verification, and signal performance tracking.",
      ZH: "Causeway 是 Trader Intelligence Layer：市场数据底座、市场图谱、AI 推理引擎、交易智能、订单预览、Arc 可验证层和信号绩效追踪。",
      KO: "Causeway는 Trader Intelligence Layer입니다: 시장 데이터 기반, 시장 그래프, AI 추론 엔진, 거래 인텔리전스, 주문 미리보기, Arc 검증, 신호 성과 추적.",
      ES: "Causeway es una Trader Intelligence Layer: datos de mercado, grafo, motor de razonamiento IA, inteligencia de trading, preview de orden, verificación Arc y seguimiento de señales.",
      FR: "Causeway est une Trader Intelligence Layer : données de marché, graphe, moteur de raisonnement IA, intelligence de trading, aperçu d'ordre, vérification Arc et suivi des signaux.",
    },
  },
  {
    id: "06",
    title: { EN: "Solved Problems", ZH: "已解决问题", KO: "해결한 문제", ES: "Problemas resueltos", FR: "Problèmes résolus" },
    body: {
      EN: "The current build focuses on outcome-token mapping, causal scripts, order preview, builder attribution, Arc reasoning trace proof, and Arc USDC premium payment verification.",
      ZH: "当前版本聚焦 outcome-token 映射、因果脚本、订单预览、builder 归因、Arc reasoning trace proof 和 Arc USDC premium 支付验证。",
      KO: "현재 빌드는 outcome-token 매핑, causal script, order preview, builder attribution, Arc reasoning trace proof, Arc USDC premium 결제 검증에 집중합니다.",
      ES: "La versión actual cubre mapeo outcome-token, scripts causales, preview de orden, atribución builder, Arc reasoning trace proof y verificación de pago Arc USDC premium.",
      FR: "La version actuelle couvre mapping outcome-token, scripts causaux, aperçu d'ordre, attribution builder, Arc reasoning trace proof et vérification de paiement Arc USDC premium.",
    },
  },
  {
    id: "07",
    title: { EN: "Architecture", ZH: "系统架构", KO: "아키텍처", ES: "Arquitectura", FR: "Architecture" },
    body: {
      EN: "The system combines React, NestJS, Prisma/PostgreSQL, Polymarket Gamma/CLOB data, structured AI output, Arc proof, and USDC payment verification.",
      ZH: "系统结合 React、NestJS、Prisma/PostgreSQL、Polymarket Gamma/CLOB 数据、结构化 AI 输出、Arc proof 和 USDC 支付验证。",
      KO: "시스템은 React, NestJS, Prisma/PostgreSQL, Polymarket Gamma/CLOB 데이터, 구조화된 AI 출력, Arc proof, USDC 결제 검증을 결합합니다.",
      ES: "El sistema combina React, NestJS, Prisma/PostgreSQL, datos Gamma/CLOB de Polymarket, salida IA estructurada, Arc proof y verificación USDC.",
      FR: "Le système combine React, NestJS, Prisma/PostgreSQL, données Gamma/CLOB Polymarket, sortie IA structurée, Arc proof et vérification USDC.",
    },
  },
  {
    id: "08",
    title: { EN: "AI Trader Intelligence", ZH: "AI 交易智能", KO: "AI 트레이더 인텔리전스", ES: "Inteligencia de trading IA", FR: "Intelligence de trading IA" },
    body: {
      EN: "Signals include market odds, AI fair odds, edge, confidence, recommendation, risk level, suggested size, and change-my-mind conditions.",
      ZH: "信号包含 market odds、AI fair odds、edge、confidence、recommendation、risk level、suggested size 和 change-my-mind 条件。",
      KO: "신호에는 market odds, AI fair odds, edge, confidence, recommendation, risk level, suggested size, change-my-mind 조건이 포함됩니다.",
      ES: "Las señales incluyen market odds, AI fair odds, edge, confianza, recomendación, nivel de riesgo, tamaño sugerido y condiciones change-my-mind.",
      FR: "Les signaux incluent market odds, AI fair odds, edge, confiance, recommandation, niveau de risque, taille suggérée et conditions change-my-mind.",
    },
  },
  {
    id: "09",
    title: { EN: "Arc Proof", ZH: "Arc Proof", KO: "Arc Proof", ES: "Arc Proof", FR: "Arc Proof" },
    body: {
      EN: "Arc proof anchors the reasoning trace hash so signal performance can be audited as pre-event, unchanged, and linked to the original market snapshot.",
      ZH: "Arc proof 锚定 reasoning trace hash，使信号绩效可以证明是事前生成、未被静默修改，并关联原始市场快照。",
      KO: "Arc proof는 reasoning trace hash를 고정하여 신호가 사전에 생성되었고 변경되지 않았으며 원본 시장 스냅샷에 연결됨을 감사할 수 있게 합니다.",
      ES: "Arc proof ancla el hash de reasoning trace para auditar que la señal existía antes del evento, no fue modificada y corresponde al snapshot original.",
      FR: "Arc proof ancre le hash de reasoning trace pour prouver que le signal existait avant l'événement, n'a pas été modifié et correspond au snapshot original.",
    },
  },
  {
    id: "10",
    title: { EN: "Arc USDC Economy", ZH: "Arc USDC 经济", KO: "Arc USDC 경제", ES: "Economía Arc USDC", FR: "Économie Arc USDC" },
    body: {
      EN: "Arc USDC supports premium membership, verifiable payment records, report unlocks, API calls, and future agent capability settlement.",
      ZH: "Arc USDC 支持 premium 会员、可验证支付记录、报告解锁、API 调用和未来智能体能力结算。",
      KO: "Arc USDC는 premium 멤버십, 검증 가능한 결제 기록, 보고서 잠금 해제, API 호출, 미래 agent 기능 정산을 지원합니다.",
      ES: "Arc USDC admite membresía premium, registros de pago verificables, desbloqueo de reportes, API calls y futura liquidación de capacidades agent.",
      FR: "Arc USDC prend en charge abonnement premium, paiements vérifiables, déblocage de rapports, appels API et règlement futur des capacités agent.",
    },
  },
  {
    id: "11",
    title: { EN: "x402 Agent Service Layer", ZH: "x402 智能体服务层", KO: "x402 에이전트 서비스 계층", ES: "Capa de servicio x402", FR: "Couche de service x402" },
    body: {
      EN: "x402 is positioned as a future agent-to-service payment and access protocol for data sources, verification, specialized agents, reports, and APIs, not as the trading execution layer.",
      ZH: "x402 被定位为未来智能体到服务的支付与访问协议，用于数据源、验证、专业智能体、报告和 API，而不是交易执行层。",
      KO: "x402는 거래 실행 레이어가 아니라 데이터 소스, 검증, 전문 agent, 보고서, API를 위한 미래 agent-to-service 결제 및 접근 프로토콜입니다.",
      ES: "x402 se posiciona como protocolo futuro de pago y acceso agent-to-service para datos, verificación, agentes especializados, reportes y APIs, no como ejecución de trading.",
      FR: "x402 est un futur protocole de paiement et d'accès agent-to-service pour données, vérification, agents spécialisés, rapports et API, pas une couche d'exécution trading.",
    },
  },
  {
    id: "12",
    title: { EN: "Swarm Prediction Engine", ZH: "群体智能预测引擎", KO: "군집 예측 엔진", ES: "Motor de predicción colectiva", FR: "Moteur de prédiction collective" },
    body: {
      EN: "The long-term engine builds parallel market worlds and coordinates research, graph, probability, skeptic, verification, risk, execution guard, and report agents.",
      ZH: "长期引擎构建平行市场世界，并协调研究、图谱、概率、怀疑、验证、风险、执行守门和报告智能体。",
      KO: "장기 엔진은 병렬 시장 세계를 만들고 research, graph, probability, skeptic, verification, risk, execution guard, report agent를 조율합니다.",
      ES: "El motor de largo plazo construye mundos de mercado paralelos y coordina agentes de investigación, grafo, probabilidad, escepticismo, verificación, riesgo, guardia de ejecución y reporte.",
      FR: "Le moteur long terme construit des mondes de marché parallèles et coordonne agents recherche, graphe, probabilité, sceptique, vérification, risque, garde d'exécution et rapport.",
    },
  },
  {
    id: "13",
    title: { EN: "Workflow", ZH: "用户工作流", KO: "사용자 워크플로", ES: "Flujo de usuario", FR: "Workflow utilisateur" },
    body: {
      EN: "The user connects a wallet, selects a root outcome, reviews the reasoning graph, previews the order, confirms action, anchors proof, and tracks the signal result.",
      ZH: "用户连接钱包、选择 root outcome、审查推理图、预览订单、确认行动、锚定 proof，并追踪信号结果。",
      KO: "사용자는 지갑 연결, root outcome 선택, 추론 그래프 검토, 주문 미리보기, 실행 확인, proof anchoring, 신호 결과 추적을 진행합니다.",
      ES: "El usuario conecta wallet, elige root outcome, revisa el grafo de razonamiento, previsualiza la orden, confirma, ancla proof y sigue el resultado.",
      FR: "L'utilisateur connecte un wallet, choisit un root outcome, révise le graphe, prévisualise l'ordre, confirme, ancre la preuve et suit le résultat.",
    },
  },
  {
    id: "14",
    title: { EN: "Risk & Governance", ZH: "风控与治理", KO: "위험 및 거버넌스", ES: "Riesgo y gobernanza", FR: "Risque et gouvernance" },
    body: {
      EN: "Risk controls cover data, information, reasoning, market liquidity, execution, auditability, user confirmation, and future revocable delegation.",
      ZH: "风控覆盖数据、信息、推理、市场流动性、执行、审计、用户确认和未来可撤销委托。",
      KO: "위험 제어는 데이터, 정보, 추론, 시장 유동성, 실행, 감사, 사용자 확인 및 미래 취소 가능한 위임을 포함합니다.",
      ES: "Los controles cubren datos, información, razonamiento, liquidez, ejecución, auditoría, confirmación del usuario y delegación revocable futura.",
      FR: "Les contrôles couvrent données, information, raisonnement, liquidité, exécution, audit, confirmation utilisateur et délégation révocable future.",
    },
  },
  {
    id: "15",
    title: { EN: "Future Problems", ZH: "未来问题", KO: "미래 과제", ES: "Problemas futuros", FR: "Problèmes futurs" },
    body: {
      EN: "Future work focuses on source authenticity, multi-agent reasoning, signal performance proof, and stronger governance for bounded automation.",
      ZH: "未来工作聚焦来源真实性、多智能体推理、信号绩效证明，以及有限自动化所需的更强治理。",
      KO: "미래 작업은 출처 진위, 다중 agent 추론, 신호 성과 증명, 제한적 자동화를 위한 강한 거버넌스에 집중합니다.",
      ES: "El trabajo futuro se centra en autenticidad de fuentes, razonamiento multiagente, prueba de rendimiento de señales y gobernanza para automatización limitada.",
      FR: "Les travaux futurs portent sur l'authenticité des sources, le raisonnement multi-agent, la preuve de performance et la gouvernance de l'automatisation bornée.",
    },
  },
  {
    id: "16",
    title: { EN: "Roadmap", ZH: "路线图", KO: "로드맵", ES: "Hoja de ruta", FR: "Feuille de route" },
    body: {
      EN: "The five phases are Market Data Foundation, Reasoning Model, Real-Time Scenario Generation, Verification & Arc Proof, and Delegated AI Execution.",
      ZH: "五阶段包括 Market Data Foundation、Reasoning Model、Real-Time Scenario Generation、Verification & Arc Proof 和 Delegated AI Execution。",
      KO: "5단계는 Market Data Foundation, Reasoning Model, Real-Time Scenario Generation, Verification & Arc Proof, Delegated AI Execution입니다.",
      ES: "Las cinco fases son Market Data Foundation, Reasoning Model, Real-Time Scenario Generation, Verification & Arc Proof y Delegated AI Execution.",
      FR: "Les cinq phases sont Market Data Foundation, Reasoning Model, Real-Time Scenario Generation, Verification & Arc Proof et Delegated AI Execution.",
    },
  },
  {
    id: "17",
    title: { EN: "Economic Model", ZH: "商业模式", KO: "경제 모델", ES: "Modelo económico", FR: "Modèle économique" },
    body: {
      EN: "Revenue paths include premium subscription, builder attribution, Signal API, team workspace, x402 agent services, swarm prediction reports, and agent marketplace.",
      ZH: "收入路径包括 premium subscription、builder attribution、Signal API、team workspace、x402 agent services、swarm prediction reports 和 agent marketplace。",
      KO: "수익 경로는 premium subscription, builder attribution, Signal API, team workspace, x402 agent services, swarm prediction reports, agent marketplace입니다.",
      ES: "Las vías de ingreso incluyen suscripción premium, builder attribution, Signal API, workspace de equipo, servicios x402, reportes swarm y marketplace de agents.",
      FR: "Les revenus incluent abonnement premium, builder attribution, Signal API, workspace équipe, services x402, rapports swarm et marketplace d'agents.",
    },
  },
  {
    id: "18",
    title: { EN: "Moat & Metrics", ZH: "护城河与指标", KO: "해자와 지표", ES: "Moat e indicadores", FR: "Moat et métriques" },
    body: {
      EN: "Moats come from market-structure understanding, reasoning data loops, Arc-verifiable history, user governance, x402 service access, and swarm prediction capability.",
      ZH: "护城河来自市场结构理解、推理数据闭环、Arc 可验证历史、用户治理、x402 服务入口和群体智能预测能力。",
      KO: "해자는 시장 구조 이해, 추론 데이터 루프, Arc 검증 기록, 사용자 거버넌스, x402 서비스 접근, 군집 예측 능력에서 나옵니다.",
      ES: "El moat surge de entender estructura de mercado, loops de razonamiento, historia verificable en Arc, gobernanza de usuario, acceso x402 y capacidad swarm.",
      FR: "Le moat vient de la compréhension de structure marché, boucles de raisonnement, historique vérifiable Arc, gouvernance utilisateur, accès x402 et capacité swarm.",
    },
  },
  {
    id: "19",
    title: { EN: "References", ZH: "参考资料", KO: "참고자료", ES: "Referencias", FR: "Références" },
    body: {
      EN: "The research base includes prediction-market theory, economic forecasting papers, arbitrage research, Polymarket documentation, Arc documentation, and x402 protocol references.",
      ZH: "研究基础包括预测市场理论、经济预测论文、套利研究、Polymarket 文档、Arc 文档和 x402 协议资料。",
      KO: "연구 기반은 예측 시장 이론, 경제 예측 논문, 차익거래 연구, Polymarket 문서, Arc 문서, x402 프로토콜 자료를 포함합니다.",
      ES: "La base incluye teoría de mercados de predicción, papers de forecasting económico, investigación de arbitraje, documentación Polymarket, Arc y x402.",
      FR: "La base comprend théorie des marchés de prédiction, articles de prévision économique, recherche d'arbitrage, documentation Polymarket, Arc et x402.",
    },
  },
];

const intelligenceFlow = [
  ["01", "Market Data", "Events, markets, result conditions, prices, depth, rules, and active state."],
  ["02", "Market Graph", "Related markets, implication edges, mutual exclusion, exposure overlap, and affected themes."],
  ["03", "Probability Estimate", "AI-estimated probabilities with assumptions, evidence quality, and confidence notes."],
  ["04", "Opportunity Score", "Estimated edge after fees, spread, slippage, rule risk, source risk, and liquidity limits."],
  ["05", "User Gate", "BUY, WATCH, VERIFY FIRST, or AVOID remains a preview until the user confirms action."],
  ["06", "Review Record", "Reasoning, signal results, calibration, and track record become easier to review over time."],
];

const marketObject = [
  ["rootMarket", "Fed Funds Rate > 5.25% by Sep 30, 2026"],
  ["resultCondition", "YES outcome selected"],
  ["marketOdds", "41.0%"],
  ["aiProbability", "48.6%"],
  ["opportunityScore", "+4.2% after costs and risk"],
  ["recommendation", "VERIFY FIRST"],
  ["riskFlags", "source risk: medium / liquidity: pass"],
  ["reviewRecord", "optional audit trail"],
];

const proofTimeline = [
  ["Inference Created", "market snapshot + prompt schema"],
  ["Review Capsule", "stable reasoning record"],
  ["Optional Anchor", "audit trail before result"],
  ["Signal Result", "price and resolution tracking"],
  ["Track Record", "Brier, log loss, PnL, calibration"],
];

const signalMetrics = [
  ["1,842", "Signals tracked"],
  ["72.4%", "Illustrative win rate"],
  ["0.128", "Avg. Brier score"],
  ["836", "Audit anchored"],
];

const researchItems = [
  ["Market-implied probability", "Use prices as signals, not unconditional truth."],
  ["Conservative Kelly", "Shrink confidence and cap size by depth, budget, and correlation."],
  ["Semantic relationships", "Detect implication, mutual exclusion, and market-rule inconsistencies."],
  ["Calibration metrics", "Evaluate probability quality with Brier score, log loss, and track records."],
];

const boundaryItems = [
  ["See the market", "Start from one market and reveal the related markets, risks, and open questions around it."],
  ["Review the reasoning", "Keep assumptions, market context, and the decision path visible before taking action."],
  ["Measure the signal", "Track probability estimates, opportunity scores, source quality, and later outcomes."],
  ["Expand with control", "As agents mature, delegation can become optional, limited, revocable, and auditable."],
];

const controls = [
  {
    step: "01 / SIMULATE",
    label: "WORLD",
    title: "Build parallel market worlds.",
    body: "Causeway's long-term engine turns one real-world event into multiple market worlds with different assumptions, information delays, source confidence, and liquidity states.",
    fields: [
      ["seed event", "policy shock"],
      ["agent groups", "128"],
      ["environment", "market world"],
      ["rounds", "24"],
    ],
  },
  {
    step: "02 / EVOLVE",
    label: "SWARM",
    title: "Let specialized agents disagree.",
    body: "Research, market graph, probability, skeptic, verification, risk, execution guard, and report agents debate the same market graph before a signal reaches preview.",
    flow: ["research", "skeptic", "verify", "risk"],
  },
  {
    step: "03 / PREDICT",
    label: "REPORT",
    title: "Compress debate into intelligence.",
    body: "The output is not an order. It is a structured market-intelligence object: scenario tree, probability estimate, opportunity score, risk budget, review record, and track record entry.",
    alert: "Future delegation stays optional, bounded, revocable, and auditable.",
  },
];

const featureCards = [
  {
    icon: "event",
    title: "Events cast wider shadows",
    body: "A single headline can move through policy, macro, sports, crypto, and election markets. Causeway helps reveal the wider field before you act.",
    visual: "event -> market shadow",
  },
  {
    icon: "path",
    title: "Theses need structure",
    body: "Causeway turns one market idea into a readable path: what it may affect, why it matters, and where the next decision point sits.",
    visual: "thesis -> path -> decision",
  },
  {
    icon: "logic",
    title: "Reasoning must be visible",
    body: "Useful AI does not just answer. It shows assumptions, confidence, uncertainty, and the reasoning behind each market connection.",
    visual: "assumptions + confidence + why",
  },
  {
    icon: "bound",
    title: "Speed needs governance",
    body: "Fast response is only valuable when control stays clear. Causeway keeps review, confirmation, and final action inside a user-governed workflow.",
    visual: "reason -> review -> approve",
    highlight: true,
  },
  {
    icon: "view",
    title: "Previews reduce blind action",
    body: "Before a scenario becomes real exposure, Causeway turns it into a preview with expected action, limits, risk checks, and audit trail.",
    visual: "scenario -> preview -> record",
  },
  {
    icon: "mem",
    title: "Strategies need memory",
    body: "Repeated scripts can mature into transparent strategies with mandates, eligibility rules, risk budgets, and reporting logic.",
    visual: "script -> strategy -> report",
  },
];

const roadmap = [
  {
    phase: "01",
    status: "Now",
    theme: "Market Data Foundation",
    headline: "Understand the market before touching the world.",
    summary:
      "Phase one focuses on Polymarket market data first. External sources are a later source-object layer.",
    detail:
      "Causeway starts by building a reliable map of the market itself: events, markets, result conditions, prices, liquidity, order books, resolution state, and recent market changes. The goal is not to rush into news ingestion. The goal is to make sure every AI-generated path can resolve back to real, tradable market structure before it becomes a preview or user decision.",
    points: ["Market and result-condition mapping", "Liquidity and order book awareness", "Dry-run previews before any real execution"],
    signal: "Data -> Structure",
  },
  {
    phase: "02",
    status: "Next",
    theme: "Reasoning Model",
    headline: "Map one event into every related market.",
    summary:
      "Build a stronger inference model that can identify all markets touched by a news event, then score relevance, direction, confidence, and suggested action.",
    detail:
      "A single event rarely affects only one market. A Federal Reserve signal may touch rates, inflation, equities, crypto, election narratives, and commodity expectations. This phase turns that relationship into an auditable market graph: each connected market gets a reason, an impact direction, a confidence score, and a recommended workflow state such as monitor, avoid, preview, or reduce size.",
    points: ["Cross-market relationship graph", "Relevance, direction, confidence, and tradability scoring", "Structured recommendations that remain reviewable"],
    signal: "Event -> Market Graph",
  },
  {
    phase: "03",
    status: "Later",
    theme: "Real-Time Scenario Generation",
    headline: "Turn live news into cross-market scripts.",
    summary:
      "Build real-time news stream ingestion and automated scenario generation so one event can produce a full-market response plan quickly.",
    detail:
      "At this stage, Causeway moves from offline reasoning into live event response. The system watches real-time news flow, extracts the event, identifies entities and affected themes, then generates a complete market script: what happened, which markets matter, which outcomes should be watched, what confirmation signals are missing, and which actions should be queued for human review.",
    points: ["Real-time news flow ingestion", "Automatic script generation from one event", "Fast all-market reaction while preserving review gates"],
    signal: "News -> Script",
  },
  {
    phase: "04",
    status: "Trust",
    theme: "Source Verification Layer",
    headline: "Verify the ground truth before action.",
    summary:
      "Before a bet is placed, Causeway should verify the deepest available source of truth through an authority-data library.",
    detail:
      "Speed is not enough if the source is wrong. This phase adds a verification layer that traces claims back to primary or authoritative sources: official releases, regulatory filings, sports league data, court documents, government databases, company statements, and on-chain records. Before an action is previewed, the system can show source trail, freshness, conflicts, and whether the original claim was corrected or misread.",
    points: ["Authority source database", "Primary-source trail and freshness checks", "Conflict detection before order preview"],
    signal: "Claim -> Proof",
  },
  {
    phase: "05",
    status: "Future",
    theme: "Delegated AI Execution",
    headline: "Let users optionally delegate bounded execution to AI.",
    summary:
      "In the future, users may choose to leave the manual verification layer and grant limited account authority to AI for intelligent order execution.",
    detail:
      "Delegation is the future layer, not the default boundary. Users can choose to authorize AI execution only inside explicit limits: market categories, maximum order size, loss budget, time window, data-source requirements, and revocation rules. The system should maintain audit trails, permission expiry, and emergency stop controls so autonomy is optional, bounded, and accountable.",
    points: ["Optional permission delegation", "User-defined limits and risk budgets", "Audit trails, expiry, and emergency revocation"],
    signal: "Approve -> Delegate",
  },
];

const comparePrinciples = [
  {
    num: "01",
    title: "Market-native",
    body: "Causeway treats events, related markets, result conditions, liquidity, and rules as first-class objects instead of reducing a market to a title.",
    tag: "structure before signal",
  },
  {
    num: "02",
    title: "Reasoning-visible",
    body: "Every signal is expected to show assumptions, source state, confidence, risk flags, and the path from market data to preview.",
    tag: "inspectable AI",
  },
  {
    num: "03",
    title: "User-governed",
    body: "AI can expand a thesis and prepare an order plan, but custody, confirmation, and final action remain user-controlled by default.",
    tag: "control by default",
  },
];

const compareRows = [
  ["Market structure", "Events, related markets, result conditions", "Titles and tabs", "Loose text prompt", "Bot-specific schema"],
  ["AI output", "Probability estimate, opportunity score, risk flags", "Research notes", "Natural language only", "Trade trigger"],
  ["Risk state", "BUY / WATCH / VERIFY FIRST / AVOID", "Manual judgment", "Usually omitted", "Often bypassed"],
  ["Review record", "Reasoning trail and optional audit anchor", "Screenshots or notes", "Conversation history", "Rarely native"],
  ["Control boundary", "User confirmation by default", "Required", "Not applicable", "May be optional"],
];

const faqs = [
  [
    "Will Causeway place trades for me automatically?",
    "No. Causeway helps analyze market relationships, prepare risk previews, and shape action plans. Real orders remain user-confirmed by default.",
  ],
  [
    "Why look beyond a single market?",
    "One event can affect many related markets. Causeway organizes those relationships into a market map so users can see missed links, conflicts, and possible opportunities.",
  ],
  [
    "How can AI reasoning be reviewed later?",
    "Each run can preserve the market snapshot, assumptions, risk notes, and signal result. When stronger auditability is needed, the reasoning record can also be anchored on Arc.",
  ],
  [
    "What is an opportunity score?",
    "It is an estimated edge after price, fees, spread, slippage, liquidity limits, rule ambiguity, source risk, and model-confidence haircuts.",
  ],
  [
    "What role does x402 play in Causeway?",
    "x402 is better suited for future data, verification, report, and specialized-agent service payments. It is not the trading execution protocol.",
  ],
];

function recipeCard(recipe) {
  return `
    <article class="recipe-card">
      <div class="recipe-top">
        <span class="recipe-icon">${recipe.icon}</span>
        <span class="ready">READY</span>
      </div>
      <h3>${recipe.title}</h3>
      <p>${recipe.body}</p>
      <div class="card-bottom">
        <div>${recipe.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
        <a href="#quickstart">Run -></a>
      </div>
    </article>
  `;
}

function dappButton(className = "") {
  return `<a class="nav-cta ${className}" href="${dappHref}">Launch App</a>`;
}

function flowStep([num, title, body]) {
  return `
    <article class="flow-step">
      <span>${num}</span>
      <h3>${title}</h3>
      <p>${body}</p>
    </article>
  `;
}

function marketObjectRow([key, value]) {
  return `<div><span>${key}</span><b>${value}</b></div>`;
}

function proofStep([title, body], index) {
  return `
    <div class="proof-step" style="--proof-index: ${index}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${title}</strong>
      <p>${body}</p>
    </div>
  `;
}

function metricCard([value, label]) {
  return `<div><b>${value}</b><span>${label}</span></div>`;
}

function researchCard([title, body]) {
  return `
    <article class="research-card">
      <h3>${title}</h3>
      <p>${body}</p>
    </article>
  `;
}

function boundaryCard([status, body]) {
  return `
    <article class="boundary-card">
      <span>${status}</span>
      <p>${body}</p>
    </article>
  `;
}

function quickStartRow([num, title, body, code]) {
  return `
    <div class="terminal-row">
      <span class="terminal-num">${num}</span>
      <div>
        <h3>${title}</h3>
        <div class="code-line"><span>$</span> ${code}<button type="button" aria-label="Copy command">Copy</button></div>
        <p>${body}</p>
      </div>
    </div>
  `;
}

function controlCard(control) {
  return `
    <article class="control-card">
      <div class="card-kicker"><span>${control.step}</span></div>
      <strong class="blue-label">${control.label}</strong>
      <h3>${control.title}</h3>
      <p>${control.body}</p>
      ${
        control.fields
          ? `<div class="field-stack">${control.fields
              .map(([key, value]) => `<div><span>${key}</span><b>${value}</b></div>`)
              .join("")}</div>`
          : ""
      }
      ${
        control.flow
          ? `<div class="flow-line">${control.flow.map((item) => `<span>${item}</span>`).join("<i>-></i>")}</div>
             <small class="metric">p50 - 37 ms - 1.24M decisions today</small>`
          : ""
      }
      ${control.alert ? `<div class="notice-box"><b>Preview gated.</b><span>${control.alert}</span></div>` : ""}
    </article>
  `;
}

function featureCard(card) {
  return `
    <article class="feature-card ${card.highlight ? "feature-highlight" : ""}">
      <span class="feature-icon">${card.icon}</span>
      <h3>${card.title}</h3>
      <p>${card.body}</p>
      <div class="feature-visual">${card.visual}</div>
    </article>
  `;
}

function roadmapCard(item, index) {
  return `
    <article class="roadmap-card" style="--roadmap-index: ${index}">
      <div class="roadmap-card-head">
        <span class="roadmap-phase">Phase ${item.phase}</span>
        <span class="roadmap-status">${item.status}</span>
      </div>
      <h3>${item.theme}</h3>
      <p>${item.headline}</p>
      <div class="roadmap-signal"><span>${item.signal}</span></div>
    </article>
  `;
}

function roadmapDetail(item, index) {
  return `
    <details class="roadmap-detail" ${index === 0 ? "open" : ""}>
      <summary>
        <span>Phase ${item.phase}</span>
        <strong>${item.theme}</strong>
        <i>+</i>
      </summary>
      <div>
        <p>${item.summary}</p>
        <p>${item.detail}</p>
        <ul>
          ${item.points.map((point) => `<li>${point}</li>`).join("")}
        </ul>
      </div>
    </details>
  `;
}

function comparePrincipleCard(item) {
  return `
    <article class="compare-principle">
      <span>${item.num}</span>
      <h3>${item.title}</h3>
      <p>${item.body}</p>
      <b>${item.tag}</b>
    </article>
  `;
}

function compareTable() {
  return `
    <div class="compare-table">
      <div class="compare-head empty"></div>
      <div class="compare-head us"><img src="/assets/causeway-mark-reversed.svg" alt="" />Causeway <span>US</span></div>
      <div class="compare-head">Market Dashboard</div>
      <div class="compare-head">Generic AI Chat</div>
      <div class="compare-head">Automated Trading Bot</div>
      ${compareRows
        .map(
          (row) => `
            <div class="row-label">${row[0]}</div>
            <div class="us">${row[1]}</div>
            <div>${row[2]}</div>
            <div>${row[3]}</div>
            <div>${row[4]}</div>
          `,
        )
        .join("")}
    </div>
  `;
}

function faqItem([question, answer], index) {
  return `
    <details ${index === 0 ? "open" : ""}>
      <summary>${question}<span>+</span></summary>
      <p>${answer}</p>
    </details>
  `;
}

function heroGraphic() {
  return `
    <div class="hero-graphic" aria-label="Causeway market relationship graph">
      <div class="market-sphere">
        <div class="sphere-header">
          <span>Live Market Graph</span>
          <b>1 root -> 126 related markets</b>
        </div>
        <div class="market-sphere-stage">
          <span class="sphere-ring sphere-ring-one"></span>
          <span class="sphere-ring sphere-ring-two"></span>
          <span class="sphere-orbit"></span>
          <svg class="market-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${heroMarkets.map(heroMarketLink).join("")}
          </svg>
          ${heroMarkets.map(heroMarketNode).join("")}
        </div>
        <div class="sphere-footer">
          <span><b>Probability</b> 48.6%</span>
          <span><b>Opportunity</b> +4.2%</span>
          <span><b>gate</b> verify first</span>
        </div>
      </div>
    </div>
  `;
}

function heroMarketNode(market, index) {
  const nodeClass = market.center ? "market-node market-node-center" : "market-node";
  return `
    <div class="${nodeClass}" style="--node-x: ${market.x}%; --node-y: ${market.y}%; --node-index: ${index}">
      <span>${market.icon}</span>
      <div>
        <b>${market.label}</b>
        <small>${market.meta}</small>
      </div>
      <em>${market.odds}</em>
    </div>
  `;
}

function heroMarketLink(market, index) {
  if (market.center) return "";
  return `<line x1="50" y1="50" x2="${market.x}" y2="${market.y}" style="--link-index: ${index}" />`;
}

function normalizeWhitepaperHtml(html) {
  return html.replaceAll("../../public/", "/").replaceAll("../../", "/");
}

function textFrom(element, selector) {
  return element.querySelector(selector)?.textContent.trim() || "";
}

function extractWhitepaper(lang) {
  const parsed = new DOMParser().parseFromString(whitepaperRaw[lang], "text/html");
  const cover = parsed.querySelector(".cover");
  const pageSections = [...parsed.body.children].filter(
    (element) => element.tagName.toLowerCase() === "section" && !element.classList.contains("cover"),
  );
  const coverTitle = cover ? textFrom(cover, "h1").replace(/\s+/g, " ") : "Causeway Whitepaper";
  const coverContent = cover ? normalizeWhitepaperHtml(cover.innerHTML) : "";

  const sections = [
    {
      id: "00",
      label: "00. Cover & Disclaimer",
      eyebrow: "00 / Cover",
      title: coverTitle,
      html: coverContent,
    },
    ...pageSections.map((section, index) => {
      const title = textFrom(section, "h2");
      const eyebrow = textFrom(section, ".eyebrow");
      const idMatch = eyebrow.match(/^(\d{2})/);
      const id = idMatch?.[1] || (index === 0 ? "TOC" : String(index).padStart(2, "0"));
      const labelPrefix = id === "TOC" ? "TOC" : id;
      return {
        id,
        label: `${labelPrefix}. ${title}`,
        eyebrow,
        title,
        html: normalizeWhitepaperHtml(section.innerHTML),
      };
    }),
  ];

  return {
    coverTitle,
    sections,
  };
}

function docsIndexPanel(lang, index, documentData) {
  return `
    <div class="docs-index-panel ${index === 0 ? "is-active" : ""}" data-doc-index-panel="${lang}">
      <span data-doc-copy="toc">${docCopy[lang].toc}</span>
      ${documentData.sections
        .map(
          (section, sectionIndex) => `
            <button type="button" class="${sectionIndex === 0 ? "is-active" : ""}" data-doc-section="${section.id}">
              ${section.label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function docsLanguagePanel(lang, index, documentData) {
  const copy = docCopy[lang];
  return `
    <article class="docs-language-panel ${index === 0 ? "is-active" : ""}" data-doc-panel="${lang}">
      <div class="docs-reading-head">
        <span>${copy.reading}</span>
        <b>${documentData.coverTitle}</b>
      </div>
      <div class="docs-section-viewer">
        ${documentData.sections
          .map(
            (section, sectionIndex) => `
              <section class="docs-original-section ${sectionIndex === 0 ? "is-active" : ""}" data-doc-section-panel="${section.id}">
                ${section.html}
              </section>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function docsSection() {
  const activeCopy = docCopy.EN;
  const documents = Object.fromEntries(docLanguages.map(([code]) => [code, extractWhitepaper(code)]));
  return `
    <section class="docs-section section-band" id="docs">
      <div class="docs-shell">
        <div class="docs-top">
          <div class="section-copy">
            <p class="eyebrow" data-doc-copy="eyebrow">${activeCopy.eyebrow}</p>
            <h2 data-doc-copy="title">${activeCopy.title}</h2>
            <p data-doc-copy="body">${activeCopy.body}</p>
          </div>
          <div class="docs-controls" aria-label="Document language">
            ${docLanguages
              .map(
                ([code, label], index) =>
                  `<button type="button" class="${index === 0 ? "is-active" : ""}" data-doc-lang="${code}"><span>${code}</span>${label}</button>`,
              )
              .join("")}
          </div>
        </div>
        <div class="docs-body">
          <aside class="docs-index">
            ${docLanguages.map(([code], index) => docsIndexPanel(code, index, documents[code])).join("")}
          </aside>
          <div class="docs-panels">
            ${docLanguages.map(([code], index) => docsLanguagePanel(code, index, documents[code])).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function docsPage() {
  return `
    <div class="intro-loader" aria-hidden="true">
      <div class="intro-grid"></div>
      <div class="intro-core">
        <div class="intro-mark">
          <span class="intro-origin"></span>
          <span class="intro-branch intro-branch-top"></span>
          <span class="intro-branch intro-branch-main"></span>
          <span class="intro-branch intro-branch-bottom"></span>
        </div>
        <img src="/assets/causeway-lockup-reversed.svg" alt="" />
        <p>origin -> path -> market graph</p>
      </div>
      <span class="intro-scan"></span>
    </div>

    <header class="site-header">
      <a class="brand" href="/" aria-label="Causeway home">
        <img src="/assets/causeway-lockup-primary.svg" alt="Causeway" />
      </a>
      <nav aria-label="Primary navigation">
        <a href="/#flow">Flow</a>
        <a href="/#proof">Proof</a>
        <a href="/#swarm">Swarm</a>
        <a href="/#roadmap">Roadmap</a>
        <a href="${docsHref}">Docs</a>
        <a href="/#compare">Compare</a>
      </nav>
      ${dappButton("nav-dapp")}
    </header>

    <main class="docs-page-main">
      ${docsSection()}
    </main>

    <footer class="site-footer">
      <span>(c) 2026 Causeway</span>
      <nav><a href="${docsHref}">Docs</a><a href="/#roadmap">Roadmap</a><a href="/#compare">Compare</a><a href="/#faq">FAQ</a></nav>
    </footer>
  `;
}

document.querySelector("#app").innerHTML = `
  <div class="intro-loader" aria-hidden="true">
    <div class="intro-grid"></div>
    <div class="intro-core">
      <div class="intro-mark">
        <span class="intro-origin"></span>
        <span class="intro-branch intro-branch-top"></span>
        <span class="intro-branch intro-branch-main"></span>
        <span class="intro-branch intro-branch-bottom"></span>
      </div>
      <img src="/assets/causeway-lockup-reversed.svg" alt="" />
      <p>origin -> path -> market graph</p>
    </div>
    <span class="intro-scan"></span>
  </div>

  <header class="site-header">
    <a class="brand" href="#top" aria-label="Causeway home">
      <img src="/assets/causeway-lockup-primary.svg" alt="Causeway" />
    </a>
    <nav aria-label="Primary navigation">
      <a href="#flow">Flow</a>
      <a href="#proof">Proof</a>
      <a href="#swarm">Swarm</a>
      <a href="#roadmap">Roadmap</a>
      <a href="${docsHref}">Docs</a>
      <a href="#compare">Compare</a>
    </nav>
    ${dappButton("nav-dapp")}
  </header>

  <main id="top">
    <section class="hero section-band">
      <div class="hero-copy">
        <p class="badge"><img src="/assets/causeway-mark-primary.svg" alt="" /> Reasoning, review, and control layer</p>
        <h1 class="hero-title"><span class="title-ink">See the market </span><span class="title-muted">behind the </span><span class="title-blue title-reveal">market.</span></h1>
        <p class="lead">Causeway turns Polymarket market data into related-market maps, AI-estimated probabilities, risk previews, user-reviewed action plans, and records that can be revisited later.</p>
        <div class="actions">
          <a class="button primary" href="${dappHref}">Launch App -></a>
          <a class="button secondary" href="${docsHref}">Read docs v0.6</a>
        </div>
        <div class="proof-row">
          <div><b>Market-aware</b><span>SEES RELATED MARKETS</span></div>
          <div><b>Reviewable</b><span>REASONING + RISK TRAIL</span></div>
          <div><b>User-controlled</b><span>YOU APPROVE ACTION</span></div>
        </div>
      </div>
      ${heroGraphic()}
    </section>

    <section class="why-now section-band">
      <div class="section-copy">
        <p class="eyebrow">- WHY NOW</p>
        <h2>Prediction markets need an intelligence layer.</h2>
        <p>As market count, liquidity, and institutional attention grow, users need systems that understand relationships, verify reasoning, measure signal quality, and keep final control explicit.</p>
      </div>
      <div class="status-strip">${boundaryItems.map(boundaryCard).join("")}</div>
    </section>

    <section class="intelligence-flow section-band" id="flow">
      <div class="section-copy wide">
        <p class="eyebrow">- INTELLIGENCE FLOW</p>
        <h2>One event. Many markets. One reviewable path.</h2>
        <p>Causeway does not stop at a generated answer. It turns market data, AI reasoning, execution checks, and proof records into a single auditable workflow.</p>
      </div>
      <div class="flow-grid">${intelligenceFlow.map(flowStep).join("")}</div>
    </section>

    <section class="object-section section-band">
      <div class="object-copy">
        <p class="eyebrow">- MARKET INTELLIGENCE OBJECT</p>
        <h2>Not a chat answer. A structured signal.</h2>
        <p>The core product object links a root market, related markets, probability estimates, opportunity score, risk flags, user action, optional audit record, and future performance record.</p>
        <div class="no-trade">
          <span>No Trade is intelligence.</span>
          <p>Causeway can return BUY, WATCH, VERIFY FIRST, or AVOID when liquidity is thin, rules are ambiguous, or source confidence is not high enough.</p>
        </div>
      </div>
      <div class="object-panel">
        <div class="object-panel-head"><span>causeway.signal.v1</span><b>VERIFY FIRST</b></div>
        ${marketObject.map(marketObjectRow).join("")}
      </div>
    </section>

    <section class="proof-system section-band" id="proof">
      <div class="section-copy">
        <p class="eyebrow">- ARC PROOF & SIGNAL TRACK RECORD</p>
        <h2>Review before performance.</h2>
        <p>Prediction markets judge today's reasoning against future outcomes. Causeway preserves the market snapshot, assumptions, and signal result; when stronger auditability is needed, the record can be anchored on Arc.</p>
      </div>
      <div class="proof-system-grid">
        <div class="proof-timeline">${proofTimeline.map(proofStep).join("")}</div>
        <div class="track-record-panel">
          <span class="panel-label-dark">Signal Track Record</span>
          <div class="metric-grid">${signalMetrics.map(metricCard).join("")}</div>
          <p>Illustrative metrics show what Causeway tracks over time: signal generation, calibration, execution status, and outcome performance.</p>
        </div>
      </div>
    </section>

    <section class="recipes section-band" id="recipes">
      <div class="section-copy">
        <p class="eyebrow">- CAUSEWAY RECIPES</p>
        <h2>Pick your first market thesis.</h2>
        <p>Pre-configured workflows for turning one Polymarket outcome into a reviewable script. Clone the pattern, then adapt the risk and execution settings.</p>
      </div>
      <div class="recipe-grid">${recipes.map(recipeCard).join("")}</div>
      <a class="outline-link" href="#features">Browse all recipes -></a>
    </section>

    <section class="quickstart section-band split" id="quickstart">
      <div class="split-copy">
        <p class="eyebrow">- QUICK START</p>
        <h2>From one market to a reviewable action plan.</h2>
        <p>Choose a root market, let Causeway map related markets, review probability estimates and opportunity score, then decide whether to watch, verify, avoid, or preview an order.</p>
        <a class="button primary" href="${dappHref}">Launch App -></a>
      </div>
      <div class="terminal-window">
        <div class="window-bar"><i></i><i></i><i></i><span>causeway-cli</span></div>
        ${quickStart.map(quickStartRow).join("")}
        <footer>Dry-run stays available while real execution remains gated by user approval.</footer>
      </div>
    </section>

    <section class="control section-band" id="swarm">
      <div class="section-copy wide">
        <p class="eyebrow">- FUTURE SWARM ENGINE</p>
        <h2>From single-model reasoning to <span>swarm prediction.</span></h2>
        <p>Causeway's long-term vision is a swarm prediction engine: specialized agents build parallel market worlds, debate evidence, verify sources, model propagation, and compress the result into auditable trading intelligence.</p>
      </div>
      <div class="control-vision" aria-hidden="true">
        <img src="/assets/swarm-intelligence-bg.png" alt="" />
        <div>
          <span>Future Engine</span>
          <b>Predict how events move through market networks.</b>
        </div>
      </div>
      <div class="control-grid">${controls.map(controlCard).join("")}</div>
      <p class="vision-note">The endgame is not faster trading. It is a living intelligence layer for predicting how the world may move.</p>
    </section>

    <section class="image-point">
      <div class="image-point-copy">
        <p class="eyebrow light">- THE POINT</p>
        <h2>AI reasons. You remain in control.</h2>
        <p>Causeway expands a market thesis into related markets, probability shifts, risk budgets, and order previews. Custody, confirmation, and final action remain with the user unless explicit bounded delegation is enabled in the future.</p>
      </div>
      <div class="logo-constellation" aria-hidden="true">
        <span class="logo-orbit logo-orbit-one"></span>
        <span class="logo-orbit logo-orbit-two"></span>
        <span class="logo-scan"></span>
        <span class="logo-path logo-path-top"></span>
        <span class="logo-path logo-path-mid"></span>
        <span class="logo-path logo-path-bottom"></span>
        <span class="logo-node logo-node-origin"></span>
        <span class="logo-node logo-node-top"></span>
        <span class="logo-node logo-node-mid"></span>
        <span class="logo-node logo-node-bottom"></span>
        <img class="logo-ghost logo-ghost-one" src="/assets/causeway-mark-reversed.svg" alt="" />
        <img class="logo-ghost logo-ghost-two" src="/assets/causeway-mark-reversed.svg" alt="" />
        <img class="point-logo-mark" src="/assets/causeway-mark-reversed.svg" alt="" />
        <img class="point-logo-lockup" src="/assets/causeway-lockup-reversed.svg" alt="" />
      </div>
    </section>

    <section class="roadmap section-band" id="roadmap">
      <div class="roadmap-top">
        <div class="section-copy">
          <p class="eyebrow">- FUTURE ROADMAP</p>
          <h2>From market data to trusted event response.</h2>
          <p>Causeway grows in five deliberate phases: market data first, reasoning second, real-time scenario generation third, source verification fourth, and optional delegated execution only when the boundary is mature.</p>
        </div>
        <div class="roadmap-orb" aria-hidden="true">
          <span></span>
          <b>Data</b>
          <b>Reason</b>
          <b>Verify</b>
          <b>Delegate</b>
        </div>
      </div>
      <div class="roadmap-track" aria-hidden="true">
        <span>Data</span>
        <i></i>
        <span>Reasoning</span>
        <i></i>
        <span>Real-time</span>
        <i></i>
        <span>Verification</span>
        <i></i>
        <span>Delegation</span>
      </div>
      <div class="roadmap-grid">${roadmap.map(roadmapCard).join("")}</div>
      <div class="roadmap-detail-list">${roadmap.map(roadmapDetail).join("")}</div>
    </section>

    <section class="research-foundation section-band">
      <div class="section-copy">
        <p class="eyebrow">- RESEARCH FOUNDATION</p>
        <h2>Built for prediction-market math, not vibes.</h2>
        <p>The whitepaper grounds Causeway in market-implied probability, transaction-friction-adjusted edge, conservative sizing, semantic market relationships, and calibration metrics.</p>
      </div>
      <div class="research-grid">${researchItems.map(researchCard).join("")}</div>
    </section>

    <section class="features section-band" id="features">
      <div class="section-copy">
        <p class="eyebrow">- MARKET INTELLIGENCE LAYER</p>
        <h2>Every event has a market shadow.</h2>
      </div>
      <div class="feature-grid">${featureCards.map(featureCard).join("")}</div>
    </section>

    <section class="compare section-band" id="compare">
      <div class="compare-top">
        <div class="section-copy">
          <p class="eyebrow">- COMPETITIVE LANDSCAPE</p>
          <h2>Why Causeway is different.</h2>
          <p>Prediction-market tools usually show markets, answer prompts, or trigger trades. Causeway focuses on market-native structure, inspectable reasoning, and user-governed execution.</p>
        </div>
        <div class="floating-mark"><img src="/assets/causeway-app-icon.png" alt="" /></div>
      </div>
      <div class="compare-principles">${comparePrinciples.map(comparePrincipleCard).join("")}</div>
      ${compareTable()}
    </section>

    <section class="faq-wrap section-band" id="faq">
      <div class="faq-intro">
        <p class="eyebrow">- FAQ</p>
        <h2>Trust starts with clear boundaries.</h2>
        <p>Causeway is designed to make market reasoning inspectable before any user-confirmed action. These are the boundaries that matter most.</p>
      </div>
      <div class="faq-list">${faqs.map(faqItem).join("")}</div>
    </section>

    <section class="final-cta">
      <img src="/assets/causeway-app-icon.png" alt="" />
      <h2>Ready when your thesis is.</h2>
      <p>Start with one outcome. Build the market graph. Preview before you act.</p>
      <div class="install-line"><span>$</span> causeway infer --root-market &lt;market&gt;<button type="button">Copy</button></div>
      <div class="actions center">
        <a class="button inverted" href="${dappHref}">Launch App -></a>
        <a class="button dark-outline" href="${docsHref}">Open docs</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <span>(c) 2026 Causeway</span>
    <nav><a href="${docsHref}">Docs</a><a href="#roadmap">Roadmap</a><a href="#compare">Compare</a><a href="#faq">FAQ</a></nav>
  </footer>
`;

if (window.location.pathname.replace(/\/$/, "") === "/docs") {
  document.querySelector("#app").innerHTML = docsPage();
}

document.querySelectorAll(".code-line button, .install-line button").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.parentElement.textContent.replace("Copy", "").trim();
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1200);
    } catch {
      button.textContent = "Copy";
    }
  });
});

const revealTargets = [
  ".hero-copy > *",
  ".hero-graphic",
  ".why-now .section-copy > *",
  ".boundary-card",
  ".intelligence-flow .section-copy > *",
  ".flow-step",
  ".object-copy > *",
  ".object-panel",
  ".proof-system .section-copy > *",
  ".proof-step",
  ".track-record-panel",
  ".section-copy > *",
  ".split-copy > *",
  ".terminal-window",
  ".recipe-card",
  ".control-card",
  ".image-point-copy > *",
  ".logo-constellation",
  ".roadmap-top > *",
  ".roadmap-track",
  ".roadmap-card",
  ".roadmap-detail",
  ".research-card",
  ".docs-top > *",
  ".docs-index",
  ".docs-language-panel.is-active",
  ".feature-card",
  ".compare-top > *",
  ".compare-principle",
  ".compare-table",
  ".faq-intro > *",
  ".faq-list",
  ".final-cta > *",
].join(",");

document.querySelectorAll(revealTargets).forEach((element, index) => {
  element.classList.add("reveal-item");
  element.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
});

const finishIntro = () => {
  document.body.classList.remove("intro-playing");
  document.body.classList.add("intro-complete");
};

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  finishIntro();
} else {
  window.setTimeout(finishIntro, 2250);
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
);

document.querySelectorAll(".reveal-item").forEach((element) => observer.observe(element));

function activateDocSection(lang, sectionId) {
  const indexPanel = document.querySelector(`[data-doc-index-panel="${lang}"]`);
  const contentPanel = document.querySelector(`[data-doc-panel="${lang}"]`);
  const targetButton =
    indexPanel?.querySelector(`[data-doc-section="${sectionId}"]`) || indexPanel?.querySelector("[data-doc-section]");
  const targetId = targetButton?.dataset.docSection;

  indexPanel?.querySelectorAll("[data-doc-section]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.docSection === targetId);
  });

  contentPanel?.querySelectorAll("[data-doc-section-panel]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.docSectionPanel === targetId);
  });
}

document.querySelectorAll("[data-doc-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    const lang = button.dataset.docLang;
    const copy = docCopy[lang];
    const activeSection =
      document.querySelector(".docs-index-panel.is-active [data-doc-section].is-active")?.dataset.docSection || "00";

    document.querySelectorAll("[data-doc-lang]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });

    document.querySelectorAll("[data-doc-index-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.docIndexPanel === lang);
    });

    document.querySelectorAll("[data-doc-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.docPanel === lang);
    });

    document.querySelectorAll("[data-doc-copy]").forEach((element) => {
      element.textContent = copy[element.dataset.docCopy];
    });

    activateDocSection(lang, activeSection);
  });
});

document.querySelectorAll("[data-doc-section]").forEach((button) => {
  button.addEventListener("click", () => {
    const lang = button.closest("[data-doc-index-panel]")?.dataset.docIndexPanel || "EN";
    activateDocSection(lang, button.dataset.docSection);
    document.querySelector(".docs-body")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
});
