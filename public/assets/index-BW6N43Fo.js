(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const t of s)if(t.type==="childList")for(const n of t.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&o(n)}).observe(document,{childList:!0,subtree:!0});function i(s){const t={};return s.integrity&&(t.integrity=s.integrity),s.referrerPolicy&&(t.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?t.credentials="include":s.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function o(s){if(s.ep)return;s.ep=!0;const t=i(s);fetch(s.href,t)}})();document.body.classList.add("intro-playing");const d=[{icon:"01",title:"Election Market Chain",body:"Start from one election outcome and review the second-order markets it may affect before building any order.",tags:["Politics","Outcome Token"]},{icon:"02",title:"Macro Shock Script",body:"Trace how rates, CPI, commodities, crypto, and policy markets connect through a single market thesis.",tags:["Macro","Causal Graph"]},{icon:"03",title:"Sports Event Basket",body:"Choose a team or match outcome, then keep every related market and outcome visible for manual review.",tags:["Sports","Market Network"]},{icon:"04",title:"Open Vault Preview",body:"Package rule-based probability exposure with eligibility, risk budgets, and NAV-style reporting logic.",tags:["Vaults","Risk Budget"]}],p=[["01","SET ROOT THESIS","Start with the event or market idea you want to understand.","thesis: fed-cut-june"],["02","MAP MARKET SHADOW","Causeway expands the thesis into related markets, paths, and second-order effects.","depth: 3 / confidence: 0.55"],["03","REVIEW REASONING","Every connection includes a reason, uncertainty, and a suggested review state.","show: assumptions | confidence | risks"],["04","BUILD PREVIEW","Turn the scenario into a controlled action preview with limits, checks, and an audit trail.","mode: dry_run | guarded"]],u=[{step:"01 / SIMULATE",label:"WORLD",title:"Build parallel market worlds.",body:"Causeway will move beyond single-path reasoning into simulated environments where events, agents, narratives, and incentives interact before real-world action.",fields:[["seed event","policy shock"],["agent groups","128"],["environment","market world"],["rounds","24"]]},{step:"02 / EVOLVE",label:"SWARM",title:"Let many agents reason together.",body:"Instead of one model producing one answer, Causeway can run specialized agents with memory, roles, biases, and strategies, then observe consensus and conflict.",flow:["analyst","skeptic","verifier","forecaster"]},{step:"03 / PREDICT",label:"REPORT",title:"Turn simulation into decision intelligence.",body:"The output is not a command to act, but a prediction report: possible futures, probability shifts, assumptions, source confidence, and review paths.",alert:"Prediction report ready. Human approval remains the boundary."}],m=[{icon:"event",title:"Events cast wider shadows",body:"A single headline can move through policy, macro, sports, crypto, and election markets. Causeway helps reveal the wider field before you act.",visual:"event -> market shadow"},{icon:"path",title:"Theses need structure",body:"Causeway turns one market idea into a readable path: what it may affect, why it matters, and where the next decision point sits.",visual:"thesis -> path -> decision"},{icon:"logic",title:"Reasoning must be visible",body:"Useful AI does not just answer. It shows assumptions, confidence, uncertainty, and the reasoning behind each market connection.",visual:"assumptions + confidence + why"},{icon:"bound",title:"Speed needs governance",body:"Fast response is only valuable when control stays clear. Causeway keeps review, confirmation, and final action inside a user-governed workflow.",visual:"reason -> review -> approve",highlight:!0},{icon:"view",title:"Previews reduce blind action",body:"Before a scenario becomes real exposure, Causeway turns it into a preview with expected action, limits, risk checks, and audit trail.",visual:"scenario -> preview -> record"},{icon:"mem",title:"Strategies need memory",body:"Repeated scripts can mature into transparent strategies with mandates, eligibility rules, risk budgets, and reporting logic.",visual:"script -> strategy -> report"}],r=[{phase:"01",status:"Now",theme:"Market Data Foundation",headline:"Understand the market before touching the world.",summary:"Phase one focuses on Polymarket market data first. External sources are a later source-object layer.",detail:"Causeway starts by building a reliable map of the market itself: market IDs, outcomes, token IDs, prices, liquidity, order books, resolution state, and recent market changes. The goal is not to rush into news ingestion. The goal is to make sure every AI-generated path can resolve back to real, tradable market structure before it becomes a preview or user decision.",points:["Market -> outcome -> tokenId mapping","Liquidity and order book awareness","Dry-run previews before any real execution"],signal:"Data -> Structure"},{phase:"02",status:"Next",theme:"Reasoning Model",headline:"Map one event into every related market.",summary:"Build a stronger inference model that can identify all markets touched by a news event, then score relevance, direction, confidence, and suggested action.",detail:"A single event rarely affects only one market. A Federal Reserve signal may touch rates, inflation, equities, crypto, election narratives, and commodity expectations. This phase turns that relationship into an auditable market graph: each connected market gets a reason, an impact direction, a confidence score, and a recommended workflow state such as monitor, avoid, preview, or reduce size.",points:["Cross-market relationship graph","Relevance, direction, confidence, and tradability scoring","Structured recommendations that remain reviewable"],signal:"Event -> Market Graph"},{phase:"03",status:"Later",theme:"Real-Time Scenario Generation",headline:"Turn live news into cross-market scripts.",summary:"Build real-time news stream ingestion and automated scenario generation so one event can produce a full-market response plan quickly.",detail:"At this stage, Causeway moves from offline reasoning into live event response. The system watches real-time news flow, extracts the event, identifies entities and affected themes, then generates a complete market script: what happened, which markets matter, which outcomes should be watched, what confirmation signals are missing, and which actions should be queued for human review.",points:["Real-time news flow ingestion","Automatic script generation from one event","Fast all-market reaction while preserving review gates"],signal:"News -> Script"},{phase:"04",status:"Trust",theme:"Source Verification Layer",headline:"Verify the ground truth before action.",summary:"Before a bet is placed, Causeway should verify the deepest available source of truth through an authority-data library.",detail:"Speed is not enough if the source is wrong. This phase adds a verification layer that traces claims back to primary or authoritative sources: official releases, regulatory filings, sports league data, court documents, government databases, company statements, and on-chain records. Before an action is previewed, the system can show source trail, freshness, conflicts, and whether the original claim was corrected or misread.",points:["Authority source database","Primary-source trail and freshness checks","Conflict detection before order preview"],signal:"Claim -> Proof"},{phase:"05",status:"Future",theme:"Delegated AI Execution",headline:"Let users optionally delegate bounded execution to AI.",summary:"In the future, users may choose to leave the manual verification layer and grant limited account authority to AI for intelligent order execution.",detail:"Delegation is the future layer, not the default boundary. Users can choose to authorize AI execution only inside explicit limits: market categories, maximum order size, loss budget, time window, data-source requirements, and revocation rules. The system should maintain audit trails, permission expiry, and emergency stop controls so autonomy is optional, bounded, and accountable.",points:["Optional permission delegation","User-defined limits and risk budgets","Audit trails, expiry, and emergency revocation"],signal:"Approve -> Delegate"}],h=[["Market structure","Event, market, outcome, tokenId","Titles and tabs","Loose text prompt","Bot-specific schema"],["Outcome mapping","All outcomes stay visible","Manual checking","Often assumes Yes/No","Depends on implementation"],["Causal graph","Layered, auditable paths","Research notes","Natural language only","Usually hidden"],["Order preview","Prices, book, risk, capability","Manual order ticket","No native execution","Often direct execution"],["Human confirmation","Required for real submit","Required","Not applicable","May be optional"],["Auditability","Saved script and order trail","Screenshots or notes","Conversation history","Varies"]],v=[["Does Causeway trade automatically?","No. Causeway can generate a script and default actions, but real orders require explicit user confirmation."],["Why does outcome-token mapping matter?","Polymarket orders execute against token IDs. A market title alone is not enough, and outcomes are not always just Yes and No."],["Does phase one use news or social data?","No. Phase one focuses on Polymarket market data first. External sources are a later source-object layer."],["Can I use Causeway before real trading is connected?","Yes. Dry-run mode keeps inference, preview, risk checks, and audit records available while real execution is gated."],["Is this investment advice?","No. Causeway is workflow software for market reasoning, previews, and user-governed execution."]];function g(e){return`
    <article class="recipe-card">
      <div class="recipe-top">
        <span class="recipe-icon">${e.icon}</span>
        <span class="ready">READY</span>
      </div>
      <h3>${e.title}</h3>
      <p>${e.body}</p>
      <div class="card-bottom">
        <div>${e.tags.map(a=>`<span class="tag">${a}</span>`).join("")}</div>
        <a href="#quickstart">Run -></a>
      </div>
    </article>
  `}function y([e,a,i,o]){return`
    <div class="terminal-row">
      <span class="terminal-num">${e}</span>
      <div>
        <h3>${a}</h3>
        <div class="code-line"><span>$</span> ${o}<button type="button" aria-label="Copy command">Copy</button></div>
        <p>${i}</p>
      </div>
    </div>
  `}function f(e){return`
    <article class="control-card">
      <div class="card-kicker"><span>${e.step}</span></div>
      <strong class="blue-label">${e.label}</strong>
      <h3>${e.title}</h3>
      <p>${e.body}</p>
      ${e.fields?`<div class="field-stack">${e.fields.map(([a,i])=>`<div><span>${a}</span><b>${i}</b></div>`).join("")}</div>`:""}
      ${e.flow?`<div class="flow-line">${e.flow.map(a=>`<span>${a}</span>`).join("<i>-></i>")}</div>
             <small class="metric">p50 - 37 ms - 1.24M decisions today</small>`:""}
      ${e.alert?`<div class="notice-box"><b>Preview gated.</b><span>${e.alert}</span></div>`:""}
    </article>
  `}function b(e){return`
    <article class="feature-card ${e.highlight?"feature-highlight":""}">
      <span class="feature-icon">${e.icon}</span>
      <h3>${e.title}</h3>
      <p>${e.body}</p>
      <div class="feature-visual">${e.visual}</div>
    </article>
  `}function w(e,a){return`
    <article class="roadmap-card" style="--roadmap-index: ${a}">
      <div class="roadmap-card-head">
        <span class="roadmap-phase">Phase ${e.phase}</span>
        <span class="roadmap-status">${e.status}</span>
      </div>
      <h3>${e.theme}</h3>
      <p>${e.headline}</p>
      <div class="roadmap-signal"><span>${e.signal}</span></div>
    </article>
  `}function k(e,a){return`
    <details class="roadmap-detail" ${a===0?"open":""}>
      <summary>
        <span>Phase ${e.phase}</span>
        <strong>${e.theme}</strong>
        <i>+</i>
      </summary>
      <div>
        <p>${e.summary}</p>
        <p>${e.detail}</p>
        <ul>
          ${e.points.map(i=>`<li>${i}</li>`).join("")}
        </ul>
      </div>
    </details>
  `}function C(){return`
    <div class="compare-table">
      <div class="compare-head empty"></div>
      <div class="compare-head us"><img src="/assets/causeway-mark-reversed.svg" alt="" />Causeway <span>US</span></div>
      <div class="compare-head">Manual Research</div>
      <div class="compare-head">Generic AI Chat</div>
      <div class="compare-head">Trading Bot</div>
      ${h.map(e=>`
            <div class="row-label">${e[0]}</div>
            <div class="us">${e[1]}</div>
            <div>${e[2]}</div>
            <div>${e[3]}</div>
            <div>${e[4]}</div>
          `).join("")}
    </div>
  `}function E([e,a],i){return`
    <details ${i===0?"open":""}>
      <summary>${e}<span>+</span></summary>
      <p>${a}</p>
    </details>
  `}function $(){return`
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
  `}document.querySelector("#app").innerHTML=`
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
      <a href="#roadmap">Roadmap</a>
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
      ${$()}
    </section>

    <section class="recipes section-band" id="recipes">
      <div class="section-copy">
        <p class="eyebrow">- CAUSEWAY RECIPES</p>
        <h2>Pick your first market thesis.</h2>
        <p>Pre-configured workflows for turning one Polymarket outcome into a reviewable script. Clone the pattern, then adapt the risk and execution settings.</p>
      </div>
      <div class="recipe-grid">${d.map(g).join("")}</div>
      <a class="outline-link" href="#features">Browse all recipes -></a>
    </section>

    <section class="quickstart section-band split" id="quickstart">
      <div class="split-copy">
        <p class="eyebrow">- QUICK START</p>
        <h2>From one event to a market response plan.</h2>
        <p>Choose a market thesis, let Causeway map the surrounding impact, review the reasoning path, and turn it into a controlled preview before any real action.</p>
        <a class="button primary" href="/Causeway_Whitepaper_v1.0_EN.pdf">Read the full docs -></a>
      </div>
      <div class="terminal-window">
        <div class="window-bar"><i></i><i></i><i></i><span>causeway-cli</span></div>
        ${p.map(y).join("")}
        <footer>Dry-run stays available while real execution remains gated by user approval.</footer>
      </div>
    </section>

    <section class="control section-band">
      <div class="section-copy wide">
        <p class="eyebrow">- SWARM INTELLIGENCE ROADMAP</p>
        <h2>From market reasoning to <span>collective prediction.</span></h2>
        <p>The long-term vision is a collective intelligence engine: seed an event, simulate many possible worlds, let agent groups debate and evolve, then turn the result into a human-governed prediction report.</p>
      </div>
      <div class="control-vision" aria-hidden="true">
        <img src="/assets/swarm-intelligence-bg.png" alt="" />
        <div>
          <span>Endgame</span>
          <b>Predict how the world may move.</b>
        </div>
      </div>
      <div class="control-grid">${u.map(f).join("")}</div>
      <p class="vision-note">The endgame is not faster trading. It is a living intelligence layer for predicting how the world may move.</p>
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

    <section class="roadmap section-band" id="roadmap">
      <div class="roadmap-top">
        <div class="section-copy">
          <p class="eyebrow">- FUTURE ROADMAP</p>
          <h2>From market data to trusted event response.</h2>
          <p>Causeway grows in five deliberate phases: data first, reasoning second, real-time scripts third, source verification fourth, and optional delegated execution only when the boundary is mature.</p>
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
      <div class="roadmap-grid">${r.map(w).join("")}</div>
      <div class="roadmap-detail-list">${r.map(k).join("")}</div>
    </section>

    <section class="features section-band" id="features">
      <div class="section-copy">
        <p class="eyebrow">- MARKET INTELLIGENCE LAYER</p>
        <h2>Every event has a market shadow.</h2>
      </div>
      <div class="feature-grid">${m.map(b).join("")}</div>
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
      ${C()}
    </section>

    <section class="faq-wrap section-band" id="faq">
      <div class="faq-intro">
        <p class="eyebrow">- FAQ</p>
        <h2>Questions, answered.</h2>
        <p>Everything builders ask before they trust AI-assisted market workflows.</p>
      </div>
      <div class="faq-list">${v.map(E).join("")}</div>
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
    <nav><a href="/Causeway_Whitepaper_v1.0_EN.pdf">Docs</a><a href="#roadmap">Roadmap</a><a href="#compare">Compare</a><a href="#faq">FAQ</a></nav>
  </footer>
`;document.querySelectorAll(".code-line button, .install-line button").forEach(e=>{e.addEventListener("click",async()=>{const a=e.parentElement.textContent.replace("Copy","").trim();try{await navigator.clipboard.writeText(a),e.textContent="Copied",setTimeout(()=>{e.textContent="Copy"},1200)}catch{e.textContent="Copy"}})});const A=[".hero-copy > *",".hero-graphic",".section-copy > *",".split-copy > *",".terminal-window",".recipe-card",".control-card",".image-point-copy > *",".logo-constellation",".roadmap-top > *",".roadmap-track",".roadmap-card",".roadmap-detail",".feature-card",".compare-top > *",".compare-table",".faq-intro > *",".faq-list",".final-cta > *"].join(",");document.querySelectorAll(A).forEach((e,a)=>{e.classList.add("reveal-item"),e.style.setProperty("--reveal-delay",`${Math.min(a%6,5)*70}ms`)});const c=()=>{document.body.classList.remove("intro-playing"),document.body.classList.add("intro-complete")};window.matchMedia("(prefers-reduced-motion: reduce)").matches?c():window.setTimeout(c,2250);const l=new IntersectionObserver(e=>{e.forEach(a=>{a.isIntersecting&&(a.target.classList.add("is-visible"),l.unobserve(a.target))})},{rootMargin:"0px 0px -12% 0px",threshold:.12});document.querySelectorAll(".reveal-item").forEach(e=>l.observe(e));
