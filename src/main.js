import * as THREE from "three";
import "./styles.css";

const brand = {
  ink: "#081B33",
  blue: "#1677FF",
  cyan: "#22C7E8",
  green: "#14B87A",
  surface: "#FBFDFF",
  border: "#D8E6F5",
  muted: "#6B7C93",
  paleBlue: "#EAF3FF",
  paleCyan: "#E9FAFE",
  darkPanel: "#0A203B",
};

const markets = [
  { icon: "btc", title: "BTC above $150k by Jun 2026", tag: "Macro / Crypto", prob: "1%", liq: "$2.4M", state: "Review" },
  { icon: "fed", title: "Fed cuts rates by 25 bps", tag: "Macro Policy", prob: "31%", liq: "$860K", state: "Monitor" },
  { icon: "cup", title: "Croatia wins the 2026 World Cup", tag: "Sports", prob: "1%", liq: "$410K", state: "Monitor" },
  { icon: "vote", title: "Republican nominee market", tag: "Election", prob: "18%", liq: "$5.8M", state: "Review" },
  { icon: "chip", title: "AI regulation bill passes", tag: "Policy / AI", prob: "24%", liq: "$690K", state: "Review" },
  { icon: "chain", title: "Major chain upgrade ships", tag: "On-chain", prob: "64%", liq: "$1.1M", state: "Monitor" },
  { icon: "chart", title: "Oil closes above $95", tag: "Commodities", prob: "9%", liq: "$530K", state: "Watch" },
  { icon: "court", title: "Supreme Court ruling before Q4", tag: "Legal", prob: "42%", liq: "$720K", state: "Review" },
  { icon: "game", title: "Esports final winner market", tag: "Sports / Esports", prob: "52%", liq: "$278K", state: "Watch" },
  { icon: "signal", title: "CPI print above consensus", tag: "Macro Data", prob: "37%", liq: "$1.6M", state: "Review" },
  { icon: "vault", title: "Election policy basket exposure", tag: "Open Vault", prob: "NAV", liq: "$3.2M", state: "Vault" },
  { icon: "globe", title: "G7 policy statement released", tag: "Geopolitics", prob: "73%", liq: "$950K", state: "Monitor" },
  { icon: "source", title: "Official source impact detected", tag: "Source Object", prob: "High", liq: "Fresh", state: "Matched" },
  { icon: "token", title: "Outcome token resolves to candidate", tag: "Token Graph", prob: "OK", liq: "Live", state: "Ready" },
  { icon: "match", title: "Related market cluster found", tag: "Matching Engine", prob: "0.82", liq: "Depth OK", state: "Matched" },
  { icon: "preview", title: "Order preview requires confirmation", tag: "Execution", prob: "TTL", liq: "Live", state: "Preview" },
];

const i18n = {
  en: {
    nav: ["System", "Workflow", "Vaults", "Roadmap"],
    whitepaper: "Whitepaper",
    waitlist: "Join early access",
    eyebrow: "Prediction market intelligence layer",
    title: "Markets are not pages. They are probability networks.",
    lead:
      "Prediction markets need an intelligence layer: source-aware, outcome-token native, previewable, and built for transparent exposure.",
    ctaPrimary: "Read whitepaper",
    ctaSecondary: "View architecture",
    proofA: "No autonomous trading",
    proofB: "Outcome-token native",
    proofC: "Vault-ready reporting",
    sphereLabel: "Live market graph",
    panelTitle: "Selected market",
    panelMeta: "Matched from source objects and token graph",
    problemTitle: "Events move faster than market interfaces.",
    problemLead:
      "Information arrives as news, releases, feeds, and on-chain signals. Prediction markets expose prices, but they rarely show how one event propagates across related markets and outcome tokens.",
    fractures: [
      ["Information fracture", "News, official releases, social posts, sports feeds, and on-chain events need provenance before they can affect reasoning."],
      ["Market fracture", "Users see titles, but real execution happens through marketId, outcomeId, and CLOB tokenId."],
      ["Execution fracture", "AI output must become previewed, signed, confirmed, and audited user action."],
    ],
    systemTitle: "Causeway turns sources into tradable market context.",
    systemLead:
      "Causeway is organized as five explicit layers so real-time sources, self-hosted AI, execution controls, and vault logic can evolve without turning the product into a black-box trading system.",
    layers: [
      ["Source Object Layer", "Normalize real-world evidence with origin, timestamp, entities, confidence, freshness, and raw payload."],
      ["Market Matching Engine", "Map evidence to real, tradable, liquid markets and explain why each outcome token is relevant."],
      ["Causal Intelligence Loop", "Maintain source updates, market graph changes, dislocation scores, reviews, previews, and feedback."],
      ["Human-Governed Execution", "Require fresh previews, capability checks, wallet signatures, idempotency, and explicit confirmation."],
      ["Open Vault Layer", "Package rule-based prediction-market exposure with mandates, eligibility, risk budgets, and NAV-style reporting."],
    ],
    workflowTitle: "From signal to preview, every step stays auditable.",
    workflowLead:
      "The product experience should feel like an operating console for market reasoning: every signal is matched, scored, previewed, and recorded before execution.",
    steps: ["Source", "Match", "Reason", "Score", "Preview", "Confirm"],
    vaultTitle: "Open Vaults package probability exposure into transparent baskets.",
    vaultLead:
      "ETF-like means basket exposure and reporting experience. It does not mean legal ETF classification, investment advice, autonomous trading, or guaranteed return.",
    vaultStats: [
      ["Mandate", "What the basket is allowed to express"],
      ["Eligibility", "Which markets and outcome tokens can enter"],
      ["Risk Budget", "Position caps, liquidity limits, drawdown controls"],
      ["NAV Logic", "Open orders, stale prices, settlement state, fees"],
    ],
    roadmapTitle: "Roadmap built by infrastructure dependency.",
    roadmapLead:
      "Each phase creates a verifiable primitive before the next layer is introduced.",
    phases: [
      ["I", "Workflow Layer", "Market sync, outcome-token model, causal scripts, order preview"],
      ["II", "Real-time Source Layer", "Source objects, provenance, freshness, replayability"],
      ["III", "Matching & Dislocation", "Explainable matching, review queues, score decomposition"],
      ["IV", "Self-hosted AI", "Model registry, prompt registry, validators, evaluations"],
      ["V", "Open Vaults", "Mandates, risk budgets, NAV-style reports, ecosystem APIs"],
    ],
    trustTitle: "Built for review, not blind automation.",
    trustLead:
      "Causeway's credibility comes from explicit boundaries: no custody, no guaranteed return, no autonomous submission, and no recommendation that cannot resolve to a real market and outcome token.",
    finalTitle: "Read the Causeway Whitepaper v1.0",
    finalLead: "The first release defines the product thesis, system architecture, roadmap, governance boundary, and open vault direction.",
    downloadEn: "Download English",
    downloadZh: "下载中文版",
  },
  zh: {
    nav: ["系统", "工作流", "金库", "路线图"],
    whitepaper: "白皮书",
    waitlist: "申请早期访问",
    eyebrow: "预测市场智能层",
    title: "市场不是页面，而是概率网络。",
    lead:
      "预测市场需要一层真正的智能基础设施：理解信息源，原生连接 Outcome Token，并将推理转化为可预览、可审计的市场语境。",
    ctaPrimary: "阅读白皮书",
    ctaSecondary: "查看架构",
    proofA: "非自主交易",
    proofB: "Outcome Token 原生",
    proofC: "金库报告就绪",
    sphereLabel: "实时市场图谱",
    panelTitle: "选中市场",
    panelMeta: "由 Source Object 与 Token Graph 匹配",
    problemTitle: "现实事件移动得比市场界面更快。",
    problemLead:
      "信息以新闻、公告、数据源和链上信号的形式涌入。预测市场展示价格，却很少解释一个事件如何传导到相关市场与 outcome token。",
    fractures: [
      ["信息断裂", "新闻、官方公告、社媒、体育数据和链上事件需要来源与可信度，才能进入市场推理。"],
      ["市场断裂", "用户看到的是标题，但真实执行发生在 marketId、outcomeId 和 CLOB tokenId。"],
      ["执行断裂", "AI 输出必须转化为可预览、可签名、可确认、可审计的用户动作。"],
    ],
    systemTitle: "Causeway 将信息源转化为可交易市场语境。",
    systemLead:
      "Causeway 被组织为五个明确层级，让实时信息、自托管 AI、执行控制和金库逻辑可以演进，同时避免形成黑箱交易系统。",
    layers: [
      ["Source Object 层", "用来源、时间、实体、置信度、新鲜度和 raw payload 标准化现实证据。"],
      ["市场匹配引擎", "把证据映射到真实、可交易、具备流动性的市场，并解释相关 outcome token。"],
      ["因果智能循环", "维护信息更新、市场图谱变化、错配评分、审查、预览和反馈。"],
      ["人工治理执行", "要求最新预览、能力检查、钱包签名、幂等提交和明确确认。"],
      ["自由金库层", "用授权范围、准入规则、风险预算和净值式报告封装规则化市场敞口。"],
    ],
    workflowTitle: "从信号到预览，每一步都保持可审计。",
    workflowLead:
      "产品体验应像市场推理操作台：每个信号在执行前都被匹配、评分、预览和记录。",
    steps: ["信息", "匹配", "推理", "评分", "预览", "确认"],
    vaultTitle: "自由金库把概率敞口封装为透明篮子。",
    vaultLead:
      "ETF-like 指篮子敞口和报告体验，不代表法律 ETF 分类、投资建议、自主交易或保证收益。",
    vaultStats: [
      ["授权范围", "篮子允许表达什么主题"],
      ["准入规则", "哪些市场与 outcome token 可以进入"],
      ["风险预算", "仓位上限、流动性限制、回撤控制"],
      ["净值逻辑", "未成交订单、过期价格、结算状态、费用"],
    ],
    roadmapTitle: "按基础设施依赖推进的路线图。",
    roadmapLead:
      "每个阶段先形成可验证原语，再进入下一层能力。",
    phases: [
      ["I", "工作流层", "市场同步、outcome token 模型、因果脚本、订单预览"],
      ["II", "实时信息层", "Source Object、来源、新鲜度、可回放"],
      ["III", "匹配与错配", "可解释匹配、审查队列、评分拆解"],
      ["IV", "AI 自托管", "模型注册表、prompt 注册表、校验器、评估体系"],
      ["V", "自由金库", "授权范围、风险预算、净值式报告、生态 API"],
    ],
    trustTitle: "为审查而建，不为盲目自动化而建。",
    trustLead:
      "Causeway 的可信度来自明确边界：不托管私钥、不保证收益、不自主提交订单，也不输出无法解析到真实市场和 outcome token 的推荐。",
    finalTitle: "阅读 Causeway 白皮书 v1.0",
    finalLead: "第一版定义产品论点、系统架构、路线图、治理边界与自由金库方向。",
    downloadEn: "Download English",
    downloadZh: "下载中文版",
  },
};

let currentLang = "en";
let hasPlayedIntro = false;

function formatHeroTitle(title) {
  if (currentLang === "zh") {
    return `<span>${title}</span>`;
  }
  const pivot = " for ";
  if (!title.includes(pivot)) {
    return `<span>${title}</span>`;
  }
  const [lead, rest] = title.split(pivot);
  return `<span>${lead}</span> <span>${pivot.trim()} ${rest}</span>`;
}

function sectionTemplate(content) {
  return `
    <div class="intro-loader" aria-hidden="true">
      <div class="intro-stage">
        <div class="intro-mark">
          <span class="intro-dot"></span>
          <span class="intro-line intro-line-mid"></span>
          <span class="intro-line intro-line-top"></span>
          <span class="intro-line intro-line-bottom"></span>
        </div>
        <img class="intro-logo" src="/assets/logo-white-transparent.png" alt="" />
      </div>
      <p>origin → path → market graph</p>
      <span class="intro-reveal-line"></span>
    </div>

    <header class="site-header">
      <a class="brand-lockup" href="#top" aria-label="Causeway home">
        <img class="brand-logo-img" src="/assets/logo-white-transparent.png" alt="Causeway" />
      </a>
      <nav aria-label="Primary navigation">
        ${content.nav.map((item, index) => `<a href="#${["system", "workflow", "vaults", "roadmap"][index]}">${item}</a>`).join("")}
      </nav>
      <div class="header-actions">
        <button class="language-toggle" type="button" data-lang-toggle>${currentLang === "en" ? "中文" : "EN"}</button>
        <a class="header-link" href="/Causeway_Whitepaper_v1.0_EN.pdf">${content.whitepaper}</a>
      </div>
    </header>

    <div class="global-visual" aria-label="${content.sphereLabel}">
      <div class="sphere-fallback" aria-hidden="true">
        ${markets
          .slice(0, 9)
          .map(
            (market, index) => `
              <span style="--fallback-index:${index}">
                <strong>${market.prob}</strong>
              </span>
            `,
          )
          .join("")}
      </div>
      <canvas id="market-spheres"></canvas>
      <div class="visual-caption">${content.sphereLabel}</div>
    </div>

    <main id="top">
      <section class="cinematic-section hero-section" data-scene="hero">
        <div class="background-word" aria-hidden="true">PROBABILITY NETWORKS</div>
        <div class="hero-copy cinematic-copy">
          <p class="scene-pill" data-reveal>${content.eyebrow}</p>
          <h1 class="hero-title" data-reveal>${content.title}</h1>
          <p class="hero-lead" data-reveal>${content.lead}</p>
          <div class="hero-actions" data-reveal>
            <a class="button primary" href="/Causeway_Whitepaper_v1.0_EN.pdf">${content.ctaPrimary}</a>
            <a class="button secondary" href="#system">${content.ctaSecondary}</a>
          </div>
          <div class="proof-strip" aria-label="Product boundaries" data-reveal>
            <span>${content.proofA}</span>
            <span>${content.proofB}</span>
            <span>${content.proofC}</span>
          </div>
        </div>
      </section>

      <section class="cinematic-section problem-section" data-scene="problem">
        <div class="background-word" aria-hidden="true">FRAGMENTED MARKETS</div>
        <div class="section-intro cinematic-copy center-copy">
          <p class="scene-pill" data-reveal>01 / Problem</p>
          <h2 data-reveal>${content.problemTitle}</h2>
          <p data-reveal>${content.problemLead}</p>
        </div>
        <div class="cinema-chip-row fracture-grid">
          ${content.fractures
            .map(
              ([title, body]) => `
                <article class="fracture-item glass-chip" data-reveal>
                  <h3>${title}</h3>
                  <p>${body}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="cinematic-section system-section" id="system" data-scene="system">
        <div class="background-word" aria-hidden="true">SOURCE TO TOKEN</div>
        <div class="section-intro cinematic-copy">
          <p class="scene-pill" data-reveal>02 / Architecture</p>
          <h2 data-reveal>${content.systemTitle}</h2>
          <p data-reveal>${content.systemLead}</p>
        </div>
        <div class="layer-stack cinematic-stack">
          ${content.layers
            .map(
              ([title, body], index) => `
                <article class="layer-row glass-chip" style="--row:${index}" data-reveal>
                  <span class="layer-index">0${index + 1}</span>
                  <h3>${title}</h3>
                  <p>${body}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="cinematic-section workflow-section" id="workflow" data-scene="workflow">
        <div class="background-word" aria-hidden="true">AUDITABLE FLOW</div>
        <div class="section-intro cinematic-copy center-copy">
          <p class="scene-pill" data-reveal>03 / Workflow</p>
          <h2 data-reveal>${content.workflowTitle}</h2>
          <p data-reveal>${content.workflowLead}</p>
        </div>
        <div class="workflow-demo" data-reveal>
          <div class="signal-panel">
            <span>Source Object</span>
            <strong>Official macro release detected</strong>
            <p>Entities: rate policy, CPI, central bank · Freshness: 00:42</p>
          </div>
          <div class="workflow-rail">
            ${content.steps
              .map(
                (step, index) => `
                  <div class="workflow-node" style="--node:${index}">
                    <span>${String(index + 1).padStart(2, "0")}</span>
                    <strong>${step}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="review-panel">
            <span>Review Queue</span>
            <strong>3 markets require confirmation</strong>
            <p>Dislocation score separates evidence strength, market relevance, liquidity, execution risk, and confidence decay.</p>
          </div>
        </div>
      </section>

      <section class="cinematic-section vault-section" id="vaults" data-scene="vaults">
        <div class="background-word" aria-hidden="true">OPEN VAULTS</div>
        <div class="section-intro cinematic-copy">
          <p class="scene-pill" data-reveal>04 / Open Vaults</p>
          <h2 data-reveal>${content.vaultTitle}</h2>
          <p data-reveal>${content.vaultLead}</p>
        </div>
        <div class="vault-grid cinema-chip-row">
          ${content.vaultStats
            .map(
              ([title, body]) => `
                <article class="glass-chip" data-reveal>
                  <h3>${title}</h3>
                  <p>${body}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="cinematic-section roadmap-section" id="roadmap" data-scene="roadmap">
        <div class="background-word" aria-hidden="true">ROADMAP</div>
        <div class="section-intro cinematic-copy center-copy">
          <p class="scene-pill" data-reveal>05 / Roadmap</p>
          <h2 data-reveal>${content.roadmapTitle}</h2>
          <p data-reveal>${content.roadmapLead}</p>
        </div>
        <div class="roadmap-lanes cinematic-stack">
          ${content.phases
            .map(
              ([phase, title, body]) => `
                <article class="phase-row glass-chip" data-reveal>
                  <span>${phase}</span>
                  <h3>${title}</h3>
                  <p>${body}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="cinematic-section trust-section" data-scene="trust">
        <div class="background-word" aria-hidden="true">USER CONFIRMED</div>
        <div class="cinematic-copy center-copy">
          <p class="scene-pill" data-reveal>Governance</p>
          <h2 data-reveal>${content.trustTitle}</h2>
          <p data-reveal>${content.trustLead}</p>
        </div>
        <div class="trust-matrix cinema-chip-row" aria-label="Governance boundaries" data-reveal>
          <span>No custody</span>
          <span>No guaranteed return</span>
          <span>No autonomous submission</span>
          <span>Preview required</span>
          <span>Audit first</span>
          <span>Token resolved</span>
        </div>
      </section>

      <section class="cinematic-section final-cta" data-scene="final">
        <div class="background-word" aria-hidden="true">CAUSEWAY</div>
        <div class="cinematic-copy center-copy">
          <p class="scene-pill" data-reveal>Whitepaper v1.0</p>
          <h2 data-reveal>${content.finalTitle}</h2>
          <p data-reveal>${content.finalLead}</p>
          <div class="hero-actions" data-reveal>
            <a class="button primary" href="/Causeway_Whitepaper_v1.0_EN.pdf">${content.downloadEn}</a>
            <a class="button secondary" href="/Causeway_Whitepaper_v1.0_ZH.pdf">${content.downloadZh}</a>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderPage() {
  document.querySelector("#app").innerHTML = sectionTemplate(i18n[currentLang]);
  document.querySelector("[data-lang-toggle]").addEventListener("click", () => {
    currentLang = currentLang === "en" ? "zh" : "en";
    renderPage();
    requestAnimationFrame(initSpheres);
  });
  initIntro();
  initReveals();
  initSpheres();
  syncInitialHash();
}

function syncInitialHash() {
  const id = window.location.hash?.replace("#", "");
  if (!id || id === "top") return;
  const delay = hasPlayedIntro ? 80 : 2720;
  window.setTimeout(() => {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ block: "start" });
  }, delay);
}

function initIntro() {
  document.body.classList.remove("intro-playing", "intro-revealing");
  if (hasPlayedIntro) {
    document.body.classList.add("intro-complete");
    return;
  }
  document.body.classList.remove("intro-complete");
  document.body.classList.add("intro-playing");
  window.setTimeout(() => {
    document.body.classList.add("intro-revealing");
  }, 1780);
  window.setTimeout(() => {
    document.body.classList.remove("intro-playing");
    document.body.classList.remove("intro-revealing");
    document.body.classList.add("intro-complete");
    hasPlayedIntro = true;
  }, 2620);
}

function initReveals() {
  const items = document.querySelectorAll("[data-reveal]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
  );
  items.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
    observer.observe(item);
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawIcon(ctx, type, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (type === "btc") {
    ctx.font = "900 76px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("₿", cx, cy + 4);
  } else if (type === "fed") {
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(cx + i * 34 - 9, cy - 22, 18, 54);
    }
    ctx.beginPath();
    ctx.moveTo(cx - 62, cy - 30);
    ctx.lineTo(cx, cy - 58);
    ctx.lineTo(cx + 62, cy - 30);
    ctx.stroke();
    ctx.fillRect(cx - 64, cy + 38, 128, 10);
  } else if (type === "cup") {
    ctx.beginPath();
    ctx.ellipse(cx, cy - 6, 34, 44, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 44, cy - 16, 22, -0.9, 1.1);
    ctx.arc(cx + 44, cy - 16, 22, 2.0, 4.1);
    ctx.stroke();
    ctx.fillRect(cx - 8, cy + 36, 16, 28);
    ctx.fillRect(cx - 36, cy + 64, 72, 10);
  } else if (type === "vote") {
    ctx.strokeRect(cx - 48, cy - 18, 96, 64);
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 18);
    ctx.lineTo(cx, cy - 46);
    ctx.lineTo(cx + 28, cy - 18);
    ctx.stroke();
    ctx.fillRect(cx - 24, cy + 4, 48, 8);
  } else if (type === "chip") {
    ctx.strokeRect(cx - 36, cy - 36, 72, 72);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 18, cy - 54);
      ctx.lineTo(cx + i * 18, cy - 38);
      ctx.moveTo(cx + i * 18, cy + 38);
      ctx.lineTo(cx + i * 18, cy + 54);
      ctx.moveTo(cx - 54, cy + i * 18);
      ctx.lineTo(cx - 38, cy + i * 18);
      ctx.moveTo(cx + 38, cy + i * 18);
      ctx.lineTo(cx + 54, cy + i * 18);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "chain") {
    ctx.strokeRect(cx - 68, cy - 18, 56, 36);
    ctx.strokeRect(cx + 12, cy - 18, 56, 36);
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.stroke();
  } else if (type === "chart") {
    ctx.beginPath();
    ctx.moveTo(cx - 58, cy + 42);
    ctx.lineTo(cx - 22, cy + 2);
    ctx.lineTo(cx + 8, cy + 18);
    ctx.lineTo(cx + 56, cy - 38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 56, cy - 38);
    ctx.lineTo(cx + 54, cy - 12);
    ctx.moveTo(cx + 56, cy - 38);
    ctx.lineTo(cx + 28, cy - 34);
    ctx.stroke();
  } else if (type === "court") {
    ctx.fillRect(cx - 54, cy + 30, 108, 10);
    ctx.fillRect(cx - 44, cy - 14, 88, 8);
    ctx.beginPath();
    ctx.moveTo(cx - 54, cy - 20);
    ctx.lineTo(cx, cy - 54);
    ctx.lineTo(cx + 54, cy - 20);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) ctx.fillRect(cx + i * 34 - 7, cy - 8, 14, 38);
  } else if (type === "game") {
    roundedRect(ctx, cx - 58, cy - 30, 116, 60, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 32, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx - 21, cy - 11);
    ctx.lineTo(cx - 21, cy + 11);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 26, cy - 6, 5, 0, Math.PI * 2);
    ctx.arc(cx + 44, cy + 10, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "signal") {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy + 52, 22 + i * 18, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + 52, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "vault") {
    roundedRect(ctx, cx - 48, cy - 36, 96, 74, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(cx - 5, cy + 19, 10, 21);
  } else if (type === "globe") {
    ctx.beginPath();
    ctx.arc(cx, cy, 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 54, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 52, cy);
    ctx.lineTo(cx + 52, cy);
    ctx.moveTo(cx - 42, cy - 28);
    ctx.lineTo(cx + 42, cy - 28);
    ctx.moveTo(cx - 42, cy + 28);
    ctx.lineTo(cx + 42, cy + 28);
    ctx.stroke();
  } else if (type === "source") {
    ctx.beginPath();
    ctx.arc(cx - 34, cy - 22, 15, 0, Math.PI * 2);
    ctx.arc(cx + 34, cy - 22, 15, 0, Math.PI * 2);
    ctx.arc(cx, cy + 34, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy - 12);
    ctx.lineTo(cx - 8, cy + 22);
    ctx.moveTo(cx + 22, cy - 12);
    ctx.lineTo(cx + 8, cy + 22);
    ctx.moveTo(cx - 18, cy - 22);
    ctx.lineTo(cx + 18, cy - 22);
    ctx.stroke();
  } else if (type === "token") {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + i * Math.PI / 3;
      const x = cx + Math.cos(angle) * 56;
      const y = cy + Math.sin(angle) * 56;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.font = "900 50px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("T", cx, cy + 3);
  } else if (type === "match") {
    ctx.beginPath();
    ctx.arc(cx - 34, cy, 24, 0, Math.PI * 2);
    ctx.arc(cx + 34, cy, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 48, cy - 28);
    ctx.lineTo(cx, cy - 52);
    ctx.lineTo(cx + 48, cy - 28);
    ctx.lineTo(cx + 48, cy + 42);
    ctx.lineTo(cx - 48, cy + 42);
    ctx.closePath();
    ctx.stroke();
    ctx.fillRect(cx - 26, cy + 6, 52, 8);
  }
  ctx.restore();
}

function createMarketTexture(market, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const color = [brand.blue, brand.cyan, brand.green][index % 3];
  const accent = [brand.cyan, brand.green, brand.blue][index % 3];
  const bg = ctx.createRadialGradient(164, 120, 20, 256, 256, 420);
  bg.addColorStop(0, "#FFFFFF");
  bg.addColorStop(0.18, index % 2 ? "#DDF8FF" : "#EAF3FF");
  bg.addColorStop(0.48, color);
  bg.addColorStop(1, brand.ink);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1;
  for (let y = 42; y < 512; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + Math.sin(y + index) * 18);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(44 + (index % 3) * 10, 86 + (index % 4) * 6);
  ctx.rotate((-8 + (index % 5) * 4) * Math.PI / 180);
  roundedRect(ctx, 0, 0, 390, 260, 24);
  ctx.fillStyle = "rgba(251,253,255,0.86)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.68)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = brand.ink;
  ctx.font = "900 32px Arial";
  ctx.textAlign = "left";
  ctx.fillText(market.tag.split(" / ")[0], 28, 54);
  ctx.font = "800 22px Arial";
  ctx.globalAlpha = 0.72;
  wrapCanvasText(ctx, market.title, 28, 94, 290, 28, 2);
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  roundedRect(ctx, 28, 176, 116, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(market.prob, 86, 211);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(176, 220);
  for (let i = 0; i < 6; i++) {
    ctx.lineTo(176 + i * 34, 214 - Math.sin(i * 1.2 + index) * 42);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.74;
  ctx.translate(300, 292);
  ctx.rotate((18 - index * 3) * Math.PI / 180);
  roundedRect(ctx, -120, -42, 244, 84, 18);
  ctx.fillStyle = "rgba(8,27,51,0.66)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawIcon(ctx, market.icon, -72, 0, "#FFFFFF");
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 26px Arial";
  ctx.textAlign = "left";
  ctx.fillText(market.state, -18, -6);
  ctx.fillStyle = accent;
  ctx.font = "800 18px Arial";
  ctx.fillText(market.liq, -18, 22);
  ctx.restore();

  for (let i = 0; i < 7; i++) {
    const x = 72 + ((index * 47 + i * 61) % 360);
    const y = 358 + Math.sin(index + i) * 58;
    ctx.beginPath();
    ctx.arc(x, y, 7 + (i % 3) * 3, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? accent : color;
    ctx.fill();
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(72 + ((index * 47 + (i - 1) * 61) % 360), 358 + Math.sin(index + i - 1) * 58);
      ctx.strokeStyle = "rgba(255,255,255,0.48)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const shine = ctx.createLinearGradient(0, 0, 512, 512);
  shine.addColorStop(0, "rgba(255,255,255,0.88)");
  shine.addColorStop(0.28, "rgba(255,255,255,0.12)");
  shine.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = `${line}${line ? " " : ""}${word}`;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((ln, i) => {
    const suffix = i === maxLines - 1 && lines.length > maxLines ? " ..." : "";
    ctx.fillText(ln + suffix, x, y + i * lineHeight);
  });
}

let renderer;
let frameId;
let cleanupSpheres = () => {};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeScenePositions(kind, count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963;
    const ring = Math.sqrt(i + 1);
    if (kind === "hero") {
      positions.push([
        Math.cos(a) * ring * 0.34,
        Math.sin(a) * ring * 0.32,
        1.1 - i * 0.055,
        i === 0 ? 0.86 : 0.34 + (i % 5) * 0.055,
      ]);
    } else if (kind === "problem") {
      positions.push([
        Math.cos(a) * ring * 0.58,
        Math.sin(a) * ring * 0.34,
        0.68 - i * 0.045,
        i % 4 === 0 ? 0.68 : 0.28 + (i % 5) * 0.042,
      ]);
    } else if (kind === "system") {
      const lane = i % 5;
      const offset = Math.floor(i / 5) - 1;
      positions.push([
        -1.06 + offset * 0.74,
        1.18 - lane * 0.56,
        0.64 - lane * 0.02,
        0.28 + lane * 0.028,
      ]);
    } else if (kind === "workflow") {
      const step = i % 6;
      const wave = Math.sin(step / 5 * Math.PI);
      positions.push([
        -2.48 + step * 0.98,
        -0.72 + wave * 1.34 + (Math.floor(i / 6) - 1) * 0.3,
        0.86 - step * 0.035,
        step === 3 ? 0.72 : 0.24 + (i % 3) * 0.04,
      ]);
    } else if (kind === "vaults") {
      const theta = (i / count) * Math.PI * 2;
      const r = i < 10 ? 1.06 : 1.68;
      positions.push([
        Math.cos(theta) * r,
        Math.sin(theta) * r * 0.66,
        0.68 + (i % 4) * 0.06,
        i < 4 ? 0.62 : 0.26 + (i % 3) * 0.04,
      ]);
    } else if (kind === "roadmap") {
      const lane = i % 5;
      positions.push([
        -2.2 + lane * 1.1,
        0.98 - Math.floor(i / 5) * 0.48,
        0.55 - lane * 0.04,
        lane === 0 ? 0.58 : 0.24 + (i % 5) * 0.025,
      ]);
    } else {
      const theta = (i / count) * Math.PI * 2;
      const r = 0.82 + (i % 4) * 0.14;
      positions.push([
        Math.cos(theta) * r,
        Math.sin(theta) * r,
        0.35,
        i === 0 ? 0.72 : 0.2 + (i % 3) * 0.04,
      ]);
    }
  }
  return positions;
}

function currentVisualScene() {
  const sections = [...document.querySelectorAll("[data-scene]")];
  let current = "hero";
  let best = 0;
  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const score = visible / Math.max(1, Math.min(rect.height, window.innerHeight));
    if (score > best) {
      best = score;
      current = section.dataset.scene;
    }
  }
  return current;
}

function getSceneWeights() {
  const sections = [...document.querySelectorAll("[data-scene]")];
  const weights = {};
  let total = 0;
  let strongestScene = "hero";
  let strongestWeight = 0;
  const focus = window.innerHeight * 0.52;
  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - focus);
    const reach = Math.max(window.innerHeight * 0.9, rect.height * 0.42);
    const raw = Math.max(0, 1 - distance / reach);
    const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const weight = raw * raw + (visible > 0 ? 0.025 : 0);
    if (weight > 0) {
      weights[section.dataset.scene] = weight;
      total += weight;
      if (weight > strongestWeight) {
        strongestWeight = weight;
        strongestScene = section.dataset.scene;
      }
    }
  }
  if (!total) {
    weights.hero = 1;
    total = 1;
    strongestScene = "hero";
  }
  Object.keys(weights).forEach((name) => {
    weights[name] /= total;
  });
  return { weights, strongestScene };
}

function weightedGroupState(sceneGroup, weights) {
  const state = { x: 0, y: 0, z: 0, scale: 0, opacity: 0 };
  Object.entries(weights).forEach(([name, weight]) => {
    const source = sceneGroup[name] || sceneGroup.hero;
    state.x += source.x * weight;
    state.y += source.y * weight;
    state.z += source.z * weight;
    state.scale += source.scale * weight;
    state.opacity += source.opacity * weight;
  });
  return state;
}

function weightedSphereTarget(scenePositions, weights, index) {
  const target = [0, 0, 0, 0];
  Object.entries(weights).forEach(([name, weight]) => {
    const source = scenePositions[name]?.[index] || scenePositions.hero[index];
    target[0] += source[0] * weight;
    target[1] += source[1] * weight;
    target[2] += source[2] * weight;
    target[3] += source[3] * weight;
  });
  return target;
}

function initSpheres() {
  const canvas = document.querySelector("#market-spheres");
  if (!canvas) return;
  if (frameId) cancelAnimationFrame(frameId);
  if (renderer) renderer.dispose();
  cleanupSpheres();

  const host = document.querySelector(".global-visual");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 8.6);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.classList.add("webgl-ready");

  scene.add(new THREE.AmbientLight(0xffffff, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0x22c7e8, 3.8, 12);
  rim.position.set(3, -2, 4);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const shellGeometry = new THREE.SphereGeometry(1.018, 64, 64);
  const sceneNames = ["hero", "problem", "system", "workflow", "vaults", "roadmap", "trust", "final"];
  const scenePositions = Object.fromEntries(sceneNames.map((name) => [name, makeScenePositions(name, markets.length)]));
  const sceneGroup = {
    hero: { x: 1.15, y: -0.02, z: 0, scale: 0.98, opacity: 0.92 },
    problem: { x: 0.0, y: -0.04, z: 0, scale: 0.95, opacity: 0.54 },
    system: { x: 1.45, y: -0.02, z: 0, scale: 0.78, opacity: 0.58 },
    workflow: { x: 0.25, y: -0.04, z: 0, scale: 0.82, opacity: 0.62 },
    vaults: { x: 1.2, y: -0.02, z: 0, scale: 0.88, opacity: 0.62 },
    roadmap: { x: 0.1, y: 0, z: 0, scale: 0.68, opacity: 0.5 },
    trust: { x: -0.1, y: 0, z: 0, scale: 0.58, opacity: 0.46 },
    final: { x: -0.1, y: 0, z: 0, scale: 0.58, opacity: 0.44 },
  };

  const meshes = scenePositions.hero.map(([x, y, z, scale], index) => {
    const market = markets[index % markets.length];
    const material = new THREE.MeshPhysicalMaterial({
      map: createMarketTexture(market, index),
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.96,
      transmission: 0.28,
      thickness: 0.48,
      envMapIntensity: 1.55,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale);
    mesh.userData.market = market;
    mesh.userData.home = new THREE.Vector3(x, y, z);
    mesh.userData.scale = scale;
    mesh.userData.speed = 0.45 + index * 0.017;

    const shell = new THREE.Mesh(
      shellGeometry,
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        roughness: 0.02,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        transmission: 0.56,
        side: THREE.FrontSide,
      }),
    );
    shell.scale.copy(mesh.scale);
    shell.position.copy(mesh.position);
    shell.userData.follow = mesh;

    group.add(mesh);
    group.add(shell);
    return mesh;
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(10, 10);
  const trackPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const clearPointer = () => {
    pointer.set(10, 10);
  };

  window.addEventListener("pointermove", trackPointer);
  window.addEventListener("pointerleave", clearPointer);

  let activeMesh = null;
  let activeScene = "hero";
  let displayedScene = "";
  const clock = new THREE.Clock();
  const syncSceneLabel = (sceneName) => {
    activeScene = sceneName;
    document.body.dataset.currentScene = activeScene;
    if (activeScene !== displayedScene) {
      displayedScene = activeScene;
    }
  };
  syncSceneLabel(currentVisualScene());

  function animate() {
    const t = clock.getElapsedTime();
    const { weights, strongestScene } = getSceneWeights();
    syncSceneLabel(strongestScene);
    const mobile = host.clientWidth <= 760;
    const state = weightedGroupState(sceneGroup, weights);
    const mobileOffset = mobile ? 0.55 : state.x;
    group.position.x = lerp(group.position.x, mobileOffset, 0.045);
    group.position.y = lerp(group.position.y, state.y + Math.sin(t * 0.32) * 0.07, 0.055);
    group.scale.setScalar(lerp(group.scale.x, mobile ? state.scale * 0.66 : state.scale, 0.045));
    group.rotation.y = lerp(group.rotation.y, Math.sin(t * 0.16) * 0.2 + (activeScene === "workflow" ? -0.24 : 0), 0.045);
    group.rotation.x = lerp(group.rotation.x, Math.sin(t * 0.12) * 0.08 + (activeScene === "system" ? 0.1 : 0), 0.04);

    meshes.forEach((mesh, index) => {
      const target = weightedSphereTarget(scenePositions, weights, index);
      const floatX = Math.sin(t * mesh.userData.speed + index) * 0.035;
      const floatY = Math.cos(t * (mesh.userData.speed + 0.08) + index * 0.8) * 0.035;
      mesh.position.x = lerp(mesh.position.x, target[0] + floatX, 0.055);
      mesh.position.y = lerp(mesh.position.y, target[1] + floatY, 0.055);
      mesh.position.z = lerp(mesh.position.z, target[2], 0.05);
      mesh.rotation.y += 0.0024 + index * 0.00004;
      mesh.rotation.x = Math.sin(t * 0.22 + index) * 0.05;
      const targetScale = activeMesh === mesh ? target[3] * 1.1 : target[3];
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
      mesh.material.opacity = lerp(mesh.material.opacity, activeScene === "final" ? 0.56 : state.opacity, 0.035);
    });

    group.children.forEach((child) => {
      if (child.userData.follow) {
        child.position.copy(child.userData.follow.position);
        child.rotation.copy(child.userData.follow.rotation);
        child.scale.copy(child.userData.follow.scale).multiplyScalar(1.018);
      }
    });

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0]?.object || null;
    if (hit !== activeMesh) {
      activeMesh = hit;
    }

    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  cleanupSpheres = () => {
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", trackPointer);
    window.removeEventListener("pointerleave", clearPointer);
    host.classList.remove("webgl-ready");
  };
  animate();
}

renderPage();
