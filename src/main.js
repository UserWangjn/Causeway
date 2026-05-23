import "./styles.css";

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
  ["01", "SELECT ROOT OUTCOME", "Pick a real Polymarket outcome token.", "market -> outcome -> tokenId"],
  ["02", "RUN CAUSAL INFERENCE", "Causeway expands the thesis into a 1-3 layer graph.", "depth: 3 / threshold: 0.55"],
  ["03", "REVIEW EVERY TOKEN", "All outcomes stay visible. No hard-coded Yes/No shortcuts.", "outcomeAction: buy | avoid"],
  ["04", "PREVIEW ORDERS", "Refresh order books, capability status, and risk checks.", "execution: dry_run | real"],
];

const controls = [
  {
    step: "01 / ROOT",
    label: "SET",
    title: "You choose the starting token.",
    body: "Every inference begins from a specific market, selected outcome, and CLOB token ID.",
    fields: [
      ["marketId", "pm_8472"],
      ["outcome", "Yes"],
      ["tokenId", "0x71a...9c02"],
      ["depth", "3"],
    ],
  },
  {
    step: "02 / REASON",
    label: "MAP",
    title: "AI builds the causal path.",
    body: "Candidate markets are recalled from local Polymarket data, then ranked by relevance, direction, confidence, and tradability.",
    flow: ["root", "market graph", "outcome actions"],
  },
  {
    step: "03 / CONFIRM",
    label: "ACT",
    title: "Execution stays human-confirmed.",
    body: "Causeway can preview orders and dry-run the workflow, but real trading waits for explicit user approval.",
    alert: "Order preview ready. Real submit requires wallet confirmation.",
  },
];

const featureCards = [
  {
    icon: "token",
    title: "Outcome-token native",
    body: "Causeway models market -> outcomes[] -> tokenId, so execution logic matches how Polymarket actually trades.",
    visual: "YES / NO / OVER / UNDER / TEAM A",
  },
  {
    icon: "graph",
    title: "Causal graph, not chat advice",
    body: "The AI returns structured nodes, edges, confidence, direction, and reasons that can be audited later.",
    visual: "root -> layer 1 -> layer 2 -> layer 3",
  },
  {
    icon: "book",
    title: "Polymarket data first",
    body: "Phase one reasons from synced market structure, outcomes, prices, order books, and liquidity.",
    visual: "Gamma + CLOB + Data API",
  },
  {
    icon: "human",
    title: "No autonomous trading",
    body: "AI defaults can be useful, but the product boundary is clear: every real order is previewed and confirmed by the user.",
    visual: "preview -> approve -> submit",
    highlight: true,
  },
  {
    icon: "preview",
    title: "Dry-run and real modes",
    body: "When real CLOB capability is unavailable, the same UX still completes the local preview and audit loop.",
    visual: "dry_run available / real gated",
  },
  {
    icon: "vault",
    title: "Vault-ready reporting",
    body: "Scripts can evolve into transparent baskets with mandates, eligibility, risk budgets, and NAV-style reports.",
    visual: "mandate + caps + NAV",
  },
];

const compareRows = [
  ["Market structure", "Event, market, outcome, tokenId", "Titles and tabs", "Loose text prompt", "Bot-specific schema"],
  ["Outcome mapping", "All outcomes stay visible", "Manual checking", "Often assumes Yes/No", "Depends on implementation"],
  ["Causal graph", "Layered, auditable paths", "Research notes", "Natural language only", "Usually hidden"],
  ["Order preview", "Prices, book, risk, capability", "Manual order ticket", "No native execution", "Often direct execution"],
  ["Human confirmation", "Required for real submit", "Required", "Not applicable", "May be optional"],
  ["Auditability", "Saved script and order trail", "Screenshots or notes", "Conversation history", "Varies"],
];

const faqs = [
  [
    "Does Causeway trade automatically?",
    "No. Causeway can generate a script and default actions, but real orders require explicit user confirmation.",
  ],
  [
    "Why does outcome-token mapping matter?",
    "Polymarket orders execute against token IDs. A market title alone is not enough, and outcomes are not always just Yes and No.",
  ],
  [
    "Does phase one use news or social data?",
    "No. Phase one focuses on Polymarket market data first. External sources are a later source-object layer.",
  ],
  [
    "Can I use Causeway before real trading is connected?",
    "Yes. Dry-run mode keeps inference, preview, risk checks, and audit records available while real execution is gated.",
  ],
  [
    "Is this investment advice?",
    "No. Causeway is workflow software for market reasoning, previews, and user-governed execution.",
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

function compareTable() {
  return `
    <div class="compare-table">
      <div class="compare-head empty"></div>
      <div class="compare-head us"><img src="/assets/causeway-mark-reversed.svg" alt="" />Causeway <span>US</span></div>
      <div class="compare-head">Manual Research</div>
      <div class="compare-head">Generic AI Chat</div>
      <div class="compare-head">Trading Bot</div>
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
    <div class="hero-graphic" aria-label="Causeway product preview">
      <div class="floating-status status-one"><i></i><b>PASS</b><span>macro.v4</span><em>+0.96</em></div>
      <div class="floating-status status-two"><i></i><b>BLOCK</b><span>cap exceeded</span><em>>$100</em></div>
      <div class="privilege-panel">
        <span class="panel-label">ROOT OUTCOME</span>
        <div class="agent-line"><span>PM</span><div><b>Fed cuts rates by 25 bps</b><small>outcome_id: fed-jun-yes</small></div></div>
        <div class="panel-grid">
          <div><span>DEPTH</span><b>3</b></div>
          <div><span>POLICY</span><b>preview.v1</b></div>
          <div><span>MARKETS</span><b>24</b></div>
        </div>
        <div class="cap-row"><span>ORDER PREVIEW</span><b>$94.0 / $100</b></div>
        <div class="progress"><i></i></div>
        <div class="allowlist">
          <span>PROTOCOL ALLOWLIST - 4</span>
          <div><b>Gamma</b><b>CLOB</b><b>Data API</b><b>Audit</b></div>
        </div>
        <div class="panel-footer"><span>sig: 0x71a...9c02</span><b>READY</b></div>
      </div>
    </div>
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
      <a href="#recipes">Recipes</a>
      <a href="#quickstart">How it works</a>
      <a href="#compare">Compare</a>
      <a href="#faq">FAQ</a>
      <a href="/Causeway_Whitepaper_v1.0_EN.pdf">Docs -></a>
    </nav>
    <a class="nav-cta" href="/Causeway_Whitepaper_v1.0_EN.pdf">Get started -></a>
  </header>

  <main id="top">
    <section class="hero section-band">
      <div class="hero-copy">
        <p class="badge"><img src="/assets/causeway-mark-primary.svg" alt="" /> Part of the Causeway system</p>
        <h1><span class="title-ink">Prediction markets </span><span class="title-ink">are networks. </span><span class="title-blue">Causeway makes </span><span class="title-blue">them tradable.</span></h1>
        <p class="lead">Causeway turns a selected Polymarket outcome into an auditable causal script: related markets, outcome tokens, order previews, and human-confirmed execution.</p>
        <div class="actions">
          <a class="button primary" href="#quickstart">Get started -></a>
          <a class="button secondary" href="/Causeway_Whitepaper_v1.0_EN.pdf">Read the docs</a>
        </div>
        <div class="proof-row">
          <div><b>&lt;40ms</b><span>POLICY DECISION</span></div>
          <div><b>Outcome-native</b><span>MARKET -> TOKEN</span></div>
          <div><b>Human-confirmed</b><span>NO AUTONOMOUS TRADING</span></div>
        </div>
      </div>
      ${heroGraphic()}
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
        <h2>From one outcome to an executable script.</h2>
        <p>Install the workflow, choose a root market, run causal inference, review every outcome, and preview orders before any real submission.</p>
        <a class="button primary" href="/Causeway_Whitepaper_v1.0_EN.pdf">Read the full docs -></a>
      </div>
      <div class="terminal-window">
        <div class="window-bar"><i></i><i></i><i></i><span>causeway-cli</span></div>
        ${quickStart.map(quickStartRow).join("")}
        <footer>Dry-run stays available when real CLOB capability is gated.</footer>
      </div>
    </section>

    <section class="control section-band">
      <div class="section-copy wide">
        <p class="eyebrow">- THREE STEPS TO CONTROLLED EXECUTION</p>
        <h2>Let AI reason. <span>Keep execution human.</span></h2>
      </div>
      <div class="control-grid">${controls.map(controlCard).join("")}</div>
    </section>

    <section class="image-point">
      <div class="image-point-copy">
        <p class="eyebrow light">- THE POINT</p>
        <h2>AI expands the thesis. You approve the path.</h2>
        <p>Causeway keeps the boundary clear: market reasoning can be assisted, but custody, confirmation, and final action stay with the user.</p>
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

    <section class="features section-band" id="features">
      <div class="section-copy">
        <p class="eyebrow">- WHY IT MATTERS</p>
        <h2>Built for markets that actually move.</h2>
      </div>
      <div class="feature-grid">${featureCards.map(featureCard).join("")}</div>
    </section>

    <section class="compare section-band" id="compare">
      <div class="compare-top">
        <div class="section-copy">
          <p class="eyebrow">- COMPETITIVE LANDSCAPE</p>
          <h2>How Causeway compares.</h2>
          <p>Direct workflow comparison with the three approaches prediction-market builders and traders usually evaluate alongside Causeway.</p>
        </div>
        <div class="floating-mark"><img src="/assets/causeway-app-icon.png" alt="" /></div>
      </div>
      ${compareTable()}
    </section>

    <section class="faq-wrap section-band" id="faq">
      <div class="faq-intro">
        <p class="eyebrow">- FAQ</p>
        <h2>Questions, answered.</h2>
        <p>Everything builders ask before they trust AI-assisted market workflows.</p>
      </div>
      <div class="faq-list">${faqs.map(faqItem).join("")}</div>
    </section>

    <section class="final-cta">
      <img src="/assets/causeway-app-icon.png" alt="" />
      <h2>Ready when your thesis is.</h2>
      <p>Start with one outcome. Build the market graph. Preview before you act.</p>
      <div class="install-line"><span>$</span> causeway infer --root-outcome &lt;tokenId&gt;<button type="button">Copy</button></div>
      <div class="actions center">
        <a class="button inverted" href="/Causeway_Whitepaper_v1.0_EN.pdf">Read the docs -></a>
        <a class="button dark-outline" href="#quickstart">See all steps</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <span>(c) 2026 Causeway</span>
    <nav><a href="/Causeway_Whitepaper_v1.0_EN.pdf">Docs</a><a href="#compare">Compare</a><a href="#faq">FAQ</a></nav>
  </footer>
`;

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
  ".section-copy > *",
  ".split-copy > *",
  ".terminal-window",
  ".recipe-card",
  ".control-card",
  ".image-point-copy > *",
  ".logo-constellation",
  ".feature-card",
  ".compare-top > *",
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
