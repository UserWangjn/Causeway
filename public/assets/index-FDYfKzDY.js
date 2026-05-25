(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))n(t);new MutationObserver(t=>{for(const s of t)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&n(i)}).observe(document,{childList:!0,subtree:!0});function a(t){const s={};return t.integrity&&(s.integrity=t.integrity),t.referrerPolicy&&(s.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?s.credentials="include":t.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(t){if(t.ep)return;t.ep=!0;const s=a(t);fetch(t.href,s)}})();const I=`<!doctype html>\r
<html lang="en">\r
  <head>\r
    <meta charset="utf-8" />\r
    <title>Causeway Technical & Economic Whitepaper v0.6 EN</title>\r
    <style>\r
      @page { size: A4; margin: 13mm 12mm; }\r
      :root {\r
        --ink: #081b33;\r
        --ink-2: #0a2a52;\r
        --blue: #1677ff;\r
        --cyan: #22c7e8;\r
        --green: #14b87a;\r
        --amber: #f59e0b;\r
        --red: #ef4444;\r
        --muted: #53657d;\r
        --line: #d8e6f5;\r
        --soft: #f5faff;\r
        --paper: #ffffff;\r
      }\r
      * { box-sizing: border-box; }\r
      body {\r
        margin: 0;\r
        background: var(--paper);\r
        color: var(--ink);\r
        font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;\r
        font-size: 10pt;\r
        line-height: 1.56;\r
      }\r
      h1, h2, h3, h4, p { margin-top: 0; }\r
      h1 { margin: 0 0 18px; font-size: 42pt; line-height: .96; letter-spacing: 0; }\r
      h2 { margin: 0 0 9px; color: var(--ink); font-size: 18pt; line-height: 1.12; break-after: avoid; }\r
      h3 { margin: 13px 0 5px; color: var(--ink-2); font-size: 11.8pt; line-height: 1.22; break-after: avoid; }\r
      h4 { margin: 10px 0 4px; color: var(--ink); font-size: 10.6pt; line-height: 1.25; }\r
      p { margin-bottom: 6px; }\r
      ul, ol { margin: 5px 0 8px 18px; padding: 0; }\r
      li { margin: 2px 0; }\r
      table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; break-inside: avoid; }\r
      th, td { border: 1px solid var(--line); padding: 5px 6px; text-align: left; vertical-align: top; }\r
      th { background: var(--soft); color: var(--ink); font-weight: 800; }\r
      code { font-family: Consolas, "SFMono-Regular", monospace; font-size: 9.3pt; color: var(--ink-2); }\r
      .cover { min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; position: relative; }\r
      .cover::before {\r
        content: "";\r
        position: absolute;\r
        inset: -13mm -12mm;\r
        z-index: -1;\r
        background:\r
          linear-gradient(rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          linear-gradient(90deg, rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          radial-gradient(circle at 76% 16%, rgba(22, 119, 255, .17), transparent 34%),\r
          radial-gradient(circle at 22% 82%, rgba(34, 199, 232, .12), transparent 30%),\r
          #fff;\r
        background-size: 26px 26px, 26px 26px, auto, auto, auto;\r
      }\r
      .brand img { width: 168px; height: auto; margin-bottom: 46px; }\r
      .eyebrow { margin: 0 0 13px; color: var(--blue); font-size: 8.8pt; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }\r
      .subtitle { max-width: 650px; color: #273b57; font-size: 15.2pt; line-height: 1.56; }\r
      .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 28px; }\r
      .meta-grid div, .callout, .principle, .phase-card, .note, .metric-card, .source-card {\r
        border: 1px solid var(--line);\r
        border-radius: 7px;\r
        background: rgba(245, 250, 255, .82);\r
        padding: 8px;\r
      }\r
      .meta-grid span, .small-label { display: block; color: var(--muted); font-size: 8pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }\r
      .meta-grid b { display: block; margin-top: 4px; font-size: 10.5pt; }\r
      .page { break-after: auto; margin-bottom: 8mm; }\r
      .toc { columns: 2; column-gap: 26px; }\r
      .toc p { break-inside: avoid; border-bottom: 1px solid var(--line); margin: 0 0 7px; padding-bottom: 6px; font-weight: 720; }\r
      .callout { margin: 8px 0 10px; border-left: 4px solid var(--blue); background: #f5faff; }\r
      .callout strong { color: var(--blue); }\r
      .warning { border-left-color: var(--amber); background: #fff8ed; }\r
      .warning strong { color: #a15c00; }\r
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }\r
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }\r
      .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }\r
      .principle, .metric-card { min-height: 88px; break-inside: avoid; }\r
      .principle b, .metric-card b, .note b { display: block; margin: 4px 0 6px; color: var(--ink); font-size: 11.2pt; }\r
      .principle p, .phase-card p, .note p, .metric-card p, .source-card p { margin-bottom: 0; color: #273b57; font-size: 8.9pt; line-height: 1.45; }\r
      .phase-card { break-inside: avoid; margin-bottom: 6px; }\r
      .phase-card h3 { margin-top: 4px; }\r
      .tag {\r
        display: inline-block;\r
        margin: 0 5px 5px 0;\r
        border: 1px solid #bcd7ff;\r
        border-radius: 999px;\r
        background: #eef6ff;\r
        color: var(--blue);\r
        padding: 2px 8px;\r
        font-size: 8pt;\r
        font-weight: 800;\r
      }\r
      .tag.dark { border-color: var(--ink); background: var(--ink); color: #fff; }\r
      .hero-image { overflow: hidden; border: 1px solid rgba(22,119,255,.22); border-radius: 10px; height: 96mm; margin: 14px 0; background: #06162b; }\r
      .hero-image img { width: 100%; height: 100%; object-fit: cover; }\r
      .concept-figure { break-inside: avoid; width: 72%; margin: 9px auto 12px; }\r
      .concept-figure-frame { overflow: hidden; border: 1px solid rgba(22,119,255,.2); border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(8,27,51,.08); }\r
      .concept-figure img { display: block; width: 100%; max-height: 82mm; object-fit: contain; }\r
      .concept-figure .caption { margin: 5px 0 0; line-height: 1.42; }\r
      .caption { color: var(--muted); font-size: 8pt; }\r
      .disclaimer, .footnotes { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 11px; color: var(--muted); font-size: 8.2pt; line-height: 1.52; }\r
      .no-break { break-inside: avoid; }\r
      .source-list p { margin-bottom: 5px; word-break: break-all; }\r
      .kpi td:first-child { width: 24%; font-weight: 800; color: var(--ink-2); }\r
      .formula {\r
        border: 1px solid var(--line);\r
        border-left: 5px solid var(--green);\r
        border-radius: 8px;\r
        background: #f3fff9;\r
        margin: 6px 0 8px;\r
        padding: 7px 9px;\r
        break-inside: avoid;\r
      }\r
      .formula code { display: block; margin: 2px 0; color: #07513a; font-size: 8.8pt; }\r
      .formula p { margin: 4px 0 0; color: #244a3d; font-size: 8.6pt; line-height: 1.42; }\r
    </style>\r
  </head>\r
  <body>\r
    <section class="cover">\r
      <div>\r
        <div class="brand"><img src="../../public/assets/causeway-lockup-primary.svg" alt="Causeway" /></div>\r
        <p class="eyebrow">Technical & Economic Whitepaper</p>\r
        <h1>Causeway<br />Technical & Economic Whitepaper</h1>\r
        <p class="subtitle">\r
          AI trading intelligence and verifiable reasoning layer for prediction markets: from Polymarket market data, causal deduction, risk preview, to Arc verifiable reasoning, USDC native agent economy and swarm intelligence prediction engine.\r
        </p>\r
        <div class="meta-grid">\r
          <div><span>Version</span><b>v0.6</b></div>\r
          <div><span>Date</span><b>2026-05</b></div>\r
          <div><span>Status</span><b>Detailed Draft</b></div>\r
          <div><span>Scope</span><b>Market + Arc</b></div>\r
        </div>\r
      </div>\r
      <div class="disclaimer">\r
        This white paper is used to explain Causeway's market judgment, product positioning, technical architecture, Arc integration, economic model, risk boundaries and future roadmap. This article does not constitute investment advice, legal advice, brokerage service descriptions, income commitments or any form of automated trading solicitation. Predicting the market involves significant risks, and any real transactions should be actively confirmed by users based on their own judgment.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">Table of Contents</p>\r
      <h2>Table of Contents</h2>\r
      <div class="toc">\r
        <p>01. Executive Summary</p>\r
        <p>02. Market background: The prediction market enters the mainstream stage</p>\r
        <p>03. Core question: Why do existing prediction markets still lack an intelligent layer?</p>\r
        <p>04. Academic foundation and value calculation framework</p>\r
        <p>05. Causeway’s product definition</p>\r
        <p>06. What problems have we solved?</p>\r
        <p>07. System architecture and data model</p>\r
        <p>08. AI Trader Intelligence: From Probability to Action Preview</p>\r
        <p>09. Arc Proof: Verifiable AI reasoning record</p>\r
        <p>10. Arc USDC Premium: Smart Economy and Payment Ability</p>\r
        <p>11. x402 Agent Service Layer: Future agent service protocol layer</p>\r
        <p>12. Swarm Prediction Engine: From the parallel market world to predicting everything</p>\r
        <p>13. User workflow and product experience</p>\r
        <p>14. Risk control, governance and compliance boundaries</p>\r
        <p>15. Problems that need to be solved in the future</p>\r
        <p>16. Five-stage technology roadmap</p>\r
        <p>17. Business model and value capture</p>\r
        <p>18. Moats, indicators and conclusions</p>\r
        <p>19. References</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">01 / Executive Summary</p>\r
      <h2>Executive Summary</h2>\r
      <p>\r
        Causeway is an AI trading intelligence and verifiable reasoning layer for prediction markets. Its basic judgment is that prediction markets are evolving from "an event betting interface with the participation of a small number of crypto users" to "a probabilistic infrastructure for real events, macro risks, sports, politics, corporate events and on-chain activities." When the number of markets, trading volume, and complexity of participants increase, users no longer need just a better-looking handicap page, but an intelligent system that can transform events into reviewable market judgments.\r
      </p>\r
      <p>\r
        The core gaps in the current prediction market interface are: the relationship between markets is not structured, the judgments given by AI lack verifiable reasoning records, and trading recommendations lack risk and position constraints. It is difficult for users to review why a signal was generated, what the basis was, and whether it was later correct. Causeway tries to fill this gap: starting from Polymarket market data, it builds a market network, generates causal scripts, outputs probability, edge, risk and preview, and anchors AI reasoning trace to Arc Testnet so that "pre-event reasoning" and "post-event results" can be audited.\r
      </p>\r
      <div class="callout">\r
        <strong>Positioning in one sentence:</strong>\r
        Causeway turns prediction markets into an AI-readable, AI-reasoned, user-executed, and Arc-verifiable trading intelligence layer.\r
      </div>\r
      <p>\r
        Different from ordinary AI chat assistants, the core product of Causeway is not a natural language answer that cannot be reviewed, but a structured market intelligence object: root market, root outcome token, candidate market, causal edge, probability estimate, market implicit probability, edge, BUY / WATCH / AVOID recommendations, risk explanation, order preview, user confirmation status, Arc proof hash and subsequent performance records. By default, the system does not host funds for users, does not bypass user signatures, and does not package AI output into investment advice; it provides a set of explainable, verifiable, and governable prediction market workflows.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">02 / Market Context</p>\r
      <h2>Market background: The prediction market enters the mainstream stage</h2>\r
      <h3>2.1 Trading volume and institutional attention are rising rapidly</h3>\r
      <p>\r
        The prediction market completed its first large-scale exit during the 2024 US election cycle. CoinDesk reported that Polymarket’s 2024 U.S. presidential election contract volume exceeded $3.6 billion. The market also brought the prediction market to the attention of large-scale mainstream media and ordinary users for the first time. By 2025, industry growth expands from single political events to more categories such as sports, macro, crypto, economic data, corporate events, and cultural events.\r
      </p>\r
      <p>\r
        In a 2026 report on forecast market entry, KPMG noted that Kalshi and Polymarket’s combined transaction volume will exceed $40 billion in 2025, compared with approximately $9 billion in 2024, representing annual growth of more than 400%. The report also mentioned that Polymarket’s monthly trading volume exceeded $3 billion in October 2025. Although the caliber of different data sources will vary depending on the platform, volume definition and time frame, the direction is the same: the prediction market has moved from experimental products to a stage of high growth, strong regulatory attention and institutional participation.\r
      </p>\r
      <h3>2.2 The prediction market is changing from a “trading venue” to a “probabilistic data layer”</h3>\r
      <p>\r
        The strategic investment in Polymarket by ICE (the parent company of the New York Stock Exchange) is further evidence that the market is focused not just on transaction fees, but on event-driven data itself. Axios reports that ICE has agreed to invest up to $2 billion in Polymarket and will become a global distributor of Polymarket’s event-driven data. This means that the value of prediction markets is not just in trading, but in its ability to convert real-world uncertainty into observable probability data in real time.\r
      </p>\r
      <div class="grid-3">\r
        <div class="metric-card">\r
          <span class="small-label">Market Signal</span>\r
          <b>Trading volume expands</b>\r
          <p>The trading volume of the platform has expanded from the peak of the election cycle to multi-category normal transactions, and the market depth and user structure have become more complex.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Institutional Signal</span>\r
          <b>Institutional entry</b>\r
          <p>Exchanges, brokerages, sports platforms and financial technology companies are looking for entry into prediction markets.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Data Signal</span>\r
          <b>Probability digitization</b>\r
          <p>Predicting market prices is being re-understood as event-driven data, not just the results of user bets.</p>\r
        </div>\r
      </div>\r
      <h3>2.3 New contradictions brought about by growth</h3>\r
      <p>\r
        After the market expands, users are no longer faced with "cannot find the market", but "cannot judge which markets are worthy of research, which prices have reflected information, which related markets are lagging behind, and which signals are noise." The faster the transaction volume grows, the more intelligent layers are needed to organize market relationships, interpret probability changes, identify misprices, control risks, and form repeatable records.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">03 / Problem</p>\r
      <h2>Core Question: Why Existing Prediction Markets Still Miss an Intelligence Layer</h2>\r
      <h3>3.1 Problem 1: The market is a network, but the interface is still a list</h3>\r
      <p>\r
        A real-life event rarely affects just one market. For example, a statement by the Federal Reserve may affect interest rates, inflation, the US dollar, crypto assets, stock indexes, gold, election narratives and related corporate events at the same time; a sports injury news may affect the outcome, championship, player data and the probability of qualifying for the same group. Traditional interfaces are typically presented as market lists, event pages, and search results, lacking a structured representation of how events propagate across markets.\r
      </p>\r
      <h3>3.2 Problem 2: The market data structure is complex and the transaction object is not the title</h3>\r
      <p>\r
        The trading object of Polymarket is not the market title, but the outcome token. In the official Gamma API <code>outcomes</code>、<code>outcomePrices</code> There is an index mapping relationship with CLOB token ID; there may be multiple markets under the same event. For users and AI systems, if only the title or Yes/No copy is understood, it is easy to produce incorrect mappings in multi-outcome markets, sports markets, range markets, and mutually exclusive events.\r
      </p>\r
      <h3>3.3 Problem 3: AI recommendations lack auditability</h3>\r
      <p>\r
        Ordinary AI systems can generate answers such as "It is recommended to buy Yes", but this answer often lacks input snapshots, candidate market scope, prompt version, model version, output schema, reasoning path, counterexamples and post-event traceability. The particularity of prediction markets is that the results will be verified in the future. If the system cannot prove that a judgment was made before the outcome occurred or that the reasoning was not modified later, then the signal performance lacks a credible basis.\r
      </p>\r
      <h3>3.4 Issue 4: There is a conflict between speed and governance</h3>\r
      <p>\r
        The advantage of event markets is that they can react quickly, but being too fast can also amplify the risks of misinformation, hallucinations, illiquidity and over-trading. A professional system cannot only pursue automatic execution, but must incorporate preview, budget, tradable status, order book refresh, user confirmation, audit records and permission revocation into the same process.\r
      </p>\r
      <div class="callout warning">\r
        <strong>Product judgment:</strong>\r
        The core competition in the next stage of the prediction market is not "who has more market pages", but "who can organize market prices, AI reasoning, real execution and verifiable records into a complete intelligent closed loop."\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">04 / Academic Foundation</p>\r
      <h2>Academic foundation and value calculation framework</h2>\r
      <p>\r
        The theoretical value of prediction markets comes from a simple but powerful mechanism: when a contract pays a fixed amount based on the outcome of an event, the transaction price can approximately express the market's collective judgment on the probability of an event occurring under certain conditions. Wolfers and Zitzewitz's review of prediction markets pointed out that prediction markets can aggregate dispersed information through prices into readable signals; Snowberg, Wolfers, and Zitzewitz further applied this mechanism to economic prediction scenarios, explaining that event contract prices can become real-time probabilistic expressions of macro and policy uncertainty. The value of Causeway is not to reinvent the prediction market, but to add AI reasoning, cross-market consistency detection, execution friction correction, risk budgeting and verifiable performance records based on "price as a probabilistic signal".\r
      </p>\r
      <h3>4.1 Price is probability, but not unconditional truth</h3>\r
      <p>\r
        For a binary event contract, if the contract pays $1 when the event occurs and $0 when it does not occur, under ideal conditions of risk neutrality, low transaction costs, sufficient liquidity, and participants being able to trade freely, the market price <code>p</code> It can be understood as market-implied probability. Realistic prediction markets do not always meet these conditions: spreads, fees, slippage, limits, information noise, manipulation attempts, regulatory restrictions and participant risk preferences will all cause prices to deviate from the "true probability". Therefore, Causeway does not regard the market price as a conclusion, but as the first layer of observable signals, which are then jointly explained by AI fair odds, source verification, liquidity check and risk model.\r
      </p>\r
      <div class="formula">\r
        <code>p_mid = (bestBid + bestAsk) / 2</code>\r
        <code>p_exec_yes = ask_yes, p_exec_no = ask_no</code>\r
        <code>q_ai = calibratedForecast(event | marketSnapshot, sourceObjects, reasoningTrace)</code>\r
        <code>rawEdge_mid = q_ai - p_mid</code>\r
        <p><code>p_mid</code> Suitable for displaying market implied probabilities,<code>p_exec_yes</code> This is the real execution probability threshold for buying YES. Causeway should distinguish between "probability for research" and "probability of tradability" to avoid using the middle price to exaggerate the edge.</p>\r
      </div>\r
      <h3>4.2 Transaction value comes from “positive expectations after friction”</h3>\r
      <p>\r
        What is really valuable to users is not "AI thinks the probability is higher", but "there is still a positive expectation after the current tradable price, handling fees, slippage, handicap depth and uncertainty discount". This is also the core that prediction market arbitrage research repeatedly emphasizes: Theoretical price inconsistencies only constitute real opportunities when they are executable, settleable, and still positive after deducting costs. Causeway therefore divides opportunities into three levels: raw signal, tradable signal and executable order preview.\r
      </p>\r
      <div class="formula">\r
        <code>EV_token_yes = q_ai * 1 + (1 - q_ai) * 0 - ask_yes - cost_per_token</code>\r
        <code>ROI_yes = EV_token_yes / ask_yes</code>\r
        <code>edgeNet = q_ai - ask_yes - feeRate - slippageBps - ruleRiskHaircut - sourceRiskHaircut</code>\r
        <code>BUY only if edgeNet &gt; minEdge, depthAtLimit &gt; targetSize, timeToClose &gt; minWindow</code>\r
        <p>The net advantage must be simultaneously constrained by probability, cost, depth, and time windows. If any of the constraints are insufficient, the system should downgrade to WATCH, VERIFY FIRST, or AVOID.</p>\r
      </div>\r
      <h3>4.3 Position Suggestion: Use conservative Kelly instead of impulsive betting</h3>\r
      <p>\r
        In an event contract, the purchase price itself is close to the maximum loss; the contract value approaches 1 when the event occurs and approaches 0 when it does not occur. The Kelly formula can be used as a theoretical starting point for position recommendations, but prediction markets contain model errors, liquidity discontinuities, rule interpretation differences, and event settlement risks, so a discounted version must be used, overlaying market capacity, portfolio correlation, and user budget caps. Causeway outputs risk budget recommendations, not revenue commitments.\r
      </p>\r
      <div class="formula">\r
        <code>q_adj = clamp(0.5 + confidence * (q_ai - 0.5), 0.01, 0.99)</code>\r
        <code>b = (1 - p_exec) / p_exec</code>\r
        <code>kellyFull = (b * q_adj - (1 - q_adj)) / b = (q_adj - p_exec) / (1 - p_exec)</code>\r
        <code>sizeUsd = bankroll * min(max(0, lambda * kellyFull), capMarket, capPortfolio, capCorrelation)</code>\r
        <p><code>q_adj</code> Use confidence to shrink the model probability toward 50%,<code>lambda</code> Discount for fractional Kelly. Positions must then be constrained by market capacity, portfolio correlation, daily loss caps and user budgets.</p>\r
      </div>\r
      <h3>4.4 Mutually Exclusive Complete Market: Identifying Arbitrage and Risk from Price Sum</h3>\r
      <p>\r
        In a mutually exclusive and complete multi-outcome market such as presidential winner, championship ownership, interval outcome, etc., the sum of the true probabilities of all outcomes should be close to 1. Arbitrage papers often use this structure to detect price inconsistencies: if the total ask of buying all outcomes is less than 1, there is theoretically a profit margin of "buying the whole basket"; if the total bid that can be sold is greater than 1, there may be a reverse arbitrage or overpricing signal. However, real trading needs to consider whether transactions can be completed at the same time, whether short selling is allowed, whether there is cancellation/settlement risk, and whether the market depth is sufficient.\r
      </p>\r
      <div class="formula">\r
        <code>Underround: Σ ask_i + fees + slippage &lt; 1</code>\r
        <code>profitFloor_buyBasket = 1 - Σ ask_i - fees - slippage - settlementRisk</code>\r
        <code>Overround: Σ bid_i - fees - slippage &gt; 1, if sell/short/redeem path exists</code>\r
        <code>executable = profitFloor &gt; 0 and min(depth_i) &gt; targetSize and rules_i are consistent</code>\r
        <p>Causeway does not reduce mutually exclusive complete arbitrage to a mathematical problem, but uses it as a consistency check for the Market Graph: first find price anomalies, and then verify the depth, rules, settlement and execution paths.</p>\r
      </div>\r
      <h3>4.5 Cross-market semantic consistency: from “same event” to “full market map”</h3>\r
      <p>\r
        Modern Polymarket is not a collection of isolated markets, but a semantic network composed of events, entities, time windows, rule texts and result conditions. One market may logically imply another market: for example, "the candidate wins the presidential election" implies "the candidate still has a chance to enter the general election after winning the nomination of his party", and a certain team "wins the championship" implies that its probability of "entering the finals/playoffs" should not be lower. If the price in the underlying market is too much higher than the contained market, the system should flag it as semantically inconsistent or potentially mispriced. The user-provided Polymarket semantic arbitrage and prediction market arbitrage literature supports Causeway's Market Graph direction: the advantage of AI is to read rule text, identify implicit relationships, and turn them into computable constraints.\r
      </p>\r
      <div class="formula">\r
        <code>If event B implies event A, then P(B) ≤ P(A)</code>\r
        <code>violation = max(0, p_exec(B) - p_exec(A) - costMargin - ruleRiskMargin)</code>\r
        <code>semanticEdge = violation * relationConfidence * min(liquidityScore_A, liquidityScore_B)</code>\r
        <code>tradeableSemanticEdge = semanticEdge only if both markets share compatible resolution rules</code>\r
        <p>The key here is not to have the model "guess", but to have the model output an auditable relationship type: implies, mutually exclusive, related, causal, same source, or unrelated.</p>\r
      </div>\r
      <h3>4.6 Case: How Causeway transfers the value of the paper to the product</h3>\r
      <table>\r
        <thead><tr><th>Academic/Market Cases</th><th>traditional value</th><th>Causeway’s approach to productization</th></tr></thead>\r
        <tbody>\r
          <tr><td>electoral market</td><td>Price aggregates polls, news, trader judgment and risk appetite into real-time odds.</td><td>Map candidates, states, parties, nominations, turnout and macro events into a market graph to identify which markets have already reflected the news and which related markets are lagging.</td></tr>\r
          <tr><td>Macroeconomic releases</td><td>Events such as CPI, interest rates, employment, recession, etc. can use contract prices to form real-time expectations.</td><td>Write the data release time, consensus expectations, historical revisions, Fed statements and asset reactions into the Source Object to generate a "before data/after data" strategy observation list.</td></tr>\r
          <tr><td>Sports Champion/Event Winner</td><td>The price sum of mutually exclusive complete outcomes can be used to detect overround, underround and handicap anomalies.</td><td>Automatically calculate sumAsk, sumBid, depth and settlement rules for the same group of outcomes, giving implementability rather than just theoretical arbitrage.</td></tr>\r
          <tr><td>Polymarket Semantic Arbitrage</td><td>Multiple markets with different titles but mutually implied outcomes may have inconsistent probabilities.</td><td>Use AI to parse the rule text, establish implies / mutually exclusive / correlated edges, and then use violationScore to sort potential opportunities.</td></tr>\r
          <tr><td>Thin Liquidity and Noisy Markets</td><td>Prices may deviate from true probabilities due to small transactions, spreads or insufficient information.</td><td>Put liquidityScore, spreadRisk, sourceRisk and confidence into signalScore and low quality opportunities are automatically downgraded to WATCH or AVOID.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>4.7 Performance evaluation: Don’t just look at PnL</h3>\r
      <p>\r
        AI signals can easily become post hoc screenings if only money-making cases are shown. Causeway must evaluate the model with calibration metrics and scoring functions commonly used in prediction market research, not just account P&L. Brier Score measures the squared error of a probability prediction versus the actual outcome; Log Loss heavily penalizes high-confidence errors; and the calibration bucket checks whether "the AI ​​says 70% of events actually happen approximately 70% of the time." The significance of Arc Proof becomes very straightforward here: it allows each probability judgment to be locked in advance, thereby making performance evaluations more credible.\r
      </p>\r
      <div class="formula">\r
        <code>Brier_mean = mean((q_ai - y)^2)</code>\r
        <code>LogLoss_mean = mean(-[y * ln(q_ai + eps) + (1 - y) * ln(1 - q_ai + eps)])</code>\r
        <code>CalibrationError = Σ_k n_k / N * |mean(q_ai in bucket k) - mean(y in bucket k)|</code>\r
        <code>signalScore = z(edgeNet) + z(confidence) + z(liquidity) - z(spreadRisk) - z(sourceRisk) - z(correlationRisk)</code>\r
        <p>Long-term value comes from repeatable, stable calibrations, not a single prediction hit. Causeway's Signal Track Record should simultaneously show post-event performance for accuracy, calibration, PnL, drawdown, execution rate, and missed opportunities.</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">05 / Product Definition</p>\r
      <h2>Causeway Product Definition</h2>\r
      <p>\r
        Causeway is a prediction market Trader Intelligence Layer. It is aimed at users who want to understand, research and execute prediction market opportunities, providing a complete workflow from full market data to AI reasoning, from trading opportunity identification to user confirmation execution, from reasoning trace to Arc proof, from single signal to performance tracking.\r
      </p>\r
      <table>\r
        <thead>\r
          <tr><th>Hierarchy</th><th>Function</th><th>user value</th></tr>\r
        </thead>\r
        <tbody>\r
          <tr><td>Market data base</td><td>Sync Polymarket events, markets, outcomes, tokens, prices, liquidity, rules and status.</td><td>Let AI and users first understand the real tradable objects.</td></tr>\r
          <tr><td>market network</td><td>Build market graph based on events, tags, semantics, price correlation and AI inference.</td><td>Transform markets from lists into browsable probabilistic networks.</td></tr>\r
          <tr><td>AI inference engine</td><td>Generate relevant markets, causal paths, confidence levels, and default actions from the root outcome.</td><td>Convert "market ideas" into reviewable scripts.</td></tr>\r
          <tr><td>Transaction Intelligence Layer</td><td>Calculate market odds, AI fair odds, edge, risk, position recommendations and BUY/WATCH/AVOID.</td><td>Let AI actually participate in transaction judgment instead of just interpreting text.</td></tr>\r
          <tr><td>Order preview layer</td><td>Generate dry-run or real CLOB order previews, refresh markets, check limits, and wait for user signatures.</td><td>Connect inference to real execution while preserving control boundaries.</td></tr>\r
          <tr><td>Arc Verifiable Layer</td><td>Write the reasoning trace hash to Arc Testnet and verify that the calldata is consistent with the original trace.</td><td>Prove that the reasoning record exists beforehand, reducing the room for subsequent tampering.</td></tr>\r
          <tr><td>performance tracking layer</td><td>Track signals, orders, positions, price changes, PnL and final results.</td><td>A system that takes AI capabilities from demonstration to sustainable evaluation.</td></tr>\r
        </tbody>\r
      </table>\r
      <p>\r
        The boundaries of the Causeway are equally important. By default, the system does not keep user private keys, does not bypass signatures for users, and does not package AI output into investment advice. AI is responsible for expanding market arguments, identifying paths, proposing risks and generating previews; users are responsible for confirming whether to act, how much to act, when to stop, and whether to open limited orders in the future.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">06 / What We Have Solved</p>\r
      <h2>What problems have we solved?</h2>\r
      <h3>6.1 Market data and outcome token mapping</h3>\r
      <p>\r
        Causeway has clearly distinguished between "market titles" and "real tradable outcome tokens". The system data model contains <code>PolymarketEvent</code>、<code>PolymarketMarket</code>、<code>PolymarketOutcome</code>、<code>clobTokenId</code>, price, best bid, best ask, last trade, spread, volume, liquidity, order min size and tick size fields. This solves the problem of AI or front-end mistaking marketing for simple Yes/No copy.\r
      </p>\r
      <h3>6.2 From root outcome to causal script</h3>\r
      <p>\r
        Users can select a root market and root outcome, and the system generates an AI inference run based on the candidate market. The output is not a single-sentence recommendation, but a structured result containing nodes, edges, warnings, impactDirection, confidence, reason, and outcome recommendation. The backend then converts it into causal script, script market and script outcome selection, allowing users to review and modify them one by one.\r
      </p>\r
      <h3>6.3 Closed loop of order preview and user confirmation</h3>\r
      <p>\r
        Causeway’s order layer distinction <code>dry_run</code> and <code>real</code> execution mode. The system can generate order previews, refresh order books, check balances and trading capabilities, prepare EIP-712 signature payloads, and submit real orders through Polymarket CLOB. When real capabilities are unavailable, the front-end and back-end protocols remain consistent, preventing the product from interrupting demonstration and development due to a single external dependency.\r
      </p>\r
      <h3>6.4 Polymarket Builder attribution</h3>\r
      <p>\r
        The Polymarket Builder Program allows applications to append builder code to order structures to obtain order attribution and builder leaderboard statistics. Causeway's business closed loop can be built on "AI discovers and explains opportunities, users retain wallet control and personally confirm transactions, and real transactions are attributed through builder code." This is more suitable for prediction market trading scenarios than a pure subscription model.\r
      </p>\r
      <h3>6.5 Arc reasoning trace proof</h3>\r
      <p>\r
        The current implementation of Causeway already includes the Arc Proof module. The system can read a certain causal script and build <code>causeway.reasoning_trace.v1</code> The capsule packages inference input hash, output hash, model version, prompt version, market snapshot, outcome selection and script graph, generates trace hash, and anchors it through Arc Testnet transaction calldata. The backend will verify the transaction signer, chainId and calldata to ensure that the records on the chain are consistent with the original trace.\r
      </p>\r
      <h3>6.6 Arc USDC premium payments</h3>\r
      <p>\r
        Causeway also implements Arc USDC payment intent and membership entitlement. Users can pay Arc USDC for premium capability, and the backend verifies the payment amount, payer, payee, transaction status, and time window by reading Arc transaction receipt and USDC Transfer log before activating premium membership. This mechanism can be used for capabilities such as advanced models, deeper reasoning, more complete reasoning traces, and Arc proof; in the future, it can also be combined with x402 service calls settled on Arc, so that member subscriptions, pay-per-view reports, API calls, and agent capability unlocking share the same set of verifiable payment records.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">07 / Architecture</p>\r
      <h2>System architecture and data model</h2>\r
      <h3>7.1 Technology stack</h3>\r
      <table>\r
        <thead><tr><th>module</th><th>Current implementation direction</th><th>effect</th></tr></thead>\r
        <tbody>\r
          <tr><td>Frontend</td><td>React + Vite + RainbowKit + wagmi + viem + React Flow</td><td>Market network, wallet connection, inference graph, order preview, Arc Proof panel.</td></tr>\r
          <tr><td>API</td><td>NestJS + Prisma + PostgreSQL</td><td>Market synchronization, AI inference, scripts, orders, portfolios, payments, Arc proof.</td></tr>\r
          <tr><td>Polymarket</td><td>Gamma API + CLOB/Data API + Builder Relayer</td><td>Market data, outcome tokens, order books, signature orders and builder attribution.</td></tr>\r
          <tr><td>AI</td><td>Structured prompt + output schema + cache</td><td>Generate cause and effect diagrams, recommended outcomes, confidence levels, risks and scripts.</td></tr>\r
          <tr><td>Arc</td><td>Arc Testnet + viem public/wallet client + USDC payment verification</td><td>Reasoning trace proof, premium payment, economic basis of agent.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>7.2 Data objects</h3>\r
      <p>\r
        Causeway's core data objects are designed around "tradable markets" and "auditable reasoning." The market object is responsible for accurately expressing the Polymarket structure, the reasoning object is responsible for recording AI input and output, the script object is responsible for converting reasoning into a user-editable action plan, the order object is responsible for connecting real transactions, and the Arc proof object is responsible for proving that the reasoning record exists at a specific point in time.\r
      </p>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Market Object</span><b>real market structure</b><p>Contains event, market, outcome, conditionId, questionId, clobTokenId, price, liquidity and rules.</p></div>\r
        <div class="note"><span class="small-label">Inference Object</span><b>AI inference record</b><p>Includes root outcome, candidate set, prompt version, model, inputJson, outputJson, and cacheKey.</p></div>\r
        <div class="note"><span class="small-label">Causal Script</span><b>Editable action script</b><p>Contains graphJson, script markets, outcome selections, userAction, orderMode and justification.</p></div>\r
        <div class="note"><span class="small-label">Arc Proof Capsule</span><b>verifiable inference proof</b><p>Contains trace hash, calldata, chainId, txHash, ArcScan URL and anchor timestamp.</p></div>\r
      </div>\r
      <h3>7.3 Architectural principles</h3>\r
      <ul>\r
        <li><strong>Market-first：</strong>Make sure the market structure, outcome tokens, and order books are reliable before expanding on external information sources.</li>\r
        <li><strong>Structured AI：</strong>AI output must conform to the schema and cannot just return natural language.</li>\r
        <li><strong>Human-governed：</strong>AI can generate default scripts, but users can modify, skip, preview, or reject them.</li>\r
        <li><strong>Proof-ready：</strong>Key reasoning records should be hashed, reviewed and anchored to support post-event performance evaluation.</li>\r
        <li><strong>Capability fallback：</strong>When real transactions, balances, payments, or external APIs are unavailable, the system should return structured capability status instead of crashing.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">08 / Trader Intelligence</p>\r
      <h2>AI Trader Intelligence: From Probability to Action Preview</h2>\r
      <h3>8.1 Signals should not be just "buy" or "don't buy"</h3>\r
      <p>\r
        A mature prediction market intelligence system should not give trading recommendations for all markets. Many markets should return WATCH or AVOID: for example, there is not enough edge, insufficient liquidity, spreads are too wide, rules are unclear, information sources are not verified, users already have highly correlated exposures, the market is about to end, or AI confidence is insufficient. No Trade Recommended is a competency in and of itself because it demonstrates a system with restraint and risk awareness.\r
      </p>\r
      <h3>8.2 Signal Object</h3>\r
      <table>\r
        <thead><tr><th>Field</th><th>illustrate</th></tr></thead>\r
        <tbody>\r
          <tr><td>signalId</td><td>Unique signal ID for tracking and performance review.</td></tr>\r
          <tr><td>marketOdds</td><td>Market price implied probabilities.</td></tr>\r
          <tr><td>aiFairOdds</td><td>AI provides fair probabilities based on market data, reasoning paths, and information source verification.</td></tr>\r
          <tr><td>edge</td><td>The difference between AI fair odds and market odds.</td></tr>\r
          <tr><td>confidence</td><td>The model's confidence in the inference path and data quality.</td></tr>\r
          <tr><td>recommendation</td><td>BUY, WATCH, AVOID, or VERIFY FIRST.</td></tr>\r
          <tr><td>riskLevel</td><td>Low, Medium, High, subject to liquidity, rules, sources, volatility and related exposures.</td></tr>\r
          <tr><td>suggestedSize</td><td>Recommended amount based on conservative Kelly, budget cap, and market capacity.</td></tr>\r
          <tr><td>changeMyMind</td><td>What factual changes would overturn the current recommendations.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>8.3 From cause-and-effect diagram to position recommendation</h3>\r
      <p>\r
        Causeway's position recommendations should not be fixed amounts, but should be determined by a combination of factors: edge size, confidence, market depth, spread, user risk appetite, market correlation, single market cap and overall budget. Conservative Kelly can be used as a basic framework, but discount factors and upper limits must be added to prevent the model from over-betting in high-uncertainty scenarios.\r
      </p>\r
      <div class="callout">\r
        <strong>Conservative principles:</strong>\r
        Recommended positions should be "explainable risk budgets", not promises of returns. The system should clearly display the maximum loss, transaction price, slippage, expiration time and conditions that trigger revaluation.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">09 / Arc Proof</p>\r
      <h2>Arc Proof: verifiable records of AI reasoning</h2>\r
      <h3>9.1 Why reasoning requires on-chain proof</h3>\r
      <p>\r
        The core of prediction markets is that the future will verify today's judgments. Therefore, the credibility of an AI signal not only comes from the model itself, but also from "whether it can prove that it made this judgment before the result occurred." If a system can modify historical reasoning traces after results are published, then any record of signal accuracy, PnL, or performance lacks a basis for trust.\r
      </p>\r
      <p>\r
        The role of Arc Proof is not to replace the Polymarket trading link, nor to move user orders to Arc. Polymarket is still responsible for market and CLOB transactions; Arc is responsible for recording the hash of AI reasoning traces as a low-cost, fast, and native audit layer for stablecoins.\r
      </p>\r
      <h3>9.2 Causeway's Arc Proof Capsule</h3>\r
      <table>\r
        <thead><tr><th>Field</th><th>meaning</th></tr></thead>\r
        <tbody>\r
          <tr><td>schema</td><td><code>causeway.reasoning_trace.v1</code></td></tr>\r
          <tr><td>scriptId / inferenceRunId</td><td>Corresponding scripts and inference runs.</td></tr>\r
          <tr><td>rootMarketId / rootOutcomeId</td><td>User-selected root market and root outcome.</td></tr>\r
          <tr><td>inputHash / outputHash</td><td>Stable JSON hash of AI input and output.</td></tr>\r
          <tr><td>model / promptVersion / outputSchemaVersion</td><td>Model, prompt and output format versions.</td></tr>\r
          <tr><td>market snapshots</td><td>Price, best bid, best ask, last trade, volume, liquidity, and syncedAt.</td></tr>\r
          <tr><td>selections</td><td>AI action, user action, order mode, limit price, size, amountUsd, and reason.</td></tr>\r
          <tr><td>traceHash</td><td>The hash of the entire capsule, used as Arc transaction calldata.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>9.3 Verification process</h3>\r
      <ol>\r
        <li>The backend reads user scripts and inference records to build a proof capsule.</li>\r
        <li>Generate using stable JSON hash <code>traceHash</code>。</li>\r
        <li>The front end requests the user to switch to Arc Testnet and sends a transaction with calldata being traceHash.</li>\r
        <li>The backend waits for the transaction receipt and reads the transaction input.</li>\r
        <li>Verify that the signer is consistent with the connected wallet, the chainId is Arc Testnet, and the calldata is consistent with the traceHash.</li>\r
        <li>Write txHash, traceHash, ArcScan URL and anchoredAt to audit records.</li>\r
      </ol>\r
      <div class="callout">\r
        <strong>Product meaning:</strong>\r
        Arc Proof allows Causeway to show that "this AI inference record existed at a certain point in time and has not been silently rewritten subsequently." This is the basis for trusting the performance of AI signals in prediction markets.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">10 / Arc USDC Economy</p>\r
      <h2>Arc USDC Premium: Member Subscriptions, Verifiable Payments, and the Smart Economy</h2>\r
      <p>\r
        Arc's stablecoin native design is suitable for low-cost, verifiable, and frequent intelligent economic activities. Causeway has currently implemented the Arc USDC payment intent: after the user selects the premium plan, the system generates the intent to be paid, specifying the chainId, USDC token, receiverAddress, amountMicroUsd and expiration time; after the user completes the USDC transfer on Arc, the backend reads the transaction receipt and ERC-20 Transfer log for verification, and maps the payment result to member rights. At the current stage, membership subscriptions are mainly used to unlock advanced signals, complete inference traces, Arc proof and higher-level analysis capabilities; in the future, Causeway can also use x402 service calls settled on Arc to unify subscriptions, pay-per-view, report unlocking, API calls and agent capability purchases into a more fine-grained payment framework.\r
      </p>\r
      <h3>10.1 Currently supported Premium capabilities</h3>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Premium Signal</span><b>advanced signaling</b><p>Unlock deeper inference, higher quality models, tighter confidence, and complete candidate market scope.</p></div>\r
        <div class="note"><span class="small-label">Full Reasoning Trace</span><b>Complete reasoning track</b><p>View inputs, outputs, candidate markets, risks, counterexamples, and What Would Change My Mind.</p></div>\r
        <div class="note"><span class="small-label">Arc Proof</span><b>On-chain proof</b><p>Anchor the reasoning trace hash to Arc Testnet and view transactions via ArcScan.</p></div>\r
        <div class="note"><span class="small-label">Future x402</span><b>Agent service call</b><p>Future access to the x402 process billed on Arc for data purchases, report unlocking, API calls, and policy subscriptions.</p></div>\r
      </div>\r
      <h3>10.2 Arc: Verifiable Reasoning and the Settlement Layer of Agent Economics</h3>\r
      <p>\r
        Arc's value to Causeway is not to replace Polymarket's transaction link, but to provide a low-cost, verifiable, stablecoin-native economic and audit layer for prediction market AI systems. Polymarket is responsible for market matching, order book, result settlement and real transaction execution; Causeway is responsible for market understanding, AI reasoning, risk preview, user confirmation and signal tracking; Arc is suitable for carrying auxiliary actions that are high in frequency, small in amount, need to be recorded, need to be verified, and are naturally priced in US dollars, such as reasoning trace deposit, premium subscription, report unlocking, API call, intelligent agent service settlement and future data source payment.\r
      </p>\r
      <p>\r
        For its current version, Arc first addresses two key issues. First, AI inference requires verifiable timestamps. The judgment of the prediction market will be verified by future results. If the system cannot prove that a certain inference record was generated before the result occurred, the credibility of the signal track record will be significantly reduced. Causeway writes the hash of the reasoning trace into Arc, so that each AI judgment can form a lightweight proof capsule. Second, AI capabilities require a native payment path for stablecoins. Advanced reasoning, complete reasoning tracks, market graph analysis, API calls and reporting services are all suitable for small-amount, real-time, verifiable settlement with USDC.\r
      </p>\r
      <p>\r
        In the medium term, Arc can support Causeway in forming a more complete Signal Economy. Each AI inference can be viewed as a traceable signal asset: it has generation time, input snapshot, model version, market price, AI fair odds, edges, risk explanations, user actions and final results. If these signals accumulate over time and key hashes are anchored to Arc, Causeway can establish a trusted Signal Track Record. In the future, users will not just purchase an AI answer once, but subscribe to proven strategies, reports, market maps, data sources and professional agent capabilities.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">11 / x402 Agent Service Layer</p>\r
      <h2>x402 Agent Service Layer: Future agent service protocol layer</h2>\r
      <p>\r
        x402 should not be positioned as a transaction execution protocol in Causeway, but as an agent service invocation and micropayment protocol. Its value lies in enabling AI agents, external APIs, data sources, and professional analytics services to complete pay-per-view settlements through machine-readable payment requests. For Causeway, x402 can become the future Agent Service Layer: Arc provides verifiable records and stablecoin settlement environment, x402 provides agent-to-service access and payment processes, and Causeway is responsible for orchestrating the market map, authority governance, risk control, order preview and performance tracking.\r
      </p>\r
      <h3>11.1 Pay-per-use data sources, validation and reporting</h3>\r
      <p>\r
        Causeway will need news streams, sports data, macro data, on-chain data, regulatory announcements, company announcements, odds data and original source verification in the future. A lot of data is not suitable for fixed monthly subscriptions, but is more suitable for on-demand calls when AI inference needs it: verifying a CPI release, purchasing team injury data, requesting on-chain capital flow analysis, verifying the original source of news, and generating a market rule difference report. x402 can turn these calls into instant, fine-grained, and auditable payment behaviors, rather than relying on manual API keys, centralized points, or offline settlement.\r
      </p>\r
      <h3>11.2 Professional Intelligence Market</h3>\r
      <p>\r
        When Causeway evolves from a single AI reasoning tool to a multi-agent prediction system, the system can introduce external professional agents: macro research agent, sports injury agent, political news agent, on-chain capital flow agent, handicap arbitrage agent, source verification agent, risk agent and execution guard. Each agent can build a reputation through long-term track records, calibration capabilities, historical return-risk performance, response speed, data source coverage and Arc proof records. x402 can be responsible for access control and pay-per-time settlement of each service call.\r
      </p>\r
      <h3>11.3 Signal Market and API Monetization</h3>\r
      <p>\r
        In the future, Causeway can expose high-quality signals, market graphs, risk reports, related markets, semantic arbitrage scans and Arc proof status as payable APIs to external applications or agents. Callers are not required to be full members and may purchase specific capabilities upon request. Arc records proof, payment, and reputation, x402 handles paid access, and Causeway displays signal performance and calibration results. In this way, Causeway's revenue comes not just from subscriptions, but from a network of composable smart services.\r
      </p>\r
      <h3>11.4 The long-term shape of limited AI commissioned trading</h3>\r
      <p>\r
        At a more advanced stage, users can designate proven and mature agents to participate in the automated AI commissioned transaction process. However, x402 itself does not assume asset custody, transaction authorization or risk control responsibilities; it is responsible for the intelligent agent service invocation and micropayment layer. Genuine commissioned transactions must be superimposed by Causeway with authority boundaries: market categories allowed for trading, maximum single transaction amount, daily loss limit, maximum relevant exposure, minimum edgeNet, minimum liquidity, maximum slippage, necessary verification steps, expiration time, emergency stop and revocable authorization. Every data call, inference generation, verification request, order preview, or trade execution should leave an Arc proof and Signal Track Record.\r
      </p>\r
      <div class="callout">\r
        <strong>Future positioning:</strong>\r
        Arc is the proof, payment record, and reputation substrate; x402 is the agent-to-service payment and access protocol; Causeway is the prediction-market intelligence orchestration layer; Polymarket is the market execution and settlement venue.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">12 / Swarm Prediction Engine</p>\r
      <h2>Swarm Prediction Engine: From a parallel market world to predicting everything</h2>\r
      <p>\r
        Causeway’s long-term goal is not to let a single AI make a one-time judgment on a market, but to build a group intelligent prediction engine for prediction markets. Our judgment is that the prediction of complex events should not rely on single-path reasoning, but should start from the seed information of the real world and build an evolvable parallel market world, allowing multiple intelligent agents with different roles, memories, positions and behavioral logic to interact, diverge, disprove, revise and generate predictions. Causeway will constrain this swarm intelligence deduction into a "tradable, verifiable, and settleable prediction market network" so that simulation results can not only form narrative reports, but also be converted into market odds, AI fair odds, edgeNet, risk budgets, order previews, Arc proof, and Signal Track Record.\r
      </p>\r
      <h3>12.1 From single model inference to swarm intelligence prediction</h3>\r
      <p>\r
        A single model is suitable for generating initial judgments, but the complex world is often determined by multiple agents, multiple motivations, multiple information lags, and multiple market feedbacks. A macro data, sports injury, regulatory announcement, on-chain event or political news may affect multiple entities, multiple time windows and multiple interconnected prediction markets at the same time. The value of the swarm intelligence prediction engine is to allow multiple agents to play the roles of research, suspicion, verification, pricing, risk and execution gatekeeping, and conduct multiple rounds of deductions in the same market map, thereby reducing single-path bias and overconfidence.\r
      </p>\r
      <figure class="concept-figure">\r
        <div class="concept-figure-frame">\r
          <img src="../../public/assets/causeway-swarm-prediction-engine-concept.png" alt="Causeway Swarm Prediction Engine concept diagram" />\r
        </div>\r
        <figcaption class="caption">Figure 12-1: Concept diagram of Causeway swarm intelligence prediction engine. After real-world events enter the parallel market world, multi-role agents, market maps, Arc proof, x402 Agent Service and Signal Track Record jointly form an auditable prediction closed loop.</figcaption>\r
      </figure>\r
      <h3>12.2 Parallel market world</h3>\r
      <p>\r
        Causeway can transform a real event into multiple parallel market worlds. Each world contains different assumptions: whether the event is real, whether the source is reliable, how fast it spreads, whether the market has reflected it, whether the relevant market lags, whether liquidity is sufficient, and whether there is ambiguity in the rules. The system does not just ask "will this event happen?" but asks "if this event happens, how will it pass through the market network, which odds will be changed, which edges will be created, which risks will be triggered, and what verifiable records will be left behind." This parallel market world is Causeway’s core judgment on future forecasting systems: Forecasting should not just answer “whether something will happen”, but should simulate how events propagate across multiple markets, multiple participants, multiple information sources, and multiple time windows, and transform this propagation process into auditable, computable, and verifiable market intelligence objects.\r
      </p>\r
      <h3>12.3 Agent Society: Multi-role agent collaboration</h3>\r
      <table>\r
        <thead><tr><th>agent role</th><th>Responsibilities</th><th>output object</th></tr></thead>\r
        <tbody>\r
          <tr><td>Research Agent</td><td>Collect events, markets, historical cases, and context.</td><td>sourceObjects、event summary、market candidates。</td></tr>\r
          <tr><td>Market Graph Agent</td><td>Look for related markets, semantic implications, mutually exclusive relationships, and related exposures.</td><td>market graph、relation type、impact direction。</td></tr>\r
          <tr><td>Probability Agent</td><td>Probability estimates are given based on scenarios and evidence.</td><td>AI fair odds、probability shift、confidence。</td></tr>\r
          <tr><td>Skeptic Agent</td><td>Look for counterexamples, rule ambiguities, false sources, and over-inference.</td><td>counterarguments、changeMyMind、risk flags。</td></tr>\r
          <tr><td>Verification Agent</td><td>Trace back to underlying facts and authoritative sources.</td><td>verification status、source confidence、conflict report。</td></tr>\r
          <tr><td>Risk Agent</td><td>Calculate liquidity, spreads, slippage, correlations and position limits.</td><td>edgeNet、risk budget、position cap。</td></tr>\r
          <tr><td>Execution Guard</td><td>Determine whether to allow order preview or commission execution.</td><td>BUY / WATCH / AVOID、order preview gate、emergency stop。</td></tr>\r
          <tr><td>Report Agent</td><td>Convert multi-agent disagreements and conclusions into readable reports.</td><td>prediction report、scenario tree、audit summary。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>12.4 From simulation reports to trading smart objects</h3>\r
      <p>\r
        The output of swarm intelligence cannot stop at natural language reporting. Causeway needs to compress the simulation results into structured trading intelligent objects: scenario tree, affected markets, relation edges, probability shift, AI fair odds, market odds, edgeNet, recommended action, risk flags, suggested size, Arc proof hash and track record entry. In this way, swarm intelligence can serve both research and review, verification and user confirmation before real transactions.\r
      </p>\r
      <div class="formula">\r
        <code>scenarioValue_s = Σ_i edgeNet_i,s * tradability_i,s * confidence_s - portfolioRisk_s</code>\r
        <code>swarmConsensus = weightedMedian(q_agent_1, q_agent_2, ..., q_agent_n; weights = reputation * calibration)</code>\r
        <code>disagreementRisk = variance(q_agent_1 ... q_agent_n) + sourceConflict + ruleAmbiguity</code>\r
        <code>finalAction = gate(swarmConsensus, edgeNet, disagreementRisk, liquidity, userPolicy)</code>\r
        <p>Rather than simply voting, swarm intelligence combines the calibration records, source quality, degree of disagreement, and market enforceability of different agents into action recommendations subject to risk control.</p>\r
      </div>\r
      <h3>12.5 Relationship to Arc and x402</h3>\r
      <p>\r
        Swarm Prediction Engine requires verifiable records and composable payments. Arc can record the hash of each simulation, inference, signal and result, so that swarm intelligence is not a story packaged after the fact; x402 can provide pay-per-call and micro-payment for external data sources, verification services, professional agents and in-depth reports; Causeway is responsible for orchestrating these capabilities, mapping agent output to prediction market objects, risk control boundaries, order previews and user governance processes. In the long term, Arc is the trusted recording and settlement base, x402 is the intelligent agent service invocation protocol, and Swarm Prediction Engine is the intelligent layer for deducing world changes.\r
      </p>\r
      <h3>12.6 Long-term vision: Predict everything but maintain user governance</h3>\r
      <p>\r
        What Causeway calls "predicting everything" is not to allow AI to place unlimited automatic bets, but to allow users to input a real-life event. The system can understand the market, organize agents, build a parallel market world, verify facts, simulate propagation paths, generate tradable signals, retain proof, and let the user decide whether to act. In the future, when the agent capabilities, reputation system and authorization mechanism are mature enough, users can choose to delegate part of the process to verified agents; but the default boundaries should still be user governance, revocable permissions, clear budgets and complete auditing.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">13 / Workflow</p>\r
      <h2>User workflow and product experience</h2>\r
      <h3>13.1 Standard procedures</h3>\r
      <ol>\r
        <li>Users connect the wallet and enter the market network.</li>\r
        <li>The system displays Polymarket events, markets, outcomes, prices, volumes and related markets.</li>\r
        <li>The user selects a root outcome as a starting point for inference.</li>\r
        <li>The system recalls candidate markets and constructs AI prompt input.</li>\r
        <li>AI outputs causal diagrams, outcome recommendations, warnings, and confidence.</li>\r
        <li>The system generates causal scripts, and users review, modify or skip them one by one.</li>\r
        <li>Users enter the order preview and check the order book, amount, maximum loss, estimated profit and capacity status.</li>\r
        <li>Dry-run or real CLOB signature submission after user confirmation.</li>\r
        <li>Users can anchor reasoning traces to Arc Testnet.</li>\r
        <li>The system tracks price changes, order status, PnL and final results in the Signal Track Record.</li>\r
      </ol>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">14 / Governance</p>\r
      <h2>Risk control, governance and compliance boundaries</h2>\r
      <h3>14.1 Risk control matrix</h3>\r
      <table>\r
        <thead><tr><th>risk category</th><th>specific questions</th><th>Control method</th></tr></thead>\r
        <tbody>\r
          <tr><td>Data risk</td><td>Market data delays, outcome mapping errors, order book unavailability.</td><td>Synchronization time, tokenId verification, real-time refresh, capability fallback.</td></tr>\r
          <tr><td>information risk</td><td>Journalistic errors, social media rumors, misinterpretation of secondary sources.</td><td>Source Object, authoritative source library, conflict detection, freshness score.</td></tr>\r
          <tr><td>reasoning risk</td><td>AI hallucinations, overconfidence, missing counterexamples.</td><td>Candidate set constraints, structured verification, skeptic agent, confidence threshold.</td></tr>\r
          <tr><td>market risk</td><td>Excessive spreads, insufficient liquidity, and mutually exclusive market-related exposures.</td><td>Handicap depth, conservative positions, event-level portfolio risk control, and No Trade status.</td></tr>\r
          <tr><td>execution risk</td><td>Users mistakenly sign in, submit duplicate orders, and orders expire.</td><td>Preview expiration, idempotency key, confirmation before signing, submission status writeback.</td></tr>\r
          <tr><td>audit risk</td><td>Signal records cannot prove prior existence.</td><td>Arc proof、hash、audit event、Signal Track Record。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>14.2 Default boundaries</h3>\r
      <ul>\r
        <li>AI output does not constitute investment advice.</li>\r
        <li>The system does not guarantee forecast accuracy, earnings or market results.</li>\r
        <li>The default mode is user confirmation rather than automatic order placement.</li>\r
        <li>Delegated execution must be implemented in the future with explicit authorization, clear budgets, scope limits and revocation mechanisms.</li>\r
        <li>Live trading, simulated trading and unexecuted signals must be clearly distinguished in the UI and data.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">15 / Future Problems</p>\r
      <h2>Problems that need to be solved in the future and how we can solve them</h2>\r
      <h3>15.1 Problem: Insufficient real-time and authenticity of external information sources</h3>\r
      <p>\r
        The current stage relies heavily on market data and controlled candidate sets. In the next phase, Causeway must access real-time news streams, official announcements, on-chain events, sports data and regulatory documents. But the more external information sources there are, the greater the noise. The solution is Source Object standardization: split each piece of information into claim, origin, timestamp, entities, rawPayload and confidence, and enter the workflow through authoritative source library and conflict detection.\r
      </p>\r
      <h3>15.2 Problem: Single model reasoning cannot cover the complex world</h3>\r
      <p>\r
        A single model is prone to a single path and over-determination. Causeway's long-term solution is multi-agent reasoning and Swarm Prediction Engine: Research Agent is responsible for collecting market and event context, Probability Agent gives probability estimates, Skeptic Agent looks for counterexamples, Verification Agent verifies sources, Risk Agent determines liquidity and positions, and Execution Guard determines whether to allow access to preview. Multi-agent is not about showing off skills, but about making disagreements, assumptions, evidence quality, and risks explicit, and mapping the multipath evolution of a complex world into reviewable market response plans.\r
      </p>\r
      <h3>15.3 Problem: Signal performance cannot be continuously proven</h3>\r
      <p>\r
        Without long-term track records, AI recommendations can easily stay in short-term display. Causeway needs to record the generation time, market price, AI fair odds, edge, recommended direction, whether the user executes, execution price, current price, unrealized profit and loss, final result and Arc proof for each signal. Only then can the system answer “whether AI really works?”\r
      </p>\r
      <h3>15.4 Issue: Automated execution requires stronger governance</h3>\r
      <p>\r
        The fifth stage of delegated execution is not to allow AI to control accounts without restrictions, but to allow users to selectively authorize under clear rules. The authorization should contain the market category, maximum single amount, daily loss limit, maximum relevant exposure, acceptable data sources, time window, revocation conditions and emergency stop. In the future, if users designate mature agents to participate in the automated process, x402 can be responsible for agent service invocation and micropayment, Arc can be responsible for certification and recording, and Causeway can be responsible for authority governance and risk control. Real transactions must still comply with user authorization and revocable boundaries.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">16 / Roadmap</p>\r
      <h2>Five-stage technology roadmap</h2>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 01</span><span class="tag">Market Data Foundation</span>\r
        <h3>Understand the market first, then understand the world</h3>\r
        <p>\r
          The first phase focuses on Polymarket market data: event, market, outcome, tokenId, price, volume, liquidity, order book, rules and status. The goal is to enable the system to stably express real tradable structures and support users to select the root outcome from the market details page to enter inference.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 02</span><span class="tag">Reasoning Model</span>\r
        <h3>Map an event to all relevant markets</h3>\r
        <p>\r
          Build stronger inference models to provide relevance, direction, confidence, tradability and recommendations for relevant markets. Introducing BUY / WATCH / AVOID, What Would Change My Mind, conservative position recommendations and multi-agent divergence checking to make the AI ​​more like a trading research team and less like a chatbot.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 03</span><span class="tag">Real-Time Scenario Generation</span>\r
        <h3>Transform news flows into market-wide response playbooks</h3>\r
        <p>\r
          Access real-time event streams, automatically extract entities, topics, event types and impact paths, and generate response scripts across the market. The system should output affected markets, missing confirmation signals, risk status and recommended workflows, and gradually expand event deduction into parallel market world simulations rather than direct orders.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 04</span><span class="tag">Verification & Arc Proof</span>\r
        <h3>Ask for evidence before placing a bet, and store evidence after reasoning.</h3>\r
        <p>\r
          Build an authoritative data source library to automatically trace underlying facts; at the same time, write key reasoning trace hashes into Arc to form a verifiable historical record. The goal of this phase is to unify speed, authenticity and auditability.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 05</span><span class="tag">Delegated AI Execution</span>\r
        <h3>User optionally delegates limited execution</h3>\r
        <p>\r
          After permissions, budget, time, market scope, and revocation mechanisms mature, users can choose to have the AI ​​perform under limited conditions. In the future, users can also designate proven mature agents to participate in the delegation process to complete data verification, risk assessment and execution-assisted pay-per-time settlement through x402; this capability must be turned off by default and governed through Arc proof, complete audit, emergency stop and permission expiration mechanisms.\r
        </p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">17 / Economic Model</p>\r
      <h2>Business model and value capture</h2>\r
      <h3>17.1 Revenue Model</h3>\r
      <table>\r
        <thead><tr><th>model</th><th>illustrate</th><th>Applicable stage</th></tr></thead>\r
        <tbody>\r
          <tr><td>Premium Subscription</td><td>Currently unlocking advanced models, deeper reasoning, full reasoning trace, Arc proof and monitoring capabilities with Arc USDC payment intent; expandable to x402 pay-per-call and capability packages based on Arc settlement in the future.</td><td>Phase 1-3</td></tr>\r
          <tr><td>Builder Attribution</td><td>Users confirm real Polymarket orders through Causeway, and transactions are attributed through builder code.</td><td>Phase 1-5</td></tr>\r
          <tr><td>Signal API</td><td>Provides structured signal, market graph and track record APIs to researchers, endpoints and policy systems.</td><td>Phase 2-4</td></tr>\r
          <tr><td>Team Workspace</td><td>Provides collaboration, permissions, auditing, reporting, risk budgeting, and policy libraries for teams.</td><td>Phase 3-5</td></tr>\r
          <tr><td>x402 Agent Service Layer</td><td>The future will allow external data sources, validation services, professional agents, and in-depth reporting via x402 for machine-readable pay-per-access and micropayments.</td><td>Phase 3-5</td></tr>\r
          <tr><td>Swarm Prediction Reports</td><td>Generate professional forecast reports based on parallel market worlds and multi-agent debates, sold by market, event or theme.</td><td>Phase 3-5</td></tr>\r
          <tr><td>Agent Marketplace</td><td>The future will allow professional agents, verification sources, reporting templates and policy modules to settle with x402 via Arc USDC and build reputation based on verifiable track records.</td><td>Phase 4-5</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>17.2 Value Flywheel</h3>\r
      <p>\r
        More market data brings a more complete market map; a more complete map improves the quality of AI reasoning; higher-quality reasoning attracts more users to generate real feedback; more feedback forms a signal track record; verifiable track records improve trust; trust brings premium, API, team, x402 agent services, Swarm Prediction Reports and builder attribution revenue; revenue in turn supports better data sources, models, verification agents, swarm simulation systems and risk control systems.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">18 / Moat & KPI</p>\r
      <h2>Moats, indicators and conclusions</h2>\r
      <h3>18.1 Moat</h3>\r
      <ul>\r
        <li><strong>Market structure understanding:</strong>In-depth modeling of events, markets, outcome tokens, CLOBs and order limits.</li>\r
        <li><strong>Inference data closed loop:</strong>Complete link from inference run to causal script, order intent, Arc proof and track record.</li>\r
        <li><strong>Swarm intelligence prediction capabilities:</strong>Combine multi-agent division of labor, parallel market world, scenario tree and market map to form a verifiable professional forecast report.</li>\r
        <li><strong>Verifiable history:</strong>Arc proof makes signal performance not just a background record, but an auditable object.</li>\r
        <li><strong>User governance boundaries:</strong>It does not take black box automatic trading as the core, but takes user-controllable intelligent execution as the direction.</li>\r
        <li><strong>Intelligent economy entrance:</strong>Arc USDC premium and the future x402 Agent Service Layer provide the basis for small, frequent, and verifiable settlement of AI capabilities.</li>\r
      </ul>\r
      <h3>18.2 Core indicators</h3>\r
      <table class="kpi">\r
        <tbody>\r
          <tr><td>Market Coverage</td><td>Number of synchronized markets, active market coverage, and outcome token mapping accuracy.</td></tr>\r
          <tr><td>Inference Quality</td><td>Inference success rate, schema verification pass rate, effective signal ratio, No Trade ratio.</td></tr>\r
          <tr><td>Swarm Quality</td><td>Agent divergence, calibration weighted consensus, scene coverage, counterexample hit rate, prediction report review performance.</td></tr>\r
          <tr><td>User Funnel</td><td>Market viewing, inference startup, script saving, order preview, user confirmation, and real transaction.</td></tr>\r
          <tr><td>Arc Proof Adoption</td><td>Number of proof generation, number of anchors, verification success rate, ArcScan click rate.</td></tr>\r
          <tr><td>Signal Track Record</td><td>Price change after signal, final accuracy, PnL, user execution rate, exit recommendation hit rate.</td></tr>\r
          <tr><td>Economics</td><td>Premium conversion rate, USDC payment success rate, x402 call times, agent service GMV, builder-attributed volume, API revenue.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>18.3 Conclusion</h3>\r
      <p>\r
        The value of Causeway lies not in allowing users to click the trading button faster, but in establishing a layer of trusted intelligent infrastructure for prediction markets. It connects market structure, AI reasoning, risk preview, user confirmation, Arc certification and performance tracking into a closed loop. In the short term, it allows users to better understand and execute the Polymarket market; in the medium term, it becomes a verifiable prediction-market signal layer; in the long term, it can evolve into a swarm intelligence prediction engine, simulate the spread of real events in multiple markets, and output professional prediction reports.\r
      </p>\r
      <div class="callout">\r
        <strong>Final vision:</strong>\r
        Causeway is not an "automated betting tool", but an early form of "a crowd intelligence engine that predicts everything": the user inputs an event, the system understands the market, organizes agents, builds a parallel market world, verifies facts, simulates paths, generates signals, retains proof, and the user decides whether to act. In the long run, Arc is responsible for trusted recording and settlement base, x402 is responsible for intelligent agent service invocation, and Causeway is responsible for intelligent orchestration of prediction markets.\r
      </div>\r
    </section>\r
\r
    <section>\r
      <p class="eyebrow">19 / References</p>\r
      <h2>References</h2>\r
      <div class="source-list">\r
        <p>1. Wolfers, Justin, and Eric Zitzewitz, <em>Prediction Markets</em>, Journal of Economic Perspectives, 2004. https://pubs.aeaweb.org/doi/pdfplus/10.1257/0895330041371321</p>\r
        <p>2. Snowberg, Erik, Justin Wolfers, and Eric Zitzewitz, <em>Prediction Markets for Economic Forecasting</em>, NBER Working Paper 18222, 2012. https://www.nber.org/system/files/working_papers/w18222/w18222.pdf</p>\r
        <p>3. Wharton Rodney L. White Center working paper, prediction-market research, 2006. https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0608.pdf</p>\r
        <p>4. Cao, prediction-market research paper, New Zealand Association of Economists archive. https://www.nzae.org.nz/wp-content/uploads/2014/05/Cao.pdf</p>\r
        <p>5. Journal of Prediction Markets article archive, prediction-market and arbitrage research. https://www.ubplj.org/index.php/jpm/article/view/1796</p>\r
        <p>6. <em>Arbitrage trade in prediction markets</em>, research archive. https://www.researchgate.net/publication/262875038_Arbitrage_trade_in_prediction_markets</p>\r
        <p>7. arXiv preprint on modern prediction-market arbitrage and semantic market dependencies. https://arxiv.org/pdf/2508.03474.pdf</p>\r
        <p>8. KPMG, <em>Prediction markets: Paths to entry</em>, 2026. https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/prediction-markets-paths-to-entry.pdf</p>\r
        <p>9. CoinDesk, <em>Polymarket Resolves Presidential Election Contract</em>, 2024. https://www.coindesk.com/markets/2024/11/06/polymarket-resolves-presidential-election-contract</p>\r
        <p>10. Axios, <em>Polymarket gets big investment from New York Stock Exchange parent company</em>, 2025. https://www.axios.com/2025/10/07/polymarket-new-york-stock-exchange</p>\r
        <p>11. Polymarket Documentation, <em>Gamma Markets API Overview</em>. https://docs.polymarket.com/developers/gamma-markets-api/overview</p>\r
        <p>12. Polymarket Documentation, <em>Trading on the Polymarket CLOB</em>. https://docs.polymarket.com/developers/CLOB/trades/trades-data-api</p>\r
        <p>13. Polymarket Documentation, <em>Builder Program</em>. https://docs.polymarket.com/developers/builders/examples</p>\r
        <p>14. Arc Docs, <em>Connect to Arc</em>. https://docs.arc.io/integrate/connect-to-arc</p>\r
        <p>15. Arc Docs, <em>Arc Network</em>. https://docs.arc.network/arc-chain</p>\r
        <p>16. x402 Protocol, <em>Open payment protocol for the internet</em>. https://www.x402.org/</p>\r
        <p>17. Coinbase Developer Platform, <em>x402</em>. https://www.coinbase.com/developer-platform/products/x402/</p>\r
        <p>18. Cloudflare Docs, <em>Agents x402</em>. https://developers.cloudflare.com/agents/x402/</p>\r
      </div>\r
      <div class="disclaimer">\r
        Copyright © 2026 Causeway. This document is a draft product, technology and economic white paper and does not constitute investment advice, legal advice, brokerage services, income commitments or regulatory opinions. The market data and industry information mentioned in this article come from public information. Actual data may differ due to statistical caliber, time range, platform definition and market changes. Users should make independent judgments and bear the risks associated with predicting the market.\r
      </div>\r
    </section>\r
  </body>\r
</html>\r
`,q=`<!doctype html>\r
<html lang="es">\r
  <head>\r
    <meta charset="utf-8" />\r
    <title>Causeway Technical & Economic Whitepaper v0.6 ES</title>\r
    <style>\r
      @page { size: A4; margin: 13mm 12mm; }\r
      :root {\r
        --ink: #081b33;\r
        --ink-2: #0a2a52;\r
        --blue: #1677ff;\r
        --cyan: #22c7e8;\r
        --green: #14b87a;\r
        --amber: #f59e0b;\r
        --red: #ef4444;\r
        --muted: #53657d;\r
        --line: #d8e6f5;\r
        --soft: #f5faff;\r
        --paper: #ffffff;\r
      }\r
      * { box-sizing: border-box; }\r
      body {\r
        margin: 0;\r
        background: var(--paper);\r
        color: var(--ink);\r
        font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;\r
        font-size: 10pt;\r
        line-height: 1.56;\r
      }\r
      h1, h2, h3, h4, p { margin-top: 0; }\r
      h1 { margin: 0 0 18px; font-size: 42pt; line-height: .96; letter-spacing: 0; }\r
      h2 { margin: 0 0 9px; color: var(--ink); font-size: 18pt; line-height: 1.12; break-after: avoid; }\r
      h3 { margin: 13px 0 5px; color: var(--ink-2); font-size: 11.8pt; line-height: 1.22; break-after: avoid; }\r
      h4 { margin: 10px 0 4px; color: var(--ink); font-size: 10.6pt; line-height: 1.25; }\r
      p { margin-bottom: 6px; }\r
      ul, ol { margin: 5px 0 8px 18px; padding: 0; }\r
      li { margin: 2px 0; }\r
      table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; break-inside: avoid; }\r
      th, td { border: 1px solid var(--line); padding: 5px 6px; text-align: left; vertical-align: top; }\r
      th { background: var(--soft); color: var(--ink); font-weight: 800; }\r
      code { font-family: Consolas, "SFMono-Regular", monospace; font-size: 9.3pt; color: var(--ink-2); }\r
      .cover { min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; position: relative; }\r
      .cover::before {\r
        content: "";\r
        position: absolute;\r
        inset: -13mm -12mm;\r
        z-index: -1;\r
        background:\r
          linear-gradient(rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          linear-gradient(90deg, rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          radial-gradient(circle at 76% 16%, rgba(22, 119, 255, .17), transparent 34%),\r
          radial-gradient(circle at 22% 82%, rgba(34, 199, 232, .12), transparent 30%),\r
          #fff;\r
        background-size: 26px 26px, 26px 26px, auto, auto, auto;\r
      }\r
      .brand img { width: 168px; height: auto; margin-bottom: 46px; }\r
      .eyebrow { margin: 0 0 13px; color: var(--blue); font-size: 8.8pt; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }\r
      .subtitle { max-width: 650px; color: #273b57; font-size: 15.2pt; line-height: 1.56; }\r
      .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 28px; }\r
      .meta-grid div, .callout, .principle, .phase-card, .note, .metric-card, .source-card {\r
        border: 1px solid var(--line);\r
        border-radius: 7px;\r
        background: rgba(245, 250, 255, .82);\r
        padding: 8px;\r
      }\r
      .meta-grid span, .small-label { display: block; color: var(--muted); font-size: 8pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }\r
      .meta-grid b { display: block; margin-top: 4px; font-size: 10.5pt; }\r
      .page { break-after: auto; margin-bottom: 8mm; }\r
      .toc { columns: 2; column-gap: 26px; }\r
      .toc p { break-inside: avoid; border-bottom: 1px solid var(--line); margin: 0 0 7px; padding-bottom: 6px; font-weight: 720; }\r
      .callout { margin: 8px 0 10px; border-left: 4px solid var(--blue); background: #f5faff; }\r
      .callout strong { color: var(--blue); }\r
      .warning { border-left-color: var(--amber); background: #fff8ed; }\r
      .warning strong { color: #a15c00; }\r
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }\r
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }\r
      .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }\r
      .principle, .metric-card { min-height: 88px; break-inside: avoid; }\r
      .principle b, .metric-card b, .note b { display: block; margin: 4px 0 6px; color: var(--ink); font-size: 11.2pt; }\r
      .principle p, .phase-card p, .note p, .metric-card p, .source-card p { margin-bottom: 0; color: #273b57; font-size: 8.9pt; line-height: 1.45; }\r
      .phase-card { break-inside: avoid; margin-bottom: 6px; }\r
      .phase-card h3 { margin-top: 4px; }\r
      .tag {\r
        display: inline-block;\r
        margin: 0 5px 5px 0;\r
        border: 1px solid #bcd7ff;\r
        border-radius: 999px;\r
        background: #eef6ff;\r
        color: var(--blue);\r
        padding: 2px 8px;\r
        font-size: 8pt;\r
        font-weight: 800;\r
      }\r
      .tag.dark { border-color: var(--ink); background: var(--ink); color: #fff; }\r
      .hero-image { overflow: hidden; border: 1px solid rgba(22,119,255,.22); border-radius: 10px; height: 96mm; margin: 14px 0; background: #06162b; }\r
      .hero-image img { width: 100%; height: 100%; object-fit: cover; }\r
      .concept-figure { break-inside: avoid; width: 72%; margin: 9px auto 12px; }\r
      .concept-figure-frame { overflow: hidden; border: 1px solid rgba(22,119,255,.2); border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(8,27,51,.08); }\r
      .concept-figure img { display: block; width: 100%; max-height: 82mm; object-fit: contain; }\r
      .concept-figure .caption { margin: 5px 0 0; line-height: 1.42; }\r
      .caption { color: var(--muted); font-size: 8pt; }\r
      .disclaimer, .footnotes { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 11px; color: var(--muted); font-size: 8.2pt; line-height: 1.52; }\r
      .no-break { break-inside: avoid; }\r
      .source-list p { margin-bottom: 5px; word-break: break-all; }\r
      .kpi td:first-child { width: 24%; font-weight: 800; color: var(--ink-2); }\r
      .formula {\r
        border: 1px solid var(--line);\r
        border-left: 5px solid var(--green);\r
        border-radius: 8px;\r
        background: #f3fff9;\r
        margin: 6px 0 8px;\r
        padding: 7px 9px;\r
        break-inside: avoid;\r
      }\r
      .formula code { display: block; margin: 2px 0; color: #07513a; font-size: 8.8pt; }\r
      .formula p { margin: 4px 0 0; color: #244a3d; font-size: 8.6pt; line-height: 1.42; }\r
    </style>\r
  </head>\r
  <body>\r
    <section class="cover">\r
      <div>\r
        <div class="brand"><img src="../../public/assets/causeway-lockup-primary.svg" alt="Causeway" /></div>\r
        <p class="eyebrow">Informe técnico y económico</p>\r
        <h1>Causeway<br />Whitepaper Técnico y Económico</h1>\r
        <p class="subtitle">\r
          Inteligencia comercial de IA y capa de razonamiento verificable para mercados de predicción: desde datos de mercado de Polymarket, deducción causal, vista previa de riesgos, hasta razonamiento verificable de Arc, economía de agentes nativos del USDC y motor de predicción de inteligencia de enjambre.\r
        </p>\r
        <div class="meta-grid">\r
          <div><span>Versión</span><b>v0.6</b></div>\r
          <div><span>Fecha</span><b>2026-05</b></div>\r
          <div><span>Estado</span><b>Borrador detallado</b></div>\r
          <div><span>Alcance</span><b>Mercado + Arco</b></div>\r
        </div>\r
      </div>\r
      <div class="disclaimer">\r
        Este documento técnico se utiliza para explicar el juicio de mercado, el posicionamiento del producto, la arquitectura técnica, la integración de Arc, el modelo económico, los límites de riesgo y la hoja de ruta futura de Causeway. Este artículo no constituye asesoramiento de inversión, asesoramiento legal, descripciones de servicios de corretaje, compromisos de ingresos ni ninguna forma de solicitud de negociación automatizada. Predecir el mercado implica riesgos importantes y cualquier transacción real debe ser confirmada activamente por los usuarios según su propio criterio.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">Tabla de contenido</p>\r
      <h2>Tabla de contenido</h2>\r
      <div class="toc">\r
        <p>01. Resumen ejecutivo</p>\r
        <p>02. Antecedentes del mercado: el mercado de predicción entra en la etapa principal</p>\r
        <p>03. Pregunta central: ¿Por qué los mercados de predicción existentes todavía carecen de una capa inteligente?</p>\r
        <p>04. Fundamento académico y marco de cálculo de valores.</p>\r
        <p>05. Definición de producto de Causeway</p>\r
        <p>06. ¿Qué problemas hemos solucionado?</p>\r
        <p>07. Arquitectura del sistema y modelo de datos.</p>\r
        <p>08. Inteligencia de AI Trader: de la probabilidad a la acción Vista previa</p>\r
        <p>09. Arc Proof: registro de razonamiento de IA verificable</p>\r
        <p>10. Arc USDC Premium: economía inteligente y capacidad de pago</p>\r
        <p>11. Capa de servicio del agente x402: capa de protocolo de servicio del agente futuro</p>\r
        <p>12. Motor de predicción de enjambres: del mundo del mercado paralelo a predecirlo todo</p>\r
        <p>13. Flujo de trabajo del usuario y experiencia del producto.</p>\r
        <p>14. Límites de control de riesgos, gobernanza y cumplimiento</p>\r
        <p>15. Problemas que deben resolverse en el futuro</p>\r
        <p>16. Hoja de ruta tecnológica de cinco etapas</p>\r
        <p>17. Modelo de negocio y captura de valor</p>\r
        <p>18. Fosos, indicadores y conclusiones</p>\r
        <p>19. Referencias</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">01 / Resumen Ejecutivo</p>\r
      <h2>resumen ejecutivo</h2>\r
      <p>\r
        Causeway es una inteligencia comercial de IA y una capa de razonamiento verificable para mercados de predicción. Su juicio básico es que los mercados de predicción están evolucionando de "una interfaz de apuestas de eventos con la participación de un pequeño número de usuarios de criptomonedas" a "una infraestructura probabilística para eventos reales, riesgos macroeconómicos, deportes, política, eventos corporativos y actividades en cadena". Cuando aumentan el número de mercados, el volumen de operaciones y la complejidad de los participantes, los usuarios ya no necesitan sólo una página de desventajas más atractiva, sino un sistema inteligente que pueda transformar los eventos en juicios de mercado revisables.\r
      </p>\r
      <p>\r
        Las principales lagunas en la actual interfaz de predicción del mercado son: la relación entre los mercados no está estructurada, los juicios emitidos por la IA carecen de registros de razonamiento verificables y las recomendaciones comerciales carecen de restricciones de riesgo y posición. Es difícil para los usuarios revisar por qué se generó una señal, cuál fue la base y si luego fue correcta. Causeway intenta llenar este vacío: a partir de los datos de mercado de Polymarket, construye una red de mercado, genera guiones causales, genera probabilidad, ventaja, riesgo y vista previa, y ancla el rastreo de razonamiento de IA a Arc Testnet para que se puedan auditar el "razonamiento previo al evento" y los "resultados posteriores al evento".\r
      </p>\r
      <div class="callout">\r
        <strong>Posicionamiento en una frase:</strong>\r
        Causeway convierte los mercados de predicción en una capa de inteligencia comercial legible por IA, razonada por IA, ejecutada por el usuario y verificable por Arc.\r
      </div>\r
      <p>\r
        A diferencia de los asistentes de chat de IA comunes, el producto principal de Causeway no es una respuesta en lenguaje natural que no se puede revisar, sino un objeto estructurado de inteligencia de mercado: mercado raíz, token de resultado raíz, mercado candidato, ventaja causal, estimación de probabilidad, probabilidad implícita del mercado, ventaja, recomendaciones de COMPRAR/OBSERVAR/EVITAR, explicación de riesgos, vista previa de pedidos, estado de confirmación del usuario, hash de prueba de arco y registros de rendimiento posteriores. De forma predeterminada, el sistema no aloja fondos para los usuarios, no omite las firmas de los usuarios y no incluye los resultados de la IA en consejos de inversión; proporciona un conjunto de flujos de trabajo de mercado de predicción explicables, verificables y gobernables.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">02 / Contexto del Mercado</p>\r
      <h2>Antecedentes del mercado: el mercado de predicción entra en la etapa principal</h2>\r
      <h3>2.1 El volumen de operaciones y la atención institucional están aumentando rápidamente</h3>\r
      <p>\r
        El mercado de predicciones completó su primera salida a gran escala durante el ciclo electoral estadounidense de 2024. CoinDesk informó que el volumen del contrato de las elecciones presidenciales estadounidenses de 2024 de Polymarket superó los 3.600 millones de dólares. El mercado también llamó la atención de los principales medios de comunicación a gran escala y de los usuarios comunes por primera vez sobre el mercado de la predicción. Para 2025, el crecimiento de la industria se expandirá desde eventos políticos únicos a más categorías como deportes, macro, criptografía, datos económicos, eventos corporativos y eventos culturales.\r
      </p>\r
      <p>\r
        En un informe sobre la previsión de entrada al mercado para 2026, KPMG señaló que el volumen de transacciones combinado de Kalshi y Polymarket superará los 40.000 millones de dólares en 2025, en comparación con aproximadamente 9.000 millones de dólares en 2024, lo que representa un crecimiento anual de más del 400%. El informe también menciona que el volumen de operaciones mensual de Polymarket superó los 3.000 millones de dólares en octubre de 2025. Aunque el calibre de las diferentes fuentes de datos variará según la plataforma, la definición del volumen y el marco temporal, la dirección es la misma: el mercado de predicción ha pasado de productos experimentales a una etapa de alto crecimiento, fuerte atención regulatoria y participación institucional.\r
      </p>\r
      <h3>2.2 El mercado de predicción está pasando de ser un “lugar de negociación” a una “capa de datos probabilísticos”</h3>\r
      <p>\r
        La inversión estratégica en Polymarket por parte de ICE (la empresa matriz de la Bolsa de Valores de Nueva York) es una prueba más de que el mercado se centra no sólo en las tarifas de transacción, sino también en los propios datos basados ​​en eventos. Axios informa que ICE acordó invertir hasta 2 mil millones de dólares en Polymarket y se convertirá en un distribuidor global de los datos basados ​​en eventos de Polymarket. Esto significa que el valor de los mercados de predicción no reside sólo en el comercio, sino en su capacidad para convertir la incertidumbre del mundo real en datos de probabilidad observables en tiempo real.\r
      </p>\r
      <div class="grid-3">\r
        <div class="metric-card">\r
          <span class="small-label">Señal de mercado</span>\r
          <b>El volumen de operaciones se expande</b>\r
          <p>El volumen de operaciones de la plataforma se ha expandido desde el pico del ciclo electoral hasta transacciones normales de múltiples categorías, y la profundidad del mercado y la estructura de usuarios se han vuelto más complejas.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Señal institucional</span>\r
          <b>Entrada institucional</b>\r
          <p>Bolsas, corretajes, plataformas deportivas y empresas de tecnología financiera están buscando entrar en los mercados de predicción.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Señal de datos</span>\r
          <b>Digitalización de probabilidad</b>\r
          <p>La predicción de los precios del mercado se está volviendo a entender como datos basados ​​en eventos, no solo como resultados de las apuestas de los usuarios.</p>\r
        </div>\r
      </div>\r
      <h3>2.3 Nuevas contradicciones provocadas por el crecimiento</h3>\r
      <p>\r
        Una vez que el mercado se expande, los usuarios ya no se enfrentan a "no pueden encontrar el mercado", sino a "no pueden juzgar qué mercados son dignos de investigación, qué precios han reflejado información, qué mercados relacionados están rezagados y qué señales son ruido". Cuanto más rápido crece el volumen de transacciones, más capas inteligentes se necesitan para organizar las relaciones de mercado, interpretar cambios de probabilidad, identificar errores de precios, controlar riesgos y formar registros repetibles.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">03 / Problema</p>\r
      <h2>Pregunta central: ¿Por qué a los mercados de predicción existentes todavía les falta una capa de inteligencia?</h2>\r
      <h3>3.1 Problema 1: El mercado es una red, pero la interfaz sigue siendo una lista</h3>\r
      <p>\r
        Un acontecimiento de la vida real rara vez afecta a un solo mercado. Por ejemplo, una declaración de la Reserva Federal puede afectar las tasas de interés, la inflación, el dólar estadounidense, los criptoactivos, los índices bursátiles, el oro, las narrativas electorales y los eventos corporativos relacionados al mismo tiempo; Una noticia sobre una lesión deportiva puede afectar el resultado, el campeonato, los datos de los jugadores y la probabilidad de clasificarse para un mismo grupo. Las interfaces tradicionales suelen presentarse como listas de mercados, páginas de eventos y resultados de búsqueda, y carecen de una representación estructurada de cómo se propagan los eventos entre los mercados.\r
      </p>\r
      <h3>3.2 Problema 2: La estructura de datos del mercado es compleja y el objeto de la transacción no es el título</h3>\r
      <p>\r
        El objeto comercial de Polymarket no es el título del mercado, sino el token de resultado. En la API oficial de Gamma <code>outcomes</code>、<code>outcomePrices</code> Existe una relación de mapeo de índice con el ID del token CLOB; puede haber múltiples mercados bajo el mismo evento. Para los usuarios y los sistemas de IA, si solo se entiende el título o la copia Sí/No, es fácil producir asignaciones incorrectas en mercados de múltiples resultados, mercados deportivos, mercados de rango y eventos mutuamente excluyentes.\r
      </p>\r
      <h3>3.3 Problema 3: las recomendaciones de IA carecen de auditabilidad</h3>\r
      <p>\r
        Los sistemas de IA ordinarios pueden generar respuestas como "Se recomienda comprar Sí", pero esta respuesta a menudo carece de instantáneas de entrada, alcance del mercado candidato, versión del mensaje, versión del modelo, esquema de salida, ruta de razonamiento, contraejemplos y trazabilidad posterior al evento. La particularidad de los mercados de predicción es que los resultados se verificarán en el futuro. Si el sistema no puede probar que se emitió un juicio antes de que ocurriera el resultado o que el razonamiento no se modificó posteriormente, entonces la señal carece de una base creíble.\r
      </p>\r
      <h3>3.4 Cuestión 4: Existe un conflicto entre velocidad y gobernanza</h3>\r
      <p>\r
        La ventaja de los mercados de eventos es que pueden reaccionar rápidamente, pero ser demasiado rápido también puede amplificar los riesgos de desinformación, alucinaciones, iliquidez y comercio excesivo. Un sistema profesional no sólo puede perseguir la ejecución automática, sino que debe incorporar vista previa, presupuesto, estado negociable, actualización del libro de órdenes, confirmación del usuario, registros de auditoría y revocación de permisos en el mismo proceso.\r
      </p>\r
      <div class="callout warning">\r
        <strong>Juicio del producto:</strong>\r
        La competencia principal en la siguiente etapa del mercado de predicción no es "quién tiene más páginas de mercado", sino "quién puede organizar los precios del mercado, el razonamiento de la IA, la ejecución real y los registros verificables en un circuito cerrado inteligente completo".\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">04 / Fundación Académica</p>\r
      <h2>Fundamentos académicos y marco de cálculo de valores.</h2>\r
      <p>\r
        El valor teórico de los mercados de predicción proviene de un mecanismo simple pero poderoso: cuando un contrato paga una cantidad fija basada en el resultado de un evento, el precio de la transacción puede expresar aproximadamente el juicio colectivo del mercado sobre la probabilidad de que un evento ocurra bajo ciertas condiciones. La revisión de Wolfers y Zitzewitz sobre los mercados de predicción señaló que los mercados de predicción pueden agregar información dispersa a través de los precios en señales legibles; Snowberg, Wolfers y Zitzewitz aplicaron además este mecanismo a escenarios de predicción económica, explicando que los precios de los contratos de eventos pueden convertirse en expresiones probabilísticas en tiempo real de incertidumbre macro y política. El valor de Causeway no es reinventar el mercado de predicción, sino agregar razonamiento de inteligencia artificial, detección de coherencia entre mercados, corrección de fricción de ejecución, presupuesto de riesgos y registros de desempeño verificables basados ​​en "el precio como señal probabilística".\r
      </p>\r
      <h3>4.1 El precio es probabilidad, pero no verdad incondicional</h3>\r
      <p>\r
        Para un contrato de evento binario, si el contrato paga $1 cuando ocurre el evento y $0 cuando no ocurre, en condiciones ideales de neutralidad de riesgo, bajos costos de transacción, suficiente liquidez y los participantes pueden comerciar libremente, el precio de mercado <code>p</code> Puede entenderse como probabilidad implícita en el mercado. Los mercados de predicción realistas no siempre cumplen estas condiciones: diferenciales, tarifas, deslizamientos, límites, ruido de información, intentos de manipulación, restricciones regulatorias y preferencias de riesgo de los participantes harán que los precios se desvíen de la "probabilidad real". Por lo tanto, Causeway no considera el precio de mercado como una conclusión, sino como la primera capa de señales observables, que luego se explican conjuntamente mediante las probabilidades justas de la IA, la verificación de la fuente, la verificación de la liquidez y el modelo de riesgo.\r
      </p>\r
      <div class="formula">\r
        <code>p_mid = (bestBid + bestAsk) / 2</code>\r
        <code>p_exec_yes = ask_yes, p_exec_no = ask_no</code>\r
        <code>q_ai = calibratedForecast(event | marketSnapshot, sourceObjects, reasoningTrace)</code>\r
        <code>rawEdge_mid = q_ai - p_mid</code>\r
        <p><code>p_mid</code> Adecuado para mostrar probabilidades implícitas en el mercado,<code>p_exec_yes</code> Este es el umbral de probabilidad de ejecución real para comprar SÍ. Causeway debería distinguir entre "probabilidad de investigación" y "probabilidad de comerciabilidad" para evitar utilizar el precio medio para exagerar la ventaja.</p>\r
      </div>\r
      <h3>4.2 El valor de la transacción proviene de “expectativas positivas después de la fricción”</h3>\r
      <p>\r
        Lo que es realmente valioso para los usuarios no es "la IA cree que la probabilidad es mayor", sino "todavía hay una expectativa positiva después del precio negociable actual, las tarifas de manejo, el deslizamiento, la profundidad del handicap y el descuento por incertidumbre". Este es también el núcleo que la investigación sobre arbitraje de mercado de predicción enfatiza repetidamente: las inconsistencias teóricas de precios sólo constituyen oportunidades reales cuando son ejecutables, liquidables y siguen siendo positivas después de deducir los costos. Por lo tanto, Causeway divide las oportunidades en tres niveles: señal sin procesar, señal negociable y vista previa de orden ejecutable.\r
      </p>\r
      <div class="formula">\r
        <code>EV_token_yes = q_ai * 1 + (1 - q_ai) * 0 - ask_yes - cost_per_token</code>\r
        <code>ROI_yes = EV_token_yes / ask_yes</code>\r
        <code>edgeNet = q_ai - ask_yes - feeRate - slippageBps - ruleRiskHaircut - sourceRiskHaircut</code>\r
        <code>BUY only if edgeNet &gt; minEdge, depthAtLimit &gt; targetSize, timeToClose &gt; minWindow</code>\r
        <p>La ventaja neta debe estar simultáneamente limitada por la probabilidad, el costo, la profundidad y las ventanas de tiempo. Si alguna de las restricciones es insuficiente, el sistema debe bajar a VER, VERIFICAR PRIMERO o EVITAR.</p>\r
      </div>\r
      <h3>4.3 Sugerencia de posición: utilice Kelly conservadora en lugar de apuestas impulsivas</h3>\r
      <p>\r
        En un contrato de evento, el precio de compra en sí está cerca de la pérdida máxima; el valor del contrato se acerca a 1 cuando ocurre el evento y se acerca a 0 cuando no ocurre. La fórmula de Kelly se puede utilizar como punto de partida teórico para las recomendaciones de posiciones, pero los mercados de predicción contienen errores de modelo, discontinuidades de liquidez, diferencias en la interpretación de las reglas y riesgos de liquidación de eventos, por lo que se debe utilizar una versión con descuento, superponiendo la capacidad del mercado, la correlación de la cartera y los límites del presupuesto del usuario. Causeway genera recomendaciones presupuestarias de riesgo, no compromisos de ingresos.\r
      </p>\r
      <div class="formula">\r
        <code>q_adj = clamp(0.5 + confidence * (q_ai - 0.5), 0.01, 0.99)</code>\r
        <code>b = (1 - p_exec) / p_exec</code>\r
        <code>kellyFull = (b * q_adj - (1 - q_adj)) / b = (q_adj - p_exec) / (1 - p_exec)</code>\r
        <code>sizeUsd = bankroll * min(max(0, lambda * kellyFull), capMarket, capPortfolio, capCorrelation)</code>\r
        <p><code>q_adj</code> Utilice la confianza para reducir la probabilidad del modelo al 50%,<code>lambda</code> Descuento para Kelly fraccional. Luego, las posiciones deben estar limitadas por la capacidad del mercado, la correlación de la cartera, los límites de pérdidas diarias y los presupuestos de los usuarios.</p>\r
      </div>\r
      <h3>4.4 Mercado completo mutuamente excluyente: identificación del arbitraje y el riesgo a partir de la suma del precio</h3>\r
      <p>\r
        En un mercado de múltiples resultados mutuamente excluyente y completo, como el ganador presidencial, la propiedad del campeonato, el resultado del intervalo, etc., la suma de las probabilidades reales de todos los resultados debe ser cercana a 1. Los documentos de arbitraje a menudo utilizan esta estructura para detectar inconsistencias de precios: si la demanda total de comprar todos los resultados es menor que 1, teóricamente existe un margen de ganancia de "comprar toda la canasta"; si la oferta total que se puede vender es mayor que 1, puede haber una señal de arbitraje inverso o sobreprecio. Sin embargo, el comercio real debe considerar si las transacciones pueden completarse al mismo tiempo, si se permiten las ventas en corto, si existe riesgo de cancelación/liquidación y si la profundidad del mercado es suficiente.\r
      </p>\r
      <div class="formula">\r
        <code>Underround: Σ ask_i + fees + slippage &lt; 1</code>\r
        <code>profitFloor_buyBasket = 1 - Σ ask_i - fees - slippage - settlementRisk</code>\r
        <code>Overround: Σ bid_i - fees - slippage &gt; 1, if sell/short/redeem path exists</code>\r
        <code>executable = profitFloor &gt; 0 and min(depth_i) &gt; targetSize and rules_i are consistent</code>\r
        <p>Causeway no reduce el arbitraje completo mutuamente excluyente a un problema matemático, sino que lo utiliza como una verificación de coherencia para el gráfico de mercado: primero encuentre anomalías en los precios y luego verifique la profundidad, las reglas, las rutas de liquidación y ejecución.</p>\r
      </div>\r
      <h3>4.5 Coherencia semántica entre mercados: del “mismo evento” al “mapa de mercado completo”</h3>\r
      <p>\r
        El polimercado moderno no es una colección de mercados aislados, sino una red semántica compuesta de eventos, entidades, ventanas de tiempo, textos de reglas y condiciones de resultados. Lógicamente, un mercado puede implicar otro mercado: por ejemplo, "el candidato gana las elecciones presidenciales" implica que "el candidato todavía tiene posibilidades de participar en las elecciones generales después de ganar la nominación de su partido", y un determinado equipo "gana el campeonato" implica que su probabilidad de "entrar a las finales/playoffs" no debería ser menor. Si el precio en el mercado subyacente es mucho más alto que el del mercado contenido, el sistema debería marcarlo como semánticamente inconsistente o potencialmente mal valorado. La literatura sobre arbitraje semántico y arbitraje de mercado de predicción de Polymarket proporcionada por el usuario respalda la dirección de Market Graph de Causeway: la ventaja de la IA es leer el texto de las reglas, identificar relaciones implícitas y convertirlas en restricciones computables.\r
      </p>\r
      <div class="formula">\r
        <code>If event B implies event A, then P(B) ≤ P(A)</code>\r
        <code>violation = max(0, p_exec(B) - p_exec(A) - costMargin - ruleRiskMargin)</code>\r
        <code>semanticEdge = violation * relationConfidence * min(liquidityScore_A, liquidityScore_B)</code>\r
        <code>tradeableSemanticEdge = semanticEdge only if both markets share compatible resolution rules</code>\r
        <p>La clave aquí no es que el modelo "adivine", sino que el modelo genere un tipo de relación auditable: implica, mutuamente excluyente, relacionada, causal, de la misma fuente o no relacionada.</p>\r
      </div>\r
      <h3>4.6 Caso: Cómo Causeway transfiere el valor del papel al producto</h3>\r
      <table>\r
        <thead><tr><th>Casos académicos/de mercado</th><th>valor tradicional</th><th>El enfoque de Causeway hacia la productización</th></tr></thead>\r
        <tbody>\r
          <tr><td>mercado electoral</td><td>El precio agrega encuestas, noticias, juicio de los comerciantes y apetito por el riesgo en probabilidades en tiempo real.</td><td>Mapee candidatos, estados, partidos, nominaciones, participación y eventos macroeconómicos en un gráfico de mercado para identificar qué mercados ya han reflejado las noticias y qué mercados relacionados están rezagados.</td></tr>\r
          <tr><td>Publicaciones macroeconómicas</td><td>Eventos como el IPC, las tasas de interés, el empleo, la recesión, etc. pueden utilizar los precios de los contratos para formar expectativas en tiempo real.</td><td>Escriba el tiempo de publicación de los datos, las expectativas de consenso, las revisiones históricas, las declaraciones de la Fed y las reacciones de los activos en el objeto fuente para generar una lista de observación de la estrategia "antes de los datos/después de los datos".</td></tr>\r
          <tr><td>Campeón deportivo/ganador del evento</td><td>La suma de precios de resultados completos mutuamente excluyentes se puede utilizar para detectar anomalías overround, underround y handicap.</td><td>Calcule automáticamente las reglas sumAsk, sumBid, profundidad y liquidación para el mismo grupo de resultados, brindando implementabilidad en lugar de solo arbitraje teórico.</td></tr>\r
          <tr><td>Arbitraje semántico polimercado</td><td>Múltiples mercados con diferentes títulos pero resultados mutuamente implícitos pueden tener probabilidades inconsistentes.</td><td>Utilice IA para analizar el texto de la regla, establezca límites implicados, mutuamente excluyentes o correlacionados, y luego utilice violacionScore para clasificar oportunidades potenciales.</td></tr>\r
          <tr><td>Poca liquidez y mercados ruidosos</td><td>Los precios pueden desviarse de las probabilidades reales debido a pequeñas transacciones, diferenciales o información insuficiente.</td><td>Coloque liquidityScore, spreadRisk, sourceRisk y confianza en signalScore y las oportunidades de baja calidad se degradarán automáticamente a WATCH o EVITAR.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>4.7 Evaluación del desempeño: no se limite a mirar PnL</h3>\r
      <p>\r
        Las señales de IA pueden convertirse fácilmente en proyecciones post hoc si solo se muestran casos que generan ganancias. Causeway debe evaluar el modelo con métricas de calibración y funciones de puntuación comúnmente utilizadas en la investigación de mercado de predicción, no solo con cuentas de pérdidas y ganancias. Brier Score mide el error al cuadrado de una predicción de probabilidad versus el resultado real; Log Loss penaliza fuertemente los errores de alta confianza; y el grupo de calibración verifica si "la IA dice que el 70% de los eventos realmente ocurren aproximadamente el 70% de las veces". La importancia de Arc Proof se vuelve muy sencilla aquí: permite bloquear cada juicio de probabilidad de antemano, lo que hace que las evaluaciones de desempeño sean más creíbles.\r
      </p>\r
      <div class="formula">\r
        <code>Brier_mean = mean((q_ai - y)^2)</code>\r
        <code>LogLoss_mean = mean(-[y * ln(q_ai + eps) + (1 - y) * ln(1 - q_ai + eps)])</code>\r
        <code>CalibrationError = Σ_k n_k / N * |mean(q_ai in bucket k) - mean(y in bucket k)|</code>\r
        <code>signalScore = z(edgeNet) + z(confidence) + z(liquidity) - z(spreadRisk) - z(sourceRisk) - z(correlationRisk)</code>\r
        <p>El valor a largo plazo proviene de calibraciones estables y repetibles, no de un solo acierto de predicción. El historial de señales de Causeway debe mostrar simultáneamente el rendimiento posterior al evento en cuanto a precisión, calibración, PnL, reducción, tasa de ejecución y oportunidades perdidas.</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">05 / Definición del producto</p>\r
      <h2>Definiciones de productos de Causeway</h2>\r
      <p>\r
        Causeway es una capa de inteligencia comercial para predecir el mercado. Está dirigido a usuarios que desean comprender, investigar y ejecutar predicciones de oportunidades de mercado, proporcionando un flujo de trabajo completo desde datos completos del mercado hasta razonamiento de IA, desde la identificación de oportunidades comerciales hasta la ejecución de la confirmación del usuario, desde el seguimiento del razonamiento hasta la prueba de arco, desde una señal única hasta el seguimiento del rendimiento.\r
      </p>\r
      <table>\r
        <thead>\r
          <tr><th>Jerarquía</th><th>Función</th><th>valor de usuario</th></tr>\r
        </thead>\r
        <tbody>\r
          <tr><td>base de datos del mercado</td><td>Sincronice eventos, mercados, resultados, tokens, precios, liquidez, reglas y estado de Polymarket.</td><td>Deje que la IA y los usuarios comprendan primero los objetos comercializables reales.</td></tr>\r
          <tr><td>red de mercado</td><td>Cree un gráfico de mercado basado en eventos, etiquetas, semántica, correlación de precios e inferencia de IA.</td><td>Transforme los mercados de listas en redes probabilísticas navegables.</td></tr>\r
          <tr><td>Motor de inferencia de IA</td><td>Genere mercados relevantes, rutas causales, niveles de confianza y acciones predeterminadas desde el resultado raíz.</td><td>Convierta las "ideas de mercado" en guiones revisables.</td></tr>\r
          <tr><td>Capa de inteligencia transaccional</td><td>Calcule las probabilidades del mercado, las probabilidades justas de la IA, la ventaja, el riesgo, las recomendaciones de posición y COMPRAR/OBSERVAR/EVITAR.</td><td>Dejemos que la IA realmente participe en el juicio de las transacciones en lugar de simplemente interpretar el texto.</td></tr>\r
          <tr><td>Ordenar capa de vista previa</td><td>Genere vistas previas de pedidos CLOB reales o de prueba, actualice mercados, verifique límites y espere las firmas de los usuarios.</td><td>Conecte la inferencia con la ejecución real preservando al mismo tiempo los límites de control.</td></tr>\r
          <tr><td>Capa verificable por arco</td><td>Escriba el hash de seguimiento de razonamiento en Arc Testnet y verifique que los datos de llamada sean coherentes con el seguimiento original.</td><td>Demostrar de antemano que el registro de razonamiento existe, reduciendo el margen de manipulación posterior.</td></tr>\r
          <tr><td>capa de seguimiento del rendimiento</td><td>Seguimiento de señales, órdenes, posiciones, cambios de precios, PnL y resultados finales.</td><td>Un sistema que lleva las capacidades de la IA desde la demostración hasta la evaluación sostenible.</td></tr>\r
        </tbody>\r
      </table>\r
      <p>\r
        Los límites de la Causeway son igualmente importantes. De forma predeterminada, el sistema no guarda las claves privadas de los usuarios, no omite las firmas de los usuarios y no incluye los resultados de la IA en consejos de inversión. La IA se encarga de ampliar los argumentos del mercado, identificar caminos, proponer riesgos y generar avances; los usuarios son responsables de confirmar si actuar, cuánto actuar, cuándo detenerse y si abrir órdenes limitadas en el futuro.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">06 / Lo que hemos resuelto</p>\r
      <h2>¿Qué problemas hemos resuelto?</h2>\r
      <h3>6.1 Datos de mercado y mapeo de tokens de resultados</h3>\r
      <p>\r
        Causeway ha distinguido claramente entre "títulos de mercado" y "tokens de resultados negociables reales". El modelo de datos del sistema contiene <code>PolymarketEvent</code>、<code>PolymarketMarket</code>、<code>PolymarketOutcome</code>、<code>clobTokenId</code>Campos , precio, mejor oferta, mejor demanda, última operación, diferencial, volumen, liquidez, tamaño mínimo de orden y tamaño de tick. Esto resuelve el problema de que la IA o el front-end confundan el marketing con una simple copia de Sí/No.\r
      </p>\r
      <h3>6.2 Del resultado raíz al guión causal</h3>\r
      <p>\r
        Los usuarios pueden seleccionar un mercado raíz y un resultado raíz, y el sistema genera una inferencia de IA basada en el mercado candidato. El resultado no es una recomendación de una sola oración, sino un resultado estructurado que contiene nodos, aristas, advertencias, dirección de impacto, confianza, motivo y recomendación de resultado. Luego, el backend lo convierte en guión causal, mercado de guión y selección de resultados del guión, lo que permite a los usuarios revisarlos y modificarlos uno por uno.\r
      </p>\r
      <h3>6.3 Bucle cerrado de vista previa del pedido y confirmación del usuario</h3>\r
      <p>\r
        Distinción de capa de orden de Causeway <code>dry_run</code> y <code>real</code> modo de ejecución. El sistema puede generar vistas previas de pedidos, actualizar libros de pedidos, verificar saldos y capacidades comerciales, preparar cargas útiles de firmas EIP-712 y enviar pedidos reales a través de Polymarket CLOB. Cuando las capacidades reales no están disponibles, los protocolos de front-end y back-end permanecen consistentes, evitando que el producto interrumpa la demostración y el desarrollo debido a una única dependencia externa.\r
      </p>\r
      <h3>6.4 Atribución de Polymarket Builder</h3>\r
      <p>\r
        El programa Polymarket Builder permite que las aplicaciones agreguen código de constructor a estructuras de pedidos para obtener atribución de pedidos y estadísticas de clasificación de constructores. El circuito cerrado de negocios de Causeway se puede construir sobre "la IA descubre y explica oportunidades, los usuarios retienen el control de la billetera y confirman personalmente las transacciones, y las transacciones reales se atribuyen a través del código de creación". Esto es más adecuado para escenarios de negociación de mercado de predicción que un modelo de suscripción puro.\r
      </p>\r
      <h3>6.5 Prueba de rastreo de razonamiento de arco</h3>\r
      <p>\r
        La implementación actual de Causeway ya incluye el módulo Arc Proof. El sistema puede leer un determinado guión causal y construir <code>causeway.reasoning_trace.v1</code> La cápsula empaqueta hash de entrada de inferencia, hash de salida, versión del modelo, versión de solicitud, instantánea del mercado, selección de resultados y gráfico de script, genera hash de seguimiento y lo ancla a través de datos de llamadas de transacciones de Arc Testnet. El backend verificará el firmante de la transacción, el chainId y los datos de llamada para garantizar que los registros de la cadena sean coherentes con el seguimiento original.\r
      </p>\r
      <h3>6.6 Pagos de primas de Arc USDC</h3>\r
      <p>\r
        Causeway también implementa la intención de pago de Arc USDC y el derecho de membresía. Los usuarios pueden pagar a Arc USDC por la capacidad premium, y el backend verifica el monto del pago, el pagador, el beneficiario, el estado de la transacción y la ventana de tiempo leyendo el recibo de la transacción de Arc y el registro de transferencia de USDC antes de activar la membresía premium. Este mecanismo se puede utilizar para capacidades como modelos avanzados, razonamiento más profundo, rastreos de razonamiento más completos y prueba de arco; en el futuro, también se puede combinar con llamadas de servicio x402 liquidadas en Arc, de modo que las suscripciones de miembros, los informes de pago por evento, las llamadas API y el desbloqueo de capacidades de agentes compartan el mismo conjunto de registros de pago verificables.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">07 / Arquitectura</p>\r
      <h2>Arquitectura del sistema y modelo de datos.</h2>\r
      <h3>7.1 Pila de tecnología</h3>\r
      <table>\r
        <thead><tr><th>módulo</th><th>Dirección de implementación actual</th><th>efecto</th></tr></thead>\r
        <tbody>\r
          <tr><td>Interfaz</td><td>Reaccionar + Vite + RainbowKit + wagmi + viem + React Flow</td><td>Red de mercado, conexión de billetera, gráfico de inferencia, vista previa de pedidos, panel Arc Proof.</td></tr>\r
          <tr><td>API</td><td>NestJS + Prisma + PostgreSQL</td><td>Sincronización de mercado, inferencia de IA, scripts, órdenes, carteras, pagos, prueba de arco.</td></tr>\r
          <tr><td>Polimercado</td><td>API gamma + CLOB/API de datos + Builder Relayer</td><td>Datos de mercado, tokens de resultados, libros de pedidos, pedidos firmados y atribución de constructores.</td></tr>\r
          <tr><td>AI</td><td>Mensaje estructurado + esquema de salida + caché</td><td>Generar diagramas de causa y efecto, resultados recomendados, niveles de confianza, riesgos y guiones.</td></tr>\r
          <tr><td>Arco</td><td>Arc Testnet + viem public/wallet client + verificación de pago USDC</td><td>Razonamiento prueba de rastreo, pago de prima, base económica del agente.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>7.2 Objetos de datos</h3>\r
      <p>\r
        Los objetos de datos centrales de Causeway están diseñados en torno a "mercados negociables" y "razonamiento auditable". El objeto de mercado es responsable de expresar con precisión la estructura Polymarket, el objeto de razonamiento es responsable de registrar la entrada y salida de la IA, el objeto de secuencia de comandos es responsable de convertir el razonamiento en un plan de acción editable por el usuario, el objeto de orden es responsable de conectar transacciones reales y el objeto de prueba Arc es responsable de demostrar que el registro de razonamiento existe en un momento específico.\r
      </p>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Objeto de mercado</span><b>estructura real del mercado</b><p>Contiene evento, mercado, resultado, conditionId, questionId, clobTokenId, precio, liquidez y reglas.</p></div>\r
        <div class="note"><span class="small-label">Objeto de inferencia</span><b>Registro de inferencia de IA</b><p>Incluye root outcome, candidate set, prompt version, model, inputJson, outputJson y cacheKey.</p></div>\r
        <div class="note"><span class="small-label">Guión causal</span><b>Guión de acción editable</b><p>Contiene GraphJson, mercados de secuencias de comandos, selecciones de resultados, acción de usuario, modo de orden y justificación.</p></div>\r
        <div class="note"><span class="small-label">Cápsula a prueba de arco</span><b>prueba de inferencia verificable</b><p>Contiene hash de seguimiento, datos de llamada, chainId, txHash, URL de ArcScan y marca de tiempo de anclaje.</p></div>\r
      </div>\r
      <h3>7.3 Principios arquitectónicos</h3>\r
      <ul>\r
        <li><strong>Primero en el mercado:</strong>Asegúrese de que la estructura del mercado, los tokens de resultados y los libros de pedidos sean confiables antes de ampliar las fuentes de información externas.</li>\r
        <li><strong>IA estructurada:</strong>La salida de la IA debe ajustarse al esquema y no puede simplemente devolver el lenguaje natural.</li>\r
        <li><strong>Gobernado por humanos:</strong>La IA puede generar scripts predeterminados, pero los usuarios pueden modificarlos, omitirlos, obtener una vista previa o rechazarlos.</li>\r
        <li><strong>Listo para prueba:</strong>Los registros de razonamiento clave deben codificarse, revisarse y anclarse para respaldar la evaluación del desempeño posterior al evento.</li>\r
        <li><strong>Respaldo de capacidad:</strong>Cuando las transacciones reales, los saldos, los pagos o las API externas no están disponibles, el sistema debería devolver el estado de capacidad estructurada en lugar de fallar.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">08 / Inteligencia del comerciante</p>\r
      <h2>Inteligencia de AI Trader: de la probabilidad a la acción Vista previa</h2>\r
      <h3>8.1 Las señales no deben ser simplemente "comprar" o "no comprar"</h3>\r
      <p>\r
        Un sistema de inteligencia de mercado de predicción maduro no debería ofrecer recomendaciones comerciales para todos los mercados. Muchos mercados deberían volver a OBSERVAR o EVITAR: por ejemplo, no hay suficiente ventaja, liquidez insuficiente, los diferenciales son demasiado amplios, las reglas no son claras, las fuentes de información no están verificadas, los usuarios ya tienen exposiciones altamente correlacionadas, el mercado está a punto de terminar o la confianza en la IA es insuficiente. No Trade Recomendado es una competencia en sí misma porque demuestra un sistema con moderación y conciencia de riesgo.\r
      </p>\r
      <h3>8.2 Objeto de señal</h3>\r
      <table>\r
        <thead><tr><th>Campo</th><th>ilustrar</th></tr></thead>\r
        <tbody>\r
          <tr><td>identificador de señal</td><td>ID de señal única para seguimiento y revisión del rendimiento.</td></tr>\r
          <tr><td>cuotas de mercado</td><td>El precio de mercado implicaba probabilidades.</td></tr>\r
          <tr><td>aiFairOportunidades</td><td>La IA proporciona probabilidades justas basadas en datos de mercado, rutas de razonamiento y verificación de fuentes de información.</td></tr>\r
          <tr><td>borde</td><td>La diferencia entre las probabilidades justas de la IA y las probabilidades del mercado.</td></tr>\r
          <tr><td>confianza</td><td>La confianza del modelo en la ruta de inferencia y la calidad de los datos.</td></tr>\r
          <tr><td>recomendación</td><td>COMPRAR, MIRAR, EVITAR y VERIFICAR PRIMERO.</td></tr>\r
          <tr><td>nivel de riesgo</td><td>Bajo, Medio, Alto, sujeto a liquidez, reglas, fuentes, volatilidad y exposiciones relacionadas.</td></tr>\r
          <tr><td>tamaño sugerido</td><td>Monto recomendado basado en Kelly conservadora, límite presupuestario y capacidad de mercado.</td></tr>\r
          <tr><td>cambiarmimente</td><td>¿Qué cambios fácticos anularían las recomendaciones actuales?</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>8.3 Del diagrama causa-efecto a la recomendación de posición</h3>\r
      <p>\r
        Las recomendaciones de posición de Causeway no deben ser cantidades fijas, sino que deben estar determinadas por una combinación de factores: tamaño del borde, confianza, profundidad del mercado, diferencial, apetito de riesgo del usuario, correlación del mercado, capitalización del mercado único y presupuesto general. El Kelly conservador se puede utilizar como marco básico, pero se deben agregar factores de descuento y límites superiores para evitar que el modelo apueste demasiado en escenarios de alta incertidumbre.\r
      </p>\r
      <div class="callout">\r
        <strong>Principios conservadores:</strong>\r
        Las posiciones recomendadas deberían ser "presupuestos de riesgo explicables", no promesas de rentabilidad. El sistema debe mostrar claramente la pérdida máxima, el precio de la transacción, el deslizamiento, el tiempo de vencimiento y las condiciones que desencadenan la revaluación.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">09 / A prueba de arco</p>\r
      <h2>Arc Proof: registros verificables del razonamiento de la IA</h2>\r
      <h3>9.1 Por qué el razonamiento requiere pruebas en cadena</h3>\r
      <p>\r
        El núcleo de los mercados de predicción es que el futuro verificará los juicios de hoy. Por lo tanto, la credibilidad de una señal de IA no sólo proviene del modelo en sí, sino también de "si puede probar que emitió este juicio antes de que se produjera el resultado". Si un sistema puede modificar los rastros de razonamiento histórico después de que se publican los resultados, entonces cualquier registro de precisión de la señal, PnL o rendimiento carece de una base de confianza.\r
      </p>\r
      <p>\r
        La función de Arc Proof no es reemplazar el enlace comercial de Polymarket ni mover las órdenes de los usuarios a Arc. Polymarket sigue siendo responsable de las transacciones de mercado y CLOB; Arc es responsable de registrar el hash de los rastros de razonamiento de la IA como una capa de auditoría nativa, rápida y de bajo costo para las monedas estables.\r
      </p>\r
      <h3>9.2 Cápsula Arc Proof de Causeway</h3>\r
      <table>\r
        <thead><tr><th>Campo</th><th>significado</th></tr></thead>\r
        <tbody>\r
          <tr><td>esquema</td><td><code>causeway.reasoning_trace.v1</code></td></tr>\r
          <tr><td>scriptId / inferenciaRunId</td><td>Secuencias de comandos y ejecuciones de inferencia correspondientes.</td></tr>\r
          <tr><td>rootMarketId / rootOutcomeId</td><td>Mercado raíz seleccionado por el usuario y resultado raíz.</td></tr>\r
          <tr><td>entradaHash/salidaHash</td><td>Hash JSON estable de entrada y salida de IA.</td></tr>\r
          <tr><td>modelo/promptVersion/outputSchemaVersion</td><td>Versiones de modelo, formato de solicitud y salida.</td></tr>\r
          <tr><td>instantáneas del mercado</td><td>Precio, best bid, best ask, last trade, volume, liquidity y syncedAt.</td></tr>\r
          <tr><td>trozos escogidos</td><td>Acción de IA, acción del usuario, modo de pedido, precio límite, tamaño, cantidad en dólares y motivo.</td></tr>\r
          <tr><td>trazaHash</td><td>El hash de toda la cápsula, utilizado como datos de llamada de transacciones de Arc.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>9.3 Proceso de verificación</h3>\r
      <ol>\r
        <li>El backend lee scripts de usuario y registros de inferencia para crear una cápsula de prueba.</li>\r
        <li>Generar usando hash JSON estable <code>traceHash</code>。</li>\r
        <li>La interfaz solicita al usuario que cambie a Arc Testnet y envía una transacción con los datos de llamada como traceHash.</li>\r
        <li>El backend espera el recibo de la transacción y lee la entrada de la transacción.</li>\r
        <li>Verifique que el firmante sea coherente con la billetera conectada, que el chainId sea Arc Testnet y que los datos de llamada sean coherentes con traceHash.</li>\r
        <li>Escriba txHash, traceHash, ArcScan URL y AnchoredAt para auditar registros.</li>\r
      </ol>\r
      <div class="callout">\r
        <strong>Significado del producto:</strong>\r
        Arc Proof permite a Causeway mostrar que "este registro de inferencia de IA existió en un momento determinado y no ha sido reescrito silenciosamente posteriormente". Ésta es la base para confiar en el desempeño de las señales de IA en los mercados de predicción.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">10 / Economía del Arco USDC</p>\r
      <h2>Arc USDC Premium: suscripciones de miembros, pagos verificables y economía inteligente</h2>\r
      <p>\r
        El diseño nativo de la moneda estable de Arc es adecuado para actividades económicas inteligentes frecuentes, verificables y de bajo costo. Actualmente, Causeway ha implementado la intención de pago Arc USDC: después de que el usuario selecciona el plan premium, el sistema genera la intención de pago, especificando el ID de la cadena, el token USDC, la dirección del receptor, la cantidad MicroUsd y el tiempo de vencimiento; Después de que el usuario completa la transferencia USDC en Arc, el backend lee el recibo de la transacción y el registro de transferencia ERC-20 para verificarlo y asigna el resultado del pago a los derechos de los miembros. En la etapa actual, las suscripciones de membresía se utilizan principalmente para desbloquear señales avanzadas, trazas de inferencia completas, pruebas de arco y capacidades de análisis de nivel superior; En el futuro, Causeway también podrá utilizar llamadas de servicio x402 establecidas en Arc para unificar suscripciones, pago por visión, desbloqueo de informes, llamadas API y compras de capacidades de agentes en un marco de pago más detallado.\r
      </p>\r
      <h3>10.1 Capacidades Premium actualmente admitidas</h3>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Señal Premium</span><b>señalización avanzada</b><p>Desbloquee inferencias más profundas, modelos de mayor calidad, mayor confianza y un alcance completo del mercado candidato.</p></div>\r
        <div class="note"><span class="small-label">Seguimiento de razonamiento completo</span><b>Pista de razonamiento completa</b><p>Vea entradas, salidas, mercados candidatos, riesgos, contraejemplos y Qué cambiaría de opinión.</p></div>\r
        <div class="note"><span class="small-label">Prueba de arco</span><b>Prueba en cadena</b><p>Ancle el hash de seguimiento de razonamiento a Arc Testnet y vea las transacciones a través de ArcScan.</p></div>\r
        <div class="note"><span class="small-label">Futuro x402</span><b>Llamada de servicio del agente</b><p>El acceso futuro al proceso x402 se factura en Arc para compras de datos, desbloqueo de informes, llamadas API y suscripciones a políticas.</p></div>\r
      </div>\r
      <h3>10.2 Arco: Razonamiento verificable y la capa de liquidación de la economía de agentes</h3>\r
      <p>\r
        El valor de Arc para Causeway no es reemplazar el enlace de transacciones de Polymarket, sino proporcionar una capa económica y de auditoría nativa de moneda estable, verificable y de bajo costo para los sistemas de inteligencia artificial del mercado de predicción. Polymarket es responsable del casamiento de mercado, libro de órdenes, liquidación de resultados y ejecución de transacciones reales; Causeway es responsable de la comprensión del mercado, el razonamiento de la IA, la vista previa de riesgos, la confirmación del usuario y el seguimiento de señales; Arc es adecuado para llevar a cabo acciones auxiliares que son de alta frecuencia, pequeñas cantidades, deben registrarse, deben verificarse y, naturalmente, tienen un precio en dólares estadounidenses, como depósito de rastreo de razonamiento, suscripción premium, desbloqueo de informes, llamada API, liquidación de servicios de agente inteligente y pago futuro de fuentes de datos.\r
      </p>\r
      <p>\r
        En su versión actual, Arc aborda primero dos cuestiones clave. En primer lugar, la inferencia de la IA requiere marcas de tiempo verificables. El juicio del mercado de predicción será verificado por resultados futuros. Si el sistema no puede probar que se generó un determinado registro de inferencia antes de que se produjera el resultado, la credibilidad del historial de la señal se reducirá significativamente. Causeway escribe el hash del rastro de razonamiento en Arc, de modo que cada juicio de IA pueda formar una cápsula de prueba liviana. En segundo lugar, las capacidades de IA requieren una ruta de pago nativa para las monedas estables. El razonamiento avanzado, las pistas de razonamiento completas, el análisis de gráficos de mercado, las llamadas API y los servicios de informes son todos adecuados para acuerdos verificables, en tiempo real y de pequeñas cantidades con el USDC.\r
      </p>\r
      <p>\r
        En el mediano plazo, Arc puede ayudar a Causeway a formar una economía de señales más completa. Cada inferencia de IA puede verse como un activo de señal rastreable: tiene tiempo de generación, instantánea de entrada, versión del modelo, precio de mercado, probabilidades justas de IA, ventajas, explicaciones de riesgo, acciones del usuario y resultados finales. Si estas señales se acumulan con el tiempo y los hashes clave están anclados a Arc, Causeway puede establecer un registro de seguimiento de señales confiable. En el futuro, los usuarios no solo comprarán una respuesta de IA una vez, sino que se suscribirán a estrategias, informes, mapas de mercado, fuentes de datos y capacidades de agentes profesionales probados.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">Capa de servicio del agente 11/x402</p>\r
      <h2>Capa de servicio del agente x402: capa de protocolo de servicio del agente futuro</h2>\r
      <p>\r
        x402 no debe posicionarse como un protocolo de ejecución de transacciones en Causeway, sino como un protocolo de micropagos y invocación de servicios de agente. Su valor radica en permitir que los agentes de inteligencia artificial, API externas, fuentes de datos y servicios de análisis profesionales completen acuerdos de pago por evento a través de solicitudes de pago legibles por máquina. Para Causeway, x402 puede convertirse en la futura capa de servicio del agente: Arc proporciona registros verificables y un entorno de liquidación de monedas estables, x402 proporciona acceso de agente a servicio y procesos de pago, y Causeway es responsable de orquestar el mapa del mercado, la gobernanza de la autoridad, el control de riesgos, la vista previa de pedidos y el seguimiento del rendimiento.\r
      </p>\r
      <h3>11.1 Fuentes de datos, validación y generación de informes de pago por uso</h3>\r
      <p>\r
        Causeway necesitará transmisiones de noticias, datos deportivos, datos macro, datos en cadena, anuncios regulatorios, anuncios de empresas, datos de probabilidades y verificación de fuentes originales en el futuro. Muchos datos no son adecuados para suscripciones mensuales fijas, pero son más adecuados para llamadas bajo demanda cuando la inferencia de IA lo necesita: verificar una publicación del IPC, comprar datos sobre lesiones del equipo, solicitar análisis de flujo de capital en cadena, verificar la fuente original de noticias y generar un informe de diferencia de reglas del mercado. x402 puede convertir estas llamadas en comportamientos de pago instantáneos, detallados y auditables, en lugar de depender de claves API manuales, puntos centralizados o liquidaciones fuera de línea.\r
      </p>\r
      <h3>11.2 Mercado de Inteligencia Profesional</h3>\r
      <p>\r
        Cuando Causeway evoluciona de una única herramienta de razonamiento de IA a un sistema de predicción de múltiples agentes, el sistema puede introducir agentes profesionales externos: agente de investigación macro, agente de lesiones deportivas, agente de noticias políticas, agente de flujo de capital en cadena, agente de arbitraje de desventajas, agente de verificación de fuentes, agente de riesgos y guardia de ejecución. Cada agente puede construir una reputación a través de registros de seguimiento a largo plazo, capacidades de calibración, rendimiento histórico de riesgo de retorno, velocidad de respuesta, cobertura de fuentes de datos y registros de prueba de arco. x402 puede ser responsable del control de acceso y la liquidación de pago por tiempo de cada llamada de servicio.\r
      </p>\r
      <h3>11.3 Mercado de señales y monetización de API</h3>\r
      <p>\r
        En el futuro, Causeway puede exponer señales de alta calidad, gráficos de mercado, informes de riesgo, mercados relacionados, escaneos de arbitraje semántico y estado de prueba de Arc como API pagables a aplicaciones o agentes externos. No es necesario que las personas que llaman sean miembros de pleno derecho y pueden adquirir capacidades específicas previa solicitud. Arc registra pruebas, pagos y reputación, x402 maneja el acceso pago y Causeway muestra el rendimiento de la señal y los resultados de calibración. De esta manera, los ingresos de Causeway provienen no sólo de las suscripciones, sino de una red de servicios inteligentes componibles.\r
      </p>\r
      <h3>11.4 La forma a largo plazo del comercio por encargo limitado de IA</h3>\r
      <p>\r
        En una etapa más avanzada, los usuarios pueden designar agentes maduros y probados para participar en el proceso de transacción automatizado encargado por IA. Sin embargo, x402 en sí no asume responsabilidades de custodia de activos, autorización de transacciones o control de riesgos; es responsable de la invocación del servicio de agente inteligente y la capa de micropagos. Causeway debe superponer las transacciones genuinas encargadas con límites de autoridad: categorías de mercado permitidas para la negociación, monto máximo de transacción única, límite de pérdida diaria, exposición máxima relevante, edgeNet mínimo, liquidez mínima, deslizamiento máximo, pasos de verificación necesarios, tiempo de vencimiento, parada de emergencia y autorización revocable. Cada llamada de datos, generación de inferencias, solicitud de verificación, vista previa de orden o ejecución comercial debe dejar una prueba de arco y un registro de seguimiento de señales.\r
      </p>\r
      <div class="callout">\r
        <strong>Posicionamiento futuro:</strong>\r
        Arc: prueba, registro de pago y sustrato de reputación; x402: protocolo de acceso y pago de agente a servicio; Causeway: capa de orquestación de inteligencia de mercado de predicción; Polymarket: lugar de ejecución y liquidación del mercado.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">12 / Motor de predicción de enjambres</p>\r
      <h2>Motor de predicción de enjambres: de un mundo de mercado paralelo a predecirlo todo</h2>\r
      <p>\r
        El objetivo a largo plazo de Causeway no es permitir que una sola IA emita un juicio único sobre un mercado, sino construir un motor de predicción inteligente grupal para los mercados de predicción. Nuestro juicio es que la predicción de eventos complejos no debe depender de un razonamiento de un solo camino, sino que debe partir de la información inicial del mundo real y construir un mundo de mercado paralelo evolutivo, permitiendo que múltiples agentes inteligentes con diferentes roles, memorias, posiciones y lógica de comportamiento interactúen, diverjan, refuten, revisen y generen predicciones. Causeway limitará esta deducción de inteligencia de enjambre a una "red de mercado de predicción negociable, verificable y liquidable" para que los resultados de la simulación no solo puedan formar informes narrativos, sino que también se conviertan en probabilidades de mercado, probabilidades justas de IA, edgeNet, presupuestos de riesgo, vistas previas de órdenes, prueba de arco y registro de seguimiento de señales.\r
      </p>\r
      <h3>12.1 De la inferencia de modelo único a la predicción de inteligencia de enjambre</h3>\r
      <p>\r
        Un solo modelo es adecuado para generar juicios iniciales, pero el mundo complejo a menudo está determinado por múltiples agentes, múltiples motivaciones, múltiples retrasos en la información y múltiples retroalimentaciones del mercado. Un dato macro, una lesión deportiva, un anuncio regulatorio, un evento en cadena o una noticia política pueden afectar a múltiples entidades, múltiples ventanas de tiempo y múltiples mercados de predicción interconectados al mismo tiempo. El valor del motor de predicción de inteligencia de enjambre es permitir que múltiples agentes desempeñen los roles de investigación, sospecha, verificación, fijación de precios, control de riesgos y ejecución, y realicen múltiples rondas de deducciones en el mismo mapa de mercado, reduciendo así el sesgo de ruta única y el exceso de confianza.\r
      </p>\r
      <figure class="concept-figure">\r
        <div class="concept-figure-frame">\r
          <img src="../../public/assets/causeway-swarm-prediction-engine-concept.png" alt="Diagrama conceptual del motor de predicción de inteligencia colectiva de Causeway" />\r
        </div>\r
        <figcaption class="caption">Figura 12-1: Diagrama conceptual del motor de predicción de inteligencia de enjambre Causeway. Después de que los eventos del mundo real ingresan al mundo del mercado paralelo, los agentes multifunción, los mapas de mercado, la prueba de arco, el servicio de agente x402 y el registro de seguimiento de señales forman conjuntamente un circuito cerrado de predicción auditable.</figcaption>\r
      </figure>\r
      <h3>12.2 Mundo de mercado paralelo</h3>\r
      <p>\r
        Causeway puede transformar un evento real en múltiples mundos de mercados paralelos. Cada mundo contiene diferentes suposiciones: si el evento es real, si la fuente es confiable, con qué rapidez se propaga, si el mercado lo ha reflejado, si el mercado relevante está rezagado, si la liquidez es suficiente y si hay ambigüedad en las reglas. El sistema no se limita a preguntar "¿sucederá este evento?" pero pregunta "si este evento ocurre, cómo pasará a través de la red del mercado, qué probabilidades se cambiarán, qué ventajas se crearán, qué riesgos se desencadenarán y qué registros verificables quedarán atrás". Este mundo de mercado paralelo es el criterio central de Causeway sobre los futuros sistemas de pronóstico: el pronóstico no debería simplemente responder “si sucederá algo”, sino que debería simular cómo los eventos se propagan a través de múltiples mercados, múltiples participantes, múltiples fuentes de información y múltiples ventanas de tiempo, y transformar este proceso de propagación en objetos de inteligencia de mercado auditables, computables y verificables.\r
      </p>\r
      <h3>12.3 Sociedad de agentes: colaboración de agentes multifunción</h3>\r
      <table>\r
        <thead><tr><th>rol de agente</th><th>Responsabilidades</th><th>objeto de salida</th></tr></thead>\r
        <tbody>\r
          <tr><td>Agente de investigación</td><td>Recopile eventos, mercados, casos históricos y contexto.</td><td>Objetos fuente, resumen del evento, candidatos del mercado.</td></tr>\r
          <tr><td>Agente de gráficos de mercado</td><td>Busque mercados relacionados, implicaciones semánticas, relaciones mutuamente excluyentes y exposiciones relacionadas.</td><td>Gráfico de mercado, tipo de relación, dirección del impacto.</td></tr>\r
          <tr><td>Agente de probabilidad</td><td>Las estimaciones de probabilidad se dan en base a escenarios y evidencia.</td><td>Probabilidades justas de IA, cambio de probabilidad, confianza.</td></tr>\r
          <tr><td>Agente escéptico</td><td>Busque contraejemplos, ambigüedades en las reglas, fuentes falsas e inferencias excesivas.</td><td>contraargumentos, changeMyMind, banderas de riesgo。</td></tr>\r
          <tr><td>Agente de verificación</td><td>Rastree los hechos subyacentes y las fuentes autorizadas.</td><td>estado de verificación, confianza en la fuente, informe de conflicto.</td></tr>\r
          <tr><td>Agente de Riesgo</td><td>Calcule liquidez, diferenciales, deslizamientos, correlaciones y límites de posición.</td><td>edgeNet、presupuesto de riesgo、límite de posición。</td></tr>\r
          <tr><td>Guardia de ejecución</td><td>Determine si se permitirá la vista previa de la orden o la ejecución de la comisión.</td><td>COMPRAR / MIRAR / EVITAR、puerta de vista previa de pedidos、parada de emergencia。</td></tr>\r
          <tr><td>Agente de informes</td><td>Convierta los desacuerdos y conclusiones de múltiples agentes en informes legibles.</td><td>Informe de predicción, árbol de escenarios, resumen de auditoría.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>12.4 De los informes de simulación al comercio de objetos inteligentes</h3>\r
      <p>\r
        Los resultados de la inteligencia de enjambre no pueden limitarse a los informes en lenguaje natural. Causeway necesita comprimir los resultados de la simulación en objetos comerciales inteligentes estructurados: árbol de escenarios, mercados afectados, bordes de relación, cambio de probabilidad, probabilidades justas de IA, probabilidades de mercado, edgeNet, acción recomendada, indicadores de riesgo, tamaño sugerido, hash de prueba de arco y entrada de registro de seguimiento. De esta forma, la inteligencia de enjambre puede servir tanto para investigación como para revisión, verificación y confirmación del usuario antes de transacciones reales.\r
      </p>\r
      <div class="formula">\r
        <code>scenarioValue_s = Σ_i edgeNet_i,s * tradability_i,s * confidence_s - portfolioRisk_s</code>\r
        <code>swarmConsensus = weightedMedian(q_agent_1, q_agent_2, ..., q_agent_n; weights = reputation * calibration)</code>\r
        <code>disagreementRisk = variance(q_agent_1 ... q_agent_n) + sourceConflict + ruleAmbiguity</code>\r
        <code>finalAction = gate(swarmConsensus, edgeNet, disagreementRisk, liquidity, userPolicy)</code>\r
        <p>En lugar de simplemente votar, la inteligencia de enjambre combina los registros de calibración, la calidad de la fuente, el grado de desacuerdo y la aplicabilidad del mercado de diferentes agentes en recomendaciones de acción sujetas a control de riesgos.</p>\r
      </div>\r
      <h3>12.5 Relación con Arc y x402</h3>\r
      <p>\r
        Swarm Prediction Engine requiere registros verificables y pagos componibles. Arc puede registrar el hash de cada simulación, inferencia, señal y resultado, de modo que la inteligencia de enjambre no sea una historia empaquetada después del hecho; x402 puede proporcionar pago por llamada y micropago para fuentes de datos externas, servicios de verificación, agentes profesionales e informes detallados; Causeway es responsable de orquestar estas capacidades, mapeando la salida del agente a objetos de mercado de predicción, límites de control de riesgos, vistas previas de pedidos y procesos de gobierno de usuarios. A largo plazo, Arc es la base confiable de registro y liquidación, x402 es el protocolo de invocación de servicio de agente inteligente y Swarm Prediction Engine es la capa inteligente para deducir cambios mundiales.\r
      </p>\r
      <h3>12.6 Visión a largo plazo: predecirlo todo pero mantener la gobernanza de los usuarios</h3>\r
      <p>\r
        Lo que Causeway llama "predecir todo" no es permitir que la IA realice apuestas automáticas ilimitadas, sino permitir a los usuarios ingresar un evento de la vida real. El sistema puede comprender el mercado, organizar agentes, construir un mundo de mercado paralelo, verificar hechos, simular rutas de propagación, generar señales negociables, retener pruebas y permitir que el usuario decida si actúa o no. En el futuro, cuando las capacidades de los agentes, el sistema de reputación y el mecanismo de autorización estén lo suficientemente maduros, los usuarios podrán optar por delegar parte del proceso a agentes verificados; pero los límites predeterminados deberían seguir siendo la gobernanza de los usuarios, los permisos revocables, los presupuestos claros y la auditoría completa.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">13 / Flujo de trabajo</p>\r
      <h2>Flujo de trabajo del usuario y experiencia del producto.</h2>\r
      <h3>13.1 Procedimientos estándar</h3>\r
      <ol>\r
        <li>Los usuarios conectan la billetera e ingresan a la red del mercado.</li>\r
        <li>El sistema muestra eventos, mercados, resultados, precios, volúmenes y mercados relacionados de Polymarket.</li>\r
        <li>El usuario selecciona un resultado raíz como punto de partida para la inferencia.</li>\r
        <li>El sistema recuerda los mercados candidatos y genera entradas rápidas de IA.</li>\r
        <li>La IA genera diagramas causales, recomendaciones de resultados, advertencias y confianza.</li>\r
        <li>El sistema genera guiones causales y los usuarios los revisan, modifican u omiten uno por uno.</li>\r
        <li>Los usuarios ingresan a la vista previa del pedido y verifican el libro de pedidos, el monto, la pérdida máxima, la ganancia estimada y el estado de la capacidad.</li>\r
        <li>Envío de firma CLOB real o de prueba después de la confirmación del usuario.</li>\r
        <li>Los usuarios pueden anclar rastros de razonamiento a Arc Testnet.</li>\r
        <li>El sistema rastrea los cambios de precios, el estado del pedido, el PnL y los resultados finales en el Signal Track Record.</li>\r
      </ol>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">14 / Gobernanza</p>\r
      <h2>Límites de control de riesgos, gobernanza y cumplimiento</h2>\r
      <h3>14.1 Matriz de control de riesgos</h3>\r
      <table>\r
        <thead><tr><th>categoría de riesgo</th><th>preguntas especificas</th><th>método de control</th></tr></thead>\r
        <tbody>\r
          <tr><td>Riesgo de datos</td><td>Retrasos en los datos de mercado, errores en el mapeo de resultados, indisponibilidad de la cartera de pedidos.</td><td>Tiempo de sincronización, verificación de tokenId, actualización en tiempo real, respaldo de capacidad.</td></tr>\r
          <tr><td>riesgo de información</td><td>Errores periodísticos, rumores en redes sociales, mala interpretación de fuentes secundarias.</td><td>Objeto fuente, biblioteca fuente autorizada, detección de conflictos, puntuación de frescura.</td></tr>\r
          <tr><td>riesgo de razonamiento</td><td>Alucinaciones de IA, exceso de confianza, falta de contraejemplos.</td><td>Restricciones del conjunto de candidatos, verificación estructurada, agente escéptico, umbral de confianza.</td></tr>\r
          <tr><td>riesgo de mercado</td><td>Spreads excesivos, liquidez insuficiente y exposiciones relacionadas con el mercado mutuamente excluyentes.</td><td>Profundidad de desventaja, posiciones conservadoras, control de riesgo de cartera a nivel de evento y estado de No Comercio.</td></tr>\r
          <tr><td>riesgo de ejecución</td><td>Los usuarios inician sesión por error, envían pedidos duplicados y los pedidos caducan.</td><td>Vista previa de vencimiento, clave de idempotencia, confirmación antes de firmar, reescritura del estado de envío.</td></tr>\r
          <tr><td>riesgo de auditoría</td><td>Los registros de señales no pueden probar la existencia anterior.</td><td>Prueba de arco, hash, evento de auditoría, registro de seguimiento de señal.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>14.2 Límites predeterminados</h3>\r
      <ul>\r
        <li>La producción de IA no constituye un asesoramiento de inversión.</li>\r
        <li>El sistema no garantiza la precisión de las previsiones, las ganancias ni los resultados del mercado.</li>\r
        <li>El modo predeterminado es la confirmación del usuario en lugar de la realización automática del pedido.</li>\r
        <li>La ejecución delegada debe implementarse en el futuro con autorización explícita, presupuestos claros, límites de alcance y mecanismos de revocación.</li>\r
        <li>Las operaciones en vivo, las operaciones simuladas y las señales no ejecutadas deben distinguirse claramente en la interfaz de usuario y los datos.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">15 / Problemas futuros</p>\r
      <h2>Problemas que deben resolverse en el futuro y cómo podemos solucionarlos</h2>\r
      <h3>15.1 Problema: tiempo real y autenticidad insuficientes de las fuentes de información externas</h3>\r
      <p>\r
        La etapa actual depende en gran medida de los datos del mercado y de conjuntos de candidatos controlados. En la siguiente fase, Causeway debe acceder a transmisiones de noticias en tiempo real, anuncios oficiales, eventos en cadena, datos deportivos y documentos regulatorios. Pero cuantas más fuentes de información externas haya, mayor será el ruido. La solución es la estandarización del objeto fuente: divida cada pieza de información en reclamo, origen, marca de tiempo, entidades, carga útil sin procesar y confianza, e ingrese al flujo de trabajo a través de una biblioteca fuente autorizada y la detección de conflictos.\r
      </p>\r
      <h3>15.2 Problema: el razonamiento de un solo modelo no puede cubrir el mundo complejo</h3>\r
      <p>\r
        Un modelo único es propenso a un camino único y a la sobredeterminación. La solución a largo plazo de Causeway es el razonamiento de múltiples agentes y el motor de predicción Swarm: el agente de investigación es responsable de recopilar el contexto del mercado y de los eventos, el agente de probabilidad proporciona estimaciones de probabilidad, el agente escéptico busca contraejemplos, el agente de verificación verifica las fuentes, el agente de riesgo determina la liquidez y las posiciones, y Execution Guard determina si se permite el acceso a la vista previa. La multiagencia no se trata de mostrar habilidades, sino de hacer explícitos los desacuerdos, las suposiciones, la calidad de la evidencia y los riesgos, y mapear la evolución de múltiples caminos de un mundo complejo en planes de respuesta de mercado revisables.\r
      </p>\r
      <h3>15.3 Problema: El rendimiento de la señal no se puede probar continuamente</h3>\r
      <p>\r
        Sin un historial a largo plazo, las recomendaciones de la IA pueden permanecer fácilmente en la pantalla a corto plazo. Causeway necesita registrar el tiempo de generación, el precio de mercado, las probabilidades justas de la IA, la ventaja, la dirección recomendada, si el usuario ejecuta, el precio de ejecución, el precio actual, las pérdidas y ganancias no realizadas, el resultado final y la prueba de arco para cada señal. Sólo entonces el sistema podrá responder "¿si la IA realmente funciona?"\r
      </p>\r
      <h3>15.4 Asunto: La ejecución automatizada requiere una gobernanza más sólida</h3>\r
      <p>\r
        La quinta etapa de ejecución delegada no es permitir que la IA controle las cuentas sin restricciones, sino permitir que los usuarios autoricen selectivamente bajo reglas claras. La autorización debe contener la categoría de mercado, el monto único máximo, el límite de pérdida diaria, la exposición máxima relevante, las fuentes de datos aceptables, la ventana de tiempo, las condiciones de revocación y la parada de emergencia. En el futuro, si los usuarios designan agentes maduros para participar en el proceso automatizado, x402 puede ser responsable de la invocación del servicio del agente y los micropagos, Arc puede ser responsable de la certificación y el registro, y Causeway puede ser responsable de la gobernanza de la autoridad y el control de riesgos. Las transacciones reales aún deben cumplir con la autorización del usuario y los límites revocables.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">16 / Hoja de ruta</p>\r
      <h2>Hoja de ruta tecnológica de cinco etapas</h2>\r
      <div class="phase-card">\r
        <span class="tag dark">Fase 01</span><span class="tag">Fundación de datos de mercado</span>\r
        <h3>Primero comprenda el mercado y luego comprenda el mundo.</h3>\r
        <p>\r
          La primera fase se centra en los datos del mercado de Polymarket: evento, mercado, resultado, tokenId, precio, volumen, liquidez, cartera de pedidos, reglas y estado. El objetivo es permitir que el sistema exprese de manera estable estructuras comerciales reales y ayudar a los usuarios a seleccionar el resultado raíz de la página de detalles del mercado para ingresar inferencias.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Fase 02</span><span class="tag">Modelo de razonamiento</span>\r
        <h3>Mapear un evento a todos los mercados relevantes</h3>\r
        <p>\r
          Construya modelos de inferencia más sólidos para proporcionar relevancia, dirección, confianza, comerciabilidad y recomendaciones para los mercados relevantes. Presentamos COMPRAR / VER / EVITAR, Qué cambiaría de opinión, recomendaciones de posiciones conservadoras y verificación de divergencia de múltiples agentes para hacer que la IA se parezca más a un equipo de investigación comercial y menos a un chatbot.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Fase 03</span><span class="tag">Generación de escenarios en tiempo real</span>\r
        <h3>Transformar los flujos de noticias en guías de respuesta para todo el mercado.</h3>\r
        <p>\r
          Acceda a flujos de eventos en tiempo real, extraiga automáticamente entidades, temas, tipos de eventos y rutas de impacto, y genere guiones de respuesta en todo el mercado. El sistema debería generar mercados afectados, señales de confirmación faltantes, estado de riesgo y flujos de trabajo recomendados, y expandir gradualmente la deducción de eventos a simulaciones de mercados mundiales paralelos en lugar de órdenes directas.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Fase 04</span><span class="tag">Verificación y prueba de arco</span>\r
        <h3>Solicite pruebas antes de realizar una apuesta y guárdelas después del razonamiento.</h3>\r
        <p>\r
          Cree una biblioteca de fuentes de datos autorizada para rastrear automáticamente los hechos subyacentes; al mismo tiempo, escriba hashes de rastreo de razonamiento clave en Arc para formar un registro histórico verificable. El objetivo de esta fase es unificar rapidez, autenticidad y auditabilidad.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Fase 05</span><span class="tag">Ejecución delegada de IA</span>\r
        <h3>El usuario opcionalmente delega la ejecución limitada</h3>\r
        <p>\r
          Una vez que maduren los permisos, el presupuesto, el tiempo, el alcance del mercado y los mecanismos de revocación, los usuarios pueden optar por que la IA funcione en condiciones limitadas. En el futuro, los usuarios también pueden designar agentes maduros probados para participar en el proceso de delegación para completar la verificación de datos, la evaluación de riesgos y la liquidación de pago por tiempo asistida por ejecución a través de x402; esta capacidad debe estar desactivada de forma predeterminada y gobernada mediante mecanismos de prueba de arco, auditoría completa, parada de emergencia y vencimiento de permisos.\r
        </p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">17 / Modelo Económico</p>\r
      <h2>Modelo de negocio y captura de valor.</h2>\r
      <h3>17.1 Modelo de ingresos</h3>\r
      <table>\r
        <thead><tr><th>modelo</th><th>ilustrar</th><th>Etapa aplicable</th></tr></thead>\r
        <tbody>\r
          <tr><td>Suscripción Premium</td><td>Actualmente desbloqueando modelos avanzados, razonamiento más profundo, rastreo de razonamiento completo, pruebas de Arc y capacidades de monitoreo con intención de pago de Arc USDC; Ampliable a pago por llamada x402 y paquetes de capacidad basados ​​en la liquidación de Arc en el futuro.</td><td>Fase 1-3</td></tr>\r
          <tr><td>Atribución del constructor</td><td>Los usuarios confirman pedidos reales de Polymarket a través de Causeway y las transacciones se atribuyen mediante el código del constructor.</td><td>Fase 1-5</td></tr>\r
          <tr><td>API de señal</td><td>Proporciona API de señales estructuradas, gráficos de mercado y registros de seguimiento a investigadores, puntos finales y sistemas de políticas.</td><td>Fase 2-4</td></tr>\r
          <tr><td>Espacio de trabajo del equipo</td><td>Proporciona colaboración, permisos, auditoría, informes, presupuestos de riesgos y bibliotecas de políticas para equipos.</td><td>Fase 3-5</td></tr>\r
          <tr><td>Capa de servicio del agente x402</td><td>El futuro permitirá fuentes de datos externas, servicios de validación, agentes profesionales e informes detallados a través de x402 para pagos por acceso y micropagos legibles por máquina.</td><td>Fase 3-5</td></tr>\r
          <tr><td>Informes de predicción de enjambres</td><td>Genere informes de pronóstico profesionales basados ​​en mundos de mercados paralelos y debates entre múltiples agentes, vendidos por mercado, evento o tema.</td><td>Fase 3-5</td></tr>\r
          <tr><td>Mercado de agentes</td><td>El futuro permitirá a los agentes profesionales, fuentes de verificación, plantillas de informes y módulos de políticas llegar a acuerdos con x402 a través de Arc USDC y construir una reputación basada en registros de seguimiento verificables.</td><td>Fase 4-5</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>17.2 Valor del volante</h3>\r
      <p>\r
        Más datos de mercado brindan un mapa de mercado más completo; un mapa más completo mejora la calidad del razonamiento de la IA; el razonamiento de mayor calidad atrae a más usuarios para generar comentarios reales; más retroalimentación forma un historial de señales; los antecedentes verificables mejoran la confianza; la confianza brinda servicios premium, API, equipo, agente x402, informes de predicción de enjambre e ingresos por atribución de constructores; Los ingresos, a su vez, respaldan mejores fuentes de datos, modelos, agentes de verificación, sistemas de simulación de enjambres y sistemas de control de riesgos.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">18 / Foso y KPI</p>\r
      <h2>Fosos, indicadores y conclusiones.</h2>\r
      <h3>18.1 Foso</h3>\r
      <ul>\r
        <li><strong>Comprensión de la estructura del mercado:</strong>Modelado en profundidad de eventos, mercados, tokens de resultados, CLOB y límites de órdenes.</li>\r
        <li><strong>Bucle cerrado de datos de inferencia:</strong>Enlace completo desde la ejecución de la inferencia hasta el guión causal, la intención del pedido, la prueba de arco y el historial.</li>\r
        <li><strong>Capacidades de predicción de inteligencia de enjambre:</strong>Combine la división del trabajo de múltiples agentes, el mundo del mercado paralelo, el árbol de escenarios y el mapa del mercado para formar un informe de pronóstico profesional verificable.</li>\r
        <li><strong>Historia verificable:</strong>La prueba de arco hace que el rendimiento de la señal no sea solo un registro de fondo, sino un objeto auditable.</li>\r
        <li><strong>Límites de gobernanza del usuario:</strong>No toma como núcleo el comercio automático de caja negra, sino que toma como dirección la ejecución inteligente controlable por el usuario.</li>\r
        <li><strong>Entrada de economía inteligente:</strong>Arc USDC premium y la futura capa de servicio del agente x402 proporcionan la base para una liquidación pequeña, frecuente y verificable de capacidades de IA.</li>\r
      </ul>\r
      <h3>18.2 Indicadores básicos</h3>\r
      <table class="kpi">\r
        <tbody>\r
          <tr><td>Cobertura de mercado</td><td>Número de mercados sincronizados, cobertura de mercado activo y precisión del mapeo de tokens de resultados.</td></tr>\r
          <tr><td>Calidad de inferencia</td><td>Tasa de éxito de inferencia, tasa de aprobación de verificación de esquema, relación de señal efectiva, relación sin intercambio.</td></tr>\r
          <tr><td>Calidad de enjambre</td><td>Divergencia de agentes, consenso ponderado de calibración, cobertura de escena, tasa de aciertos de contraejemplos, rendimiento de revisión de informes de predicción.</td></tr>\r
          <tr><td>Embudo de usuario</td><td>Visualización del mercado, inicio de inferencias, guardado de scripts, vista previa de pedidos, confirmación del usuario y transacciones reales.</td></tr>\r
          <tr><td>Adopción a prueba de arco</td><td>Número de generación de pruebas, número de anclajes, tasa de éxito de la verificación, tasa de clics de ArcScan.</td></tr>\r
          <tr><td>Historial de señales</td><td>Cambio de precio después de la señal, precisión final, PnL, tasa de ejecución del usuario, tasa de aciertos de recomendación de salida.</td></tr>\r
          <tr><td>Ciencias económicas</td><td>Tasa de conversión premium, tasa de éxito de pagos en USDC, tiempos de llamadas x402, GMV del servicio del agente, volumen atribuido al constructor, ingresos de API.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>18.3 Conclusión</h3>\r
      <p>\r
        El valor de Causeway no radica en permitir a los usuarios hacer clic en el botón de negociación más rápido, sino en establecer una capa de infraestructura inteligente confiable para los mercados de predicción. Conecta la estructura del mercado, el razonamiento de la IA, la vista previa de riesgos, la confirmación del usuario, la certificación Arc y el seguimiento del desempeño en un circuito cerrado. A corto plazo, permite a los usuarios comprender y ejecutar mejor el mercado Polymarket; a mediano plazo, se convierte en una capa de señal de mercado de predicción verificable; a largo plazo, puede evolucionar hasta convertirse en un motor de predicción de inteligencia de enjambre, simular la propagación de eventos reales en múltiples mercados y generar informes de predicción profesionales.\r
      </p>\r
      <div class="callout">\r
        <strong>Visión final:</strong>\r
        Causeway no es una "herramienta de apuestas automatizada", sino una forma temprana de "un motor de inteligencia colectiva que predice todo": el usuario ingresa un evento, el sistema comprende el mercado, organiza a los agentes, construye un mundo de mercado paralelo, verifica hechos, simula caminos, genera señales, retiene pruebas y el usuario decide si actuar. A largo plazo, Arc es responsable de la base confiable de registro y liquidación, x402 es responsable de la invocación de servicios de agentes inteligentes y Causeway es responsable de la orquestación inteligente de los mercados de predicción.\r
      </div>\r
    </section>\r
\r
    <section>\r
      <p class="eyebrow">19 / Referencias</p>\r
      <h2>Referencias</h2>\r
      <div class="source-list">\r
        <p>1. Wolfers, Justin y Eric Zitzewitz, <em>Mercados de predicción</em>, Revista de Perspectivas Económicas, 2004. https://pubs.aeaweb.org/doi/pdfplus/10.1257/0895330041371321</p>\r
        <p>2. Snowberg, Erik, Justin Wolfers y Eric Zitzewitz, <em>Mercados de predicción para pronósticos económicos</em>, Documento de trabajo NBER 18222, 2012. https://www.nber.org/system/files/working_papers/w18222/w18222.pdf</p>\r
        <p>3. Documento de trabajo del Wharton Rodney L. White Center, investigación de mercados de predicción, 2006. https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0608.pdf</p>\r
        <p>4. Cao, artículo de investigación de mercados de predicción, archivo de la Asociación de Economistas de Nueva Zelanda. https://www.nzae.org.nz/wp-content/uploads/2014/05/Cao.pdf</p>\r
        <p>5. Archivo de artículos del Journal of Prediction Markets, investigación de arbitraje y mercados de predicción. https://www.ubplj.org/index.php/jpm/article/view/1796</p>\r
        <p>6. <em>Comercio de arbitraje en mercados de predicción</em>, archivo de investigación. https://www.researchgate.net/publication/262875038_Arbitrage_trade_in_prediction_markets</p>\r
        <p>7. Preimpresión de arXiv sobre el arbitraje del mercado de predicción moderno y las dependencias semánticas del mercado. https://arxiv.org/pdf/2508.03474.pdf</p>\r
        <p>8. KPMG, <em>Mercados de predicción: caminos de entrada</em>, 2026. https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/prediction-markets-paths-to-entry.pdf</p>\r
        <p>9. CoinDesk, <em>Polymarket resuelve contrato electoral presidencial</em>, 2024. https://www.coindesk.com/markets/2024/11/06/polymarket-resolves-presidential-election-contract</p>\r
        <p>10. Axios, <em>Polymarket recibe una gran inversión de la empresa matriz de la Bolsa de Valores de Nueva York</em>, 2025. https://www.axios.com/2025/10/07/polymarket-new-york-stock-exchange</p>\r
        <p>11. Documentación de polimercado, <em>Descripción general de la API de Gamma Markets</em>. https://docs.polymarket.com/developers/gamma-markets-api/overview</p>\r
        <p>12. Documentación de polimercado, <em>Negociación en Polymarket CLOB</em>. https://docs.polymarket.com/developers/CLOB/trades/trades-data-api</p>\r
        <p>13. Documentación de polimercado, <em>Programa constructor</em>. https://docs.polymarket.com/developers/builders/examples</p>\r
        <p>14. Documentos de arco, <em>Conéctate a Arco</em>. https://docs.arc.io/integrate/connect-to-arc</p>\r
        <p>15. Documentos de arco, <em>Red de arco</em>. https://docs.arc.network/arc-chain</p>\r
        <p>16. Protocolo x402, <em>Protocolo de pago abierto para internet</em>. https://www.x402.org/</p>\r
        <p>17. Plataforma de desarrollo Coinbase, <em>x402</em>. https://www.coinbase.com/developer-platform/products/x402/</p>\r
        <p>18. Documentos de Cloudflare, <em>Agentes x402</em>. https://developers.cloudflare.com/agents/x402/</p>\r
      </div>\r
      <div class="disclaimer">\r
        Copyright © 2026 Causeway. Este documento es un borrador de whitepaper de producto, técnico y económico; no constituye asesoramiento de inversión, asesoramiento legal, servicio de corretaje, promesa de rentabilidad ni opinión regulatoria. Los datos de mercado y la información sectorial mencionados proceden de fuentes públicas y pueden variar según metodología, periodo, definición de plataforma y cambios del mercado. Los usuarios deben formarse su propio criterio y asumir los riesgos relacionados con los mercados de predicción.\r
      </div>\r
    </section>\r
  </body>\r
</html>\r
`,P=`<!doctype html>\r
<html lang="fr">\r
  <head>\r
    <meta charset="utf-8" />\r
    <title>Livre blanc technique et économique de Causeway v0.6 ZH</title>\r
    <style>\r
      @page { size: A4; margin: 13mm 12mm; }\r
      :root {\r
        --ink: #081b33;\r
        --ink-2: #0a2a52;\r
        --blue: #1677ff;\r
        --cyan: #22c7e8;\r
        --green: #14b87a;\r
        --amber: #f59e0b;\r
        --red: #ef4444;\r
        --muted: #53657d;\r
        --line: #d8e6f5;\r
        --soft: #f5faff;\r
        --paper: #ffffff;\r
      }\r
      * { box-sizing: border-box; }\r
      body {\r
        margin: 0;\r
        background: var(--paper);\r
        color: var(--ink);\r
        font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;\r
        font-size: 10pt;\r
        line-height: 1.56;\r
      }\r
      h1, h2, h3, h4, p { margin-top: 0; }\r
      h1 { margin: 0 0 18px; font-size: 42pt; line-height: .96; letter-spacing: 0; }\r
      h2 { margin: 0 0 9px; color: var(--ink); font-size: 18pt; line-height: 1.12; break-after: avoid; }\r
      h3 { margin: 13px 0 5px; color: var(--ink-2); font-size: 11.8pt; line-height: 1.22; break-after: avoid; }\r
      h4 { margin: 10px 0 4px; color: var(--ink); font-size: 10.6pt; line-height: 1.25; }\r
      p { margin-bottom: 6px; }\r
      ul, ol { margin: 5px 0 8px 18px; padding: 0; }\r
      li { margin: 2px 0; }\r
      table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; break-inside: avoid; }\r
      th, td { border: 1px solid var(--line); padding: 5px 6px; text-align: left; vertical-align: top; }\r
      th { background: var(--soft); color: var(--ink); font-weight: 800; }\r
      code { font-family: Consolas, "SFMono-Regular", monospace; font-size: 9.3pt; color: var(--ink-2); }\r
      .cover { min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; position: relative; }\r
      .cover::before {\r
        content: "";\r
        position: absolute;\r
        inset: -13mm -12mm;\r
        z-index: -1;\r
        background:\r
          linear-gradient(rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          linear-gradient(90deg, rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          radial-gradient(circle at 76% 16%, rgba(22, 119, 255, .17), transparent 34%),\r
          radial-gradient(circle at 22% 82%, rgba(34, 199, 232, .12), transparent 30%),\r
          #fff;\r
        background-size: 26px 26px, 26px 26px, auto, auto, auto;\r
      }\r
      .brand img { width: 168px; height: auto; margin-bottom: 46px; }\r
      .eyebrow { margin: 0 0 13px; color: var(--blue); font-size: 8.8pt; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }\r
      .subtitle { max-width: 650px; color: #273b57; font-size: 15.2pt; line-height: 1.56; }\r
      .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 28px; }\r
      .meta-grid div, .callout, .principle, .phase-card, .note, .metric-card, .source-card {\r
        border: 1px solid var(--line);\r
        border-radius: 7px;\r
        background: rgba(245, 250, 255, .82);\r
        padding: 8px;\r
      }\r
      .meta-grid span, .small-label { display: block; color: var(--muted); font-size: 8pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }\r
      .meta-grid b { display: block; margin-top: 4px; font-size: 10.5pt; }\r
      .page { break-after: auto; margin-bottom: 8mm; }\r
      .toc { columns: 2; column-gap: 26px; }\r
      .toc p { break-inside: avoid; border-bottom: 1px solid var(--line); margin: 0 0 7px; padding-bottom: 6px; font-weight: 720; }\r
      .callout { margin: 8px 0 10px; border-left: 4px solid var(--blue); background: #f5faff; }\r
      .callout strong { color: var(--blue); }\r
      .warning { border-left-color: var(--amber); background: #fff8ed; }\r
      .warning strong { color: #a15c00; }\r
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }\r
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }\r
      .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }\r
      .principle, .metric-card { min-height: 88px; break-inside: avoid; }\r
      .principle b, .metric-card b, .note b { display: block; margin: 4px 0 6px; color: var(--ink); font-size: 11.2pt; }\r
      .principle p, .phase-card p, .note p, .metric-card p, .source-card p { margin-bottom: 0; color: #273b57; font-size: 8.9pt; line-height: 1.45; }\r
      .phase-card { break-inside: avoid; margin-bottom: 6px; }\r
      .phase-card h3 { margin-top: 4px; }\r
      .tag {\r
        display: inline-block;\r
        margin: 0 5px 5px 0;\r
        border: 1px solid #bcd7ff;\r
        border-radius: 999px;\r
        background: #eef6ff;\r
        color: var(--blue);\r
        padding: 2px 8px;\r
        font-size: 8pt;\r
        font-weight: 800;\r
      }\r
      .tag.dark { border-color: var(--ink); background: var(--ink); color: #fff; }\r
      .hero-image { overflow: hidden; border: 1px solid rgba(22,119,255,.22); border-radius: 10px; height: 96mm; margin: 14px 0; background: #06162b; }\r
      .hero-image img { width: 100%; height: 100%; object-fit: cover; }\r
      .concept-figure { break-inside: avoid; width: 72%; margin: 9px auto 12px; }\r
      .concept-figure-frame { overflow: hidden; border: 1px solid rgba(22,119,255,.2); border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(8,27,51,.08); }\r
      .concept-figure img { display: block; width: 100%; max-height: 82mm; object-fit: contain; }\r
      .concept-figure .caption { margin: 5px 0 0; line-height: 1.42; }\r
      .caption { color: var(--muted); font-size: 8pt; }\r
      .disclaimer, .footnotes { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 11px; color: var(--muted); font-size: 8.2pt; line-height: 1.52; }\r
      .no-break { break-inside: avoid; }\r
      .source-list p { margin-bottom: 5px; word-break: break-all; }\r
      .kpi td:first-child { width: 24%; font-weight: 800; color: var(--ink-2); }\r
      .formula {\r
        border: 1px solid var(--line);\r
        border-left: 5px solid var(--green);\r
        border-radius: 8px;\r
        background: #f3fff9;\r
        margin: 6px 0 8px;\r
        padding: 7px 9px;\r
        break-inside: avoid;\r
      }\r
      .formula code { display: block; margin: 2px 0; color: #07513a; font-size: 8.8pt; }\r
      .formula p { margin: 4px 0 0; color: #244a3d; font-size: 8.6pt; line-height: 1.42; }\r
    </style>\r
  </head>\r
  <body>\r
    <section class="cover">\r
      <div>\r
        <div class="brand"><img src="../../public/assets/causeway-lockup-primary.svg" alt="Causeway" /></div>\r
        <p class="eyebrow">Livre blanc technique et économique</p>\r
        <h1>Chaussée<br />Livre blanc sur la technologie et l’économie</h1>\r
        <p class="subtitle">\r
          Intelligence commerciale IA et couche de raisonnement vérifiable pour les marchés de prédiction : des données de marché Polymarket, déduction causale, aperçu des risques, au raisonnement vérifiable Arc, à l'économie d'agent natif de l'USDC et au moteur de prédiction d'intelligence en essaim.\r
        </p>\r
        <div class="meta-grid">\r
          <div><span>Version</span><b>v0.6</b></div>\r
          <div><span>Date</span><b>2026-05</b></div>\r
          <div><span>Statut</span><b>Projet détaillé</b></div>\r
          <div><span>Portée</span><b>Marché + Arc</b></div>\r
        </div>\r
      </div>\r
      <div class="disclaimer">\r
        Ce livre blanc est utilisé pour expliquer le jugement de Causeway sur le marché, le positionnement du produit, l'architecture technique, l'intégration d'Arc, le modèle économique, les limites des risques et la future feuille de route. Cet article ne constitue pas des conseils en investissement, des conseils juridiques, des descriptions de services de courtage, des engagements de revenus ou toute forme de sollicitation de trading automatisée. Prédire le marché implique des risques importants et toute transaction réelle doit être activement confirmée par les utilisateurs sur la base de leur propre jugement.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">Table des matières</p>\r
      <h2>Table des matières</h2>\r
      <div class="toc">\r
        <p>01. Résumé exécutif</p>\r
        <p>02. Contexte du marché : le marché de la prédiction entre sur la scène grand public</p>\r
        <p>03. Question centrale : pourquoi les marchés de prédiction existants manquent-ils encore d'une couche intelligente ?</p>\r
        <p>04. Fondation académique et cadre de calcul de la valeur</p>\r
        <p>05. Définition du produit Causeway</p>\r
        <p>06. Quels problèmes avons-nous résolus ?</p>\r
        <p>07. Architecture du système et modèle de données</p>\r
        <p>08. AI Trader Intelligence : de la probabilité à l'aperçu de l'action</p>\r
        <p>09. Arc Proof : enregistrement de raisonnement vérifiable de l'IA</p>\r
        <p>10. Arc USDC Premium : économie intelligente et capacité de paiement</p>\r
        <p>11. Couche de service d'agent x402 : future couche de protocole de service d'agent</p>\r
        <p>12. Moteur de prédiction Swarm : du monde du marché parallèle à tout prédire</p>\r
        <p>13. Flux de travail utilisateur et expérience produit</p>\r
        <p>14. Limites du contrôle des risques, de la gouvernance et de la conformité</p>\r
        <p>15. Problèmes qui doivent être résolus à l'avenir</p>\r
        <p>16. Feuille de route technologique en cinq étapes</p>\r
        <p>17. Modèle économique et capture de valeur</p>\r
        <p>18. Fossés, indicateurs et conclusions</p>\r
        <p>19. Références</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">01 / Résumé exécutif</p>\r
      <h2>Résumé exécutif</h2>\r
      <p>\r
        Causeway est une couche d'intelligence commerciale IA et de raisonnement vérifiable pour les marchés de prédiction. Son jugement fondamental est que les marchés de prédiction évoluent d'« une interface de paris événementiels avec la participation d'un petit nombre d'utilisateurs de crypto » à « une infrastructure probabiliste pour les événements réels, les risques macroéconomiques, les sports, la politique, les événements d'entreprise et les activités en chaîne ». Lorsque le nombre de marchés, le volume des transactions et la complexité des participants augmentent, les utilisateurs n'ont plus seulement besoin d'une page de handicap plus esthétique, mais d'un système intelligent capable de transformer les événements en jugements de marché révisables.\r
      </p>\r
      <p>\r
        Les principales lacunes de l'interface de prévision actuelle du marché sont les suivantes : la relation entre les marchés n'est pas structurée, les jugements émis par l'IA manquent de raisonnements vérifiables et les recommandations de trading manquent de contraintes de risque et de position. Il est difficile pour les utilisateurs de comprendre pourquoi un signal a été généré, quelle en était la base et s'il était correct par la suite. Causeway tente de combler cette lacune : à partir des données de marché de Polymarket, il construit un réseau de marché, génère des scripts causals, génère des probabilités, des limites, des risques et des aperçus, et ancre la trace du raisonnement de l'IA dans Arc Testnet afin que le "raisonnement pré-événement" et les "résultats post-événement" puissent être audités.\r
      </p>\r
      <div class="callout">\r
        <strong>Positionnement en une phrase :</strong>\r
        Causeway transforme les marchés de prédiction en une couche d'intelligence commerciale lisible par l'IA, raisonnée par l'IA, exécutée par l'utilisateur et vérifiable par Arc.\r
      </div>\r
      <p>\r
        Différent des assistants de discussion IA ordinaires, le produit principal de Causeway n'est pas une réponse en langage naturel qui ne peut pas être examinée, mais un objet d'intelligence de marché structuré : marché racine, jeton de résultat racine, marché candidat, avantage causal, estimation de probabilité, probabilité implicite du marché, avantage, recommandations ACHETER/REGARDER/ÉVITER, explication du risque, aperçu de la commande, statut de confirmation de l'utilisateur, hachage de preuve Arc et enregistrements de performances ultérieurs. Par défaut, le système n'héberge pas de fonds pour les utilisateurs, ne contourne pas les signatures des utilisateurs et n'intègre pas les résultats de l'IA dans des conseils d'investissement ; il fournit un ensemble de flux de travail de prédiction du marché explicables, vérifiables et gouvernables.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">02 / Contexte du marché</p>\r
      <h2>Contexte du marché : le marché de la prédiction entre sur la scène grand public</h2>\r
      <h3>2.1 Le volume des échanges et l’attention institutionnelle augmentent rapidement</h3>\r
      <p>\r
        Le marché des prédictions a réalisé sa première sortie à grande échelle au cours du cycle électoral américain de 2024. CoinDesk a rapporté que le volume du contrat de Polymarket pour l’élection présidentielle américaine de 2024 dépassait 3,6 milliards de dollars. Le marché a également attiré pour la première fois le marché des prédictions à l’attention des grands médias et des utilisateurs ordinaires. D’ici 2025, la croissance de l’industrie s’étendra d’événements politiques uniques à davantage de catégories telles que les sports, la macro, la cryptographie, les données économiques, les événements d’entreprise et les événements culturels.\r
      </p>\r
      <p>\r
        Dans un rapport de 2026 sur les prévisions d’entrée sur le marché, KPMG a noté que le volume combiné des transactions de Kalshi et Polymarket dépassera 40 milliards de dollars en 2025, contre environ 9 milliards de dollars en 2024, ce qui représente une croissance annuelle de plus de 400 %. Le rapport mentionne également que le volume mensuel des échanges de Polymarket a dépassé 3 milliards de dollars en octobre 2025. Bien que le calibre des différentes sources de données varie en fonction de la plateforme, de la définition du volume et du calendrier, la direction est la même : le marché de la prédiction est passé de produits expérimentaux à une étape de forte croissance, de forte attention réglementaire et de participation institutionnelle.\r
      </p>\r
      <h3>2.2 Le marché des prédictions passe d’un « lieu de négociation » à une « couche de données probabilistes »</h3>\r
      <p>\r
        L'investissement stratégique dans Polymarket par ICE (la société mère de la Bourse de New York) est une preuve supplémentaire que le marché se concentre non seulement sur les frais de transaction, mais aussi sur les données événementielles elles-mêmes. Axios rapporte qu'ICE a accepté d'investir jusqu'à 2 milliards de dollars dans Polymarket et deviendra un distributeur mondial des données événementielles de Polymarket. Cela signifie que la valeur des marchés de prédiction ne réside pas seulement dans le trading, mais aussi dans leur capacité à convertir l’incertitude du monde réel en données de probabilité observables en temps réel.\r
      </p>\r
      <div class="grid-3">\r
        <div class="metric-card">\r
          <span class="small-label">Signal du marché</span>\r
          <b>Le volume des échanges augmente</b>\r
          <p>Le volume des échanges de la plateforme s'est étendu depuis le sommet du cycle électoral jusqu'aux transactions normales multicatégories, et la profondeur du marché et la structure des utilisateurs sont devenues plus complexes.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Signal institutionnel</span>\r
          <b>Entrée institutionnelle</b>\r
          <p>Les bourses, les maisons de courtage, les plateformes sportives et les sociétés de technologie financière cherchent à entrer sur les marchés de prédiction.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Signal de données</span>\r
          <b>Numérisation des probabilités</b>\r
          <p>La prévision des prix du marché est aujourd’hui réinterprétée comme des données événementielles, et non seulement comme les résultats des paris des utilisateurs.</p>\r
        </div>\r
      </div>\r
      <h3>2.3 Nouvelles contradictions induites par la croissance</h3>\r
      <p>\r
        Après l'expansion du marché, les utilisateurs ne sont plus confrontés à « l'impossibilité de trouver le marché », mais à « l'impossibilité de déterminer quels marchés méritent d'être étudiés, quels prix reflètent l'information, quels marchés connexes sont en retard et quels signaux sont du bruit ». Plus le volume des transactions augmente rapidement, plus des couches intelligentes sont nécessaires pour organiser les relations de marché, interpréter les changements de probabilité, identifier les erreurs de prix, contrôler les risques et constituer des enregistrements reproductibles.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">03 / Problème</p>\r
      <h2>Question centrale : pourquoi les marchés de prédiction existants manquent encore d'une couche d'intelligence</h2>\r
      <h3>3.1 Problème 1 : Le marché est un réseau, mais l'interface est toujours une liste</h3>\r
      <p>\r
        Un événement réel affecte rarement un seul marché. Par exemple, une déclaration de la Réserve fédérale peut affecter simultanément les taux d’intérêt, l’inflation, le dollar américain, les actifs cryptographiques, les indices boursiers, l’or, les récits électoraux et les événements d’entreprise connexes ; une nouvelle sur une blessure sportive peut affecter le résultat, le championnat, les données des joueurs et la probabilité de se qualifier pour le même groupe. Les interfaces traditionnelles sont généralement présentées sous forme de listes de marchés, de pages d'événements et de résultats de recherche, sans représentation structurée de la manière dont les événements se propagent sur les marchés.\r
      </p>\r
      <h3>3.2 Problème 2 : La structure des données du marché est complexe et l'objet de la transaction n'est pas le titre</h3>\r
      <p>\r
        L'objet commercial de Polymarket n'est pas le titre du marché, mais le jeton de résultat. Dans l'API Gamma officielle <code>outcomes</code>、<code>outcomePrices</code> Il existe une relation de mappage d'index avec l'ID de jeton CLOB ; il peut y avoir plusieurs marchés dans le cadre du même événement. Pour les utilisateurs et les systèmes d’IA, si seul le titre ou la copie Oui/Non est compris, il est facile de produire des cartographies incorrectes sur les marchés à résultats multiples, les marchés sportifs, les marchés de gamme et les événements mutuellement exclusifs.\r
      </p>\r
      <h3>3.3 Problème 3 : les recommandations de l'IA manquent de possibilité d'audit</h3>\r
      <p>\r
        Les systèmes d'IA ordinaires peuvent générer des réponses telles que « Il est recommandé d'acheter Oui », mais cette réponse manque souvent d'instantanés d'entrée, de portée du marché candidat, de version d'invite, de version de modèle, de schéma de sortie, de chemin de raisonnement, de contre-exemples et de traçabilité post-événement. La particularité des marchés de prédiction est que les résultats seront vérifiés dans le futur. Si le système ne peut pas prouver qu’un jugement a été émis avant que le résultat ne se produise ou que le raisonnement n’a pas été modifié par la suite, alors la performance du signal manque de base crédible.\r
      </p>\r
      <h3>3.4 Problème 4 : Il existe un conflit entre rapidité et gouvernance</h3>\r
      <p>\r
        L’avantage des marchés événementiels est qu’ils peuvent réagir rapidement, mais être trop rapide peut aussi amplifier les risques de désinformation, d’hallucinations, d’illiquidité et de sur-négociation. Un système professionnel ne peut pas seulement poursuivre l'exécution automatique, mais doit intégrer l'aperçu, le budget, le statut négociable, l'actualisation du carnet d'ordres, la confirmation de l'utilisateur, les enregistrements d'audit et la révocation des autorisations dans le même processus.\r
      </p>\r
      <div class="callout warning">\r
        <strong>Jugement produit :</strong>\r
        La principale concurrence dans la prochaine étape du marché des prédictions n'est pas « qui a plus de pages de marché », mais « qui peut organiser les prix du marché, le raisonnement de l'IA, l'exécution réelle et les enregistrements vérifiables dans une boucle fermée intelligente complète ».\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">04 / Fondation Académique</p>\r
      <h2>Fondation académique et cadre de calcul de la valeur</h2>\r
      <p>\r
        La valeur théorique des marchés de prédiction vient d'un mécanisme simple mais puissant : lorsqu'un contrat paie un montant fixe basé sur le résultat d'un événement, le prix de transaction peut exprimer approximativement le jugement collectif du marché sur la probabilité qu'un événement se produise dans certaines conditions. L'examen des marchés de prédiction par Wolfers et Zitzewitz a souligné que les marchés de prédiction peuvent regrouper des informations dispersées à travers les prix en signaux lisibles ; Snowberg, Wolfers et Zitzewitz ont ensuite appliqué ce mécanisme à des scénarios de prévision économique, expliquant que les prix des contrats événementiels peuvent devenir des expressions probabilistes en temps réel de l'incertitude macro et politique. La valeur de Causeway n'est pas de réinventer le marché de la prédiction, mais d'y ajouter le raisonnement de l'IA, la détection de la cohérence entre les marchés, la correction des frictions d'exécution, la budgétisation des risques et des enregistrements de performances vérifiables basés sur « le prix comme signal probabiliste ».\r
      </p>\r
      <h3>4.1 Le prix est une probabilité, mais pas une vérité inconditionnelle</h3>\r
      <p>\r
        Pour un contrat d'événement binaire, si le contrat rapporte 1 $ lorsque l'événement se produit et 0 $ lorsqu'il ne se produit pas, dans des conditions idéales de neutralité du risque, de faibles coûts de transaction, de liquidité suffisante et de participants pouvant négocier librement, le prix du marché <code>p</code> Cela peut être compris comme une probabilité implicite du marché. Les marchés de prédiction réalistes ne remplissent pas toujours ces conditions : les spreads, les frais, les dérapages, les limites, le bruit de l'information, les tentatives de manipulation, les restrictions réglementaires et les préférences de risque des participants feront s'écarter les prix de la « vraie probabilité ». Par conséquent, Causeway ne considère pas le prix du marché comme une conclusion, mais comme la première couche de signaux observables, qui sont ensuite expliqués conjointement par les cotes équitables de l'IA, la vérification de la source, le contrôle de liquidité et le modèle de risque.\r
      </p>\r
      <div class="formula">\r
        <code>p_mid = (bestBid + bestAsk) / 2</code>\r
        <code>p_exec_yes = ask_yes, p_exec_no = ask_no</code>\r
        <code>q_ai = calibratedForecast(event | marketSnapshot, sourceObjects, reasoningTrace)</code>\r
        <code>rawEdge_mid = q_ai - p_mid</code>\r
        <p><code>p_mid</code> Convient pour afficher les probabilités implicites du marché,<code>p_exec_yes</code> Il s’agit du véritable seuil de probabilité d’exécution pour acheter OUI. Causeway devrait faire la distinction entre la « probabilité de recherche » et la « probabilité de commercialisation » afin d'éviter d'utiliser le prix moyen pour exagérer l'avantage.</p>\r
      </div>\r
      <h3>4.2 La valeur transactionnelle provient des « attentes positives après friction »</h3>\r
      <p>\r
        Ce qui est vraiment précieux pour les utilisateurs, ce n'est pas "l'IA pense que la probabilité est plus élevée", mais "il existe toujours des attentes positives après le prix négociable actuel, les frais de traitement, le dérapage, la profondeur du handicap et la réduction de l'incertitude". C’est également l’élément central sur lequel les recherches sur l’arbitrage de marché prédictif soulignent à plusieurs reprises : les incohérences théoriques des prix ne constituent de véritables opportunités que lorsqu’elles sont exécutables, réglables et toujours positives après déduction des coûts. Causeway divise donc les opportunités en trois niveaux : signal brut, signal négociable et aperçu de l'ordre exécutable.\r
      </p>\r
      <div class="formula">\r
        <code>EV_token_yes = q_ai * 1 + (1 - q_ai) * 0 - ask_yes - cost_per_token</code>\r
        <code>ROI_yes = EV_token_yes / ask_yes</code>\r
        <code>edgeNet = q_ai - ask_yes - feeRate - slippageBps - ruleRiskHaircut - sourceRiskHaircut</code>\r
        <code>BUY only if edgeNet &gt; minEdge, depthAtLimit &gt; targetSize, timeToClose &gt; minWindow</code>\r
        <p>L’avantage net doit être simultanément limité par la probabilité, le coût, la profondeur et les fenêtres temporelles. Si l’une des contraintes est insuffisante, le système doit rétrograder vers WATCH, VERIFY FIRST ou AVOID.</p>\r
      </div>\r
      <h3>4.3 Suggestion de position : utilisez Kelly conservatrice au lieu de parier impulsivement</h3>\r
      <p>\r
        Dans un contrat événementiel, le prix d’achat lui-même est proche de la perte maximale ; la valeur du contrat s'approche de 1 lorsque l'événement se produit et s'approche de 0 lorsqu'il ne se produit pas. La formule de Kelly peut être utilisée comme point de départ théorique pour les recommandations de positions, mais les marchés de prédiction contiennent des erreurs de modèle, des discontinuités de liquidité, des différences d'interprétation des règles et des risques de règlement des événements. Une version actualisée doit donc être utilisée, superposant la capacité du marché, la corrélation du portefeuille et les plafonds budgétaires des utilisateurs. Causeway produit des recommandations budgétaires à risque, et non des engagements en matière de revenus.\r
      </p>\r
      <div class="formula">\r
        <code>q_adj = clamp(0.5 + confidence * (q_ai - 0.5), 0.01, 0.99)</code>\r
        <code>b = (1 - p_exec) / p_exec</code>\r
        <code>kellyFull = (b * q_adj - (1 - q_adj)) / b = (q_adj - p_exec) / (1 - p_exec)</code>\r
        <code>sizeUsd = bankroll * min(max(0, lambda * kellyFull), capMarket, capPortfolio, capCorrelation)</code>\r
        <p><code>q_adj</code> Utiliser la confiance pour réduire la probabilité du modèle à 50 %,<code>lambda</code> Remise pour Kelly fractionnée. Les positions doivent alors être limitées par la capacité du marché, la corrélation du portefeuille, les plafonds de pertes quotidiennes et les budgets des utilisateurs.</p>\r
      </div>\r
      <h3>4.4 Marché complet mutuellement exclusif : identification de l’arbitrage et des risques à partir de la somme des prix</h3>\r
      <p>\r
        Dans un marché à résultats multiples mutuellement exclusif et complet, tel que le vainqueur d'une présidentielle, la propriété d'un championnat, le résultat d'un intervalle, etc., la somme des probabilités réelles de tous les résultats devrait être proche de 1. Les documents d'arbitrage utilisent souvent cette structure pour détecter les incohérences de prix : si la demande totale d'achat de tous les résultats est inférieure à 1, il existe théoriquement une marge bénéficiaire pour « acheter le panier entier » ; si l'offre totale pouvant être vendue est supérieure à 1, il peut y avoir un signal d'arbitrage inversé ou de surévaluation. Cependant, le trading réel doit déterminer si les transactions peuvent être effectuées en même temps, si les ventes à découvert sont autorisées, s'il existe un risque d'annulation/de règlement et si la profondeur du marché est suffisante.\r
      </p>\r
      <div class="formula">\r
        <code>Underround: Σ ask_i + fees + slippage &lt; 1</code>\r
        <code>profitFloor_buyBasket = 1 - Σ ask_i - fees - slippage - settlementRisk</code>\r
        <code>Overround: Σ bid_i - fees - slippage &gt; 1, if sell/short/redeem path exists</code>\r
        <code>executable = profitFloor &gt; 0 and min(depth_i) &gt; targetSize and rules_i are consistent</code>\r
        <p>Causeway ne réduit pas l'arbitrage complet mutuellement exclusif à un problème mathématique, mais l'utilise comme contrôle de cohérence pour le graphique du marché : recherchez d'abord les anomalies de prix, puis vérifiez la profondeur, les règles, les chemins de règlement et d'exécution.</p>\r
      </div>\r
      <h3>4.5 Cohérence sémantique cross-market : du « même événement » à la « carte complète du marché »</h3>\r
      <p>\r
        Modern Polymarket n'est pas un ensemble de marchés isolés, mais un réseau sémantique composé d'événements, d'entités, de fenêtres horaires, de textes de règles et de conditions de résultats. Un marché peut logiquement impliquer un autre marché : par exemple, « le candidat remporte l'élection présidentielle » implique « le candidat a encore une chance de participer aux élections générales après avoir remporté l'investiture de son parti », et une certaine équipe « remporte le championnat » implique que sa probabilité « d'accéder aux finales/éliminatoires » ne devrait pas être inférieure. Si le prix sur le marché sous-jacent est trop supérieur à celui du marché contenu, le système doit le signaler comme étant sémantiquement incohérent ou potentiellement mal évalué. La littérature sur l'arbitrage sémantique et l'arbitrage de marché prédictif fournie par les utilisateurs de Polymarket soutient l'orientation du Market Graph de Causeway : l'avantage de l'IA est de lire le texte des règles, d'identifier les relations implicites et de les transformer en contraintes calculables.\r
      </p>\r
      <div class="formula">\r
        <code>If event B implies event A, then P(B) ≤ P(A)</code>\r
        <code>violation = max(0, p_exec(B) - p_exec(A) - costMargin - ruleRiskMargin)</code>\r
        <code>semanticEdge = violation * relationConfidence * min(liquidityScore_A, liquidityScore_B)</code>\r
        <code>tradeableSemanticEdge = semanticEdge only if both markets share compatible resolution rules</code>\r
        <p>La clé ici n'est pas de laisser le modèle « deviner », mais de faire en sorte que le modèle génère un type de relation vérifiable : implique, mutuellement exclusif, lié, causal, de même source ou sans rapport.</p>\r
      </div>\r
      <h3>4.6 Cas : Comment Causeway transfère la valeur du papier au produit</h3>\r
      <table>\r
        <thead><tr><th>Cas académiques/de marché</th><th>valeur traditionnelle</th><th>L’approche de Causeway en matière de production</th></tr></thead>\r
        <tbody>\r
          <tr><td>marché électoral</td><td>Price regroupe les sondages, les actualités, le jugement des traders et l'appétit pour le risque en cotes en temps réel.</td><td>Cartographiez les candidats, les États, les partis, les nominations, la participation et les événements macroéconomiques dans un graphique de marché pour identifier quels marchés ont déjà reflété l'actualité et quels marchés associés sont à la traîne.</td></tr>\r
          <tr><td>Publications macroéconomiques</td><td>Des événements tels que l'IPC, les taux d'intérêt, l'emploi, la récession, etc. peuvent utiliser les prix contractuels pour former des attentes en temps réel.</td><td>Écrivez l'heure de publication des données, les attentes du consensus, les révisions historiques, les déclarations de la Fed et les réactions des actifs dans l'objet source pour générer une liste d'observations stratégiques « avant les données/après les données ».</td></tr>\r
          <tr><td>Champion sportif/gagnant de l'événement</td><td>La somme des prix des résultats complets mutuellement exclusifs peut être utilisée pour détecter les anomalies de sur-tour, de sous-tour et de handicap.</td><td>Calculez automatiquement les règles sumAsk, sumBid, de profondeur et de règlement pour le même groupe de résultats, offrant ainsi une mise en œuvre plutôt qu'un simple arbitrage théorique.</td></tr>\r
          <tr><td>Arbitrage sémantique polymarché</td><td>Plusieurs marchés portant des titres différents mais des résultats mutuellement implicites peuvent avoir des probabilités incohérentes.</td><td>Utilisez l'IA pour analyser le texte de la règle, établir des bords impliquant/mutuellement exclusifs/corrélés, puis utilisez violationScore pour trier les opportunités potentielles.</td></tr>\r
          <tr><td>Liquidité faible et marchés bruyants</td><td>Les prix peuvent s'écarter des vraies probabilités en raison de petites transactions, de spreads ou d'informations insuffisantes.</td><td>Mettez liquidScore, spreadRisk, sourceRisk et confiance dans signalScore et les opportunités de faible qualité sont automatiquement rétrogradées à WATCH ou AVOID.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>4.7 Évaluation des performances : ne vous contentez pas de regarder PnL</h3>\r
      <p>\r
        Les signaux de l’IA peuvent facilement devenir des examens post-hoc si seuls des cas lucratifs sont présentés. Causeway doit évaluer le modèle avec des mesures d'étalonnage et des fonctions de notation couramment utilisées dans les études de marché prédictives, et pas seulement dans les comptes de résultat. Le score Brier mesure l'erreur quadratique d'une prédiction de probabilité par rapport au résultat réel ; Log Loss pénalise fortement les erreurs de haute confiance ; et le seau d'étalonnage vérifie si "l'IA dit que 70 % des événements se produisent réellement environ 70 % du temps". L’importance d’Arc Proof devient ici très simple : elle permet de verrouiller à l’avance chaque jugement de probabilité, rendant ainsi les évaluations de performances plus crédibles.\r
      </p>\r
      <div class="formula">\r
        <code>Brier_mean = mean((q_ai - y)^2)</code>\r
        <code>LogLoss_mean = mean(-[y * ln(q_ai + eps) + (1 - y) * ln(1 - q_ai + eps)])</code>\r
        <code>CalibrationError = Σ_k n_k / N * |mean(q_ai in bucket k) - mean(y in bucket k)|</code>\r
        <code>signalScore = z(edgeNet) + z(confidence) + z(liquidity) - z(spreadRisk) - z(sourceRisk) - z(correlationRisk)</code>\r
        <p>La valeur à long terme provient d’étalonnages stables et reproductibles, et non d’une seule prédiction. L'enregistrement des signaux de Causeway doit simultanément montrer les performances post-événement en termes de précision, d'étalonnage, de PnL, de retrait, de taux d'exécution et d'opportunités manquées.</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">05 / Définition du produit</p>\r
      <h2>Définitions des produits Causeway</h2>\r
      <p>\r
        Causeway est une couche d'intelligence commerciale pour le marché de prédiction. Il s'adresse aux utilisateurs qui souhaitent comprendre, rechercher et exécuter des opportunités de marché de prévision, en fournissant un flux de travail complet allant des données complètes du marché au raisonnement de l'IA, de l'identification des opportunités de trading à l'exécution de la confirmation de l'utilisateur, de la trace du raisonnement à la preuve d'Arc, du signal unique au suivi des performances.\r
      </p>\r
      <table>\r
        <thead>\r
          <tr><th>Hiérarchie</th><th>Fonction</th><th>valeur utilisateur</th></tr>\r
        </thead>\r
        <tbody>\r
          <tr><td>Base de données du marché</td><td>Synchronisez les événements, les marchés, les résultats, les jetons, les prix, la liquidité, les règles et le statut de Polymarket.</td><td>Laissez l’IA et les utilisateurs comprendre d’abord les véritables objets échangeables.</td></tr>\r
          <tr><td>réseau de marché</td><td>Créez un graphique de marché basé sur des événements, des balises, la sémantique, la corrélation des prix et l'inférence de l'IA.</td><td>Transformez les marchés des listes en réseaux probabilistes consultables.</td></tr>\r
          <tr><td>Moteur d'inférence IA</td><td>Générez des marchés pertinents, des chemins de causalité, des niveaux de confiance et des actions par défaut à partir du résultat racine.</td><td>Convertissez les « idées de marché » en scripts révisables.</td></tr>\r
          <tr><td>Couche d'intelligence transactionnelle</td><td>Calculez les cotes du marché, les cotes équitables de l'IA, l'avantage, le risque, les recommandations de position et ACHETER/REGARDER/ÉVITER.</td><td>Laissez l’IA participer réellement au jugement des transactions au lieu de simplement interpréter le texte.</td></tr>\r
          <tr><td>Couche d’aperçu de commande</td><td>Générez des aperçus d'ordres secs ou réels CLOB, actualisez les marchés, vérifiez les limites et attendez les signatures des utilisateurs.</td><td>Connectez l’inférence à l’exécution réelle tout en préservant les limites de contrôle.</td></tr>\r
          <tr><td>Couche vérifiable d'arc</td><td>Écrivez le hachage de trace de raisonnement dans Arc Testnet et vérifiez que les données d'appel sont cohérentes avec la trace d'origine.</td><td>Prouvez que le dossier de raisonnement existe au préalable, réduisant ainsi les risques de falsification ultérieure.</td></tr>\r
          <tr><td>couche de suivi des performances</td><td>Suivez les signaux, les commandes, les positions, les changements de prix, le PnL et les résultats finaux.</td><td>Un système qui fait passer les capacités de l’IA de la démonstration à l’évaluation durable.</td></tr>\r
        </tbody>\r
      </table>\r
      <p>\r
        Les limites de la chaussée sont tout aussi importantes. Par défaut, le système ne conserve pas les clés privées des utilisateurs, ne contourne pas les signatures des utilisateurs et n'intègre pas les résultats de l'IA dans les conseils d'investissement. L’IA est chargée d’élargir les arguments du marché, d’identifier les voies, de proposer des risques et de générer des aperçus ; les utilisateurs sont responsables de confirmer s'ils doivent agir, dans quelle mesure agir, quand s'arrêter et s'ils doivent ouvrir des ordres limités à l'avenir.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">06 / Ce que nous avons résolu</p>\r
      <h2>Quels problèmes avons-nous résolus ?</h2>\r
      <h3>6.1 Cartographie des données de marché et des jetons de résultats</h3>\r
      <p>\r
        Causeway a clairement fait la distinction entre les « titres de marché » et les « jetons de résultats réels négociables ». Le modèle de données système contient <code>PolymarketEvent</code>、<code>PolymarketMarket</code>、<code>PolymarketOutcome</code>、<code>clobTokenId</code>, prix, meilleure offre, meilleure demande, dernière transaction, spread, volume, liquidité, taille minimale de l'ordre et taille du tick. Cela résout le problème de l'IA ou du marketing frontal qui confond le marketing avec une simple copie Oui/Non.\r
      </p>\r
      <h3>6.2 Du résultat racine au script causal</h3>\r
      <p>\r
        Les utilisateurs peuvent sélectionner un marché racine et un résultat racine, et le système génère une exécution d'inférence d'IA basée sur le marché candidat. Le résultat n’est pas une recommandation d’une seule phrase, mais un résultat structuré contenant des nœuds, des bords, des avertissements, impactDirection, une recommandation de confiance, de raison et de résultat. Le backend le convertit ensuite en script causal, en marché de script et en sélection de résultats de script, permettant aux utilisateurs de les examiner et de les modifier un par un.\r
      </p>\r
      <h3>6.3 Boucle fermée de prévisualisation de la commande et de confirmation de l'utilisateur</h3>\r
      <p>\r
        Distinction des couches d'ordre de Causeway <code>dry_run</code> et <code>real</code> mode d'exécution. Le système peut générer des aperçus de commandes, actualiser les carnets de commandes, vérifier les soldes et les capacités de négociation, préparer les charges utiles de signature EIP-712 et soumettre des commandes réelles via Polymarket CLOB. Lorsque les fonctionnalités réelles ne sont pas disponibles, les protocoles front-end et back-end restent cohérents, empêchant le produit d'interrompre la démonstration et le développement en raison d'une seule dépendance externe.\r
      </p>\r
      <h3>6.4 Attribution du constructeur Polymarket</h3>\r
      <p>\r
        Le programme Polymarket Builder permet aux applications d'ajouter du code de constructeur aux structures de commande afin d'obtenir l'attribution des commandes et les statistiques du classement des constructeurs. La boucle fermée de l'activité de Causeway peut être construite sur « l'IA découvre et explique les opportunités, les utilisateurs conservent le contrôle du portefeuille et confirment personnellement les transactions, et les transactions réelles sont attribuées via le code du constructeur. » Ceci est plus adapté aux scénarios de trading de prédiction sur le marché qu’à un modèle d’abonnement pur.\r
      </p>\r
      <h3>6.5 Preuve de trace du raisonnement sur l'arc</h3>\r
      <p>\r
        L'implémentation actuelle de Causeway inclut déjà le module Arc Proof. Le système peut lire un certain script causal et construire <code>causeway.reasoning_trace.v1</code> La capsule regroupe le hachage d'entrée d'inférence, le hachage de sortie, la version du modèle, la version d'invite, l'instantané du marché, la sélection des résultats et le graphique de script, génère un hachage de trace et l'ancre via les données d'appel de transaction Arc Testnet. Le backend vérifiera le signataire de la transaction, le chainId et les données d'appel pour garantir que les enregistrements de la chaîne sont cohérents avec la trace d'origine.\r
      </p>\r
      <h3>6.6 Paiements des primes Arc USDC</h3>\r
      <p>\r
        Causeway met également en œuvre l'intention de paiement Arc USDC et le droit d'adhésion. Les utilisateurs peuvent payer Arc USDC pour une fonctionnalité premium, et le backend vérifie le montant du paiement, le payeur, le bénéficiaire, l'état de la transaction et la fenêtre horaire en lisant le reçu de transaction Arc et le journal de transfert USDC avant d'activer l'adhésion premium. Ce mécanisme peut être utilisé pour des fonctionnalités telles que des modèles avancés, un raisonnement plus approfondi, des traces de raisonnement plus complètes et la preuve Arc ; à l'avenir, il pourra également être combiné avec les appels de service x402 réglés sur Arc, de sorte que les abonnements des membres, les rapports à la carte, les appels API et le déverrouillage des capacités des agents partagent le même ensemble d'enregistrements de paiement vérifiables.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">07 / Architecture</p>\r
      <h2>Architecture du système et modèle de données</h2>\r
      <h3>7.1 Pile technologique</h3>\r
      <table>\r
        <thead><tr><th>module</th><th>Orientation actuelle de la mise en œuvre</th><th>effet</th></tr></thead>\r
        <tbody>\r
          <tr><td>L'extrémité avant</td><td>React + Vite + RainbowKit + wagmi + viem + React Flow</td><td>Réseau de marché, connexion au portefeuille, graphique d'inférence, aperçu des commandes, panneau Arc Proof.</td></tr>\r
          <tr><td>API</td><td>NestJS + Prisma + PostgreSQL</td><td>Synchronisation du marché, inférence IA, scripts, commandes, portefeuilles, paiements, preuve Arc.</td></tr>\r
          <tr><td>Polymarché</td><td>API Gamma + API CLOB/Data + Relais Builder</td><td>Données de marché, jetons de résultat, carnets de commandes, commandes de signature et attribution du constructeur.</td></tr>\r
          <tr><td>AI</td><td>Invite structurée + schéma de sortie + cache</td><td>Générez des diagrammes de cause à effet, des résultats recommandés, des niveaux de confiance, des risques et des scripts.</td></tr>\r
          <tr><td>Arc</td><td>Arc Testnet + client public/portefeuille viem + vérification des paiements USDC</td><td>Preuve de trace du raisonnement, paiement de la prime, base économique de l'agent.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>7.2 Objets de données</h3>\r
      <p>\r
        Les objets de données de base de Causeway sont conçus autour des « marchés échangeables » et du « raisonnement vérifiable ». L'objet marché est chargé d'exprimer avec précision la structure de Polymarket, l'objet de raisonnement est responsable de l'enregistrement des entrées et des sorties de l'IA, l'objet de script est responsable de la conversion du raisonnement en un plan d'action modifiable par l'utilisateur, l'objet de commande est responsable de la connexion des transactions réelles et l'objet de preuve Arc est chargé de prouver que l'enregistrement de raisonnement existe à un moment précis.\r
      </p>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Objet de marché</span><b>véritable structure du marché</b><p>Contient l'événement, le marché, le résultat, le conditionId, le questionId, le clobTokenId, le prix, la liquidité et les règles.</p></div>\r
        <div class="note"><span class="small-label">Objet d'inférence</span><b>Enregistrement d'inférence IA</b><p>Il s'agit du résultat racine, de l'ensemble des candidats, de la version rapide, du modèle, d'inputJson, de sortieJson, de cacheKey.</p></div>\r
        <div class="note"><span class="small-label">Script causal</span><b>Script d'action modifiable</b><p>Contient graphJson, les marchés de scripts, les sélections de résultats, userAction, orderMode et justification.</p></div>\r
        <div class="note"><span class="small-label">Capsule résistante aux arcs</span><b>preuve d'inférence vérifiable</b><p>Contient le hachage de trace, les données d'appel, le chainId, le txHash, l'URL ArcScan et l'horodatage de l'ancre.</p></div>\r
      </div>\r
      <h3>7.3 Principes architecturaux</h3>\r
      <ul>\r
        <li><strong>Le marché d'abord :</strong>Assurez-vous que la structure du marché, les jetons de résultats et les carnets de commandes sont fiables avant de développer des sources d'informations externes.</li>\r
        <li><strong>IA structurée :</strong>La sortie de l’IA doit être conforme au schéma et ne peut pas simplement renvoyer le langage naturel.</li>\r
        <li><strong>Gouverné par l'homme :</strong>L'IA peut générer des scripts par défaut, mais les utilisateurs peuvent les modifier, les ignorer, les prévisualiser ou les rejeter.</li>\r
        <li><strong>Prêt à l'épreuve :</strong>Les enregistrements de raisonnement clés doivent être hachés, examinés et ancrés pour soutenir l'évaluation des performances après l'événement.</li>\r
        <li><strong>Capacité de repli :</strong>Lorsque les transactions, soldes, paiements ou API externes réels ne sont pas disponibles, le système doit renvoyer un statut de capacité structurée au lieu de planter.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">08 / Intelligence des traders</p>\r
      <h2>AI Trader Intelligence : de la probabilité à l'aperçu de l'action</h2>\r
      <h3>8.1 Les signaux ne doivent pas être simplement « acheter » ou « ne pas acheter »</h3>\r
      <p>\r
        Un système d’intelligence de marché prédictif mature ne devrait pas donner de recommandations commerciales pour tous les marchés. De nombreux marchés devraient faire attention ou éviter : par exemple, il n'y a pas assez d'avantages, une liquidité insuffisante, les spreads sont trop larges, les règles ne sont pas claires, les sources d'informations ne sont pas vérifiées, les utilisateurs ont déjà des expositions fortement corrélées, le marché est sur le point de prendre fin ou la confiance dans l'IA est insuffisante. Aucun commerce recommandé est une compétence en soi car elle démontre un système faisant preuve de retenue et de sensibilisation aux risques.\r
      </p>\r
      <h3>8.2 Objet signal</h3>\r
      <table>\r
        <thead><tr><th>Champ</th><th>illustrer</th></tr></thead>\r
        <tbody>\r
          <tr><td>identifiant du signal</td><td>ID de signal unique pour le suivi et l’évaluation des performances.</td></tr>\r
          <tr><td>cotes du marché</td><td>Le prix du marché implique des probabilités.</td></tr>\r
          <tr><td>aiFairOdds</td><td>L'IA fournit des probabilités équitables basées sur les données du marché, les cheminements de raisonnement et la vérification des sources d'informations.</td></tr>\r
          <tr><td>bord</td><td>La différence entre les cotes équitables de l’IA et les cotes du marché.</td></tr>\r
          <tr><td>confiance</td><td>La confiance du modèle dans le chemin d'inférence et la qualité des données.</td></tr>\r
          <tr><td>recommandation</td><td>ACHETER, REGARDER, ÉVITER et VÉRIFIER D'ABORD.</td></tr>\r
          <tr><td>Niveau de risque</td><td>Faible, Moyen, Élevé, soumis à la liquidité, aux règles, aux sources, à la volatilité et aux expositions associées.</td></tr>\r
          <tr><td>Taille suggérée</td><td>Montant recommandé basé sur un Kelly conservateur, le plafond budgétaire et la capacité du marché.</td></tr>\r
          <tr><td>changerMonesprit</td><td>Quels changements factuels annuleraient les recommandations actuelles.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>8.3 Du diagramme de cause à effet à la recommandation de position</h3>\r
      <p>\r
        Les recommandations de position de Causeway ne doivent pas être des montants fixes, mais doivent être déterminées par une combinaison de facteurs : taille de l'avantage, confiance, profondeur du marché, spread, appétit pour le risque des utilisateurs, corrélation du marché, capitalisation boursière unique et budget global. Le modèle conservateur Kelly peut être utilisé comme cadre de base, mais des facteurs d'actualisation et des limites supérieures doivent être ajoutés pour éviter que le modèle ne parie trop dans des scénarios de forte incertitude.\r
      </p>\r
      <div class="callout">\r
        <strong>Principes conservateurs :</strong>\r
        Les positions recommandées doivent être des « budgets de risque explicables », et non des promesses de rendement. Le système doit clairement afficher la perte maximale, le prix de la transaction, le dérapage, le délai d'expiration et les conditions qui déclenchent la réévaluation.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">09 / Preuve d'arc</p>\r
      <h2>Arc Proof : enregistrements vérifiables du raisonnement de l'IA</h2>\r
      <h3>9.1 Pourquoi le raisonnement nécessite une preuve en chaîne</h3>\r
      <p>\r
        Le cœur des marchés de prédiction est que l’avenir vérifiera les jugements d’aujourd’hui. Par conséquent, la crédibilité d’un signal d’IA ne vient pas seulement du modèle lui-même, mais aussi de « s’il peut prouver qu’il a porté ce jugement avant que le résultat ne se produise ». Si un système peut modifier les traces de raisonnement historiques après la publication des résultats, alors tout enregistrement de précision du signal, de PnL ou de performances manque de base de confiance.\r
      </p>\r
      <p>\r
        Le rôle d'Arc Proof n'est pas de remplacer le lien de trading Polymarket, ni de déplacer les commandes des utilisateurs vers Arc. Polymarket est toujours responsable des transactions de marché et CLOB ; Arc est chargé d'enregistrer le hachage des traces de raisonnement de l'IA en tant que couche d'audit peu coûteuse, rapide et native pour les pièces stables.\r
      </p>\r
      <h3>9.2 Causeway 的 Capsule résistante aux arcs</h3>\r
      <table>\r
        <thead><tr><th>Champ</th><th>signification</th></tr></thead>\r
        <tbody>\r
          <tr><td>schéma</td><td><code>causeway.reasoning_trace.v1</code></td></tr>\r
          <tr><td>scriptId / inferenceRunId</td><td>Scripts et exécutions d'inférence correspondants.</td></tr>\r
          <tr><td>rootMarketId/rootOutcomeId</td><td>Marché racine et résultat racine sélectionnés par l'utilisateur.</td></tr>\r
          <tr><td>inputHash / sortieHash</td><td>Hachage JSON stable des entrées et sorties AI.</td></tr>\r
          <tr><td>modèle / promptVersion / sortieSchemaVersion</td><td>Versions du modèle, de l'invite et du format de sortie.</td></tr>\r
          <tr><td>instantanés du marché</td><td>价格、meilleure offre、meilleure demande、dernière transaction、volume、liquidité、syncedAt。</td></tr>\r
          <tr><td>sélections</td><td>Action IA, action utilisateur, mode de commande, prix limite, taille, montant en USD et raison.</td></tr>\r
          <tr><td>traceHash</td><td>Le hachage de la capsule entière, utilisé comme données d'appel de transaction Arc.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>9.3 Processus de vérification</h3>\r
      <ol>\r
        <li>Le backend lit les scripts utilisateur et les enregistrements d'inférence pour créer une capsule de preuve.</li>\r
        <li>Générer à l'aide d'un hachage JSON stable <code>traceHash</code>。</li>\r
        <li>Le frontal demande à l'utilisateur de passer à Arc Testnet et envoie une transaction avec les données d'appel étant traceHash.</li>\r
        <li>Le backend attend le reçu de la transaction et lit l'entrée de la transaction.</li>\r
        <li>Vérifiez que le signataire est cohérent avec le portefeuille connecté, que le chainId est Arc Testnet et que les données d'appel sont cohérentes avec traceHash.</li>\r
        <li>Écrivez txHash, traceHash, ArcScan URL et AnchoredAt pour auditer les enregistrements.</li>\r
      </ol>\r
      <div class="callout">\r
        <strong>Signification du produit :</strong>\r
        Arc Proof permet à Causeway de montrer que « cet enregistrement d'inférence d'IA existait à un moment donné et n'a pas été réécrit silencieusement par la suite ». C’est la base pour faire confiance aux performances des signaux d’IA sur les marchés de prédiction.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">10/Arc USDC Économie</p>\r
      <h2>Arc USDC Premium : abonnements des membres, paiements vérifiables et économie intelligente</h2>\r
      <p>\r
        La conception native du stablecoin d'Arc convient aux activités économiques intelligentes peu coûteuses, vérifiables et fréquentes. Causeway a actuellement implémenté l'intention de paiement Arc USDC : une fois que l'utilisateur a sélectionné le plan premium, le système génère l'intention de paiement, en spécifiant le chainId, le jeton USDC, le récepteurAddress, le montantMicroUsd et l'heure d'expiration ; une fois que l'utilisateur a terminé le transfert USDC sur Arc, le backend lit le reçu de transaction et le journal de transfert ERC-20 pour vérification, et mappe le résultat du paiement aux droits du membre. Au stade actuel, les abonnements sont principalement utilisés pour débloquer des signaux avancés, des traces d'inférence complètes, des preuves d'arc et des capacités d'analyse de niveau supérieur ; à l'avenir, Causeway pourra également utiliser les appels de service x402 réglés sur Arc pour unifier les abonnements, le paiement à la séance, le déverrouillage de rapports, les appels API et les achats de capacités d'agent dans un cadre de paiement plus précis.\r
      </p>\r
      <h3>10.1 Fonctionnalités Premium actuellement prises en charge</h3>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Signal Premium</span><b>signalisation avancée</b><p>Bénéficiez d’inférences plus approfondies, de modèles de meilleure qualité, d’une confiance plus étroite et d’une portée complète du marché candidat.</p></div>\r
        <div class="note"><span class="small-label">Trace de raisonnement complète</span><b>Piste de raisonnement complète</b><p>Affichez les entrées, les sorties, les marchés candidats, les risques, les contre-exemples et ce qui pourrait me faire changer d'avis.</p></div>\r
        <div class="note"><span class="small-label">Preuve d'arc</span><b>Preuve en chaîne</b><p>Ancrez le hachage de trace de raisonnement à Arc Testnet et affichez les transactions via ArcScan.</p></div>\r
        <div class="note"><span class="small-label">Futur x402</span><b>Appel de service d'agent</b><p>Accès futur au processus x402 facturé sur Arc pour les achats de données, le déverrouillage de rapports, les appels API et les abonnements aux politiques.</p></div>\r
      </div>\r
      <h3>Arc 10.2 : Raisonnement vérifiable et couche de règlement de l’économie des agents</h3>\r
      <p>\r
        La valeur d'Arc pour Causeway n'est pas de remplacer le lien de transaction de Polymarket, mais de fournir une couche économique et d'audit à faible coût, vérifiable et stable, pour les systèmes d'IA de prédiction du marché. Polymarket est responsable de l'appariement du marché, du carnet d'ordres, du règlement des résultats et de l'exécution réelle des transactions ; Causeway est responsable de la compréhension du marché, du raisonnement de l'IA, de la prévisualisation des risques, de la confirmation des utilisateurs et du suivi des signaux ; Arc est adapté pour effectuer des actions auxiliaires qui sont élevées en fréquence, de faible montant, doivent être enregistrées, doivent être vérifiées et sont naturellement tarifées en dollars américains, telles que le dépôt de trace de raisonnement, l'abonnement premium, le déverrouillage de rapports, l'appel API, le règlement du service d'agent intelligent et le paiement futur de la source de données.\r
      </p>\r
      <p>\r
        Pour sa version actuelle, Arc répond d’abord à deux problématiques clés. Premièrement, l’inférence de l’IA nécessite des horodatages vérifiables. Le jugement du marché des prédictions sera vérifié par les résultats futurs. Si le système ne peut pas prouver qu'un certain enregistrement d'inférence a été généré avant que le résultat ne se produise, la crédibilité de l'historique du signal sera considérablement réduite. Causeway écrit le hachage de la trace de raisonnement dans Arc, afin que chaque jugement de l'IA puisse former une capsule de preuve légère. Deuxièmement, les capacités de l’IA nécessitent un chemin de paiement natif pour les pièces stables. Le raisonnement avancé, les pistes de raisonnement complètes, l'analyse des graphiques de marché, les appels API et les services de reporting sont tous adaptés au règlement de petits montants, en temps réel et vérifiable avec l'USDC.\r
      </p>\r
      <p>\r
        À moyen terme, Arc peut aider Causeway à constituer une économie du signal plus complète. Chaque inférence de l'IA peut être considérée comme un actif de signal traçable : elle comprend le temps de génération, l'instantané d'entrée, la version du modèle, le prix du marché, les cotes équitables de l'IA, les bords, les explications des risques, les actions de l'utilisateur et les résultats finaux. Si ces signaux s'accumulent au fil du temps et que les hachages de clés sont ancrés à Arc, Causeway peut établir un enregistrement de suivi de signal fiable. À l’avenir, les utilisateurs n’achèteront pas une seule fois une réponse IA, mais s’abonneront à des stratégies, des rapports, des cartes de marché, des sources de données et des capacités d’agents professionnels éprouvés.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">Couche de service d'agent 11/x402</p>\r
      <h2>Couche de service d'agent x402 : future couche de protocole de service d'agent</h2>\r
      <p>\r
        x402 ne doit pas être positionné comme un protocole d'exécution de transactions dans Causeway, mais comme un protocole d'invocation de service d'agent et de micropaiement. Sa valeur réside dans le fait de permettre aux agents d'IA, aux API externes, aux sources de données et aux services d'analyse professionnels d'effectuer des règlements à la carte via des demandes de paiement lisibles par machine. Pour Causeway, x402 peut devenir la future couche de service d'agent : Arc fournit des enregistrements vérifiables et un environnement de règlement stable, x402 fournit des processus d'accès et de paiement de l'agent au service, et Causeway est responsable de l'orchestration de la carte du marché, de la gouvernance des autorités, du contrôle des risques, de la prévisualisation des commandes et du suivi des performances.\r
      </p>\r
      <h3>11.1 Sources de données payantes, validation et reporting</h3>\r
      <p>\r
        Causeway aura besoin à l'avenir de flux d'actualités, de données sportives, de données macro, de données en chaîne, d'annonces réglementaires, d'annonces d'entreprises, de données de cotes et de vérification de la source originale. De nombreuses données ne conviennent pas aux abonnements mensuels fixes, mais conviennent mieux aux appels à la demande lorsque l'inférence de l'IA en a besoin : vérification d'une publication de l'IPC, achat de données sur les blessures de l'équipe, demande d'analyse des flux de capitaux en chaîne, vérification de la source d'origine des informations et génération d'un rapport sur les différences entre les règles du marché. x402 peut transformer ces appels en comportements de paiement instantanés, précis et vérifiables, plutôt que de s'appuyer sur des clés API manuelles, des points centralisés ou un règlement hors ligne.\r
      </p>\r
      <h3>11.2 Marché de l’intelligence professionnelle</h3>\r
      <p>\r
        Lorsque Causeway évolue d'un outil de raisonnement d'IA unique à un système de prédiction multi-agents, le système peut introduire des agents professionnels externes : agent de recherche macro, agent de blessures sportives, agent de presse politique, agent de flux de capitaux en chaîne, agent d'arbitrage de handicap, agent de vérification de source, agent de risque et gardien d'exécution. Chaque agent peut se forger une réputation grâce à des antécédents à long terme, des capacités d'étalonnage, des performances historiques en termes de rendement et de risque, une vitesse de réponse, une couverture de sources de données et des enregistrements à l'épreuve des arcs. x402 peut être responsable du contrôle d'accès et du paiement au temps de chaque appel de service.\r
      </p>\r
      <h3>11.3 Marché des signaux et monétisation des API</h3>\r
      <p>\r
        À l'avenir, Causeway pourra exposer des signaux de haute qualité, des graphiques de marché, des rapports sur les risques, des marchés associés, des analyses d'arbitrage sémantique et le statut de preuve Arc en tant qu'API payantes pour des applications ou des agents externes. Les appelants ne sont pas tenus d’être membres à part entière et peuvent acheter des fonctionnalités spécifiques sur demande. Arc enregistre la preuve, le paiement et la réputation, x402 gère l'accès payant et Causeway affiche les performances du signal et les résultats d'étalonnage. Ainsi, les revenus de Causeway ne proviennent pas uniquement des abonnements, mais également d'un réseau de services intelligents composables.\r
      </p>\r
      <h3>11.4 La forme à long terme du trading limité sur commission de l’IA</h3>\r
      <p>\r
        À un stade plus avancé, les utilisateurs peuvent désigner des agents éprouvés et matures pour participer au processus automatisé de transaction commandé par l’IA. Cependant, x402 lui-même n'assume pas de responsabilités en matière de conservation des actifs, d'autorisation des transactions ou de contrôle des risques ; il est responsable de l’invocation du service d’agent intelligent et de la couche de micropaiement. Les véritables transactions commandées doivent être superposées par Causeway avec des limites d'autorité : catégories de marché autorisées pour la négociation, montant maximum d'une transaction unique, limite de perte quotidienne, exposition pertinente maximale, EdgeNet minimum, liquidité minimale, glissement maximum, étapes de vérification nécessaires, délai d'expiration, arrêt d'urgence et autorisation révocable. Chaque appel de données, génération d'inférence, demande de vérification, aperçu d'ordre ou exécution de transaction doit laisser une preuve d'arc et un enregistrement de suivi de signal.\r
      </p>\r
      <div class="callout">\r
        <strong>Positionnement futur :</strong>\r
        Arc est une preuve, un enregistrement de paiement et un substrat de réputation ;\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">12/ Moteur de prédiction d’essaims</p>\r
      <h2>Moteur de prédiction Swarm : d'un monde de marché parallèle à tout prédire</h2>\r
      <p>\r
        L’objectif à long terme de Causeway n’est pas de laisser une seule IA porter un jugement unique sur un marché, mais de créer un moteur de prédiction intelligent de groupe pour les marchés de prédiction. Notre jugement est que la prédiction d’événements complexes ne devrait pas s’appuyer sur un raisonnement à chemin unique, mais devrait partir des informations initiales du monde réel et construire un monde de marché parallèle évolutif, permettant à plusieurs agents intelligents avec des rôles, des mémoires, des positions et une logique comportementale différents d’interagir, de diverger, de réfuter, de réviser et de générer des prédictions. Causeway limitera cette déduction de l'intelligence en essaim à un « réseau de marché de prédiction négociable, vérifiable et réglable » afin que les résultats de simulation puissent non seulement former des rapports narratifs, mais également être convertis en cotes de marché, cotes équitables de l'IA, edgeNet, budgets de risque, aperçus de commandes, preuve d'arc et enregistrement de signal.\r
      </p>\r
      <h3>12.1 De l'inférence d'un modèle unique à la prédiction de l'intelligence en essaim</h3>\r
      <p>\r
        Un modèle unique convient pour générer des jugements initiaux, mais le monde complexe est souvent déterminé par de multiples agents, de multiples motivations, de multiples retards d’information et de multiples réactions du marché. Des données macro, une blessure sportive, une annonce réglementaire, un événement en chaîne ou une actualité politique peuvent affecter simultanément plusieurs entités, plusieurs fenêtres temporelles et plusieurs marchés de prédiction interconnectés. L’intérêt du moteur de prédiction de l’intelligence par essaim est de permettre à plusieurs agents de jouer les rôles de recherche, de suspicion, de vérification, de tarification, de contrôle des risques et d’exécution, et d’effectuer plusieurs séries de déductions sur la même carte du marché, réduisant ainsi les biais à chemin unique et l’excès de confiance.\r
      </p>\r
      <figure class="concept-figure">\r
        <div class="concept-figure-frame">\r
          <img src="../../public/assets/causeway-swarm-prediction-engine-concept.png" alt="Schéma conceptuel du moteur de prédiction par intelligence collective de Causeway" />\r
        </div>\r
        <figcaption class="caption">Figure 12-1 : Diagramme conceptuel du moteur de prédiction de l’intelligence des essaims de Causeway. Une fois que les événements du monde réel sont entrés dans le monde du marché parallèle, les agents multi-rôles, les cartes de marché, Arc Proof, le service d'agent x402 et Signal Track Record forment conjointement une boucle fermée de prédiction vérifiable.</figcaption>\r
      </figure>\r
      <h3>12.2 Monde de marché parallèle</h3>\r
      <p>\r
        Causeway peut transformer un événement réel en plusieurs mondes de marché parallèles. Chaque monde contient des hypothèses différentes : si l'événement est réel, si la source est fiable, à quelle vitesse il se propage, si le marché l'a reflété, si le marché concerné est en retard, si la liquidité est suffisante et s'il y a une ambiguïté dans les règles. Le système ne se contente pas de demander « cet événement se produira-t-il ? mais demande "si cet événement se produit, comment passera-t-il à travers le réseau de marché, quelles cotes seront modifiées, quels bords seront créés, quels risques seront déclenchés et quels enregistrements vérifiables seront laissés derrière". Ce monde de marché parallèle est le jugement principal de Causeway sur les futurs systèmes de prévision : la prévision ne doit pas seulement répondre « si quelque chose va se produire », mais doit simuler la façon dont les événements se propagent sur plusieurs marchés, plusieurs participants, plusieurs sources d'informations et plusieurs fenêtres temporelles, et transformer ce processus de propagation en objets d'intelligence de marché auditables, calculables et vérifiables.\r
      </p>\r
      <h3>12.3 Société d'agents : collaboration d'agents multi-rôles</h3>\r
      <table>\r
        <thead><tr><th>rôle d'agent</th><th>Responsabilités</th><th>objet de sortie</th></tr></thead>\r
        <tbody>\r
          <tr><td>Agent de recherche</td><td>Recueillez les événements, les marchés, les cas historiques et le contexte.</td><td>sourceObjects、résumé de l'événement、candidats du marché。</td></tr>\r
          <tr><td>Agent de graphique de marché</td><td>Recherchez les marchés connexes, les implications sémantiques, les relations mutuellement exclusives et les expositions associées.</td><td>graphique du marché, type de relation, direction de l'impact.</td></tr>\r
          <tr><td>Agent de probabilité</td><td>Les estimations de probabilité sont données sur la base de scénarios et de preuves.</td><td>AI cotes équitables, changement de probabilité, confiance.</td></tr>\r
          <tr><td>Agent sceptique</td><td>Recherchez des contre-exemples, des ambiguïtés dans les règles, de fausses sources et des inférences excessives.</td><td>contre-arguments、changeMyMind、indicateurs de risque。</td></tr>\r
          <tr><td>Agent de vérification</td><td>Remontez aux faits sous-jacents et aux sources faisant autorité.</td><td>état de vérification, confiance de la source, rapport de conflit.</td></tr>\r
          <tr><td>Agent de risque</td><td>Calculez la liquidité, les spreads, le slippage, les corrélations et les limites de position.</td><td>edgeNet, budget de risque, plafond de position.</td></tr>\r
          <tr><td>Garde d'exécution</td><td>Déterminez s’il faut autoriser la prévisualisation des ordres ou l’exécution des commissions.</td><td>ACHETER/REGARDER/ÉVITER、porte d'aperçu de la commande、arrêt d'urgence。</td></tr>\r
          <tr><td>Agent de signalement</td><td>Convertissez les désaccords et les conclusions multi-agents en rapports lisibles.</td><td>rapport de prédiction, arbre de scénario, résumé d'audit.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>12.4 Des rapports de simulation au trading d'objets intelligents</h3>\r
      <p>\r
        Les résultats de l’intelligence en essaim ne peuvent pas s’arrêter aux rapports en langage naturel. Causeway doit compresser les résultats de la simulation en objets intelligents de trading structurés : arbre de scénarios, marchés concernés, bords de relation, changement de probabilité, cotes équitables de l'IA, cotes du marché, edgeNet, action recommandée, indicateurs de risque, taille suggérée, hachage de preuve d'arc et entrée d'historique. De cette manière, l’intelligence par essaim peut servir à la fois à la recherche et à l’examen, à la vérification et à la confirmation des utilisateurs avant les transactions réelles.\r
      </p>\r
      <div class="formula">\r
        <code>scenarioValue_s = Σ_i edgeNet_i,s * tradability_i,s * confidence_s - portfolioRisk_s</code>\r
        <code>swarmConsensus = weightedMedian(q_agent_1, q_agent_2, ..., q_agent_n; weights = reputation * calibration)</code>\r
        <code>disagreementRisk = variance(q_agent_1 ... q_agent_n) + sourceConflict + ruleAmbiguity</code>\r
        <code>finalAction = gate(swarmConsensus, edgeNet, disagreementRisk, liquidity, userPolicy)</code>\r
        <p>Plutôt que de simplement voter, l'intelligence par essaim combine les enregistrements d'étalonnage, la qualité de la source, le degré de désaccord et l'applicabilité sur le marché des différents agents en recommandations d'action soumises au contrôle des risques.</p>\r
      </div>\r
      <h3>12.5 Relation avec Arc et x402</h3>\r
      <p>\r
        Le moteur de prédiction Swarm nécessite des enregistrements vérifiables et des paiements composables. Arc peut enregistrer le hachage de chaque simulation, inférence, signal et résultat, de sorte que l'intelligence en essaim ne soit pas une histoire emballée après coup ; x402 peut fournir un paiement par appel et un micro-paiement pour des sources de données externes, des services de vérification, des agents professionnels et des rapports approfondis ; Causeway est responsable de l'orchestration de ces capacités, de la cartographie des résultats des agents avec les objets de marché de prédiction, les limites de contrôle des risques, les aperçus des commandes et les processus de gouvernance des utilisateurs. À long terme, Arc est la base d'enregistrement et de règlement fiable, x402 est le protocole d'invocation de service d'agent intelligent et Swarm Prediction Engine est la couche intelligente permettant de déduire les changements mondiaux.\r
      </p>\r
      <h3>12.6 Vision à long terme : tout prévoir mais maintenir la gouvernance des utilisateurs</h3>\r
      <p>\r
        Ce que Causeway appelle « tout prédire » n'est pas pour permettre à l'IA de placer des paris automatiques illimités, mais pour permettre aux utilisateurs de saisir un événement réel. Le système peut comprendre le marché, organiser les agents, construire un monde de marché parallèle, vérifier les faits, simuler les chemins de propagation, générer des signaux négociables, conserver des preuves et laisser l'utilisateur décider d'agir ou non. À l’avenir, lorsque les capacités des agents, le système de réputation et le mécanisme d’autorisation seront suffisamment matures, les utilisateurs pourront choisir de déléguer une partie du processus à des agents vérifiés ; mais les limites par défaut devraient toujours être la gouvernance des utilisateurs, les autorisations révocables, des budgets clairs et un audit complet.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">13 / Flux de travail</p>\r
      <h2>Flux de travail utilisateur et expérience produit</h2>\r
      <h3>13.1 Procédures standards</h3>\r
      <ol>\r
        <li>Les utilisateurs connectent le portefeuille et entrent dans le réseau de marché.</li>\r
        <li>Le système affiche les événements, les marchés, les résultats, les prix, les volumes et les marchés associés de Polymarket.</li>\r
        <li>L'utilisateur sélectionne un résultat racine comme point de départ de l'inférence.</li>\r
        <li>Le système rappelle les marchés candidats et construit une saisie rapide par l'IA.</li>\r
        <li>L'IA génère des diagrammes de cause à effet, des recommandations de résultats, des avertissements et de la confiance.</li>\r
        <li>Le système génère des scripts causals et les utilisateurs les examinent, les modifient ou les ignorent un par un.</li>\r
        <li>Les utilisateurs accèdent à l'aperçu de la commande et vérifient le carnet de commandes, le montant, la perte maximale, le bénéfice estimé et l'état de la capacité.</li>\r
        <li>Soumission d’un essai à sec ou d’une véritable signature CLOB après confirmation de l’utilisateur.</li>\r
        <li>Les utilisateurs peuvent ancrer les traces de raisonnement à Arc Testnet.</li>\r
        <li>Le système suit les modifications de prix, l'état des commandes, le PnL et les résultats finaux dans le Signal Track Record.</li>\r
      </ol>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">14/ Gouvernance</p>\r
      <h2>Limites du contrôle des risques, de la gouvernance et de la conformité</h2>\r
      <h3>14.1 Matrice de contrôle des risques</h3>\r
      <table>\r
        <thead><tr><th>catégorie de risque</th><th>questions spécifiques</th><th>Méthode de contrôle</th></tr></thead>\r
        <tbody>\r
          <tr><td>Risque lié aux données</td><td>Retards dans les données de marché, erreurs de cartographie des résultats, indisponibilité du carnet d’ordres.</td><td>Temps de synchronisation, vérification du tokenId, actualisation en temps réel, repli des capacités.</td></tr>\r
          <tr><td>risque informationnel</td><td>Erreurs journalistiques, rumeurs sur les réseaux sociaux, interprétation erronée de sources secondaires.</td><td>Objet source, bibliothèque source faisant autorité, détection de conflits, score de fraîcheur.</td></tr>\r
          <tr><td>risque de raisonnement</td><td>Hallucinations de l’IA, excès de confiance, contre-exemples manquants.</td><td>Contraintes définies par le candidat, vérification structurée, agent sceptique, seuil de confiance.</td></tr>\r
          <tr><td>risque de marché</td><td>Spreads excessifs, liquidité insuffisante et expositions liées au marché mutuellement exclusives.</td><td>Profondeur du handicap, positions conservatrices, contrôle des risques du portefeuille au niveau des événements et statut No Trade.</td></tr>\r
          <tr><td>risque d'exécution</td><td>Les utilisateurs se connectent par erreur, soumettent des commandes en double et les commandes expirent.</td><td>Expiration de l'aperçu, clé d'idempotence, confirmation avant signature, réécriture du statut de soumission.</td></tr>\r
          <tr><td>risque d'audit</td><td>Les enregistrements de signaux ne peuvent pas prouver une existence antérieure.</td><td>Preuve d'arc, hachage, événement d'audit, enregistrement du signal.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>14.2 Limites par défaut</h3>\r
      <ul>\r
        <li>Les résultats de l’IA ne constituent pas un conseil en investissement.</li>\r
        <li>Le système ne garantit pas l'exactitude des prévisions, des bénéfices ou des résultats du marché.</li>\r
        <li>Le mode par défaut est la confirmation de l'utilisateur plutôt que le placement automatique de la commande.</li>\r
        <li>L’exécution déléguée devra être mise en œuvre à l’avenir avec une autorisation explicite, des budgets clairs, des limites de portée et des mécanismes de révocation.</li>\r
        <li>Le trading en direct, le trading simulé et les signaux non exécutés doivent être clairement distingués dans l'interface utilisateur et les données.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">15 / Problèmes futurs</p>\r
      <h2>Problèmes qui doivent être résolus à l'avenir et comment nous pouvons les résoudre</h2>\r
      <h3>15.1 Problème : temps réel et authenticité insuffisants des sources d'informations externes</h3>\r
      <p>\r
        L’étape actuelle repose en grande partie sur les données du marché et sur des ensembles de candidats contrôlés. Dans la phase suivante, Causeway doit accéder aux flux d'informations en temps réel, aux annonces officielles, aux événements en chaîne, aux données sportives et aux documents réglementaires. Mais plus il y a de sources d’informations externes, plus le bruit est grand. La solution est la standardisation de l'objet source : divisez chaque élément d'information en revendication, origine, horodatage, entités, rawPayload et confiance, et entrez dans le flux de travail via une bibliothèque source faisant autorité et la détection des conflits.\r
      </p>\r
      <h3>15.2 Problème : le raisonnement sur un modèle unique ne peut pas couvrir le monde complexe</h3>\r
      <p>\r
        Un modèle unique est sujet à une voie unique et à une surdétermination. La solution à long terme de Causeway est le raisonnement multi-agents et le moteur de prédiction Swarm : l'agent de recherche est responsable de la collecte du contexte du marché et des événements, l'agent de probabilité donne des estimations de probabilité, l'agent sceptique recherche des contre-exemples, l'agent de vérification vérifie les sources, l'agent de risque détermine la liquidité et les positions, et Execution Guard détermine s'il convient d'autoriser l'accès à l'aperçu. Le multi-agent ne consiste pas à montrer des compétences, mais à rendre explicites les désaccords, les hypothèses, la qualité des preuves et les risques, et à cartographier l'évolution multivoie d'un monde complexe en plans de réponse du marché révisables.\r
      </p>\r
      <h3>15.3 Problème : la performance du signal ne peut pas être prouvée en permanence</h3>\r
      <p>\r
        Sans antécédents à long terme, les recommandations de l’IA peuvent facilement rester affichées à court terme. Causeway doit enregistrer le temps de génération, le prix du marché, les cotes équitables de l'IA, l'avantage, la direction recommandée, si l'utilisateur exécute, le prix d'exécution, le prix actuel, les profits et pertes non réalisés, le résultat final et la preuve d'arc pour chaque signal. Ce n’est qu’à ce moment-là que le système pourra répondre « si l’IA fonctionne vraiment ? »\r
      </p>\r
      <h3>15.4 Problème : L'exécution automatisée nécessite une gouvernance plus forte</h3>\r
      <p>\r
        La cinquième étape de l’exécution déléguée ne consiste pas à permettre à l’IA de contrôler les comptes sans restrictions, mais à permettre aux utilisateurs d’autoriser de manière sélective selon des règles claires. L'autorisation doit contenir la catégorie de marché, le montant unique maximum, la limite de perte quotidienne, l'exposition maximale pertinente, les sources de données acceptables, la fenêtre temporelle, les conditions de révocation et l'arrêt d'urgence. À l'avenir, si les utilisateurs désignent des agents matures pour participer au processus automatisé, x402 pourra être responsable de l'appel de service d'agent et du micropaiement, Arc pourra être responsable de la certification et de l'enregistrement, et Causeway pourra être responsable de la gouvernance des autorités et du contrôle des risques. Les transactions réelles doivent toujours être conformes à l'autorisation de l'utilisateur et aux limites révocables.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">16 / Feuille de route</p>\r
      <h2>Feuille de route technologique en cinq étapes</h2>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 01</span><span class="tag">Fondation de données de marché</span>\r
        <h3>Comprendre le marché d'abord, puis comprendre le monde</h3>\r
        <p>\r
          La première phase se concentre sur les données du marché Polymarket : événement, marché, résultat, tokenId, prix, volume, liquidité, carnet d'ordres, règles et statut. L'objectif est de permettre au système d'exprimer de manière stable des structures négociables réelles et d'aider les utilisateurs à sélectionner le résultat racine sur la page de détails du marché pour saisir l'inférence.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 02</span><span class="tag">Modèle de raisonnement</span>\r
        <h3>Cartographier un événement sur tous les marchés pertinents</h3>\r
        <p>\r
          Créez des modèles d'inférence plus solides pour fournir pertinence, orientation, confiance, négociabilité et recommandations pour les marchés pertinents. Présentation de BUY / WATCH / AVOID, What Could Change My Mind, des recommandations de position conservatrices et une vérification des divergences multi-agents pour que l'IA ressemble davantage à une équipe de recherche commerciale et moins à un chatbot.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 03</span><span class="tag">Génération de scénarios en temps réel</span>\r
        <h3>Transformez les flux d’informations en manuels de réponse à l’échelle du marché</h3>\r
        <p>\r
          Accédez aux flux d'événements en temps réel, extrayez automatiquement les entités, les sujets, les types d'événements et les chemins d'impact, et générez des scripts de réponse sur l'ensemble du marché. Le système devrait afficher les marchés concernés, les signaux de confirmation manquants, le statut de risque et les flux de travail recommandés, et étendre progressivement la déduction des événements à des simulations de marchés parallèles plutôt qu'à des ordres directs.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 04</span><span class="tag">Vérification et preuve d'arc</span>\r
        <h3>Demandez des preuves avant de placer un pari et conservez les preuves après raisonnement.</h3>\r
        <p>\r
          Créez une bibliothèque de sources de données faisant autorité pour retracer automatiquement les faits sous-jacents ; en même temps, écrivez les hachages de traces de raisonnement clés dans Arc pour former un enregistrement historique vérifiable. L’objectif de cette phase est d’unifier rapidité, authenticité et auditabilité.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 05</span><span class="tag">Exécution déléguée de l'IA</span>\r
        <h3>L'utilisateur délègue éventuellement une exécution limitée</h3>\r
        <p>\r
          Une fois que les autorisations, le budget, le temps, la portée du marché et les mécanismes de révocation sont arrivés à maturité, les utilisateurs peuvent choisir de faire fonctionner l'IA dans des conditions limitées. À l'avenir, les utilisateurs pourront également désigner des agents expérimentés et expérimentés pour participer au processus de délégation afin de compléter la vérification des données, l'évaluation des risques et le règlement au paiement au temps assisté par exécution via x402 ; cette fonctionnalité doit être désactivée par défaut et régie par des mécanismes de preuve Arc, d'audit complet, d'arrêt d'urgence et d'expiration des autorisations.\r
        </p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">17/ Modèle économique</p>\r
      <h2>Modèle économique et capture de valeur</h2>\r
      <h3>17.1 Modèle de revenus</h3>\r
      <table>\r
        <thead><tr><th>modèle</th><th>illustrer</th><th>Étape applicable</th></tr></thead>\r
        <tbody>\r
          <tr><td>Abonnement Premium</td><td>Déverrouillage actuel de modèles avancés, d'un raisonnement plus approfondi, d'une trace complète du raisonnement, de capacités de preuve et de surveillance Arc avec l'intention de paiement Arc USDC ; extensible au paiement par appel x402 et aux packages de fonctionnalités basés sur le règlement Arc à l'avenir.</td><td>Phases 1 à 3</td></tr>\r
          <tr><td>Attribution du constructeur</td><td>Les utilisateurs confirment les commandes réelles de Polymarket via Causeway et les transactions sont attribuées via le code du constructeur.</td><td>Phases 1 à 5</td></tr>\r
          <tr><td>API de signaux</td><td>Fournit des API de signaux structurés, de graphiques de marché et d’historique aux chercheurs, aux points finaux et aux systèmes politiques.</td><td>Phases 2-4</td></tr>\r
          <tr><td>Espace de travail d'équipe</td><td>Fournit des bibliothèques de collaboration, d'autorisations, d'audit, de reporting, de budgétisation des risques et de politiques aux équipes.</td><td>Phases 3 à 5</td></tr>\r
          <tr><td>Couche de service de l'agent x402</td><td>L’avenir permettra des sources de données externes, des services de validation, des agents professionnels et des rapports approfondis via x402 pour un paiement par accès et des micropaiements lisibles par machine.</td><td>Phases 3 à 5</td></tr>\r
          <tr><td>Rapports de prévision d’essaims</td><td>Générez des rapports prévisionnels professionnels basés sur des mondes de marché parallèles et des débats multi-agents, vendus par marché, événement ou thème.</td><td>Phases 3 à 5</td></tr>\r
          <tr><td>Marché des agents</td><td>L'avenir permettra aux agents professionnels, aux sources de vérification, aux modèles de reporting et aux modules de politique de s'installer avec x402 via Arc USDC et de bâtir une réputation basée sur des antécédents vérifiables.</td><td>Phases 4-5</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>17.2 Volant de valeur</h3>\r
      <p>\r
        Plus de données de marché apportent une carte de marché plus complète ; une carte plus complète améliore la qualité du raisonnement de l’IA ; un raisonnement de meilleure qualité attire davantage d’utilisateurs pour générer de véritables commentaires ; plus de retours constituent un historique de signal ; des antécédents vérifiables améliorent la confiance ; la confiance apporte des services premium, API, d'équipe, d'agent x402, des rapports de prévision d'essaim et des revenus d'attribution de constructeur ; les revenus soutiennent à leur tour de meilleures sources de données, modèles, agents de vérification, systèmes de simulation d’essaims et systèmes de contrôle des risques.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">18 / Douves & KPI</p>\r
      <h2>Fossés, indicateurs et conclusions</h2>\r
      <h3>18.1 Douves</h3>\r
      <ul>\r
        <li><strong>Compréhension de la structure du marché :</strong>Modélisation approfondie des événements, des marchés, des jetons de résultat, des CLOB et des limites d'ordres.</li>\r
        <li><strong>Boucle fermée de données d'inférence :</strong>Lien complet entre l'exécution d'inférence et le script causal, l'intention de commande, la preuve Arc et les antécédents.</li>\r
        <li><strong>Capacités de prédiction de l’intelligence en essaim :</strong>Combinez la division du travail multi-agents, le monde du marché parallèle, l’arbre de scénarios et la carte du marché pour former un rapport prévisionnel professionnel vérifiable.</li>\r
        <li><strong>Historique vérifiable :</strong>La preuve d'arc fait de la performance du signal non seulement un enregistrement de fond, mais un objet vérifiable.</li>\r
        <li><strong>Limites de gouvernance des utilisateurs :</strong>Il ne prend pas comme noyau le trading automatique par boîte noire, mais prend comme direction une exécution intelligente contrôlable par l'utilisateur.</li>\r
        <li><strong>Entrée économique intelligente :</strong>Arc USDC premium et la future couche de service d'agent x402 constituent la base d'un règlement restreint, fréquent et vérifiable des capacités d'IA.</li>\r
      </ul>\r
      <h3>18.2 Indicateurs de base</h3>\r
      <table class="kpi">\r
        <tbody>\r
          <tr><td>Couverture du marché</td><td>Nombre de marchés synchronisés, couverture active du marché et précision de la cartographie des jetons de résultats.</td></tr>\r
          <tr><td>Qualité d'inférence</td><td>Taux de réussite de l'inférence, taux de réussite de la vérification du schéma, rapport de signal effectif, ratio de non-échange.</td></tr>\r
          <tr><td>Qualité de l'essaim</td><td>Divergence des agents, consensus pondéré par calibrage, couverture de scène, taux de réussite des contre-exemples, performances d'examen des rapports de prédiction.</td></tr>\r
          <tr><td>Entonnoir utilisateur</td><td>Visualisation du marché, démarrage de l'inférence, enregistrement du script, aperçu des commandes, confirmation de l'utilisateur et transaction réelle.</td></tr>\r
          <tr><td>Adoption de la preuve d’arc</td><td>Nombre de générations de preuves, nombre d'ancres, taux de réussite de la vérification, taux de clics ArcScan.</td></tr>\r
          <tr><td>Historique des signaux</td><td>Changement de prix après signal, précision finale, PnL, taux d'exécution des utilisateurs, taux de réussite des recommandations de sortie.</td></tr>\r
          <tr><td>Économie</td><td>Taux de conversion premium, taux de réussite des paiements USDC, durées d'appel x402, GMV du service d'agent, volume attribué au constructeur, revenus de l'API.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>18.3 Conclusion</h3>\r
      <p>\r
        La valeur de Causeway ne réside pas dans le fait de permettre aux utilisateurs de cliquer plus rapidement sur le bouton de trading, mais dans l'établissement d'une couche d'infrastructure intelligente et fiable pour les marchés de prédiction. Il relie la structure du marché, le raisonnement de l’IA, la prévisualisation des risques, la confirmation des utilisateurs, la certification Arc et le suivi des performances dans une boucle fermée. À court terme, cela permet aux utilisateurs de mieux comprendre et exécuter le marché Polymarket ; à moyen terme, il devient une couche de signaux de marché prévisionnels vérifiable ; à long terme, il peut évoluer vers un moteur de prédiction d'intelligence en essaim, simuler la propagation d'événements réels sur plusieurs marchés et produire des rapports de prédiction professionnels.\r
      </p>\r
      <div class="callout">\r
        <strong>Vision finale :</strong>\r
        Causeway n'est pas un « outil de pari automatisé », mais une première forme de « moteur d'intelligence collective qui prédit tout » : l'utilisateur saisit un événement, le système comprend le marché, organise les agents, construit un monde de marché parallèle, vérifie les faits, simule des chemins, génère des signaux, conserve des preuves et l'utilisateur décide d'agir ou non. À long terme, Arc est responsable de la base d'enregistrement et de règlement fiable, x402 est responsable de l'invocation du service d'agent intelligent et Causeway est responsable de l'orchestration intelligente des marchés de prédiction.\r
      </div>\r
    </section>\r
\r
    <section>\r
      <p class="eyebrow">19 / Références</p>\r
      <h2>Références</h2>\r
      <div class="source-list">\r
        <p>1. Wolfers, Justin et Eric Zitzewitz, <em>Marchés de prédiction</em>, Journal des perspectives économiques, 2004. https://pubs.aeaweb.org/doi/pdfplus/10.1257/0895330041371321</p>\r
        <p>2. Snowberg, Erik, Justin Wolfers et Eric Zitzewitz, <em>Marchés de prédiction pour les prévisions économiques</em>, Document de travail du NBER 18222, 2012. https://www.nber.org/system/files/working_papers/w18222/w18222.pdf</p>\r
        <p>3. Document de travail du Wharton Rodney L. White Center, étude de marché prévisionnelle, 2006. https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0608.pdf</p>\r
        <p>4. Cao, document d'étude de marché prédictif, archives de l'Association néo-zélandaise des économistes. https://www.nzae.org.nz/wp-content/uploads/2014/05/Cao.pdf</p>\r
        <p>5. Archives d'articles du Journal of Prediction Markets, recherche sur les marchés de prédiction et d'arbitrage. https://www.ubplj.org/index.php/jpm/article/view/1796</p>\r
        <p>6. <em>Commerce d'arbitrage sur les marchés de prédiction</em>, archives de recherche. https://www.researchgate.net/publication/262875038_Arbitrage_trade_in_prediction_markets</p>\r
        <p>7. Préimpression arXiv sur l'arbitrage de marché prédictif moderne et les dépendances sémantiques du marché. https://arxiv.org/pdf/2508.03474.pdf</p>\r
        <p>8. KPMG, <em>Marchés de prédiction : voies d’entrée</em>, 2026. https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/prediction-markets-paths-to-entry.pdf</p>\r
        <p>9. CoinDesk, <em>Polymarket résout le contrat pour l'élection présidentielle</em>, 2024. https://www.coondesk.com/markets/2024/11/06/polymarket-resolves-presidential-election-contract</p>\r
        <p>10. Axios, <em>Polymarket obtient un gros investissement de la société mère de la Bourse de New York</em>, 2025. https://www.axios.com/2025/10/07/polymarket-new-york-stock-exchange</p>\r
        <p>11. Documentation Polymarché, <em>Présentation de l'API Gamma Markets</em>. https://docs.polymarket.com/developers/gamma-markets-api/overview</p>\r
        <p>12. Documentation Polymarché, <em>Négocier sur le Polymarket CLOB</em>. https://docs.polymarket.com/developers/CLOB/trades/trades-data-api</p>\r
        <p>13. Documentation Polymarché, <em>Programme de construction</em>. https://docs.polymarket.com/developers/builders/examples</p>\r
        <p>14. Documents Arc, <em>Connectez-vous à Arc</em>. https://docs.arc.io/integrate/connect-to-arc</p>\r
        <p>15. Documents Arc, <em>Réseau d'arcs</em>. https://docs.arc.network/arc-chain</p>\r
        <p>16. Protocole x402, <em>Protocole de paiement ouvert pour Internet</em>. https://www.x402.org/</p>\r
        <p>17. Plateforme de développement Coinbase, <em>x402</em>. https://www.coinbase.com/developer-platform/products/x402/</p>\r
        <p>18. Documents Cloudflare, <em>Agents x402</em>. https://developers.cloudflare.com/agents/x402/</p>\r
      </div>\r
      <div class="disclaimer">\r
        Copyright © 2026 Chaussée. Ce document est un projet de livre blanc sur les produits, la technologie et l’économie et ne constitue pas des conseils en investissement, des conseils juridiques, des services de courtage, des engagements de revenus ou des avis réglementaires. Les données de marché et les informations sur l'industrie mentionnées dans cet article proviennent d'informations publiques. Les données réelles peuvent différer en raison du calibre statistique, de la période, de la définition de la plateforme et des changements du marché. Les utilisateurs doivent porter des jugements indépendants et supporter les risques associés à la prévision du marché.\r
      </div>\r
    </section>\r
  </body>\r
</html>\r
`,z=`<!doctype html>\r
<html lang="ko">\r
  <head>\r
    <meta charset="utf-8" />\r
    <title>Causeway Technical & Economic Whitepaper v0.6 KO</title>\r
    <style>\r
      @page { size: A4; margin: 13mm 12mm; }\r
      :root {\r
        --ink: #081b33;\r
        --ink-2: #0a2a52;\r
        --blue: #1677ff;\r
        --cyan: #22c7e8;\r
        --green: #14b87a;\r
        --amber: #f59e0b;\r
        --red: #ef4444;\r
        --muted: #53657d;\r
        --line: #d8e6f5;\r
        --soft: #f5faff;\r
        --paper: #ffffff;\r
      }\r
      * { box-sizing: border-box; }\r
      body {\r
        margin: 0;\r
        background: var(--paper);\r
        color: var(--ink);\r
        font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;\r
        font-size: 10pt;\r
        line-height: 1.56;\r
      }\r
      h1, h2, h3, h4, p { margin-top: 0; }\r
      h1 { margin: 0 0 18px; font-size: 42pt; line-height: .96; letter-spacing: 0; }\r
      h2 { margin: 0 0 9px; color: var(--ink); font-size: 18pt; line-height: 1.12; break-after: avoid; }\r
      h3 { margin: 13px 0 5px; color: var(--ink-2); font-size: 11.8pt; line-height: 1.22; break-after: avoid; }\r
      h4 { margin: 10px 0 4px; color: var(--ink); font-size: 10.6pt; line-height: 1.25; }\r
      p { margin-bottom: 6px; }\r
      ul, ol { margin: 5px 0 8px 18px; padding: 0; }\r
      li { margin: 2px 0; }\r
      table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; break-inside: avoid; }\r
      th, td { border: 1px solid var(--line); padding: 5px 6px; text-align: left; vertical-align: top; }\r
      th { background: var(--soft); color: var(--ink); font-weight: 800; }\r
      code { font-family: Consolas, "SFMono-Regular", monospace; font-size: 9.3pt; color: var(--ink-2); }\r
      .cover { min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; position: relative; }\r
      .cover::before {\r
        content: "";\r
        position: absolute;\r
        inset: -13mm -12mm;\r
        z-index: -1;\r
        background:\r
          linear-gradient(rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          linear-gradient(90deg, rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          radial-gradient(circle at 76% 16%, rgba(22, 119, 255, .17), transparent 34%),\r
          radial-gradient(circle at 22% 82%, rgba(34, 199, 232, .12), transparent 30%),\r
          #fff;\r
        background-size: 26px 26px, 26px 26px, auto, auto, auto;\r
      }\r
      .brand img { width: 168px; height: auto; margin-bottom: 46px; }\r
      .eyebrow { margin: 0 0 13px; color: var(--blue); font-size: 8.8pt; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }\r
      .subtitle { max-width: 650px; color: #273b57; font-size: 15.2pt; line-height: 1.56; }\r
      .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 28px; }\r
      .meta-grid div, .callout, .principle, .phase-card, .note, .metric-card, .source-card {\r
        border: 1px solid var(--line);\r
        border-radius: 7px;\r
        background: rgba(245, 250, 255, .82);\r
        padding: 8px;\r
      }\r
      .meta-grid span, .small-label { display: block; color: var(--muted); font-size: 8pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }\r
      .meta-grid b { display: block; margin-top: 4px; font-size: 10.5pt; }\r
      .page { break-after: auto; margin-bottom: 8mm; }\r
      .toc { columns: 2; column-gap: 26px; }\r
      .toc p { break-inside: avoid; border-bottom: 1px solid var(--line); margin: 0 0 7px; padding-bottom: 6px; font-weight: 720; }\r
      .callout { margin: 8px 0 10px; border-left: 4px solid var(--blue); background: #f5faff; }\r
      .callout strong { color: var(--blue); }\r
      .warning { border-left-color: var(--amber); background: #fff8ed; }\r
      .warning strong { color: #a15c00; }\r
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }\r
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }\r
      .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }\r
      .principle, .metric-card { min-height: 88px; break-inside: avoid; }\r
      .principle b, .metric-card b, .note b { display: block; margin: 4px 0 6px; color: var(--ink); font-size: 11.2pt; }\r
      .principle p, .phase-card p, .note p, .metric-card p, .source-card p { margin-bottom: 0; color: #273b57; font-size: 8.9pt; line-height: 1.45; }\r
      .phase-card { break-inside: avoid; margin-bottom: 6px; }\r
      .phase-card h3 { margin-top: 4px; }\r
      .tag {\r
        display: inline-block;\r
        margin: 0 5px 5px 0;\r
        border: 1px solid #bcd7ff;\r
        border-radius: 999px;\r
        background: #eef6ff;\r
        color: var(--blue);\r
        padding: 2px 8px;\r
        font-size: 8pt;\r
        font-weight: 800;\r
      }\r
      .tag.dark { border-color: var(--ink); background: var(--ink); color: #fff; }\r
      .hero-image { overflow: hidden; border: 1px solid rgba(22,119,255,.22); border-radius: 10px; height: 96mm; margin: 14px 0; background: #06162b; }\r
      .hero-image img { width: 100%; height: 100%; object-fit: cover; }\r
      .concept-figure { break-inside: avoid; width: 72%; margin: 9px auto 12px; }\r
      .concept-figure-frame { overflow: hidden; border: 1px solid rgba(22,119,255,.2); border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(8,27,51,.08); }\r
      .concept-figure img { display: block; width: 100%; max-height: 82mm; object-fit: contain; }\r
      .concept-figure .caption { margin: 5px 0 0; line-height: 1.42; }\r
      .caption { color: var(--muted); font-size: 8pt; }\r
      .disclaimer, .footnotes { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 11px; color: var(--muted); font-size: 8.2pt; line-height: 1.52; }\r
      .no-break { break-inside: avoid; }\r
      .source-list p { margin-bottom: 5px; word-break: break-all; }\r
      .kpi td:first-child { width: 24%; font-weight: 800; color: var(--ink-2); }\r
      .formula {\r
        border: 1px solid var(--line);\r
        border-left: 5px solid var(--green);\r
        border-radius: 8px;\r
        background: #f3fff9;\r
        margin: 6px 0 8px;\r
        padding: 7px 9px;\r
        break-inside: avoid;\r
      }\r
      .formula code { display: block; margin: 2px 0; color: #07513a; font-size: 8.8pt; }\r
      .formula p { margin: 4px 0 0; color: #244a3d; font-size: 8.6pt; line-height: 1.42; }\r
    </style>\r
  </head>\r
  <body>\r
    <section class="cover">\r
      <div>\r
        <div class="brand"><img src="../../public/assets/causeway-lockup-primary.svg" alt="Causeway" /></div>\r
        <p class="eyebrow">기술 및 경제 백서</p>\r
        <h1>Causeway<br />기술 및 경제 백서</h1>\r
        <p class="subtitle">\r
          예측 시장을 위한 AI 거래 인텔리전스 및 검증 가능한 추론 레이어: Polymarket 시장 데이터, 인과 추론, 위험 미리 보기부터 Arc 검증 가능한 추론, USDC 기본 에이전트 경제 및 집단 지능 예측 엔진에 이르기까지.\r
        </p>\r
        <div class="meta-grid">\r
          <div><span>버전</span><b>v0.6</b></div>\r
          <div><span>날짜</span><b>2026-05</b></div>\r
          <div><span>상태</span><b>상세 초안</b></div>\r
          <div><span>범위</span><b>시장 + 아크</b></div>\r
        </div>\r
      </div>\r
      <div class="disclaimer">\r
        본 백서는 Causeway의 시장 판단, 제품 포지셔닝, 기술 아키텍처, Arc 통합, 경제 모델, 위험 경계 및 향후 로드맵을 설명하는 데 사용됩니다. 이 기사는 투자 조언, 법률 조언, 중개 서비스 설명, 소득 약속 또는 모든 형태의 자동 거래 권유를 구성하지 않습니다. 시장을 예측하는 것은 상당한 위험을 수반하며, 실제 거래는 사용자 자신의 판단에 따라 적극적으로 확인되어야 합니다.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">목차</p>\r
      <h2>목차</h2>\r
      <div class="toc">\r
        <p>01. 요약</p>\r
        <p>02. 시장배경 : 예측시장이 주류단계로 진입</p>\r
        <p>03. 핵심 질문: 기존 예측 시장에 여전히 지능형 레이어가 부족한 이유는 무엇입니까?</p>\r
        <p>04. 학문적 기초와 가치산정 체계</p>\r
        <p>05. Causeway의 제품 정의</p>\r
        <p>06. 어떤 문제를 해결했나요?</p>\r
        <p>07. 시스템 아키텍처 및 데이터 모델</p>\r
        <p>08. AI 트레이더 인텔리전스: 확률부터 행동까지 미리보기</p>\r
        <p>09. Arc Proof: 검증 가능한 AI 추론 기록</p>\r
        <p>10. Arc USDC Premium: 스마트 경제와 결제 능력</p>\r
        <p>11. x402 에이전트 서비스 계층: 미래 에이전트 서비스 프로토콜 계층</p>\r
        <p>12. 군집 예측 엔진: 병렬 시장 세계에서 모든 것을 예측하는 것까지</p>\r
        <p>13. 사용자 워크플로 및 제품 경험</p>\r
        <p>14. 위험 통제, 거버넌스 및 규정 준수 경계</p>\r
        <p>15. 앞으로 해결해야 할 문제</p>\r
        <p>16. 5단계 기술 로드맵</p>\r
        <p>17. 비즈니스 모델과 가치 포착</p>\r
        <p>18. 해자, 지표 및 결론</p>\r
        <p>19. 참고자료</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">01 / 요약</p>\r
      <h2>요약</h2>\r
      <p>\r
        Causeway는 예측 시장을 위한 AI 거래 인텔리전스이자 검증 가능한 추론 레이어입니다. 기본적인 판단은 예측 시장이 "소수 암호화폐 사용자가 참여하는 이벤트 베팅 인터페이스"에서 "실제 이벤트, 거시적 위험, 스포츠, 정치, 기업 이벤트 및 온체인 활동을 위한 확률적 인프라"로 진화하고 있다는 것입니다. 시장의 수, 거래량, 참가자의 복잡성이 증가하면 사용자에게는 더 이상 보기 좋은 핸디캡 페이지가 아니라 이벤트를 검토 가능한 시장 판단으로 전환할 수 있는 지능형 시스템이 필요합니다.\r
      </p>\r
      <p>\r
        현재 예측 시장 인터페이스의 핵심 격차는 시장 간의 관계가 구조화되지 않았고, AI가 내린 판단에 검증 가능한 추론 기록이 부족하며, 거래 추천에 위험 및 포지션 제약이 부족하다는 것입니다. 사용자가 신호가 생성된 이유, 근거는 무엇인지, 나중에 올바른지 여부를 검토하는 것은 어렵습니다. Causeway는 이러한 격차를 메우려고 노력합니다. Polymarket 시장 데이터에서 시작하여 시장 네트워크를 구축하고 인과 스크립트를 생성하고 확률, 에지, 위험 및 미리보기를 출력하고 AI 추론 추적을 Arc Testnet에 고정하여 "사전 이벤트 추론" 및 "이벤트 후 결과"를 감사할 수 있습니다.\r
      </p>\r
      <div class="callout">\r
        <strong>한 문장으로 포지셔닝:</strong>\r
        Causeway는 예측 시장을 AI 판독 가능, AI 기반, 사용자 실행 및 Arc 검증 가능한 거래 인텔리전스 레이어로 전환합니다.\r
      </div>\r
      <p>\r
        일반 AI 채팅 도우미와 달리 Causeway의 핵심 제품은 검토할 수 없는 자연어 답변이 아니라 루트 시장, 루트 결과 토큰, 후보 시장, 인과 가장자리, 확률 추정, 시장 암시적 확률, 엣지, BUY/WATCH/AVOID 권장 사항, 위험 설명, 주문 미리 보기, 사용자 확인 상태, 아크 증명 해시 및 후속 성능 기록과 같은 구조화된 시장 인텔리전스 개체입니다. 기본적으로 시스템은 사용자를 위한 자금을 호스팅하지 않으며 사용자 서명을 우회하지 않으며 AI 결과를 투자 조언으로 패키지하지 않습니다. 이는 설명 가능하고 검증 가능하며 관리 가능한 예측 시장 워크플로우 세트를 제공합니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">02 / 시장 상황</p>\r
      <h2>시장 배경: 예측 시장이 주류 단계에 진입</h2>\r
      <h3>2.1 거래량과 기관의 관심이 빠르게 높아지고 있습니다.</h3>\r
      <p>\r
        예측 시장은 2024년 미국 선거 주기 동안 첫 번째 대규모 퇴출을 완료했습니다. 코인데스크는 폴리마켓의 2024년 미국 대선 계약 규모가 36억 달러를 넘어섰다고 보도했다. 시장은 또한 처음으로 예측 시장을 대규모 주류 언론과 일반 사용자의 관심을 끌었습니다. 2025년까지 업계 성장은 단일 정치 행사에서 스포츠, 매크로, 암호화폐, 경제 데이터, 기업 행사, 문화 행사 등 더 많은 카테고리로 확대됩니다.\r
      </p>\r
      <p>\r
        KPMG는 예측 시장 진입에 관한 2026년 보고서에서 Kalshi와 Polymarket의 합산 거래량이 2024년 약 90억 달러에 비해 2025년에는 400억 달러를 초과하여 연간 400% 이상의 성장을 나타낼 것이라고 언급했습니다. 보고서는 또한 폴리마켓의 월간 거래량이 2025년 10월에 30억 달러를 초과했다고 언급했습니다. 다양한 데이터 소스의 규모는 플랫폼, 거래량 정의 및 기간에 따라 다르지만 방향은 동일합니다. 예측 시장은 실험적인 제품에서 고성장 단계, 강력한 규제 관심 및 기관 참여 단계로 이동했습니다.\r
      </p>\r
      <h3>2.2 예측 시장은 '거래 장소'에서 '확률적 데이터 레이어'로 변화하고 있습니다.</h3>\r
      <p>\r
        ICE(뉴욕 증권 거래소의 모회사)가 Polymarket에 전략적으로 투자한 것은 시장이 거래 수수료뿐만 아니라 이벤트 기반 데이터 자체에 초점을 맞추고 있다는 추가적인 증거입니다. Axios는 ICE가 Polymarket에 최대 20억 달러를 투자하기로 합의했으며 Polymarket의 이벤트 중심 데이터의 글로벌 배포자가 될 것이라고 보고했습니다. 이는 예측 시장의 가치가 단지 거래에만 있는 것이 아니라 실제 불확실성을 관찰 가능한 확률 데이터로 실시간으로 변환하는 능력에 있다는 것을 의미합니다.\r
      </p>\r
      <div class="grid-3">\r
        <div class="metric-card">\r
          <span class="small-label">시장 신호</span>\r
          <b>거래량 확대</b>\r
          <p>플랫폼의 거래량은 선거주기의 정점에서 다중 카테고리 일반 거래로 확대되었으며 시장 깊이와 사용자 구조는 더욱 복잡해졌습니다.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">제도적 신호</span>\r
          <b>기관 진입</b>\r
          <p>거래소, 중개업, 스포츠 플랫폼 및 금융 기술 회사는 예측 시장 진출을 모색하고 있습니다.</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">데이터 신호</span>\r
          <b>확률 디지털화</b>\r
          <p>시장 가격 예측은 단순한 사용자 베팅 결과가 아닌 이벤트 기반 데이터로 다시 이해되고 있습니다.</p>\r
        </div>\r
      </div>\r
      <h3>2.3 성장이 가져온 새로운 모순</h3>\r
      <p>\r
        시장이 확장된 후 사용자는 더 이상 "시장을 찾을 수 없다"는 문제에 직면하지 않고 "어떤 시장이 조사할 가치가 있는지, 어떤 가격이 정보를 반영했는지, 어떤 관련 시장이 뒤쳐져 있는지, 어떤 신호가 노이즈인지 판단할 수 없다"는 문제에 직면하게 됩니다. 거래량이 빠르게 증가할수록 시장 관계를 구성하고, 확률 변화를 해석하고, 잘못된 가격을 식별하고, 위험을 제어하고, 반복 가능한 기록을 형성하는 데 더 지능적인 계층이 필요합니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">03 / 문제</p>\r
      <h2>핵심 질문: 기존 예측 시장이 여전히 인텔리전스 계층을 놓치는 이유</h2>\r
      <h3>3.1 문제 1: 시장은 네트워크이지만 인터페이스는 여전히 목록이다</h3>\r
      <p>\r
        실제 사건이 하나의 시장에만 영향을 미치는 경우는 거의 없습니다. 예를 들어, 연준의 성명은 금리, 인플레이션, 미국 달러, 암호화폐 자산, 주가 지수, 금, 선거 이야기 및 관련 기업 행사에 동시에 영향을 미칠 수 있습니다. 스포츠 부상 뉴스는 결과, 챔피언십, 선수 데이터 및 같은 그룹에 참가할 자격을 얻을 확률에 영향을 미칠 수 있습니다. 기존 인터페이스는 일반적으로 시장 목록, 이벤트 페이지, 검색 결과로 표시되며, 이벤트가 시장 전체에 전파되는 방식에 대한 구조화된 표현이 부족합니다.\r
      </p>\r
      <h3>3.2 문제 2: 시장 데이터 구조가 복잡하고 거래 대상이 제목이 아닙니다.</h3>\r
      <p>\r
        폴리마켓의 거래 대상은 마켓 타이틀이 아닌 결과 토큰입니다. 공식 감마 API <code>outcomes</code>、<code>outcomePrices</code> CLOB 토큰 ID와 인덱스 매핑 관계가 있습니다. 동일한 이벤트에 여러 시장이 있을 수 있습니다. 사용자와 AI 시스템의 경우 제목이나 예/아니오 문구만 이해하면 다중 결과 시장, 스포츠 시장, 레인지 시장 및 상호 배타적인 이벤트에서 잘못된 매핑이 생성되기 쉽습니다.\r
      </p>\r
      <h3>3.3 문제 3: AI 추천에는 감사 가능성이 부족합니다.</h3>\r
      <p>\r
        일반 AI 시스템은 "구매를 권장합니다"와 같은 답변을 생성할 수 있지만 이 답변에는 입력 스냅샷, 후보 시장 범위, 프롬프트 버전, 모델 버전, 출력 스키마, 추론 경로, 반례 및 이벤트 후 추적성이 부족한 경우가 많습니다. 예측시장의 특징은 그 결과가 미래에 검증된다는 점이다. 결과가 발생하기 전에 판단이 내려졌거나 나중에 추론이 수정되지 않았음을 시스템이 증명할 수 없는 경우 신호 성능은 신뢰할 수 있는 근거가 부족합니다.\r
      </p>\r
      <h3>3.4 이슈 4: 속도와 거버넌스 사이에 갈등이 있습니다</h3>\r
      <p>\r
        이벤트 시장의 장점은 빠르게 반응할 수 있다는 점이지만 너무 빠르면 잘못된 정보, 환각, 비유동성 및 과잉 거래의 위험이 증폭될 수도 있습니다. 전문 시스템은 자동 실행을 추구할 뿐만 아니라 미리보기, 예산, 거래 가능 상태, 주문서 새로 ​​고침, 사용자 확인, 감사 기록 ​​및 권한 취소를 동일한 프로세스에 통합해야 합니다.\r
      </p>\r
      <div class="callout warning">\r
        <strong>제품 판단:</strong>\r
        예측 시장의 다음 단계에서 핵심 경쟁은 '누가 더 많은 시장 페이지를 갖고 있는가'가 아니라 '시장 가격, AI 추론, 실제 실행 및 검증 가능한 기록을 완전한 지능형 폐쇄 루프로 구성할 수 있는 사람'입니다.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">04 / 학술재단</p>\r
      <h2>학문적 기초와 가치산출 프레임워크</h2>\r
      <p>\r
        예측 시장의 이론적 가치는 간단하지만 강력한 메커니즘에서 비롯됩니다. 즉, 계약이 이벤트 결과에 따라 고정된 금액을 지불하는 경우 거래 가격은 특정 조건에서 이벤트가 발생할 확률에 대한 시장의 집합적 판단을 대략적으로 표현할 수 있습니다. Wolfers와 Zitzewitz의 예측 시장 검토에서는 예측 시장이 가격을 통해 분산된 정보를 판독 가능한 신호로 집계할 수 있다는 점을 지적했습니다. Snowberg, Wolfers 및 Zitzewitz는 이 메커니즘을 경제 예측 시나리오에 추가로 적용하여 이벤트 계약 가격이 거시 및 정책 불확실성의 실시간 확률적 표현이 될 수 있다고 설명했습니다. Causeway의 가치는 예측 시장을 재창조하는 것이 아니라 "확률적 신호로서의 가격"을 기반으로 AI 추론, 시장 간 일관성 감지, 실행 마찰 수정, 위험 예산 책정 및 검증 가능한 성과 기록을 추가하는 것입니다.\r
      </p>\r
      <h3>4.1 가격은 확률이지만 무조건적인 진실은 아닙니다</h3>\r
      <p>\r
        바이너리 이벤트 계약의 경우, 위험 중립성, 낮은 거래 비용, 충분한 유동성, 참가자가 자유롭게 거래할 수 있는 이상적인 조건에서 이벤트가 발생할 때 계약이 $1를 지불하고 발생하지 않을 때 $0를 지불하는 경우 시장 가격은 <code>p</code> 이는 시장 내재 확률로 이해될 수 있습니다. 현실적인 예측 시장이 항상 이러한 조건을 충족하는 것은 아닙니다. 스프레드, 수수료, 미끄러짐, 한도, 정보 노이즈, 조작 시도, 규제 제한 및 참가자 위험 선호 등으로 인해 가격이 "실제 확률"에서 벗어나게 됩니다. 따라서 Causeway는 시장 가격을 결론으로 ​​간주하지 않고 관찰 가능한 신호의 첫 번째 레이어로 간주하며 AI 공정 확률, 소스 검증, 유동성 확인 및 위험 모델을 통해 공동으로 설명합니다.\r
      </p>\r
      <div class="formula">\r
        <code>p_mid = (bestBid + bestAsk) / 2</code>\r
        <code>p_exec_yes = ask_yes, p_exec_no = ask_no</code>\r
        <code>q_ai = calibratedForecast(event | marketSnapshot, sourceObjects, reasoningTrace)</code>\r
        <code>rawEdge_mid = q_ai - p_mid</code>\r
        <p><code>p_mid</code> 시장 내재 확률을 표시하는 데 적합합니다.<code>p_exec_yes</code> 이는 YES 구매에 대한 실제 실행 확률 임계값입니다. Causeway는 중간 가격을 사용하여 가장자리를 과장하는 것을 피하기 위해 "연구 확률"과 "거래 가능성"을 구분해야 합니다.</p>\r
      </div>\r
      <h3>4.2 거래 가치는 "마찰 이후의 긍정적인 기대"에서 비롯됩니다.</h3>\r
      <p>\r
        사용자에게 정말 가치 있는 것은 "AI가 확률이 더 높다고 생각한다"는 것이 아니라 "현재 거래 가격, 처리 수수료, 슬리피지, 핸디캡 깊이 및 불확실성 할인 이후에도 여전히 긍정적인 기대가 있다"는 것입니다. 이는 또한 예측 시장 차익거래 연구가 반복적으로 강조하는 핵심이기도 합니다. 이론적 가격 불일치는 실행 가능하고 해결 가능하며 비용을 공제한 후에도 여전히 긍정적인 경우에만 실제 기회가 됩니다. 따라서 Causeway는 기회를 원시 신호, 거래 가능한 신호 및 실행 가능한 주문 미리보기의 세 가지 수준으로 나눕니다.\r
      </p>\r
      <div class="formula">\r
        <code>EV_token_yes = q_ai * 1 + (1 - q_ai) * 0 - ask_yes - cost_per_token</code>\r
        <code>ROI_yes = EV_token_yes / ask_yes</code>\r
        <code>edgeNet = q_ai - ask_yes - feeRate - slippageBps - ruleRiskHaircut - sourceRiskHaircut</code>\r
        <code>BUY only if edgeNet &gt; minEdge, depthAtLimit &gt; targetSize, timeToClose &gt; minWindow</code>\r
        <p>순 이점은 확률, 비용, 깊이 및 시간 창에 의해 동시에 제한되어야 합니다. 제약 조건 중 하나라도 충분하지 않은 경우 시스템은 WATCH, VERIFY FIRST 또는 AVOID로 다운그레이드해야 합니다.</p>\r
      </div>\r
      <h3>4.3 포지션 제안: 충동적인 베팅 대신 보수적인 Kelly를 사용하세요.</h3>\r
      <p>\r
        이벤트 계약에서는 구매 가격 자체가 최대 손실액에 가깝습니다. 계약 값은 이벤트가 발생하면 1에 가까워지고 이벤트가 발생하지 않으면 0에 가까워집니다. Kelly 공식은 포지션 추천의 이론적 출발점으로 사용될 수 있지만 예측 시장에는 모델 오류, 유동성 불연속성, 규칙 해석 차이 및 이벤트 해결 위험이 포함되어 있으므로 시장 용량, 포트폴리오 상관 관계 및 사용자 예산 한도를 오버레이하여 할인된 버전을 사용해야 합니다. Causeway는 수익 약속이 아닌 위험 예산 권장 사항을 출력합니다.\r
      </p>\r
      <div class="formula">\r
        <code>q_adj = clamp(0.5 + confidence * (q_ai - 0.5), 0.01, 0.99)</code>\r
        <code>b = (1 - p_exec) / p_exec</code>\r
        <code>kellyFull = (b * q_adj - (1 - q_adj)) / b = (q_adj - p_exec) / (1 - p_exec)</code>\r
        <code>sizeUsd = bankroll * min(max(0, lambda * kellyFull), capMarket, capPortfolio, capCorrelation)</code>\r
        <p><code>q_adj</code> 신뢰도를 사용하여 모델 확률을 50%로 축소합니다.<code>lambda</code> 분수 켈리 할인. 그런 다음 포지션은 시장 용량, 포트폴리오 상관 관계, 일일 손실 한도 및 사용자 예산에 의해 제한되어야 합니다.</p>\r
      </div>\r
      <h3>4.4 상호배타적인 완전시장: 가격합계로부터 차익거래와 위험 식별</h3>\r
      <p>\r
        대통령 승자, 챔피언십 소유권, 간격 결과 등과 같은 상호 배타적이고 완전한 다중 결과 시장에서 모든 결과의 실제 확률의 합은 1에 가까워야 합니다. 차익 거래 논문에서는 가격 불일치를 감지하기 위해 종종 이 구조를 사용합니다. 모든 결과를 구매하는 총 요청이 1보다 작으면 이론적으로 "전체 바구니 구매"라는 이익 마진이 있습니다. 판매할 수 있는 총 입찰가가 1보다 큰 경우 역차익거래 또는 가격 초과 신호가 있을 수 있습니다. 그러나 실제 거래에서는 거래가 동시에 완료될 수 있는지, 공매도가 허용되는지, 취소/결제 위험이 있는지, 시장 깊이가 충분한지 등을 고려해야 합니다.\r
      </p>\r
      <div class="formula">\r
        <code>Underround: Σ ask_i + fees + slippage &lt; 1</code>\r
        <code>profitFloor_buyBasket = 1 - Σ ask_i - fees - slippage - settlementRisk</code>\r
        <code>Overround: Σ bid_i - fees - slippage &gt; 1, if sell/short/redeem path exists</code>\r
        <code>executable = profitFloor &gt; 0 and min(depth_i) &gt; targetSize and rules_i are consistent</code>\r
        <p>Causeway는 상호 배타적인 완전 차익거래를 수학적 문제로 축소하지 않고 이를 시장 그래프의 일관성 검사로 사용합니다. 먼저 가격 이상을 찾은 다음 깊이, 규칙, 결제 및 실행 경로를 확인합니다.</p>\r
      </div>\r
      <h3>4.5 시장 간 의미론적 일관성: "동일 이벤트"에서 "전체 시장 지도"까지</h3>\r
      <p>\r
        Modern Polymarket은 고립된 시장의 집합이 아니라 이벤트, 엔터티, 시간대, 규칙 텍스트 및 결과 조건으로 구성된 의미 네트워크입니다. 하나의 시장은 논리적으로 또 다른 시장을 암시할 수 있습니다. 예를 들어, "후보자가 대선에서 승리합니다"는 "후보자가 소속 정당의 후보로 지명된 후에도 여전히 총선에 진출할 기회가 있습니다"를 의미하고, 특정 팀이 "우승을 차지합니다"는 "결승/플레이오프 진출" 확률이 낮아서는 안 된다는 것을 의미합니다. 기본 시장의 가격이 포함된 시장보다 너무 높으면 시스템은 의미상 일관성이 없거나 가격이 잘못 책정되었을 수 있다고 표시해야 합니다. 사용자가 제공한 Polymarket 의미 체계 차익 거래 및 예측 시장 차익 거래 문헌은 Causeway의 시장 그래프 방향을 지원합니다. AI의 장점은 규칙 텍스트를 읽고 암시적 관계를 식별하고 이를 계산 가능한 제약 조건으로 바꾸는 것입니다.\r
      </p>\r
      <div class="formula">\r
        <code>If event B implies event A, then P(B) ≤ P(A)</code>\r
        <code>violation = max(0, p_exec(B) - p_exec(A) - costMargin - ruleRiskMargin)</code>\r
        <code>semanticEdge = violation * relationConfidence * min(liquidityScore_A, liquidityScore_B)</code>\r
        <code>tradeableSemanticEdge = semanticEdge only if both markets share compatible resolution rules</code>\r
        <p>여기서 핵심은 모델이 "추측"하는 것이 아니라 모델이 감사 가능한 관계 유형(암시, 상호 배타적, 관련됨, 인과적, 동일한 소스 또는 관련 없음)을 출력하도록 하는 것입니다.</p>\r
      </div>\r
      <h3>4.6 사례: Causeway가 종이의 가치를 제품에 전달하는 방법</h3>\r
      <table>\r
        <thead><tr><th>학술/시장 사례</th><th>전통적인 가치</th><th>Causeway의 제품화 접근 방식</th></tr></thead>\r
        <tbody>\r
          <tr><td>선거 시장</td><td>가격은 여론 조사, 뉴스, 거래자 판단 및 위험 선호도를 실시간 배당률로 집계합니다.</td><td>후보자, 주, 정당, 후보, 투표율 및 거시적 이벤트를 시장 그래프로 매핑하여 어떤 시장이 이미 뉴스를 반영했고 어떤 관련 시장이 뒤처져 있는지 식별합니다.</td></tr>\r
          <tr><td>거시경제적 발표</td><td>CPI, 이자율, 고용, 경기 침체 등과 같은 이벤트는 계약 가격을 사용하여 실시간 기대치를 형성할 수 있습니다.</td><td>데이터 릴리스 시간, 합의 기대치, 과거 수정 사항, Fed 성명서 및 자산 반응을 소스 개체에 기록하여 "데이터 전/데이터 후" 전략 관찰 목록을 생성합니다.</td></tr>\r
          <tr><td>스포츠 챔피언/이벤트 우승자</td><td>상호 배타적인 전체 결과의 가격 합계를 사용하여 오버라운드, 언더라운드 및 핸디캡 이상을 감지할 수 있습니다.</td><td>동일한 결과 그룹에 대해 sumAsk, sumBid, 깊이 및 정산 규칙을 ​​자동으로 계산하여 이론적 차익거래가 아닌 구현 가능성을 제공합니다.</td></tr>\r
          <tr><td>폴리마켓 의미론적 차익거래</td><td>제목은 다르지만 상호 암시적인 결과를 가진 여러 시장의 확률은 일관되지 않을 수 있습니다.</td><td>AI를 사용하여 규칙 텍스트를 구문 분석하고 암시적/상호 배타적/상관된 가장자리를 설정한 다음 ViolationScore를 사용하여 잠재적인 기회를 정렬합니다.</td></tr>\r
          <tr><td>유동성이 부족하고 시끄러운 시장</td><td>가격은 소규모 거래, 스프레드 또는 정보 부족으로 인해 실제 확률에서 벗어날 수 있습니다.</td><td>liquidityScore, SpreadRisk, sourceRisk 및 Confidence를 signalScore에 입력하면 품질이 낮은 기회는 자동으로 WATCH 또는 AVOID로 다운그레이드됩니다.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>4.7 성과평가: 손익만 보지 마세요</h3>\r
      <p>\r
        AI 신호는 돈 버는 사례만 보여주면 쉽게 사후 심사가 될 수 있다. Causeway는 계정 손익뿐만 아니라 예측 시장 조사에 일반적으로 사용되는 보정 지표 및 채점 기능을 사용하여 모델을 평가해야 합니다. Brier Score는 확률 예측과 실제 결과의 제곱 오차를 측정합니다. 로그 손실은 신뢰도가 높은 오류에 큰 페널티를 줍니다. 보정 버킷은 "AI가 70%의 이벤트가 실제로 약 70%의 시간 동안 발생한다고 말합니다." 여부를 확인합니다. Arc Proof의 중요성은 여기서 매우 간단해집니다. 각 확률 판단을 미리 고정할 수 있으므로 성능 평가를 더욱 신뢰할 수 있게 만듭니다.\r
      </p>\r
      <div class="formula">\r
        <code>Brier_mean = mean((q_ai - y)^2)</code>\r
        <code>LogLoss_mean = mean(-[y * ln(q_ai + eps) + (1 - y) * ln(1 - q_ai + eps)])</code>\r
        <code>CalibrationError = Σ_k n_k / N * |mean(q_ai in bucket k) - mean(y in bucket k)|</code>\r
        <code>signalScore = z(edgeNet) + z(confidence) + z(liquidity) - z(spreadRisk) - z(sourceRisk) - z(correlationRisk)</code>\r
        <p>장기적인 가치는 단일 예측 히트가 아닌 반복 가능하고 안정적인 보정에서 비롯됩니다. Causeway의 신호 추적 기록은 정확성, 보정, 손익, 손실률, 실행률 및 놓친 기회에 대한 이벤트 후 성과를 동시에 표시해야 합니다.</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">05 / 제품 정의</p>\r
      <h2>Causeway 제품 정의</h2>\r
      <p>\r
        Causeway는 예측 시장 거래자 인텔리전스 레이어입니다. 전체 시장 데이터에서 AI 추론, 거래 기회 식별에서 사용자 확인 실행, 추론 추적에서 Arc 증명, 단일 신호에서 성과 추적까지 완전한 워크플로우를 제공하여 예측 시장 기회를 이해하고 연구하고 실행하려는 사용자를 대상으로 합니다.\r
      </p>\r
      <table>\r
        <thead>\r
          <tr><th>계층</th><th>기능</th><th>사용자 가치</th></tr>\r
        </thead>\r
        <tbody>\r
          <tr><td>시장 데이터베이스</td><td>Polymarket 이벤트, 시장, 결과, 토큰, 가격, 유동성, 규칙 및 상태를 동기화합니다.</td><td>AI와 사용자가 실제 거래 가능한 개체를 먼저 이해하도록 하세요.</td></tr>\r
          <tr><td>시장 네트워크</td><td>이벤트, 태그, 의미론, 가격 상관관계, AI 추론을 기반으로 시장 그래프를 구축하세요.</td><td>시장을 목록에서 탐색 가능한 확률적 네트워크로 전환합니다.</td></tr>\r
          <tr><td>AI 추론 엔진</td><td>근본 결과로부터 관련 시장, 인과 경로, 신뢰 수준 및 기본 조치를 생성합니다.</td><td>"시장 아이디어"를 검토 가능한 스크립트로 변환합니다.</td></tr>\r
          <tr><td>트랜잭션 인텔리전스 계층</td><td>시장 배당률, AI 공정 배당률, 우위, 위험, 포지션 추천 및 구매/감시/방지를 계산합니다.</td><td>단순히 텍스트를 해석하는 것이 아니라 AI가 실제로 거래 판단에 참여하게 하세요.</td></tr>\r
          <tr><td>미리보기 레이어 주문</td><td>테스트 실행 또는 실제 CLOB 주문 미리보기를 생성하고, 시장을 새로 고치고, 한도를 확인하고, 사용자 서명을 기다립니다.</td><td>제어 경계를 유지하면서 추론을 실제 실행에 연결합니다.</td></tr>\r
          <tr><td>아크 검증 가능 레이어</td><td>Arc Testnet에 추론 추적 해시를 작성하고 호출 데이터가 원본 추적과 일치하는지 확인합니다.</td><td>추론 기록이 사전에 존재한다는 것을 증명하여 후속 변조의 여지를 줄입니다.</td></tr>\r
          <tr><td>성능 추적 계층</td><td>신호, 주문, 포지션, 가격 변동, 손익 및 최종 결과를 추적합니다.</td><td>AI 기능을 시연부터 지속 가능한 평가까지 수행하는 시스템입니다.</td></tr>\r
        </tbody>\r
      </table>\r
      <p>\r
        Causeway의 경계도 똑같이 중요합니다. 기본적으로 시스템은 사용자 개인 키를 보관하지 않고, 사용자 서명을 우회하지 않으며, AI 출력을 투자 조언으로 패키지하지 않습니다. AI는 시장 주장 확대, 경로 식별, 위험 제안 및 미리보기 생성을 담당합니다. 사용자는 행동할지, 얼마나 행동할지, 언제 중지할지, 향후 제한 주문을 열지 여부를 확인할 책임이 있습니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">06 / 우리가 해결한 것</p>\r
      <h2>우리는 어떤 문제를 해결했나요?</h2>\r
      <h3>6.1 시장 데이터 및 결과 토큰 매핑</h3>\r
      <p>\r
        Causeway는 "시장 타이틀"과 "실제 거래 가능한 결과 토큰"을 명확하게 구분했습니다. 시스템 데이터 모델에는 다음이 포함됩니다. <code>PolymarketEvent</code>、<code>PolymarketMarket</code>、<code>PolymarketOutcome</code>、<code>clobTokenId</code>, 가격, 최적 매수, 최적 매도, 최종 거래, 스프레드, 거래량, 유동성, 주문 최소 크기 및 틱 크기 필드입니다. 이는 AI나 프론트엔드 마케팅이 단순한 예/아니오 카피로 착각하는 문제를 해결합니다.\r
      </p>\r
      <h3>6.2 근본 결과에서 원인 스크립트까지</h3>\r
      <p>\r
        사용자는 루트 시장과 루트 결과를 선택할 수 있으며, 시스템은 후보 시장을 기반으로 AI 추론 실행을 생성합니다. 출력은 단일 문장 추천이 아니라 노드, 엣지, 경고, ImpactDirection, 신뢰도, 이유 및 결과 추천을 포함하는 구조화된 결과입니다. 그런 다음 백엔드는 이를 원인 스크립트, 스크립트 시장 및 스크립트 결과 선택으로 변환하여 사용자가 하나씩 검토하고 수정할 수 있도록 합니다.\r
      </p>\r
      <h3>6.3 주문 미리보기 및 사용자 확인의 폐쇄 루프</h3>\r
      <p>\r
        Causeway의 순서 레이어 구분 <code>dry_run</code> 그리고 <code>real</code> 실행 모드. 시스템은 주문 미리보기 생성, 주문장 새로 고침, 잔액 및 거래 기능 확인, EIP-712 서명 페이로드 준비, Polymarket CLOB를 통한 실제 주문 제출 등을 수행할 수 있습니다. 실제 기능을 사용할 수 없는 경우 프런트엔드 및 백엔드 프로토콜이 일관되게 유지되므로 단일 외부 종속성으로 인해 제품이 데모 및 개발을 중단하는 것을 방지할 수 있습니다.\r
      </p>\r
      <h3>6.4 Polymarket Builder 속성</h3>\r
      <p>\r
        Polymarket Builder 프로그램을 사용하면 애플리케이션에서 주문 속성 및 빌더 리더보드 통계를 얻기 위해 주문 구조에 빌더 코드를 추가할 수 있습니다. Causeway의 비즈니스 폐쇄 루프는 "AI가 기회를 발견하고 설명하며, 사용자는 지갑 제어권을 유지하고 거래를 개인적으로 확인하며, 실제 거래는 빌더 코드를 통해 귀속됩니다."를 기반으로 구축될 수 있습니다. 이는 순수 구독 모델보다 예측 시장 거래 시나리오에 더 적합합니다.\r
      </p>\r
      <h3>6.5 아크 추론 추적 증명</h3>\r
      <p>\r
        현재 Causeway 구현에는 이미 Arc Proof 모듈이 포함되어 있습니다. 시스템은 특정 원인 스크립트를 읽고 빌드할 수 있습니다. <code>causeway.reasoning_trace.v1</code> 캡슐 패키지는 입력 해시, 출력 해시, 모델 버전, 프롬프트 버전, 시장 스냅샷, 결과 선택 및 스크립트 그래프를 추론하고 추적 해시를 생성하고 이를 Arc Testnet 트랜잭션 호출 데이터를 통해 고정합니다. 백엔드는 트랜잭션 서명자, chainId 및 calldata를 확인하여 체인의 기록이 원래 추적과 일치하는지 확인합니다.\r
      </p>\r
      <h3>6.6 Arc USDC 프리미엄 지급</h3>\r
      <p>\r
        Causeway는 Arc USDC 지불 의도와 멤버십 자격도 구현합니다. 사용자는 프리미엄 기능을 위해 Arc USDC를 결제할 수 있으며 백엔드는 프리미엄 멤버십을 활성화하기 전에 Arc 거래 영수증 및 USDC 전송 로그를 읽어 결제 금액, 지불자, 수취인, 거래 상태 및 시간대를 확인합니다. 이 메커니즘은 고급 모델, 심층 추론, 보다 완전한 추론 추적 및 Arc 증명과 같은 기능에 사용될 수 있습니다. 향후에는 Arc에 정착된 x402 서비스 호출과 결합하여 회원 구독, 유료 시청 보고서, API 호출 및 에이전트 기능 잠금 해제가 동일한 검증 가능한 결제 기록 세트를 공유할 수도 있습니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">07 / 건축</p>\r
      <h2>시스템 아키텍처 및 데이터 모델</h2>\r
      <h3>7.1 기술 스택</h3>\r
      <table>\r
        <thead><tr><th>기준 치수</th><th>현재 시행 방향</th><th>효과</th></tr></thead>\r
        <tbody>\r
          <tr><td>프런트엔드</td><td>React + Vite + RainbowKit + wagmi + viem + React Flow</td><td>마켓 네트워크, 지갑 연결, 추론 그래프, 주문 미리보기, Arc Proof 패널.</td></tr>\r
          <tr><td>API</td><td>NestJS + 프리즈마 + PostgreSQL</td><td>시장 동기화, AI 추론, 스크립트, 주문, 포트폴리오, 결제, 아크 증명.</td></tr>\r
          <tr><td>폴리마켓</td><td>감마 API + CLOB/데이터 API + 빌더 릴레이어</td><td>시장 데이터, 결과 토큰, 주문서, 서명 주문 및 빌더 속성.</td></tr>\r
          <tr><td>AI</td><td>구조화된 프롬프트 + 출력 스키마 + 캐시</td><td>원인 및 결과 다이어그램, 권장 결과, 신뢰 수준, 위험 및 스크립트를 생성합니다.</td></tr>\r
          <tr><td>호</td><td>Arc 테스트넷 + viem 퍼블릭/지갑 클라이언트 + USDC 결제 확인</td><td>추적 증명, 보험료 지불, 대리인의 경제적 기반을 추론합니다.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>7.2 데이터 객체</h3>\r
      <p>\r
        Causeway의 핵심 데이터 개체는 "거래 가능한 시장"과 "감사 가능한 추론"을 중심으로 설계되었습니다. 마켓 객체는 폴리마켓 구조를 정확하게 표현하는 역할을 담당하고, 추론 객체는 AI 입출력을 기록하는 역할을 담당하며, 스크립트 객체는 추론을 사용자가 편집 가능한 행동 계획으로 변환하는 역할을 담당하고, 주문 객체는 실제 거래를 연결하는 역할을 담당하며, 아크 증명 객체는 추론 기록이 특정 시점에 존재함을 증명하는 역할을 담당한다.\r
      </p>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">시장 개체</span><b>실제 시장 구조</b><p>이벤트, 시장, 결과, ConditionId, QuestionId, clobTokenId, 가격, 유동성 및 규칙을 포함합니다.</p></div>\r
        <div class="note"><span class="small-label">추론 객체</span><b>AI 추론 기록</b><p>root outcome, candidate set, prompt version, model, inputJson, outputJson, cacheKey를 포함합니다.</p></div>\r
        <div class="note"><span class="small-label">원인 스크립트</span><b>편집 가능한 액션 스크립트</b><p>graphJson, 스크립트 시장, 결과 선택, userAction, orderMode 및 정당성을 포함합니다.</p></div>\r
        <div class="note"><span class="small-label">아크 방지 캡슐</span><b>검증 가능한 추론 증명</b><p>추적 해시, calldata, chainId, txHash, ArcScan URL 및 앵커 타임스탬프가 포함되어 있습니다.</p></div>\r
      </div>\r
      <h3>7.3 아키텍처 원칙</h3>\r
      <ul>\r
        <li><strong>시장 우선：</strong>외부 정보 소스를 확장하기 전에 시장 구조, 결과 토큰 및 주문장이 신뢰할 수 있는지 확인하십시오.</li>\r
        <li><strong>구조화된 AI:</strong>AI 출력은 스키마를 준수해야 하며 자연어만 반환할 수는 없습니다.</li>\r
        <li><strong>인간이 통치하는 것:</strong>AI는 기본 스크립트를 생성할 수 있지만 사용자는 이를 수정, 건너뛰기, 미리보기 또는 거부할 수 있습니다.</li>\r
        <li><strong>증명 가능：</strong>주요 추론 기록은 이벤트 후 성과 평가를 지원하기 위해 해시, 검토 및 고정되어야 합니다.</li>\r
        <li><strong>기능 대체:</strong>실제 거래, 잔액, 결제 또는 외부 API를 사용할 수 없는 경우 시스템은 충돌 대신 구조화된 기능 상태를 반환해야 합니다.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">08 / 트레이더 인텔리전스</p>\r
      <h2>AI 트레이더 인텔리전스: 확률부터 행동 미리보기까지</h2>\r
      <h3>8.1 신호는 단순히 "매수" 또는 "매수하지 않음"이 되어서는 안 됩니다.</h3>\r
      <p>\r
        성숙한 예측 시장 정보 시스템은 모든 시장에 대한 거래 추천을 제공해서는 안 됩니다. 많은 시장에서는 WATCH 또는 AVOID를 반환해야 합니다. 예를 들어 우위가 충분하지 않고, 유동성이 부족하고, 스프레드가 너무 넓으며, 규칙이 불분명하고, 정보 소스가 확인되지 않고, 사용자가 이미 상관 관계가 높은 노출을 갖고 있고, 시장이 곧 끝나거나, AI 신뢰도가 부족합니다. 거래 금지 권장은 자제력과 위험 인식을 갖춘 시스템을 보여주기 때문에 그 자체로 역량입니다.\r
      </p>\r
      <h3>8.2 신호 객체</h3>\r
      <table>\r
        <thead><tr><th>필드</th><th>설명하다</th></tr></thead>\r
        <tbody>\r
          <tr><td>신호 ID</td><td>추적 및 성과 검토를 위한 고유 신호 ID입니다.</td></tr>\r
          <tr><td>시장 승률</td><td>시장 가격은 확률을 암시합니다.</td></tr>\r
          <tr><td>aiFairOdds</td><td>AI는 시장 데이터, 추론 경로, 정보 출처 검증을 기반으로 공정한 확률을 제공합니다.</td></tr>\r
          <tr><td>가장자리</td><td>AI 공정 확률과 시장 확률의 차이.</td></tr>\r
          <tr><td>신뢰</td><td>추론 경로 및 데이터 품질에 대한 모델의 신뢰도입니다.</td></tr>\r
          <tr><td>추천</td><td>구매, 시청, 피하고 먼저 확인하세요.</td></tr>\r
          <tr><td>위험 수준</td><td>낮음, 중간, 높음. 유동성, 규칙, 소스, 변동성 및 관련 노출에 따라 달라집니다.</td></tr>\r
          <tr><td>제안된 크기</td><td>보수적인 Kelly, 예산 한도 및 시장 용량을 기준으로 권장 금액입니다.</td></tr>\r
          <tr><td>내 마음을 바꾸다</td><td>현재 권장 사항을 뒤집을 사실적 변경 사항은 무엇입니까?</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>8.3 특성요인도부터 포지션 추천까지</h3>\r
      <p>\r
        Causeway의 포지션 권장 사항은 고정된 금액이 아니라 가장자리 크기, 신뢰도, 시장 깊이, 스프레드, 사용자 위험 선호도, 시장 상관 관계, 단일 시가 총액 및 전체 예산과 같은 요소의 조합에 의해 결정되어야 합니다. 보수적인 Kelly를 기본 프레임워크로 사용할 수 있지만 불확실성이 높은 시나리오에서 모델이 과도한 베팅을 방지하려면 할인 요인과 상한을 추가해야 합니다.\r
      </p>\r
      <div class="callout">\r
        <strong>보수적 원칙:</strong>\r
        권장되는 입장은 수익을 약속하는 것이 아니라 "설명 가능한 위험 예산"이어야 합니다. 시스템은 최대 손실, 거래 가격, 슬리피지, 만료 시간 및 재평가를 유발하는 조건을 명확하게 표시해야 합니다.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">09 / 아크 증명</p>\r
      <h2>Arc Proof: 검증 가능한 AI 추론 기록</h2>\r
      <h3>9.1 추론에 온체인 증명이 필요한 이유</h3>\r
      <p>\r
        예측 시장의 핵심은 미래가 오늘의 판단을 검증한다는 것입니다. 따라서 AI 신호의 신뢰성은 모델 자체에서 비롯되는 것이 아니라, "결과가 발생하기 전에 이러한 판단을 했다는 것을 입증할 수 있는지 여부"에서 비롯됩니다. 결과가 게시된 후 시스템이 과거 추론 추적을 수정할 수 있는 경우 신호 정확도, PnL 또는 성과에 대한 기록은 신뢰 기반이 부족합니다.\r
      </p>\r
      <p>\r
        Arc Proof의 역할은 Polymarket 거래 링크를 대체하거나 사용자 주문을 Arc로 이동하는 것이 아닙니다. Polymarket은 여전히 ​​시장 및 CLOB 거래를 담당합니다. Arc는 AI 추론 추적의 해시를 스테이블 코인에 대한 저렴하고 빠른 기본 감사 계층으로 기록하는 역할을 담당합니다.\r
      </p>\r
      <h3>9.2 Causeway의 아크 프루프 캡슐</h3>\r
      <table>\r
        <thead><tr><th>필드</th><th>의미</th></tr></thead>\r
        <tbody>\r
          <tr><td>개요</td><td><code>causeway.reasoning_trace.v1</code></td></tr>\r
          <tr><td>scriptId / inferenceRunId</td><td>해당 스크립트 및 추론이 실행됩니다.</td></tr>\r
          <tr><td>rootMarketId / rootOutcomeId</td><td>사용자가 선택한 루트 시장 및 루트 결과.</td></tr>\r
          <tr><td>입력해시 / 출력해시</td><td>AI 입력 및 출력의 안정적인 JSON 해시입니다.</td></tr>\r
          <tr><td>모델/promptVersion/outputSchemaVersion</td><td>모델, 프롬프트 및 출력 형식 버전.</td></tr>\r
          <tr><td>시장 스냅샷</td><td>가격, best bid, best ask, last trade, volume, liquidity, syncedAt.</td></tr>\r
          <tr><td>선택</td><td>AI 액션、사용자 액션、주문 모드、한도 가격、크기、금액Usd 및 이유。</td></tr>\r
          <tr><td>추적해시</td><td>Arc 트랜잭션 호출 데이터로 사용되는 전체 캡슐의 해시입니다.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>9.3 검증 프로세스</h3>\r
      <ol>\r
        <li>백엔드는 사용자 스크립트와 추론 기록을 읽어 증명 캡슐을 만듭니다.</li>\r
        <li>안정적인 JSON 해시를 사용하여 생성 <code>traceHash</code>。</li>\r
        <li>프런트 엔드는 사용자에게 Arc Testnet으로 전환하도록 요청하고 호출 데이터가 TraceHash인 트랜잭션을 보냅니다.</li>\r
        <li>백엔드는 트랜잭션 수신을 기다리고 트랜잭션 입력을 읽습니다.</li>\r
        <li>서명자가 연결된 지갑과 일치하는지, chainId가 Arc Testnet인지, 호출 데이터가 TraceHash와 일치하는지 확인하세요.</li>\r
        <li>감사 기록에 txHash, TraceHash, ArcScan URL 및 AnchoredAt를 작성합니다.</li>\r
      </ol>\r
      <div class="callout">\r
        <strong>제품 의미:</strong>\r
        Arc Proof를 통해 Causeway는 "이 AI 추론 기록이 특정 시점에 존재했으며 이후에 자동으로 다시 작성되지 않았다"는 사실을 보여줄 수 있습니다. 이는 예측 시장에서 AI 신호의 성능을 신뢰하는 기반입니다.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">10 / 아크 USDC 경제</p>\r
      <h2>Arc USDC Premium: 회원 구독, 검증 가능한 결제 및 스마트 경제</h2>\r
      <p>\r
        Arc의 스테이블 코인 기본 디자인은 저비용, 검증 가능하고 빈번한 지능형 경제 활동에 적합합니다. Causeway는 현재 Arc USDC 결제 의도를 구현했습니다. 사용자가 프리미엄 플랜을 선택한 후 시스템은 chainId, USDC 토큰, ReceiverAddress, amountMicroUsd 및 만료 시간을 지정하여 결제하려는 의도를 생성합니다. 사용자가 Arc에서 USDC 전송을 완료한 후 백엔드는 확인을 위해 거래 영수증과 ERC-20 전송 로그를 읽고 결제 결과를 회원 권한에 매핑합니다. 현 단계에서 멤버십 구독은 주로 고급 신호 잠금 해제, 추론 추적 완료, Arc 증명 및 더 높은 수준의 분석 기능을 사용하는 데 사용됩니다. 앞으로 Causeway는 Arc에 정착된 x402 서비스 호출을 사용하여 구독, 유료 시청, 보고서 잠금 해제, API 호출 및 에이전트 기능 구매를 보다 세분화된 결제 프레임워크로 통합할 수도 있습니다.\r
      </p>\r
      <h3>10.1 현재 지원되는 프리미엄 기능</h3>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">프리미엄 시그널</span><b>고급 신호</b><p>더 깊은 추론, 더 높은 품질의 모델, 더 엄격한 신뢰도 및 완전한 후보 시장 범위를 확보하세요.</p></div>\r
        <div class="note"><span class="small-label">전체 추론 추적</span><b>완전한 추론 트랙</b><p>입력, 출력, 후보 시장, 위험, 반례 및 무엇이 내 마음을 바꿀 것인가를 봅니다.</p></div>\r
        <div class="note"><span class="small-label">아크 증명</span><b>온체인 증명</b><p>추론 추적 해시를 Arc Testnet에 고정하고 ArcScan을 통해 트랜잭션을 확인하세요.</p></div>\r
        <div class="note"><span class="small-label">미래 x402</span><b>에이전트 서비스 호출</b><p>데이터 구매, 보고서 잠금 해제, API 호출 및 정책 구독을 위해 Arc에서 청구되는 x402 프로세스에 대한 향후 액세스.</p></div>\r
      </div>\r
      <h3>10.2 Arc: 에이전트 경제학의 검증 가능한 추론 및 결제 계층</h3>\r
      <p>\r
        Causeway에 대한 Arc의 가치는 Polymarket의 거래 링크를 대체하는 것이 아니라 예측 시장 AI 시스템을 위한 저렴하고 검증 가능한 스테이블 코인 기반 경제 및 감사 계층을 제공하는 것입니다. Polymarket은 시장 매칭, 주문서, 결과 정산 및 실제 거래 실행을 담당합니다. Causeway는 시장 이해, AI 추론, 위험 미리 보기, 사용자 확인 및 신호 추적을 담당합니다. Arc는 추론 추적 입금, 프리미엄 구독, 보고서 잠금 해제, API 호출, 지능형 에이전트 서비스 정산 및 향후 데이터 소스 지불과 같이 빈도가 높고 양이 적으며 기록이 필요하고 검증이 필요하며 자연스럽게 미국 달러로 가격이 책정되는 보조 작업을 수행하는 데 적합합니다.\r
      </p>\r
      <p>\r
        현재 버전의 경우 Arc는 먼저 두 가지 주요 문제를 해결합니다. 첫째, AI 추론에는 검증 가능한 타임스탬프가 필요합니다. 예측시장의 판단은 향후 결과를 통해 검증될 예정이다. 결과가 발생하기 전에 특정 추론 기록이 생성되었음을 시스템이 입증할 수 없는 경우 신호 추적 기록의 신뢰성이 크게 감소합니다. Causeway는 추론 추적의 해시를 Arc에 기록하여 각 AI 판단이 가벼운 증명 캡슐을 형성할 수 있도록 합니다. 둘째, AI 기능에는 스테이블코인에 대한 기본 결제 경로가 필요합니다. 고급 추론, 완전한 추론 트랙, 시장 그래프 분석, API 호출 및 보고 서비스는 모두 USDC를 통한 소액, 실시간, 검증 가능한 결제에 적합합니다.\r
      </p>\r
      <p>\r
        중기적으로 Arc는 Causeway가 보다 완전한 신호 경제를 형성하도록 지원할 수 있습니다. 각 AI 추론은 추적 가능한 신호 자산으로 볼 수 있습니다. 여기에는 생성 시간, 입력 스냅샷, 모델 버전, 시장 가격, AI 공정 확률, 가장자리, 위험 설명, 사용자 작업 및 최종 결과가 포함됩니다. 이러한 신호가 시간이 지남에 따라 축적되고 주요 해시가 Arc에 고정되면 Causeway는 신뢰할 수 있는 신호 추적 기록을 구축할 수 있습니다. 앞으로 사용자는 AI 답변을 한 번만 구매하는 것이 아니라 입증된 전략, 보고서, 시장 지도, 데이터 소스 및 전문 에이전트 기능을 구독하게 될 것입니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">11 / x402 에이전트 서비스 계층</p>\r
      <h2>x402 에이전트 서비스 계층: 미래 에이전트 서비스 프로토콜 계층</h2>\r
      <p>\r
        x402는 Causeway에서 거래 실행 프로토콜로 포지셔닝되어서는 안 되며, 에이전트 서비스 호출 및 소액 결제 프로토콜로 포지셔닝되어야 합니다. 그 가치는 AI 에이전트, 외부 API, 데이터 소스 및 전문 분석 서비스가 기계 판독 가능 결제 요청을 통해 유료 결제를 완료할 수 있도록 하는 데 있습니다. Causeway의 경우 x402는 미래의 에이전트 서비스 계층이 될 수 있습니다. Arc는 검증 가능한 기록과 스테이블코인 결제 환경을 제공하고, x402는 에이전트-서비스 액세스 및 결제 프로세스를 제공하며, Causeway는 시장 지도, 권한 거버넌스, 위험 제어, 주문 미리보기 및 성과 추적을 조정하는 역할을 담당합니다.\r
      </p>\r
      <h3>11.1 종량제 데이터 소스, 검증 및 보고</h3>\r
      <p>\r
        Causeway에는 향후 뉴스 스트림, 스포츠 데이터, 매크로 데이터, 온체인 데이터, 규제 발표, 회사 발표, 확률 데이터 및 원본 소스 검증이 필요합니다. 많은 데이터는 고정된 월간 구독에는 적합하지 않지만 AI 추론이 필요할 때 주문형 통화에 더 적합합니다. 즉, CPI 릴리스 확인, 팀 부상 데이터 구매, 온체인 자본 흐름 분석 요청, 뉴스 원본 확인, 시장 규칙 차이 보고서 생성 등이 있습니다. x402는 수동 API 키, 중앙 집중식 포인트 또는 오프라인 결제에 의존하는 대신 이러한 호출을 즉각적이고 세밀하며 감사 가능한 결제 동작으로 전환할 수 있습니다.\r
      </p>\r
      <h3>11.2 전문지능 시장</h3>\r
      <p>\r
        Causeway가 단일 AI 추론 도구에서 다중 에이전트 예측 시스템으로 발전하면 시스템은 거시 연구 에이전트, 스포츠 상해 에이전트, 정치 뉴스 에이전트, 온체인 자본 흐름 에이전트, 핸디캡 차익 거래 에이전트, 소스 검증 에이전트, 위험 에이전트 및 실행 가드와 같은 외부 전문 에이전트를 도입할 수 있습니다. 각 에이전트는 장기 실적, 보정 기능, 과거 수익 위험 성능, 응답 속도, 데이터 소스 적용 범위 및 아크 증명 기록을 통해 평판을 구축할 수 있습니다. x402는 각 서비스 호출에 대한 액세스 제어 및 시간당 지불 정산을 담당할 수 있습니다.\r
      </p>\r
      <h3>11.3 시그널 시장과 API 수익화</h3>\r
      <p>\r
        앞으로 Causeway는 고품질 신호, 시장 그래프, 위험 보고서, 관련 시장, 의미론적 재정 거래 스캔 및 Arc 증명 상태를 지불 가능한 API로 외부 애플리케이션이나 에이전트에 노출할 수 있습니다. 발신자는 정회원일 필요가 없으며 요청 시 특정 기능을 구매할 수 있습니다. Arc는 증거, 지불 및 평판을 기록하고 x402는 유료 액세스를 처리하며 Causeway는 신호 성능 및 교정 결과를 표시합니다. 이런 방식으로 Causeway의 수익은 구독뿐만 아니라 구성 가능한 스마트 서비스 네트워크에서도 발생합니다.\r
      </p>\r
      <h3>11.4 제한된 AI 위탁 거래의 장기적인 형태</h3>\r
      <p>\r
        보다 발전된 단계에서 사용자는 자동화된 AI 위탁 거래 프로세스에 참여할 검증되고 성숙한 에이전트를 지정할 수 있습니다. 그러나 x402 자체는 자산 보관, 거래 승인 또는 위험 제어 책임을 맡지 않습니다. 지능형 에이전트 서비스 호출 및 소액결제 레이어를 담당합니다. 실제 위탁 거래는 권한 경계(거래에 허용되는 시장 범주, 최대 단일 거래 금액, 일일 손실 한도, 최대 관련 노출, 최소 edgeNet, 최소 유동성, 최대 슬리피지, 필요한 검증 단계, 만료 시간, 비상 정지 및 취소 가능한 승인)와 함께 Causeway에 의해 중첩되어야 합니다. 모든 데이터 호출, 추론 생성, 검증 요청, 주문 미리보기 또는 거래 실행은 아크 증명 및 신호 추적 기록을 남겨야 합니다.\r
      </p>\r
      <div class="callout">\r
        <strong>미래 포지셔닝:</strong>\r
        Arc는 proof, payment record 및 reputation substrate이고; x402는 agent-to-service payment and access protocol이며; Causeway는 prediction-market intelligence orchestration layer이고; Polymarket은 market execution and settlement venue입니다.\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">12 / 떼 예측 엔진</p>\r
      <h2>군집 예측 엔진: 병렬 시장 세계에서 모든 것을 예측하는 것까지</h2>\r
      <p>\r
        Causeway의 장기 목표는 단일 AI가 시장에 대해 일회성 판단을 내리도록 하는 것이 아니라 예측 시장을 위한 그룹 지능형 예측 엔진을 구축하는 것입니다. 우리의 판단은 복잡한 사건의 예측이 단일 경로 추론에 의존해서는 안 되며 현실 세계의 시드 정보에서 시작하여 진화 가능한 병렬 시장 세계를 구축하여 서로 다른 역할, 기억, 위치 및 행동 논리를 가진 여러 지능형 에이전트가 상호 작용하고, 분기하고, 반증하고, 수정하고, 예측을 생성할 수 있도록 해야 한다는 것입니다. Causeway는 시뮬레이션 결과가 설명 보고서를 형성할 뿐만 아니라 시장 승률, AI 공정 승률, edgeNet, 위험 예산, 주문 미리 보기, 아크 증명 및 신호 추적 기록으로 변환될 수 있도록 이러한 군집 인텔리전스 추론을 "거래 가능하고 검증 가능하며 확정 가능한 예측 시장 네트워크"로 제한합니다.\r
      </p>\r
      <h3>12.1 단일 모델 추론에서 군집 지능 예측까지</h3>\r
      <p>\r
        단일 모델은 초기 판단을 생성하는 데 적합하지만 복잡한 세계는 종종 여러 행위자, 여러 동기, 여러 정보 지연 및 여러 시장 피드백에 의해 결정됩니다. 거시적 데이터, 스포츠 부상, 규제 발표, 온체인 이벤트 또는 정치 뉴스는 여러 주체, 여러 시간대 및 여러 상호 연결된 예측 시장에 동시에 영향을 미칠 수 있습니다. 군집 지능 예측 엔진의 가치는 여러 에이전트가 연구, 의심, 검증, 가격 책정, 위험 및 실행 게이트키핑 역할을 수행하고 동일한 시장 맵에서 여러 라운드의 추론을 수행하여 단일 경로 편견과 과신을 줄이는 것입니다.\r
      </p>\r
      <figure class="concept-figure">\r
        <div class="concept-figure-frame">\r
          <img src="../../public/assets/causeway-swarm-prediction-engine-concept.png" alt="Causeway 군집 지능 예측 엔진 개념도" />\r
        </div>\r
        <figcaption class="caption">그림 12-1: Causeway 군집 지능 예측 엔진의 개념도. 실제 이벤트가 병렬 시장 세계에 진입한 후 다중 역할 에이전트, 시장 지도, Arc 증명, x402 에이전트 서비스 및 신호 추적 기록이 함께 감사 가능한 예측 폐쇄 루프를 형성합니다.</figcaption>\r
      </figure>\r
      <h3>12.2 병행시장의 세계</h3>\r
      <p>\r
        Causeway는 실제 이벤트를 여러 병렬 시장 세계로 변환할 수 있습니다. 각 세계에는 사건이 실제인지, 출처가 신뢰할 수 있는지, 확산 속도가 어느 정도인지, 시장이 이를 반영했는지, 관련 시장이 뒤처져 있는지, 유동성이 충분한지, 규칙에 모호성이 있는지 등 다양한 가정이 포함되어 있습니다. 시스템은 단순히 "이런 일이 일어날까요?"라고 묻지 않습니다. 그러나 "이런 이벤트가 발생하면 시장 네트워크를 어떻게 통과할 것인지, 어떤 확률이 변경될 것인지, 어떤 엣지가 생성될 것인지, 어떤 위험이 발생할 것인지, 어떤 검증 가능한 기록이 남게 될 것인지"를 묻습니다. 이 평행 시장 세계는 미래 예측 시스템에 대한 Causeway의 핵심 판단입니다. 예측은 단순히 "무슨 일이 일어날지 여부"에 대답하는 것이 아니라 이벤트가 여러 시장, 여러 참가자, 여러 정보 소스 및 여러 시간 창에 전파되는 방식을 시뮬레이션하고 이 전파 프로세스를 감사 가능하고 계산 가능하며 검증 가능한 시장 정보 개체로 변환해야 합니다.\r
      </p>\r
      <h3>12.3 에이전트 사회: 다중 역할 에이전트 협업</h3>\r
      <table>\r
        <thead><tr><th>상담원 역할</th><th>책임</th><th>출력 객체</th></tr></thead>\r
        <tbody>\r
          <tr><td>연구 대리인</td><td>이벤트, 시장, 역사적 사례, 맥락을 수집하세요.</td><td>sourceObjects、이벤트 요약、시장 후보。</td></tr>\r
          <tr><td>시장 그래프 에이전트</td><td>관련 시장, 의미론적 의미, 상호 배타적인 관계, 관련 노출을 찾아보세요.</td><td>시장 그래프, 관계 유형, 영향 방향.</td></tr>\r
          <tr><td>확률 에이전트</td><td>확률 추정치는 시나리오와 증거를 기반으로 제공됩니다.</td><td>AI 공정 확률, 확률 변화, 신뢰도.</td></tr>\r
          <tr><td>회의적인 요원</td><td>반례, 규칙의 모호함, 잘못된 출처, 과잉 추론을 찾아보세요.</td><td>반론、changeMyMind、위험 플래그。</td></tr>\r
          <tr><td>검증대행자</td><td>근본적인 사실과 권위 있는 출처를 추적해 보세요.</td><td>확인 상태、소스 신뢰、충돌 보고서。</td></tr>\r
          <tr><td>위험 대리인</td><td>유동성, 스프레드, 미끄러짐, 상관 관계 및 포지션 한도를 계산합니다.</td><td>edgeNet、위험 예산、포지션 한도。</td></tr>\r
          <tr><td>처형 가드</td><td>주문 미리보기 또는 커미션 실행을 허용할지 여부를 결정합니다.</td><td>BUY / WATCH / AVOID、미리보기 게이트주문、긴급정지。</td></tr>\r
          <tr><td>신고 대리인</td><td>다중 상담원의 의견 불일치 및 결론을 읽기 쉬운 보고서로 변환합니다.</td><td>예측 보고서、시나리오 트리、감사 요약。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>12.4 시뮬레이션 보고서에서 스마트 객체 거래까지</h3>\r
      <p>\r
        군집지능의 출력은 자연어 보고에서 멈출 수 없습니다. Causeway는 시뮬레이션 결과를 시나리오 트리, 영향을 받는 시장, 관계 가장자리, 확률 변화, AI 공정 확률, 시장 확률, edgeNet, 권장 조치, 위험 플래그, 제안 크기, 아크 증명 해시 및 추적 기록 항목과 같은 구조화된 거래 지능형 개체로 압축해야 합니다. 이러한 방식으로 스웜 인텔리전스는 실제 거래 이전에 연구와 검토, 검증 및 사용자 확인을 모두 제공할 수 있습니다.\r
      </p>\r
      <div class="formula">\r
        <code>scenarioValue_s = Σ_i edgeNet_i,s * tradability_i,s * confidence_s - portfolioRisk_s</code>\r
        <code>swarmConsensus = weightedMedian(q_agent_1, q_agent_2, ..., q_agent_n; weights = reputation * calibration)</code>\r
        <code>disagreementRisk = variance(q_agent_1 ... q_agent_n) + sourceConflict + ruleAmbiguity</code>\r
        <code>finalAction = gate(swarmConsensus, edgeNet, disagreementRisk, liquidity, userPolicy)</code>\r
        <p>단순히 투표하는 것이 아니라 스웜 인텔리전스는 다양한 에이전트의 교정 기록, 소스 품질, 불일치 정도 및 시장 집행 가능성을 위험 제어에 따른 조치 권장 사항에 결합합니다.</p>\r
      </div>\r
      <h3>12.5 Arc와 x402와의 관계</h3>\r
      <p>\r
        Swarm 예측 엔진에는 검증 가능한 기록과 구성 가능한 결제가 필요합니다. Arc는 각 시뮬레이션, 추론, 신호 및 결과의 해시를 기록할 수 있으므로 집단 지능은 사실 뒤에 포장된 이야기가 아닙니다. x402는 외부 데이터 소스, 검증 서비스, 전문 에이전트 및 심층 보고서에 대한 통화당 지불 및 소액 지불을 제공할 수 있습니다. Causeway는 이러한 기능을 조율하고 에이전트 출력을 예측 시장 개체, 위험 제어 경계, 주문 미리보기 및 사용자 거버넌스 프로세스에 매핑하는 일을 담당합니다. 장기적으로 Arc는 신뢰할 수 있는 기록 및 정산 기반이고, x402는 지능형 에이전트 서비스 호출 프로토콜이며, Swarm Prediction Engine은 세계 변화를 추론하는 지능형 레이어입니다.\r
      </p>\r
      <h3>12.6 장기 비전: 모든 것을 예측하되 사용자 거버넌스를 유지하세요</h3>\r
      <p>\r
        Causeway가 말하는 '모든 것을 예측한다'는 것은 AI가 무제한의 자동 배팅을 허용하는 것이 아니라, 사용자가 실제 사건을 입력할 수 있도록 하는 것이다. 시스템은 시장을 이해하고, 에이전트를 구성하고, 평행 시장 세계를 구축하고, 사실을 확인하고, 전파 경로를 시뮬레이션하고, 거래 가능한 신호를 생성하고, 증거를 유지하고, 사용자가 행동할지 여부를 결정하도록 할 수 있습니다. 미래에 에이전트 기능, 평판 시스템 및 인증 메커니즘이 충분히 성숙되면 사용자는 검증된 에이전트에게 프로세스의 일부를 위임하도록 선택할 수 있습니다. 그러나 기본 경계는 여전히 사용자 거버넌스, 취소 가능한 권한, 명확한 예산 및 완전한 감사여야 합니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">13 / 작업흐름</p>\r
      <h2>사용자 워크플로 및 제품 경험</h2>\r
      <h3>13.1 표준 절차</h3>\r
      <ol>\r
        <li>사용자는 지갑을 연결하고 시장 네트워크에 들어갑니다.</li>\r
        <li>시스템은 Polymarket 이벤트, 시장, 결과, 가격, 거래량 및 관련 시장을 표시합니다.</li>\r
        <li>사용자는 추론의 시작점으로 근본 결과를 선택합니다.</li>\r
        <li>시스템은 후보 시장을 회상하고 AI 프롬프트 입력을 구성합니다.</li>\r
        <li>AI는 인과관계 다이어그램, 결과 권장 사항, 경고 및 신뢰도를 출력합니다.</li>\r
        <li>시스템은 원인 스크립트를 생성하고 사용자는 이를 하나씩 검토, 수정 또는 건너뜁니다.</li>\r
        <li>사용자는 주문미리보기에 접속하여 주문장, 금액, 최대 손실액, 예상이익, 생산능력 현황 등을 확인합니다.</li>\r
        <li>사용자 확인 후 테스트 실행 또는 실제 CLOB 서명 제출.</li>\r
        <li>사용자는 추론 추적을 Arc Testnet에 고정할 수 있습니다.</li>\r
        <li>시스템은 가격 변동, 주문 상태, 손익 및 신호 추적 기록의 최종 결과를 추적합니다.</li>\r
      </ol>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">14 / 거버넌스</p>\r
      <h2>위험 제어, 거버넌스 및 규정 준수 경계</h2>\r
      <h3>14.1 위험 통제 매트릭스</h3>\r
      <table>\r
        <thead><tr><th>위험 카테고리</th><th>구체적인 질문</th><th>제어방식</th></tr></thead>\r
        <tbody>\r
          <tr><td>데이터 위험</td><td>시장 데이터 지연, 결과 매핑 오류, 주문장 이용 불가.</td><td>동기화 시간, tokenId 확인, 실시간 새로 고침, 기능 대체.</td></tr>\r
          <tr><td>정보 위험</td><td>저널리즘 오류, 소셜 미디어 루머, 2차 출처에 대한 잘못된 해석.</td><td>소스 개체, 신뢰할 수 있는 소스 라이브러리, 충돌 감지, 신선도 점수.</td></tr>\r
          <tr><td>위험을 추론하다</td><td>AI 환각, 과신, 반례 누락.</td><td>후보 세트 제약, 구조화된 검증, 회의론자, 신뢰 임계값.</td></tr>\r
          <tr><td>시장 위험</td><td>과도한 스프레드, 부족한 유동성, 상호 배타적인 시장 관련 노출.</td><td>핸디캡 깊이, 보수적 포지션, 이벤트 수준 포트폴리오 위험 제어 및 거래 금지 상태.</td></tr>\r
          <tr><td>실행 위험</td><td>사용자가 실수로 로그인하여 중복 주문을 제출하고 주문이 만료됩니다.</td><td>미리보기 만료, 멱등성 키, 서명 전 확인, 제출 상태 쓰기 저장.</td></tr>\r
          <tr><td>감사 위험</td><td>신호 기록은 사전 존재를 증명할 수 없습니다.</td><td>아크 증명、해시、감사 이벤트、신호 추적 기록。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>14.2 기본 경계</h3>\r
      <ul>\r
        <li>AI 결과는 투자 조언을 구성하지 않습니다.</li>\r
        <li>시스템은 예측 정확성, 수익 또는 시장 결과를 보장하지 않습니다.</li>\r
        <li>기본 모드는 자동 주문이 아닌 사용자 확인입니다.</li>\r
        <li>위임된 실행은 명시적인 승인, 명확한 예산, 범위 제한 및 취소 메커니즘을 통해 향후 구현되어야 합니다.</li>\r
        <li>실시간 거래, 시뮬레이션 거래 및 실행되지 않은 신호는 UI와 데이터에서 명확하게 구분되어야 합니다.</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">15 / 미래의 문제</p>\r
      <h2>앞으로 해결해야 할 문제와 해결방안</h2>\r
      <h3>15.1 문제: 외부 정보 소스의 실시간 및 신뢰성이 부족합니다.</h3>\r
      <p>\r
        현재 단계는 시장 데이터와 통제된 후보 세트에 크게 의존합니다. 다음 단계에서 Causeway는 실시간 뉴스 스트림, 공식 발표, 온체인 이벤트, 스포츠 데이터 및 규제 문서에 액세스해야 합니다. 그러나 외부 정보 소스가 많을수록 소음도 커집니다. 솔루션은 소스 개체 표준화입니다. 각 정보 조각을 청구서, 출처, 타임스탬프, 엔터티, rawPayload 및 신뢰도로 분할하고 신뢰할 수 있는 소스 라이브러리 및 충돌 감지를 통해 워크플로에 들어갑니다.\r
      </p>\r
      <h3>15.2 문제: 단일 모델 추론은 복잡한 세계를 다룰 수 없습니다</h3>\r
      <p>\r
        단일 모델은 단일 경로와 과잉 결정이 발생하기 쉽습니다. Causeway의 장기적인 솔루션은 다중 에이전트 추론 및 Swarm Prediction Engine입니다. Research Agent는 시장 및 이벤트 컨텍스트 수집을 담당하고 Probability Agent는 확률 추정을 제공하고 Skeptic Agent는 반례를 찾고 Verification Agent는 소스를 확인하고 Risk Agent는 유동성과 위치를 결정하며 Execution Guard는 미리보기에 대한 액세스 허용 여부를 결정합니다. 다중 에이전트는 기술을 과시하는 것이 아니라 불일치, 가정, 증거 품질 및 위험을 명시적으로 만들고 복잡한 세계의 다중 경로 진화를 검토 가능한 시장 대응 계획으로 매핑하는 것입니다.\r
      </p>\r
      <h3>15.3 문제: 신호 성능을 지속적으로 입증할 수 없습니다.</h3>\r
      <p>\r
        장기적인 실적이 없으면 AI 추천은 쉽게 단기적으로 표시될 수 있습니다. Causeway는 생성 시간, 시장 가격, AI 공정 확률, 우위, 권장 방향, 사용자 실행 여부, 실행 가격, 현재 가격, 미실현 손익, 최종 결과 및 각 신호에 대한 아크 증명을 기록해야 합니다. 그래야만 시스템이 “AI가 정말 작동하는가?”라고 답할 수 있다.\r
      </p>\r
      <h3>15.4 문제: 자동화된 실행에는 더 강력한 거버넌스가 필요합니다.</h3>\r
      <p>\r
        위임집행의 5단계는 AI가 제한 없이 계정을 통제할 수 있도록 하는 것이 아니라, 명확한 규칙에 따라 사용자가 선택적으로 권한을 부여할 수 있도록 하는 것입니다. 승인에는 시장 범주, 최대 단일 금액, 일일 손실 한도, 최대 관련 노출, 허용 가능한 데이터 소스, 기간, 취소 조건 및 비상 중지가 포함되어야 합니다. 향후 사용자가 자동화된 프로세스에 참여할 성숙한 에이전트를 지정하면 x402는 에이전트 서비스 호출 및 소액 결제를 담당하고 Arc는 인증 및 녹음을 담당하며 Causeway는 권한 거버넌스 및 위험 제어를 담당할 수 있습니다. 실제 거래는 여전히 사용자 승인 및 취소 가능한 경계를 준수해야 합니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">16 / 로드맵</p>\r
      <h2>5단계 기술 로드맵</h2>\r
      <div class="phase-card">\r
        <span class="tag dark">01단계</span><span class="tag">시장 데이터 기반</span>\r
        <h3>시장을 먼저 이해하고 세상을 이해하라</h3>\r
        <p>\r
          첫 번째 단계는 이벤트, 시장, 결과, tokenId, 가격, 거래량, 유동성, 주문서, 규칙 및 상태 등 Polymarket 시장 데이터에 중점을 둡니다. 목표는 시스템이 실제 거래 가능한 구조를 안정적으로 표현할 수 있도록 하고 사용자가 시장 세부 정보 페이지에서 근본 결과를 선택하여 추론에 들어갈 수 있도록 지원하는 것입니다.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">02단계</span><span class="tag">추론 모델</span>\r
        <h3>모든 관련 시장에 이벤트 매핑</h3>\r
        <p>\r
          관련 시장에 대한 관련성, 방향, 신뢰도, 거래 가능성 및 권장 사항을 제공하기 위해 더 강력한 추론 모델을 구축합니다. BUY / WATCH / AVOID, 내 마음을 바꿀 것, 보수적 입장 추천 및 다중 에이전트 발산 검사를 도입하여 AI를 챗봇이 아닌 트레이딩 리서치 팀에 더 가깝게 만듭니다.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">03단계</span><span class="tag">실시간 시나리오 생성</span>\r
        <h3>뉴스 흐름을 시장 전반의 대응 플레이북으로 전환</h3>\r
        <p>\r
          실시간 이벤트 스트림에 액세스하고 엔터티, 주제, 이벤트 유형 및 영향 경로를 자동으로 추출하고 시장 전반에 걸쳐 응답 스크립트를 생성합니다. 시스템은 영향을 받은 시장, 누락된 확인 신호, 위험 상태 및 권장 워크플로우를 출력하고 이벤트 추론을 직접 주문이 아닌 병렬 시장 세계 시뮬레이션으로 점진적으로 확장해야 합니다.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">04단계</span><span class="tag">검증 및 아크 증명</span>\r
        <h3>베팅하기 전에 증거를 요청하고, 추론한 후에 증거를 저장하세요.</h3>\r
        <p>\r
          신뢰할 수 있는 데이터 소스 라이브러리를 구축하여 기본 사실을 자동으로 추적합니다. 동시에 주요 추론 추적 해시를 Arc에 작성하여 검증 가능한 기록을 형성합니다. 이 단계의 목표는 속도, 신뢰성 및 감사 가능성을 통합하는 것입니다.\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">05단계</span><span class="tag">위임된 AI 실행</span>\r
        <h3>사용자는 선택적으로 제한된 실행을 위임합니다.</h3>\r
        <p>\r
          권한, 예산, 시간, 시장 범위 및 철회 메커니즘이 성숙된 후 사용자는 AI가 제한된 조건에서 수행되도록 선택할 수 있습니다. 앞으로 사용자는 검증된 성숙한 에이전트를 지정하여 위임 프로세스에 참여하여 x402를 통해 데이터 검증, 위험 평가 및 실행 지원 시간당 지불 정산을 완료할 수도 있습니다. 이 기능은 기본적으로 꺼져 있어야 하며 아크 방지, 전체 감사, 비상 중지 및 권한 만료 메커니즘을 통해 관리되어야 합니다.\r
        </p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">17 / 경제 모델</p>\r
      <h2>비즈니스 모델 및 가치 포착</h2>\r
      <h3>17.1 수익 모델</h3>\r
      <table>\r
        <thead><tr><th>모델</th><th>설명하다</th><th>적용단계</th></tr></thead>\r
        <tbody>\r
          <tr><td>프리미엄 구독</td><td>현재 Arc USDC 지불 의도를 통해 고급 모델, 심층 추론, 전체 추론 추적, Arc 증명 및 모니터링 기능을 잠금 해제하고 있습니다. 향후 Arc 결제 기반의 x402 Pay-Per-Call 및 기능 패키지로 확장 가능합니다.</td><td>1~3단계</td></tr>\r
          <tr><td>빌더 기여</td><td>사용자는 Causeway를 통해 실제 Polymarket 주문을 확인하고 거래는 빌더 코드를 통해 귀속됩니다.</td><td>1~5단계</td></tr>\r
          <tr><td>신호 API</td><td>연구원, 엔드포인트 및 정책 시스템에 구조화된 신호, 시장 그래프 및 실적 API를 제공합니다.</td><td>2~4단계</td></tr>\r
          <tr><td>팀 작업공간</td><td>팀을 위한 협업, 권한, 감사, 보고, 위험 예산 책정 및 정책 라이브러리를 제공합니다.</td><td>3~5단계</td></tr>\r
          <tr><td>x402 에이전트 서비스 계층</td><td>미래에는 외부 데이터 소스, 검증 서비스, 전문 에이전트 및 x402를 통한 심층 보고를 통해 기계 판독 가능한 액세스당 지불 및 소액 결제가 가능해질 것입니다.</td><td>3~5단계</td></tr>\r
          <tr><td>떼 예측 보고서</td><td>시장, 이벤트 또는 테마별로 판매되는 병렬 시장 세계 및 다중 에이전트 토론을 기반으로 전문적인 예측 보고서를 생성합니다.</td><td>3~5단계</td></tr>\r
          <tr><td>에이전트 마켓플레이스</td><td>미래에는 전문 대리인, 검증 소스, 보고 템플릿 및 정책 모듈이 Arc USDC를 통해 x402에 정착하고 검증 가능한 실적을 기반으로 평판을 구축할 수 있게 될 것입니다.</td><td>4~5단계</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>17.2 가치 플라이휠</h3>\r
      <p>\r
        더 많은 시장 데이터는 더 완전한 시장 지도를 제공합니다. 더욱 완전한 지도는 AI 추론의 품질을 향상시킵니다. 더 높은 품질의 추론은 더 많은 사용자를 끌어 실제 피드백을 생성합니다. 더 많은 피드백이 신호 기록을 형성합니다. 검증 가능한 실적은 신뢰를 향상시킵니다. 신뢰는 프리미엄, API, 팀, x402 에이전트 서비스, Swarm 예측 보고서 및 빌더 기여 수익을 제공합니다. 결과적으로 수익은 더 나은 데이터 소스, 모델, 검증 에이전트, 떼 시뮬레이션 시스템 및 위험 제어 시스템을 지원합니다.\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">18 / 해자 및 KPI</p>\r
      <h2>해자, 지표 및 결론</h2>\r
      <h3>18.1 해자</h3>\r
      <ul>\r
        <li><strong>시장 구조 이해:</strong>이벤트, 시장, 결과 토큰, CLOB 및 주문 한도에 대한 심층적인 모델링.</li>\r
        <li><strong>추론 데이터 폐쇄 루프:</strong>추론 실행부터 원인 스크립트, 주문 의도, 아크 증명 및 실적까지 완전한 링크입니다.</li>\r
        <li><strong>군집 지능 예측 기능:</strong>다중 에이전트 업무 분업, 병렬 시장 세계, 시나리오 트리 및 시장 지도를 결합하여 검증 가능한 전문 예측 보고서를 구성합니다.</li>\r
        <li><strong>검증 가능한 기록:</strong>아크 방지는 신호 성능을 단순한 배경 기록이 아니라 감사 가능한 개체로 만듭니다.</li>\r
        <li><strong>사용자 거버넌스 경계:</strong>블랙박스 자동매매를 핵심으로 삼는 것이 아니라, 사용자가 제어할 수 있는 지능형 실행을 방향으로 삼는다.</li>\r
        <li><strong>지능형 경제 입구:</strong>Arc USDC 프리미엄과 미래의 x402 에이전트 서비스 레이어는 AI 기능의 소규모, 빈번하고 검증 가능한 정착을 위한 기반을 제공합니다.</li>\r
      </ul>\r
      <h3>18.2 핵심 지표</h3>\r
      <table class="kpi">\r
        <tbody>\r
          <tr><td>시장 범위</td><td>동기화된 시장 수, 활성 시장 범위 및 결과 토큰 매핑 정확도.</td></tr>\r
          <tr><td>추론 품질</td><td>추론 성공률, 스키마 검증 통과율, 유효 신호 비율, 거래 없음 비율.</td></tr>\r
          <tr><td>떼 품질</td><td>에이전트 발산, 보정 가중치 합의, 장면 적용 범위, 반례 적중률, 예측 보고서 검토 성능.</td></tr>\r
          <tr><td>사용자 퍼널</td><td>시세 조회, 추론 시작, 스크립트 저장, 주문 미리보기, 사용자 확인, 실제 거래까지.</td></tr>\r
          <tr><td>아크 증명 채택</td><td>증명 생성 수, 앵커 수, 검증 성공률, ArcScan 클릭률.</td></tr>\r
          <tr><td>신호실적</td><td>신호 후 가격 변동, 최종 정확도, 손익, 사용자 실행률, 종료 권장 적중률.</td></tr>\r
          <tr><td>경제학</td><td>프리미엄 전환율, USDC 결제 성공률, x402 통화 시간, 에이전트 서비스 GMV, 빌더 기여 볼륨, API 수익.</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>18.3 결론</h3>\r
      <p>\r
        Causeway의 가치는 사용자가 거래 버튼을 더 빠르게 클릭할 수 있도록 하는 데 있는 것이 아니라 예측 시장을 위한 신뢰할 수 있는 지능형 인프라 계층을 구축하는 데 있습니다. 시장 구조, AI 추론, 위험 미리 보기, 사용자 확인, Arc 인증 및 성과 추적을 폐쇄 루프로 연결합니다. 단기적으로 이를 통해 사용자는 Polymarket 시장을 더 잘 이해하고 실행할 수 있습니다. 중기적으로는 검증 가능한 예측 시장 신호 계층이 됩니다. 장기적으로는 군집 지능 예측 엔진으로 발전하고, 여러 시장에서 실제 사건의 확산을 시뮬레이션하고, 전문적인 예측 보고서를 출력할 수 있습니다.\r
      </p>\r
      <div class="callout">\r
        <strong>최종 비전:</strong>\r
        Causeway는 "자동화된 베팅 도구"가 아니라 "모든 것을 예측하는 군중 지능 엔진"의 초기 형태입니다. 사용자가 이벤트를 입력하고, 시스템이 시장을 이해하고, 에이전트를 구성하고, 평행 시장 세계를 구축하고, 사실을 확인하고, 경로를 시뮬레이션하고, 신호를 생성하고, 증거를 유지하고, 사용자가 행동할지 여부를 결정합니다. 장기적으로 Arc는 신뢰할 수 있는 기록 및 정산 기반을 담당하고, x402는 지능형 에이전트 서비스 호출을 담당하며, Causeway는 예측 시장의 지능형 조정을 담당합니다.\r
      </div>\r
    </section>\r
\r
    <section>\r
      <p class="eyebrow">19 / 참고자료</p>\r
      <h2>참고자료</h2>\r
      <div class="source-list">\r
        <p>1. 울퍼스(Wolfers), 저스틴(Justin), 에릭 지체위츠(Eric Zitzewitz) <em>예측 시장</em>, 경제 관점 저널, 2004. https://pubs.aeaweb.org/doi/pdfplus/10.1257/0895330041371321</p>\r
        <p>2. 스노우버그, 에릭, 저스틴 울퍼스, 에릭 Zitzewitz, <em>경제 예측을 위한 예측 시장</em>, NBER 작업 문서 18222, 2012. https://www.nber.org/system/files/working_papers/w18222/w18222.pdf</p>\r
        <p>3. Wharton Rodney L. White Center 연구 보고서, 예측 시장 조사, 2006년. https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0608.pdf</p>\r
        <p>4. Cao, 예측 시장 조사 논문, 뉴질랜드 경제학자 협회 아카이브. https://www.nzae.org.nz/wp-content/uploads/2014/05/Cao.pdf</p>\r
        <p>5. Journal of Prediction Markets 기사 아카이브, 예측 시장 및 차익 거래 연구. https://www.ubplj.org/index.php/jpm/article/view/1796</p>\r
        <p>6. <em>예측 시장의 차익 거래</em>, 연구 아카이브. https://www.researchgate.net/publication/262875038_Arbitrage_trade_in_prediction_markets</p>\r
        <p>7. 현대 예측 시장 차익거래 및 의미론적 시장 종속성에 대한 arXiv 사전 인쇄. https://arxiv.org/pdf/2508.03474.pdf</p>\r
        <p>8. KPMG, <em>예측 시장: 진입 경로</em>, 2026. https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/prediction-markets-paths-to-entry.pdf</p>\r
        <p>9. 코인데스크, <em>폴리마켓, 대선 계약 체결</em>, 2024년. https://www.coindesk.com/markets/2024/11/06/polymarket-resolves-presidential-election-contract</p>\r
        <p>10. 액시오스, <em>폴리마켓, 뉴욕증권거래소 모회사로부터 대규모 투자 받아</em>, 2025. https://www.axios.com/2025/10/07/polymarket-new-york-stock-exchange</p>\r
        <p>11. 폴리마켓 문서, <em>감마 시장 API 개요</em>. https://docs.polymarket.com/developers/gamma-markets-api/overview</p>\r
        <p>12. 폴리마켓 문서, <em>폴리마켓 CLOB에서 거래하기</em>. https://docs.polymarket.com/developers/CLOB/trades/trades-data-api</p>\r
        <p>13. 폴리마켓 문서, <em>빌더 프로그램</em>. https://docs.polymarket.com/developers/builders/examples</p>\r
        <p>14. 아크 문서, <em>아크에 연결</em>. https://docs.arc.io/integrate/connect-to-arc</p>\r
        <p>15. 아크 문서, <em>아크 네트워크</em>. https://docs.arc.network/arc-chain</p>\r
        <p>16. x402 프로토콜, <em>인터넷을 위한 개방형 결제 프로토콜</em>. https://www.x402.org/</p>\r
        <p>17. 코인베이스 개발자 플랫폼, <em>x402</em>. https://www.coinbase.com/developer-platform/products/x402/</p>\r
        <p>18. 클라우드플레어 문서, <em>에이전트 x402</em>. https://developers.cloudflare.com/agents/x402/</p>\r
      </div>\r
      <div class="disclaimer">\r
        저작권 © 2026 Causeway. 이 문서는 초안 제품, 기술 및 경제 백서이며 투자 조언, 법률 자문, 중개 서비스, 소득 약속 또는 규제 의견을 구성하지 않습니다. 이 기사에 언급된 시장 데이터 및 업계 정보는 공개 정보에서 나온 것입니다. 실제 데이터는 통계 수준, 기간, 플랫폼 정의 및 시장 변화로 인해 다를 수 있습니다. 사용자는 독립적인 판단을 내리고 시장 예측과 관련된 위험을 감수해야 합니다.\r
      </div>\r
    </section>\r
  </body>\r
</html>\r
`,S=`<!doctype html>\r
<html lang="zh-CN">\r
  <head>\r
    <meta charset="utf-8" />\r
    <title>Causeway Technical & Economic Whitepaper v0.6 ZH</title>\r
    <style>\r
      @page { size: A4; margin: 13mm 12mm; }\r
      :root {\r
        --ink: #081b33;\r
        --ink-2: #0a2a52;\r
        --blue: #1677ff;\r
        --cyan: #22c7e8;\r
        --green: #14b87a;\r
        --amber: #f59e0b;\r
        --red: #ef4444;\r
        --muted: #53657d;\r
        --line: #d8e6f5;\r
        --soft: #f5faff;\r
        --paper: #ffffff;\r
      }\r
      * { box-sizing: border-box; }\r
      body {\r
        margin: 0;\r
        background: var(--paper);\r
        color: var(--ink);\r
        font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;\r
        font-size: 10pt;\r
        line-height: 1.56;\r
      }\r
      h1, h2, h3, h4, p { margin-top: 0; }\r
      h1 { margin: 0 0 18px; font-size: 42pt; line-height: .96; letter-spacing: 0; }\r
      h2 { margin: 0 0 9px; color: var(--ink); font-size: 18pt; line-height: 1.12; break-after: avoid; }\r
      h3 { margin: 13px 0 5px; color: var(--ink-2); font-size: 11.8pt; line-height: 1.22; break-after: avoid; }\r
      h4 { margin: 10px 0 4px; color: var(--ink); font-size: 10.6pt; line-height: 1.25; }\r
      p { margin-bottom: 6px; }\r
      ul, ol { margin: 5px 0 8px 18px; padding: 0; }\r
      li { margin: 2px 0; }\r
      table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; break-inside: avoid; }\r
      th, td { border: 1px solid var(--line); padding: 5px 6px; text-align: left; vertical-align: top; }\r
      th { background: var(--soft); color: var(--ink); font-weight: 800; }\r
      code { font-family: Consolas, "SFMono-Regular", monospace; font-size: 9.3pt; color: var(--ink-2); }\r
      .cover { min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; position: relative; }\r
      .cover::before {\r
        content: "";\r
        position: absolute;\r
        inset: -13mm -12mm;\r
        z-index: -1;\r
        background:\r
          linear-gradient(rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          linear-gradient(90deg, rgba(8, 27, 51, .035) 1px, transparent 1px),\r
          radial-gradient(circle at 76% 16%, rgba(22, 119, 255, .17), transparent 34%),\r
          radial-gradient(circle at 22% 82%, rgba(34, 199, 232, .12), transparent 30%),\r
          #fff;\r
        background-size: 26px 26px, 26px 26px, auto, auto, auto;\r
      }\r
      .brand img { width: 168px; height: auto; margin-bottom: 46px; }\r
      .eyebrow { margin: 0 0 13px; color: var(--blue); font-size: 8.8pt; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }\r
      .subtitle { max-width: 650px; color: #273b57; font-size: 15.2pt; line-height: 1.56; }\r
      .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 28px; }\r
      .meta-grid div, .callout, .principle, .phase-card, .note, .metric-card, .source-card {\r
        border: 1px solid var(--line);\r
        border-radius: 7px;\r
        background: rgba(245, 250, 255, .82);\r
        padding: 8px;\r
      }\r
      .meta-grid span, .small-label { display: block; color: var(--muted); font-size: 8pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }\r
      .meta-grid b { display: block; margin-top: 4px; font-size: 10.5pt; }\r
      .page { break-after: auto; margin-bottom: 8mm; }\r
      .toc { columns: 2; column-gap: 26px; }\r
      .toc p { break-inside: avoid; border-bottom: 1px solid var(--line); margin: 0 0 7px; padding-bottom: 6px; font-weight: 720; }\r
      .callout { margin: 8px 0 10px; border-left: 4px solid var(--blue); background: #f5faff; }\r
      .callout strong { color: var(--blue); }\r
      .warning { border-left-color: var(--amber); background: #fff8ed; }\r
      .warning strong { color: #a15c00; }\r
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }\r
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }\r
      .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }\r
      .principle, .metric-card { min-height: 88px; break-inside: avoid; }\r
      .principle b, .metric-card b, .note b { display: block; margin: 4px 0 6px; color: var(--ink); font-size: 11.2pt; }\r
      .principle p, .phase-card p, .note p, .metric-card p, .source-card p { margin-bottom: 0; color: #273b57; font-size: 8.9pt; line-height: 1.45; }\r
      .phase-card { break-inside: avoid; margin-bottom: 6px; }\r
      .phase-card h3 { margin-top: 4px; }\r
      .tag {\r
        display: inline-block;\r
        margin: 0 5px 5px 0;\r
        border: 1px solid #bcd7ff;\r
        border-radius: 999px;\r
        background: #eef6ff;\r
        color: var(--blue);\r
        padding: 2px 8px;\r
        font-size: 8pt;\r
        font-weight: 800;\r
      }\r
      .tag.dark { border-color: var(--ink); background: var(--ink); color: #fff; }\r
      .hero-image { overflow: hidden; border: 1px solid rgba(22,119,255,.22); border-radius: 10px; height: 96mm; margin: 14px 0; background: #06162b; }\r
      .hero-image img { width: 100%; height: 100%; object-fit: cover; }\r
      .concept-figure { break-inside: avoid; width: 72%; margin: 9px auto 12px; }\r
      .concept-figure-frame { overflow: hidden; border: 1px solid rgba(22,119,255,.2); border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(8,27,51,.08); }\r
      .concept-figure img { display: block; width: 100%; max-height: 82mm; object-fit: contain; }\r
      .concept-figure .caption { margin: 5px 0 0; line-height: 1.42; }\r
      .caption { color: var(--muted); font-size: 8pt; }\r
      .disclaimer, .footnotes { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 11px; color: var(--muted); font-size: 8.2pt; line-height: 1.52; }\r
      .no-break { break-inside: avoid; }\r
      .source-list p { margin-bottom: 5px; word-break: break-all; }\r
      .kpi td:first-child { width: 24%; font-weight: 800; color: var(--ink-2); }\r
      .formula {\r
        border: 1px solid var(--line);\r
        border-left: 5px solid var(--green);\r
        border-radius: 8px;\r
        background: #f3fff9;\r
        margin: 6px 0 8px;\r
        padding: 7px 9px;\r
        break-inside: avoid;\r
      }\r
      .formula code { display: block; margin: 2px 0; color: #07513a; font-size: 8.8pt; }\r
      .formula p { margin: 4px 0 0; color: #244a3d; font-size: 8.6pt; line-height: 1.42; }\r
    </style>\r
  </head>\r
  <body>\r
    <section class="cover">\r
      <div>\r
        <div class="brand"><img src="../../public/assets/causeway-lockup-primary.svg" alt="Causeway" /></div>\r
        <p class="eyebrow">Technical & Economic Whitepaper</p>\r
        <h1>Causeway<br />技术经济白皮书</h1>\r
        <p class="subtitle">\r
          面向预测市场的 AI 交易智能与可验证推理层：从 Polymarket 市场数据、因果推演、风险预览，走向 Arc 可验证推理、USDC 原生智能体经济与群体智能预测引擎。\r
        </p>\r
        <div class="meta-grid">\r
          <div><span>Version</span><b>v0.6</b></div>\r
          <div><span>Date</span><b>2026-05</b></div>\r
          <div><span>Status</span><b>Detailed Draft</b></div>\r
          <div><span>Scope</span><b>Market + Arc</b></div>\r
        </div>\r
      </div>\r
      <div class="disclaimer">\r
        本白皮书用于阐述 Causeway 的市场判断、产品定位、技术架构、Arc 集成、经济模型、风险边界和未来路线图。本文不构成投资建议、法律意见、经纪服务说明、收益承诺或任何形式的自动交易邀约。预测市场具有显著风险，任何真实交易均应由用户基于自身判断主动确认。\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">Table of Contents</p>\r
      <h2>目录</h2>\r
      <div class="toc">\r
        <p>01. 执行摘要</p>\r
        <p>02. 市场背景：预测市场进入主流化阶段</p>\r
        <p>03. 核心问题：为什么现有预测市场仍缺少智能层</p>\r
        <p>04. 学术基础与价值计算框架</p>\r
        <p>05. Causeway 的产品定义</p>\r
        <p>06. 我们已经解决了什么问题</p>\r
        <p>07. 系统架构与数据模型</p>\r
        <p>08. AI Trader Intelligence：从概率到行动预览</p>\r
        <p>09. Arc Proof：可验证的 AI 推理记录</p>\r
        <p>10. Arc USDC Premium：智能体经济与付费能力</p>\r
        <p>11. x402 Agent Service Layer：未来智能体服务协议层</p>\r
        <p>12. Swarm Prediction Engine：从平行市场世界到预测万物</p>\r
        <p>13. 用户工作流与产品体验</p>\r
        <p>14. 风控、治理与合规边界</p>\r
        <p>15. 未来需要解决的问题</p>\r
        <p>16. 五阶段技术路线图</p>\r
        <p>17. 商业模式与价值捕获</p>\r
        <p>18. 护城河、指标与结论</p>\r
        <p>19. 参考资料</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">01 / Executive Summary</p>\r
      <h2>执行摘要</h2>\r
      <p>\r
        Causeway 是一个面向预测市场的 AI 交易智能与可验证推理层。它的基本判断是：预测市场正在从“少数加密用户参与的事件下注界面”演化为“面向现实事件、宏观风险、体育、政治、公司事件和链上活动的概率基础设施”。当市场数量、交易量和参与者复杂度上升时，用户需要的不再只是更好看的盘口页面，而是一套能够把事件转化为可审查市场判断的智能系统。\r
      </p>\r
      <p>\r
        当前预测市场界面的核心缺口在于：市场之间的关系没有被结构化，AI 给出的判断缺少可验证推理记录，交易建议缺少风险和仓位约束，用户很难复盘一个信号为什么产生、依据是什么、后来是否正确。Causeway 试图填补这一层空白：从 Polymarket 市场数据出发，构建市场网络，生成因果脚本，输出概率、edge、风险和预览，并把 AI reasoning trace 锚定到 Arc Testnet，使“事前推理”和“事后结果”可以被审计。\r
      </p>\r
      <div class="callout">\r
        <strong>一句话定位：</strong>\r
        Causeway turns prediction markets into an AI-readable, AI-reasoned, user-executed, and Arc-verifiable trading intelligence layer.\r
      </div>\r
      <p>\r
        与普通 AI 聊天助手不同，Causeway 的核心产物不是一段无法复盘的自然语言回答，而是结构化的 market intelligence object：根市场、根 outcome token、候选市场、因果边、概率估计、市场隐含概率、edge、BUY / WATCH / AVOID 建议、风险解释、订单预览、用户确认状态、Arc proof hash 和后续绩效记录。系统默认不替用户托管资金，不绕过用户签名，不把 AI 输出包装成投资建议；它提供的是一套可解释、可验证、可治理的预测市场工作流。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">02 / Market Context</p>\r
      <h2>市场背景：预测市场进入主流化阶段</h2>\r
      <h3>2.1 交易量与机构关注度正在快速上升</h3>\r
      <p>\r
        预测市场在 2024 年美国大选周期中完成了第一次大规模出圈。CoinDesk 报道称，Polymarket 的 2024 年美国总统选举合约成交量超过 36 亿美元，该市场也使预测市场首次被大规模主流媒体和普通用户关注。到 2025 年，行业增长从单一政治事件扩展到体育、宏观、加密、经济数据、公司事件和文化事件等更多类别。\r
      </p>\r
      <p>\r
        KPMG 在 2026 年关于预测市场进入路径的报告中指出，Kalshi 与 Polymarket 的合计交易量在 2025 年超过 400 亿美元，而 2024 年约为 90 亿美元，年增长超过 400%。该报告还提到，Polymarket 在 2025 年 10 月的月交易量超过 30 亿美元。虽然不同数据源的口径会因平台、成交量定义和时间范围不同而变化，但方向是一致的：预测市场已经从实验性产品进入高增长、强监管关注和机构参与阶段。\r
      </p>\r
      <h3>2.2 预测市场正在从“交易场所”变成“概率数据层”</h3>\r
      <p>\r
        ICE（纽约证券交易所母公司）对 Polymarket 的战略投资进一步说明，市场关注的不只是交易手续费，而是事件驱动数据本身。Axios 报道称，ICE 同意向 Polymarket 投资最高 20 亿美元，并将成为 Polymarket 事件驱动数据的全球分销商。这意味着预测市场的价值不只在交易，而在于它把现实世界的不确定性实时转化为可观察的概率数据。\r
      </p>\r
      <div class="grid-3">\r
        <div class="metric-card">\r
          <span class="small-label">Market Signal</span>\r
          <b>成交量扩大</b>\r
          <p>平台交易量从大选周期峰值扩展到多类别常态化交易，市场深度和用户结构更复杂。</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Institutional Signal</span>\r
          <b>机构进入</b>\r
          <p>交易所、券商、体育平台和金融科技公司正在寻找预测市场入口。</p>\r
        </div>\r
        <div class="metric-card">\r
          <span class="small-label">Data Signal</span>\r
          <b>概率数据化</b>\r
          <p>预测市场价格正在被重新理解为事件驱动数据，而不只是用户下注结果。</p>\r
        </div>\r
      </div>\r
      <h3>2.3 增长带来的新矛盾</h3>\r
      <p>\r
        市场扩大后，用户面临的不再是“找不到市场”，而是“无法判断哪些市场值得研究、哪些价格已经反映信息、哪些关联市场存在滞后、哪些信号是噪音”。交易量增长越快，越需要智能层去组织市场关系、解释概率变化、识别错价、控制风险并形成可复盘记录。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">03 / Problem</p>\r
      <h2>核心问题：为什么现有预测市场仍缺少智能层</h2>\r
      <h3>3.1 问题一：市场是网络，界面却仍是列表</h3>\r
      <p>\r
        一个现实事件很少只影响一个市场。例如一次美联储表态可能同时影响利率、通胀、美元、加密资产、股指、黄金、选举叙事和相关公司事件；一次体育伤病消息可能影响胜负盘、冠军盘、球员数据盘和同组出线概率。传统界面通常以市场列表、事件页和搜索结果呈现，缺少“事件如何跨市场传播”的结构化表示。\r
      </p>\r
      <h3>3.2 问题二：市场数据结构复杂，交易对象不是标题</h3>\r
      <p>\r
        Polymarket 的交易对象不是市场标题，而是 outcome token。官方 Gamma API 中 <code>outcomes</code>、<code>outcomePrices</code> 与 CLOB token ID 存在索引映射关系；同一 event 下也可能存在多个 market。对于用户和 AI 系统而言，如果只理解标题或 Yes/No 文案，就容易在多 outcome 市场、体育市场、区间市场和互斥事件中产生错误映射。\r
      </p>\r
      <h3>3.3 问题三：AI 推荐缺少可审计性</h3>\r
      <p>\r
        普通 AI 系统可以生成“建议买 Yes”这样的回答，但这个回答往往缺少输入快照、候选市场范围、prompt 版本、模型版本、输出 schema、推理路径、反例和事后追踪。预测市场的特殊性在于：结果会被未来验证。如果系统无法证明某个判断是在结果发生前生成的，也无法证明后来没有修改推理，那么信号绩效就缺少可信基础。\r
      </p>\r
      <h3>3.4 问题四：速度与治理之间存在冲突</h3>\r
      <p>\r
        事件市场的优势在于反应快，但过快也会放大错误信息、幻觉、流动性不足和过度交易风险。一个专业系统不能只追求自动执行，而必须把预览、预算、可交易状态、订单簿刷新、用户确认、审计记录和权限撤销纳入同一流程。\r
      </p>\r
      <div class="callout warning">\r
        <strong>产品判断：</strong>\r
        预测市场下一阶段的核心竞争不是“谁有更多市场页面”，而是“谁能把市场价格、AI 推理、真实执行和可验证记录组织成完整智能闭环”。\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">04 / Academic Foundation</p>\r
      <h2>学术基础与价值计算框架</h2>\r
      <p>\r
        预测市场的理论价值来自一个简单但强大的机制：当合约按事件结果支付固定金额时，交易价格可以在一定条件下近似表达市场对事件发生概率的集合判断。Wolfers 与 Zitzewitz 对预测市场的综述指出，预测市场能够把分散信息通过价格聚合成可读信号；Snowberg、Wolfers 与 Zitzewitz 进一步把这种机制用于经济预测场景，说明事件合约价格可以成为宏观和政策不确定性的实时概率表达。Causeway 的价值不是重新发明预测市场，而是在“价格作为概率信号”的基础上，增加 AI 推理、跨市场一致性检测、执行摩擦校正、风险预算和可验证绩效记录。\r
      </p>\r
      <h3>4.1 价格即概率，但不是无条件真理</h3>\r
      <p>\r
        对一个二元事件合约而言，如果事件发生时合约支付 1 美元，未发生时支付 0 美元，在风险中性、交易成本较低、流动性充分、参与者能够自由交易的理想条件下，市场价格 <code>p</code> 可以被理解为市场隐含概率。现实预测市场并不总满足这些条件：价差、手续费、滑点、限额、信息噪声、操纵尝试、监管限制和参与者风险偏好都会让价格偏离“真实概率”。因此 Causeway 不把市场价格当作结论，而把它当作第一层可观察信号，再由 AI fair odds、来源求证、流动性检查和风险模型共同解释。\r
      </p>\r
      <div class="formula">\r
        <code>p_mid = (bestBid + bestAsk) / 2</code>\r
        <code>p_exec_yes = ask_yes, p_exec_no = ask_no</code>\r
        <code>q_ai = calibratedForecast(event | marketSnapshot, sourceObjects, reasoningTrace)</code>\r
        <code>rawEdge_mid = q_ai - p_mid</code>\r
        <p><code>p_mid</code> 适合展示市场隐含概率，<code>p_exec_yes</code> 才是买入 YES 的真实执行概率门槛。Causeway 应区分“研究用概率”和“可成交概率”，避免用中间价夸大 edge。</p>\r
      </div>\r
      <h3>4.2 交易价值来自“扣除摩擦后的正期望”</h3>\r
      <p>\r
        对用户真正有价值的不是“AI 认为概率更高”，而是“在当前可成交价格、手续费、滑点、盘口深度和不确定性折扣之后仍然存在正期望”。这也是预测市场套利研究反复强调的核心：理论上的价格不一致只有在可执行、可结算、扣除成本后仍为正时才构成真实机会。Causeway 因此把机会分成 raw signal、tradable signal 和 executable order preview 三个层级。\r
      </p>\r
      <div class="formula">\r
        <code>EV_token_yes = q_ai * 1 + (1 - q_ai) * 0 - ask_yes - cost_per_token</code>\r
        <code>ROI_yes = EV_token_yes / ask_yes</code>\r
        <code>edgeNet = q_ai - ask_yes - feeRate - slippageBps - ruleRiskHaircut - sourceRiskHaircut</code>\r
        <code>BUY only if edgeNet &gt; minEdge, depthAtLimit &gt; targetSize, timeToClose &gt; minWindow</code>\r
        <p>净优势必须同时通过概率、成本、深度和时间窗口约束。若任一约束不足，系统应降级为 WATCH、VERIFY FIRST 或 AVOID。</p>\r
      </div>\r
      <h3>4.3 仓位建议：用保守 Kelly，而不是冲动下注</h3>\r
      <p>\r
        在事件合约中，买入价格本身接近最大损失；事件发生时合约价值趋近 1，未发生时趋近 0。Kelly 公式可作为仓位建议的理论起点，但预测市场包含模型误差、流动性不连续、规则解释差异和事件结算风险，因此必须使用折扣版本，并叠加市场容量、组合相关性和用户预算上限。Causeway 输出的是风险预算建议，而不是收益承诺。\r
      </p>\r
      <div class="formula">\r
        <code>q_adj = clamp(0.5 + confidence * (q_ai - 0.5), 0.01, 0.99)</code>\r
        <code>b = (1 - p_exec) / p_exec</code>\r
        <code>kellyFull = (b * q_adj - (1 - q_adj)) / b = (q_adj - p_exec) / (1 - p_exec)</code>\r
        <code>sizeUsd = bankroll * min(max(0, lambda * kellyFull), capMarket, capPortfolio, capCorrelation)</code>\r
        <p><code>q_adj</code> 用置信度把模型概率向 50% 回缩，<code>lambda</code> 为 fractional Kelly 折扣。仓位必须再受市场容量、组合相关性、日损失上限和用户预算共同约束。</p>\r
      </div>\r
      <h3>4.4 互斥完备市场：从价格和识别套利与风险</h3>\r
      <p>\r
        在总统赢家、冠军归属、区间结果等互斥且完备的多 outcome 市场中，所有 outcome 的真实概率之和应接近 1。套利论文常用这一结构检测价格不一致：如果买入所有 outcome 的总 ask 小于 1，理论上存在“买全篮子”的利润空间；如果可卖出的总 bid 大于 1，则可能存在反向套利或过度定价信号。但真实交易需要考虑是否能同时成交、是否允许做空、是否存在取消/结算风险，以及盘口深度是否足够。\r
      </p>\r
      <div class="formula">\r
        <code>Underround: Σ ask_i + fees + slippage &lt; 1</code>\r
        <code>profitFloor_buyBasket = 1 - Σ ask_i - fees - slippage - settlementRisk</code>\r
        <code>Overround: Σ bid_i - fees - slippage &gt; 1, if sell/short/redeem path exists</code>\r
        <code>executable = profitFloor &gt; 0 and min(depth_i) &gt; targetSize and rules_i are consistent</code>\r
        <p>Causeway 不把互斥完备套利简化为数学题，而是把它作为 Market Graph 的一致性检查：先发现价格异常，再验证深度、规则、结算和执行路径。</p>\r
      </div>\r
      <h3>4.5 跨市场语义一致性：从“同一事件”到“全市场图谱”</h3>\r
      <p>\r
        现代 Polymarket 不是孤立市场集合，而是一张由事件、实体、时间窗口、规则文本和结果条件构成的语义网络。一个市场可能逻辑蕴含另一个市场：例如“候选人赢得总统大选”蕴含“候选人赢得所在党派提名之后仍有机会进入大选结果”，某个球队“赢得冠军”蕴含其“进入决赛/季后赛”的概率不应更低。若蕴含市场的价格高于被蕴含市场太多，系统应标记为语义不一致或潜在错价。用户提供的 Polymarket 语义套利与预测市场套利文献正好支持 Causeway 的 Market Graph 方向：AI 的优势在于读懂规则文本、识别蕴含关系，并把它们变成可计算约束。\r
      </p>\r
      <div class="formula">\r
        <code>If event B implies event A, then P(B) ≤ P(A)</code>\r
        <code>violation = max(0, p_exec(B) - p_exec(A) - costMargin - ruleRiskMargin)</code>\r
        <code>semanticEdge = violation * relationConfidence * min(liquidityScore_A, liquidityScore_B)</code>\r
        <code>tradeableSemanticEdge = semanticEdge only if both markets share compatible resolution rules</code>\r
        <p>这里的关键不是让模型“猜”，而是让模型输出可审查的关系类型：implies、mutually exclusive、correlated、causal、same source 或 unrelated。</p>\r
      </div>\r
      <h3>4.6 案例：Causeway 如何把论文价值落到产品</h3>\r
      <table>\r
        <thead><tr><th>学术/市场案例</th><th>传统价值</th><th>Causeway 的产品化方式</th></tr></thead>\r
        <tbody>\r
          <tr><td>选举市场</td><td>价格把民调、新闻、交易者判断和风险偏好聚合为实时胜率。</td><td>把候选人、州、党派、提名、投票率和宏观事件映射为 market graph，识别哪些盘口已经反映新闻，哪些相关市场滞后。</td></tr>\r
          <tr><td>宏观经济发布</td><td>CPI、利率、就业、衰退等事件可用合约价格形成实时预期。</td><td>把数据发布时间、共识预期、历史修正、Fed 表态和资产反应写入 Source Object，生成“数据前/数据后”策略观察清单。</td></tr>\r
          <tr><td>体育冠军/赛事赢家</td><td>互斥完备 outcome 的价格和可用于检测 overround、underround 与盘口异常。</td><td>自动计算同组 outcome 的 sumAsk、sumBid、深度和结算规则，给出可执行性而不是只给理论套利。</td></tr>\r
          <tr><td>Polymarket 语义套利</td><td>多个标题不同但结果相互蕴含的市场可能出现概率不一致。</td><td>用 AI 解析规则文本，建立 implies / mutually exclusive / correlated 边，再用 violationScore 排序潜在机会。</td></tr>\r
          <tr><td>薄流动性与噪声市场</td><td>价格可能因小额交易、价差或信息不足而偏离真实概率。</td><td>把 liquidityScore、spreadRisk、sourceRisk 和 confidence 放入 signalScore，低质量机会自动降级为 WATCH 或 AVOID。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>4.7 绩效评价：不能只看 PnL</h3>\r
      <p>\r
        如果只展示赚钱案例，AI 信号很容易变成事后筛选。Causeway 必须用预测市场研究中常用的校准指标和评分函数评估模型，而不仅是账户盈亏。Brier Score 衡量概率预测与实际结果的平方误差；Log Loss 会重罚高置信度错误；calibration bucket 检查“AI 说 70% 的事件是否真的大约发生 70%”。Arc Proof 的意义在这里变得非常直接：它让每个概率判断在事前被锁定，从而让绩效评价更可信。\r
      </p>\r
      <div class="formula">\r
        <code>Brier_mean = mean((q_ai - y)^2)</code>\r
        <code>LogLoss_mean = mean(-[y * ln(q_ai + eps) + (1 - y) * ln(1 - q_ai + eps)])</code>\r
        <code>CalibrationError = Σ_k n_k / N * |mean(q_ai in bucket k) - mean(y in bucket k)|</code>\r
        <code>signalScore = z(edgeNet) + z(confidence) + z(liquidity) - z(spreadRisk) - z(sourceRisk) - z(correlationRisk)</code>\r
        <p>长期价值来自可复盘的稳定校准，而不是单次预测命中。Causeway 的 Signal Track Record 应同时展示 accuracy、calibration、PnL、drawdown、执行率和未执行机会的事后表现。</p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">05 / Product Definition</p>\r
      <h2>Causeway 的产品定义</h2>\r
      <p>\r
        Causeway 是一个预测市场 Trader Intelligence Layer。它面向希望理解、研究和执行预测市场机会的用户，提供从全量市场数据到 AI 推理、从交易机会识别到用户确认执行、从 reasoning trace 到 Arc proof、从单次信号到绩效追踪的完整工作流。\r
      </p>\r
      <table>\r
        <thead>\r
          <tr><th>层级</th><th>功能</th><th>用户价值</th></tr>\r
        </thead>\r
        <tbody>\r
          <tr><td>市场数据底座</td><td>同步 Polymarket event、market、outcome、token、价格、流动性、规则和状态。</td><td>让 AI 和用户先理解真实可交易对象。</td></tr>\r
          <tr><td>市场网络</td><td>基于事件、标签、语义、价格相关性和 AI 推理构建 market graph。</td><td>把市场从列表变成可浏览的概率网络。</td></tr>\r
          <tr><td>AI 推理引擎</td><td>从根 outcome 出发生成相关市场、因果路径、置信度和默认动作。</td><td>把“市场想法”转化为可审查脚本。</td></tr>\r
          <tr><td>交易智能层</td><td>计算 market odds、AI fair odds、edge、风险、仓位建议和 BUY/WATCH/AVOID。</td><td>让 AI 真正参与交易判断，而不只是解释文本。</td></tr>\r
          <tr><td>订单预览层</td><td>生成 dry-run 或真实 CLOB 订单预览，刷新盘口、检查限制、等待用户签名。</td><td>把推理与真实执行连接起来，同时保留控制边界。</td></tr>\r
          <tr><td>Arc 可验证层</td><td>把 reasoning trace hash 写入 Arc Testnet，并校验 calldata 与原始 trace 一致。</td><td>证明推理记录在事前存在，减少事后篡改空间。</td></tr>\r
          <tr><td>绩效追踪层</td><td>追踪信号、订单、持仓、价格变化、PnL 和最终结果。</td><td>把 AI 能力从演示变成可持续评估的系统。</td></tr>\r
        </tbody>\r
      </table>\r
      <p>\r
        Causeway 的边界同样重要。系统默认不保管用户私钥，不替用户绕过签名，不把 AI 输出包装成投资建议。AI 负责扩展市场论点、识别路径、提出风险和生成预览；用户负责确认是否行动、行动多少、何时停止，以及是否在未来开启有限委托。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">06 / What We Have Solved</p>\r
      <h2>我们已经解决了什么问题</h2>\r
      <h3>6.1 市场数据和 outcome token 映射</h3>\r
      <p>\r
        Causeway 已经把“市场标题”与“真实可交易 outcome token”明确区分。系统数据模型包含 <code>PolymarketEvent</code>、<code>PolymarketMarket</code>、<code>PolymarketOutcome</code>、<code>clobTokenId</code>、价格、best bid、best ask、last trade、spread、volume、liquidity、order min size 和 tick size 等字段。这解决了 AI 或前端把市场误认为简单 Yes/No 文案的问题。\r
      </p>\r
      <h3>6.2 从根 outcome 到因果脚本</h3>\r
      <p>\r
        用户可以选择一个 root market 和 root outcome，系统基于候选市场生成 AI inference run。输出不是单句建议，而是包含 nodes、edges、warnings、impactDirection、confidence、reason 和 outcome recommendation 的结构化结果。后端再将其转化为 causal script、script market 和 script outcome selection，使用户能够逐项审查和修改。\r
      </p>\r
      <h3>6.3 订单预览与用户确认闭环</h3>\r
      <p>\r
        Causeway 的订单层区分 <code>dry_run</code> 和 <code>real</code> execution mode。系统可以生成订单预览、刷新 order book、检查余额和交易能力、准备 EIP-712 签名 payload，并通过 Polymarket CLOB 提交真实订单。真实能力不可用时，前后端协议仍保持一致，避免产品因为单一外部依赖而中断演示和开发。\r
      </p>\r
      <h3>6.4 Polymarket Builder attribution</h3>\r
      <p>\r
        Polymarket Builder Program 允许应用在订单结构中附加 builder code，以获得订单归因和 builder leaderboard 统计。Causeway 的商业闭环可以建立在“AI 发现和解释机会，用户保留钱包控制权并亲自确认交易，真实成交通过 builder code 归因”之上。这比纯订阅模型更贴合预测市场交易场景。\r
      </p>\r
      <h3>6.5 Arc reasoning trace proof</h3>\r
      <p>\r
        Causeway 当前实现版本已经包含 Arc Proof 模块。系统可以读取某个 causal script，构建 <code>causeway.reasoning_trace.v1</code> capsule，将 inference input hash、output hash、模型版本、prompt 版本、市场快照、outcome selection 和脚本图谱打包，生成 trace hash，并通过 Arc Testnet 交易 calldata 锚定。后端会校验交易 signer、chainId 和 calldata，确保链上记录与原始 trace 一致。\r
      </p>\r
      <h3>6.6 Arc USDC premium payments</h3>\r
      <p>\r
        Causeway 还实现了 Arc USDC payment intent 和 membership entitlement。用户可以为 premium capability 支付 Arc USDC，后端通过读取 Arc transaction receipt 和 USDC Transfer log 验证付款金额、付款方、收款方、交易状态和时间窗口，再开通 premium membership。该机制可用于高级模型、更深推理、更完整 reasoning trace 和 Arc proof 等能力；未来也可以与在 Arc 上结算的 x402 服务调用结合，使会员订阅、按次报告、API 调用和智能体能力解锁共用同一套可验证支付记录。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">07 / Architecture</p>\r
      <h2>系统架构与数据模型</h2>\r
      <h3>7.1 技术栈</h3>\r
      <table>\r
        <thead><tr><th>模块</th><th>当前实现方向</th><th>作用</th></tr></thead>\r
        <tbody>\r
          <tr><td>Frontend</td><td>React + Vite + RainbowKit + wagmi + viem + React Flow</td><td>市场网络、钱包连接、推理图谱、订单预览、Arc Proof 面板。</td></tr>\r
          <tr><td>API</td><td>NestJS + Prisma + PostgreSQL</td><td>市场同步、AI 推理、脚本、订单、投资组合、支付、Arc proof。</td></tr>\r
          <tr><td>Polymarket</td><td>Gamma API + CLOB/Data API + Builder Relayer</td><td>市场数据、outcome token、订单簿、签名订单和 builder attribution。</td></tr>\r
          <tr><td>AI</td><td>结构化 prompt + output schema + cache</td><td>生成因果图、推荐 outcome、置信度、风险和脚本。</td></tr>\r
          <tr><td>Arc</td><td>Arc Testnet + viem public/wallet client + USDC payment verification</td><td>reasoning trace proof、premium payment、智能体经济基础。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>7.2 数据对象</h3>\r
      <p>\r
        Causeway 的核心数据对象围绕“可交易市场”和“可审计推理”设计。市场对象负责准确表达 Polymarket 结构，推理对象负责记录 AI 输入输出，脚本对象负责把推理转化为用户可编辑的行动计划，订单对象负责连接真实交易，Arc proof 对象负责证明推理记录在特定时间点存在。\r
      </p>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Market Object</span><b>真实市场结构</b><p>包含 event、market、outcome、conditionId、questionId、clobTokenId、价格、流动性和规则。</p></div>\r
        <div class="note"><span class="small-label">Inference Object</span><b>AI 推理记录</b><p>包含 root outcome、candidate set、prompt version、model、inputJson、outputJson、cacheKey。</p></div>\r
        <div class="note"><span class="small-label">Causal Script</span><b>可编辑行动脚本</b><p>包含 graphJson、script markets、outcome selections、userAction、orderMode 和理由。</p></div>\r
        <div class="note"><span class="small-label">Arc Proof Capsule</span><b>可验证推理证明</b><p>包含 trace hash、calldata、chainId、txHash、ArcScan URL 和 anchor timestamp。</p></div>\r
      </div>\r
      <h3>7.3 架构原则</h3>\r
      <ul>\r
        <li><strong>Market-first：</strong>先确保市场结构、outcome token 和订单簿可靠，再扩展外部信息源。</li>\r
        <li><strong>Structured AI：</strong>AI 输出必须符合 schema，不能只返回自然语言。</li>\r
        <li><strong>Human-governed：</strong>AI 可以生成默认脚本，但用户可以修改、跳过、预览或拒绝。</li>\r
        <li><strong>Proof-ready：</strong>关键推理记录应能被 hash、复盘和锚定，支持事后绩效评估。</li>\r
        <li><strong>Capability fallback：</strong>真实交易、余额、支付或外部 API 不可用时，系统应返回结构化 capability 状态，而不是崩溃。</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">08 / Trader Intelligence</p>\r
      <h2>AI Trader Intelligence：从概率到行动预览</h2>\r
      <h3>8.1 信号不应只有“买”或“不买”</h3>\r
      <p>\r
        一个成熟的预测市场智能系统不应对所有市场给出交易建议。很多市场应该返回 WATCH 或 AVOID：例如 edge 不够、流动性不足、价差太宽、规则不清晰、信息源未求证、用户已有高度相关敞口、市场即将结束或 AI confidence 不足。No Trade Recommended 本身就是能力，因为它表明系统具备克制和风险意识。\r
      </p>\r
      <h3>8.2 Signal Object</h3>\r
      <table>\r
        <thead><tr><th>字段</th><th>说明</th></tr></thead>\r
        <tbody>\r
          <tr><td>signalId</td><td>唯一信号 ID，用于追踪和绩效复盘。</td></tr>\r
          <tr><td>marketOdds</td><td>市场价格隐含概率。</td></tr>\r
          <tr><td>aiFairOdds</td><td>AI 基于市场数据、推理路径和信息源求证给出的公允概率。</td></tr>\r
          <tr><td>edge</td><td>AI fair odds 与 market odds 的差异。</td></tr>\r
          <tr><td>confidence</td><td>模型对推理路径和数据质量的置信度。</td></tr>\r
          <tr><td>recommendation</td><td>BUY、WATCH、AVOID 或 VERIFY FIRST。</td></tr>\r
          <tr><td>riskLevel</td><td>Low、Medium、High，受流动性、规则、来源、波动和相关敞口影响。</td></tr>\r
          <tr><td>suggestedSize</td><td>基于保守 Kelly、预算上限和市场容量的建议金额。</td></tr>\r
          <tr><td>changeMyMind</td><td>哪些事实变化会推翻当前建议。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>8.3 从因果图到仓位建议</h3>\r
      <p>\r
        Causeway 的仓位建议不应是固定金额，而应由多项因素共同决定：edge 大小、confidence、盘口深度、价差、用户风险偏好、市场相关性、单市场上限和总体预算。保守 Kelly 可以作为基础框架，但必须加入折扣因子和上限，避免模型在高不确定场景中过度下注。\r
      </p>\r
      <div class="callout">\r
        <strong>保守原则：</strong>\r
        推荐仓位应是“可解释的风险预算”，不是对收益的承诺。系统应明确显示最大损失、成交价格、滑点、过期时间和触发重新评估的条件。\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">09 / Arc Proof</p>\r
      <h2>Arc Proof：可验证的 AI 推理记录</h2>\r
      <h3>9.1 为什么推理需要上链证明</h3>\r
      <p>\r
        预测市场的核心是未来会验证今天的判断。因此，AI signal 的可信度不仅来自模型本身，还来自“它是否能证明自己在结果发生前做出了这个判断”。如果系统可以在结果公布后修改历史 reasoning trace，那么任何信号准确率、PnL 或绩效记录都缺少可信基础。\r
      </p>\r
      <p>\r
        Arc Proof 的作用不是替代 Polymarket 交易链路，也不是把用户订单搬到 Arc。Polymarket 仍负责市场和 CLOB 交易；Arc 负责记录 AI reasoning trace 的 hash，作为低成本、快速、稳定币原生的审计层。\r
      </p>\r
      <h3>9.2 Causeway 的 Arc Proof Capsule</h3>\r
      <table>\r
        <thead><tr><th>字段</th><th>含义</th></tr></thead>\r
        <tbody>\r
          <tr><td>schema</td><td><code>causeway.reasoning_trace.v1</code></td></tr>\r
          <tr><td>scriptId / inferenceRunId</td><td>对应的脚本和推理运行。</td></tr>\r
          <tr><td>rootMarketId / rootOutcomeId</td><td>用户选择的根市场和根 outcome。</td></tr>\r
          <tr><td>inputHash / outputHash</td><td>AI 输入和输出的稳定 JSON hash。</td></tr>\r
          <tr><td>model / promptVersion / outputSchemaVersion</td><td>模型、prompt 和输出格式版本。</td></tr>\r
          <tr><td>market snapshots</td><td>价格、best bid、best ask、last trade、volume、liquidity、syncedAt。</td></tr>\r
          <tr><td>selections</td><td>AI action、user action、order mode、limit price、size、amountUsd 和 reason。</td></tr>\r
          <tr><td>traceHash</td><td>整个 capsule 的 hash，用作 Arc transaction calldata。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>9.3 验证流程</h3>\r
      <ol>\r
        <li>后端读取用户脚本和推理记录，构建 proof capsule。</li>\r
        <li>使用稳定 JSON hash 生成 <code>traceHash</code>。</li>\r
        <li>前端请求用户切换到 Arc Testnet，并发送 calldata 为 traceHash 的交易。</li>\r
        <li>后端等待交易 receipt，并读取 transaction input。</li>\r
        <li>校验 signer 与连接钱包一致、chainId 为 Arc Testnet、calldata 与 traceHash 一致。</li>\r
        <li>把 txHash、traceHash、ArcScan URL 和 anchoredAt 写入审计记录。</li>\r
      </ol>\r
      <div class="callout">\r
        <strong>产品意义：</strong>\r
        Arc Proof 让 Causeway 能够展示“这个 AI 推理记录在某个时间点已经存在，并且后续没有被静默改写”。这是预测市场 AI 信号绩效可信化的基础。\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">10 / Arc USDC Economy</p>\r
      <h2>Arc USDC Premium：会员订阅、可验证支付与智能体经济</h2>\r
      <p>\r
        Arc 的稳定币原生设计适合低成本、可验证、频繁发生的智能体经济活动。Causeway 当前已经实现 Arc USDC payment intent：用户选择 premium plan 后，系统生成待支付 intent，指定 chainId、USDC token、receiverAddress、amountMicroUsd 和过期时间；用户在 Arc 上完成 USDC 转账后，后端读取 transaction receipt 和 ERC-20 Transfer log 进行验证，并将支付结果映射为会员权益。当前阶段，会员订阅主要用于解锁高级信号、完整推理轨迹、Arc proof 和更高额度的分析能力；未来，Causeway 也可以使用在 Arc 上结算的 x402 服务调用，把订阅、按次付费、报告解锁、API 调用和智能体能力购买统一到更细粒度的支付框架中。\r
      </p>\r
      <h3>10.1 当前可支持的 Premium 能力</h3>\r
      <div class="grid-2">\r
        <div class="note"><span class="small-label">Premium Signal</span><b>高级信号</b><p>解锁更深层推理、更高质量模型、更严格置信度和完整候选市场范围。</p></div>\r
        <div class="note"><span class="small-label">Full Reasoning Trace</span><b>完整推理轨迹</b><p>查看输入、输出、候选市场、风险、反例和 What Would Change My Mind。</p></div>\r
        <div class="note"><span class="small-label">Arc Proof</span><b>链上证明</b><p>将 reasoning trace hash 锚定到 Arc Testnet，并通过 ArcScan 查看交易。</p></div>\r
        <div class="note"><span class="small-label">Future x402</span><b>智能体服务调用</b><p>未来可接入在 Arc 上结算的 x402 流程，用于数据购买、报告解锁、API 调用和策略订阅。</p></div>\r
      </div>\r
      <h3>10.2 Arc：可验证推理与智能体经济的结算层</h3>\r
      <p>\r
        Arc 对 Causeway 的价值不在于替代 Polymarket 的交易链路，而在于为预测市场 AI 系统提供一个低成本、可验证、稳定币原生的经济与审计层。Polymarket 负责市场撮合、订单簿、结果结算和真实交易执行；Causeway 负责市场理解、AI 推理、风险预览、用户确认和信号追踪；Arc 则适合承载那些频率高、金额小、需要记录、需要验证、并且天然以美元计价的辅助动作，例如 reasoning trace 存证、premium 订阅、报告解锁、API 调用、智能体服务结算和未来的数据源付费。\r
      </p>\r
      <p>\r
        对当前版本而言，Arc 首先解决两个关键问题。第一，AI 推理需要可验证时间戳。预测市场的判断会被未来结果验证，如果系统无法证明某个推理记录是在结果发生前生成的，那么 signal track record 的可信度会明显下降。Causeway 将 reasoning trace 的 hash 写入 Arc，使每一次 AI 判断都可以形成轻量级 proof capsule。第二，AI 能力需要稳定币原生的付费路径。高级推理、完整推理轨迹、市场图谱分析、API 调用和报告服务，都适合以 USDC 进行小额、实时、可验证结算。\r
      </p>\r
      <p>\r
        从中期看，Arc 可以支持 Causeway 形成更完整的 Signal Economy。每一次 AI 推理都可以被视为一个可追踪的信号资产：它有生成时间、输入快照、模型版本、市场价格、AI fair odds、edge、风险解释、用户动作和最终结果。如果这些信号长期积累，并且关键 hash 被锚定到 Arc，Causeway 就可以建立可信的 Signal Track Record。未来，用户不只是购买一次 AI 回答，而是订阅经过验证的策略、报告、市场图谱、数据源和专业智能体能力。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">11 / x402 Agent Service Layer</p>\r
      <h2>x402 Agent Service Layer：未来智能体服务协议层</h2>\r
      <p>\r
        x402 在 Causeway 中不应被定位为交易执行协议，而应被定位为智能体服务调用与微支付协议。它的价值在于让 AI agent、外部 API、数据源和专业分析服务能够通过机器可读的支付请求完成按次结算。对 Causeway 而言，x402 可以成为未来 Agent Service Layer：Arc 提供可验证记录与稳定币结算环境，x402 提供 agent-to-service 的访问和支付流程，Causeway 负责编排市场图谱、权限治理、风险控制、订单预览和绩效追踪。\r
      </p>\r
      <h3>11.1 数据源、验证与报告的按次付费</h3>\r
      <p>\r
        Causeway 未来需要新闻流、体育数据、宏观数据、链上数据、监管公告、公司公告、赔率数据和原始来源验证。很多数据并不适合固定包月，而更适合在 AI 推理需要时按次调用：验证一次 CPI 发布、购买一次球队伤病数据、请求一次链上资金流解析、校验一次新闻原始来源、生成一次市场规则差异报告。x402 可以让这些调用变成即时、细粒度、可审计的支付行为，而不是依赖人工 API key、中心化积分或离线结算。\r
      </p>\r
      <h3>11.2 专业智能体市场</h3>\r
      <p>\r
        当 Causeway 从单一 AI 推理工具演化为多智能体预测系统时，系统可以引入外部专业智能体：宏观研究 Agent、体育伤病 Agent、政治新闻 Agent、链上资金流 Agent、盘口套利 Agent、Source Verification Agent、Risk Agent 和 Execution Guard。每个智能体都可以通过长期 track record、校准能力、历史收益风险表现、响应速度、数据源覆盖和 Arc proof 记录建立声誉。x402 则可以负责每一次服务调用的访问控制和按次结算。\r
      </p>\r
      <h3>11.3 信号市场与 API 货币化</h3>\r
      <p>\r
        未来，Causeway 可以把高质量 signal、market graph、risk report、related markets、semantic arbitrage scan 和 Arc proof status 作为可付费 API 暴露给外部应用或智能体。调用方不一定需要成为完整会员，也可以按请求购买特定能力。Arc 记录 proof、payment 和 reputation，x402 处理付费访问，Causeway 展示信号绩效与校准结果。这样，Causeway 的收入不只来自订阅，还来自可组合的智能服务网络。\r
      </p>\r
      <h3>11.4 有限 AI 委托交易的长期形态</h3>\r
      <p>\r
        在更高级的阶段，用户可以指定经过验证的成熟智能体参与自动化 AI 委托交易流程。但 x402 本身不承担资产托管、交易授权或风控职责；它承担的是智能体服务调用和微支付层。真正的委托交易必须由 Causeway 叠加权限边界：允许交易的市场类别、最大单笔金额、每日损失上限、最大相关敞口、最低 edgeNet、最小流动性、最大滑点、必要验证步骤、到期时间、紧急停止和可撤销授权。每一次数据调用、推理生成、验证请求、订单预览或交易执行，都应留下 Arc proof 和 Signal Track Record。\r
      </p>\r
      <div class="callout">\r
        <strong>未来定位：</strong>\r
        Arc 是 proof、payment record 和 reputation substrate；x402 是 agent-to-service payment and access protocol；Causeway 是 prediction-market intelligence orchestration layer；Polymarket 是 market execution and settlement venue。\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">12 / Swarm Prediction Engine</p>\r
      <h2>Swarm Prediction Engine：从平行市场世界到预测万物</h2>\r
      <p>\r
        Causeway 的长期目标不是让单一 AI 对一个市场给出一次性判断，而是构建面向预测市场的群体智能预测引擎。我们的判断是：复杂事件的预测不应该依赖单一路径推理，而应该从现实世界的种子信息出发，构建可演化的平行市场世界，让多个具有不同角色、记忆、立场和行为逻辑的智能体在其中互动、分歧、反证、修正并生成预测。Causeway 会把这种群体智能推演约束到“可交易、可验证、可结算的预测市场网络”中，使模拟结果不仅能形成叙事报告，也能转化为 market odds、AI fair odds、edgeNet、风险预算、订单预览、Arc proof 和 Signal Track Record。\r
      </p>\r
      <h3>12.1 从单模型推理到群体智能预测</h3>\r
      <p>\r
        单一模型适合生成初始判断，但复杂世界往往由多主体、多动机、多信息滞后和多市场反馈共同决定。一个宏观数据、体育伤病、监管公告、链上事件或政治新闻，可能同时影响多个实体、多个时间窗口和多个相互关联的预测市场。群体智能预测引擎的价值在于让多个智能体分别扮演研究、怀疑、验证、定价、风险和执行守门角色，在同一个市场图谱中进行多轮推演，从而降低单一路径偏差和过度自信。\r
      </p>\r
      <figure class="concept-figure">\r
        <div class="concept-figure-frame">\r
          <img src="../../public/assets/causeway-swarm-prediction-engine-concept.png" alt="Causeway 群体智能预测引擎概念图" />\r
        </div>\r
        <figcaption class="caption">图 12-1：Causeway 群体智能预测引擎概念图。真实世界事件进入平行市场世界后，由多角色智能体、市场图谱、Arc proof、x402 Agent Service 与 Signal Track Record 共同形成可审查的预测闭环。</figcaption>\r
      </figure>\r
      <h3>12.2 平行市场世界</h3>\r
      <p>\r
        Causeway 可以把一个真实事件转化为多个平行市场世界。每个世界都包含不同假设：事件是否真实、来源是否可靠、传播速度如何、市场是否已经反映、相关市场是否滞后、流动性是否足够、规则是否存在歧义。系统不只问“这个事件会不会发生”，而是问“如果这个事件发生，它会如何穿过市场网络、改变哪些 odds、制造哪些 edge、触发哪些风险，并留下怎样的可验证记录”。这种平行市场世界是 Causeway 对未来预测系统的核心判断：预测不应只回答“某件事是否会发生”，而应模拟事件如何在多个市场、多个参与者、多个信息源和多个时间窗口之间传播，并将这种传播过程转化为可审查、可计算、可验证的市场智能对象。\r
      </p>\r
      <h3>12.3 Agent Society：多角色智能体协作</h3>\r
      <table>\r
        <thead><tr><th>智能体角色</th><th>职责</th><th>输出对象</th></tr></thead>\r
        <tbody>\r
          <tr><td>Research Agent</td><td>收集事件、市场、历史案例和上下文。</td><td>sourceObjects、event summary、market candidates。</td></tr>\r
          <tr><td>Market Graph Agent</td><td>寻找相关市场、语义蕴含、互斥关系和相关敞口。</td><td>market graph、relation type、impact direction。</td></tr>\r
          <tr><td>Probability Agent</td><td>基于情景和证据给出概率估计。</td><td>AI fair odds、probability shift、confidence。</td></tr>\r
          <tr><td>Skeptic Agent</td><td>寻找反例、规则歧义、虚假来源和过度推断。</td><td>counterarguments、changeMyMind、risk flags。</td></tr>\r
          <tr><td>Verification Agent</td><td>追溯底层事实和权威来源。</td><td>verification status、source confidence、conflict report。</td></tr>\r
          <tr><td>Risk Agent</td><td>计算流动性、价差、滑点、相关性和仓位上限。</td><td>edgeNet、risk budget、position cap。</td></tr>\r
          <tr><td>Execution Guard</td><td>判断是否允许进入订单预览或委托执行。</td><td>BUY / WATCH / AVOID、order preview gate、emergency stop。</td></tr>\r
          <tr><td>Report Agent</td><td>把多智能体分歧和结论转化为可读报告。</td><td>prediction report、scenario tree、audit summary。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>12.4 从模拟报告到交易智能对象</h3>\r
      <p>\r
        群体智能的输出不能停留在自然语言报告。Causeway 需要把模拟结果压缩成结构化的交易智能对象：scenario tree、affected markets、relation edges、probability shift、AI fair odds、market odds、edgeNet、recommended action、risk flags、suggested size、Arc proof hash 和 track record entry。这样，群体智能既可以服务研究，也可以服务真实交易前的审查、验证和用户确认。\r
      </p>\r
      <div class="formula">\r
        <code>scenarioValue_s = Σ_i edgeNet_i,s * tradability_i,s * confidence_s - portfolioRisk_s</code>\r
        <code>swarmConsensus = weightedMedian(q_agent_1, q_agent_2, ..., q_agent_n; weights = reputation * calibration)</code>\r
        <code>disagreementRisk = variance(q_agent_1 ... q_agent_n) + sourceConflict + ruleAmbiguity</code>\r
        <code>finalAction = gate(swarmConsensus, edgeNet, disagreementRisk, liquidity, userPolicy)</code>\r
        <p>群体智能不是简单投票，而是把不同智能体的校准记录、来源质量、分歧程度和市场可执行性合并为受风控约束的行动建议。</p>\r
      </div>\r
      <h3>12.5 与 Arc 和 x402 的关系</h3>\r
      <p>\r
        Swarm Prediction Engine 需要可验证记录和可组合支付。Arc 可以记录每次模拟、推理、信号和结果的 hash，使群体智能不是事后包装的故事；x402 可以为外部数据源、验证服务、专业智能体和深度报告提供按次调用和微支付；Causeway 则负责编排这些能力，把智能体输出映射到预测市场对象、风控边界、订单预览和用户治理流程。长期看，Arc 是可信记录与结算底座，x402 是智能体服务调用协议，Swarm Prediction Engine 是推演世界变化的智能层。\r
      </p>\r
      <h3>12.6 长期愿景：预测万物，但保持用户治理</h3>\r
      <p>\r
        Causeway 所说的“预测万物”不是让 AI 无限自动下注，而是让用户输入一个现实事件后，系统能够理解市场、组织智能体、构建平行市场世界、求证事实、模拟传播路径、生成可交易信号、保留证明，并由用户决定是否行动。未来当智能体能力、声誉系统和授权机制足够成熟时，用户可以选择将部分流程委托给经过验证的智能体；但默认边界仍应是用户治理、可撤销权限、明确预算和完整审计。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">13 / Workflow</p>\r
      <h2>用户工作流与产品体验</h2>\r
      <h3>13.1 标准流程</h3>\r
      <ol>\r
        <li>用户连接钱包并进入市场网络。</li>\r
        <li>系统展示 Polymarket events、markets、outcomes、价格、成交量和相关市场。</li>\r
        <li>用户选择一个 root outcome 作为推理起点。</li>\r
        <li>系统召回候选市场，并构造 AI prompt input。</li>\r
        <li>AI 输出因果图、outcome recommendation、warnings 和 confidence。</li>\r
        <li>系统生成 causal script，用户逐项审查、修改或跳过。</li>\r
        <li>用户进入订单预览，检查订单簿、金额、最大损失、预估收益和能力状态。</li>\r
        <li>用户确认后进行 dry-run 或真实 CLOB 签名提交。</li>\r
        <li>用户可将 reasoning trace 锚定到 Arc Testnet。</li>\r
        <li>系统在 Signal Track Record 中追踪价格变化、订单状态、PnL 和最终结果。</li>\r
      </ol>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">14 / Governance</p>\r
      <h2>风控、治理与合规边界</h2>\r
      <h3>14.1 风控矩阵</h3>\r
      <table>\r
        <thead><tr><th>风险类别</th><th>具体问题</th><th>控制方式</th></tr></thead>\r
        <tbody>\r
          <tr><td>数据风险</td><td>市场数据延迟、outcome 映射错误、订单簿不可用。</td><td>同步时间、tokenId 校验、实时刷新、capability fallback。</td></tr>\r
          <tr><td>信息风险</td><td>新闻错误、社交媒体谣言、二手来源误读。</td><td>Source Object、权威源库、冲突检测、新鲜度评分。</td></tr>\r
          <tr><td>推理风险</td><td>AI 幻觉、过度自信、遗漏反例。</td><td>候选集约束、结构化校验、skeptic agent、confidence threshold。</td></tr>\r
          <tr><td>市场风险</td><td>价差过大、流动性不足、互斥市场相关敞口。</td><td>盘口深度、保守仓位、事件级组合风控、No Trade 状态。</td></tr>\r
          <tr><td>执行风险</td><td>用户误签、重复提交、订单过期。</td><td>预览过期、idempotency key、签名前确认、提交状态回写。</td></tr>\r
          <tr><td>审计风险</td><td>信号记录无法证明事前存在。</td><td>Arc proof、hash、audit event、Signal Track Record。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>14.2 默认边界</h3>\r
      <ul>\r
        <li>AI 输出不构成投资建议。</li>\r
        <li>系统不保证预测准确率、收益或市场结果。</li>\r
        <li>默认模式为用户确认，而非自动下单。</li>\r
        <li>委托执行必须在未来以显式授权、明确预算、范围限制和撤销机制实现。</li>\r
        <li>真实交易、模拟交易和未执行信号必须在 UI 和数据中明确区分。</li>\r
      </ul>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">15 / Future Problems</p>\r
      <h2>未来需要解决的问题，以及我们如何解决</h2>\r
      <h3>15.1 问题：外部信息源实时性和真实性不足</h3>\r
      <p>\r
        当前阶段主要依赖市场数据和受控候选集。下一阶段，Causeway 必须接入实时新闻流、官方公告、链上事件、体育数据和监管文件。但外部信息源越多，噪音越大。解决方案是 Source Object 标准化：把每条信息拆成 claim、origin、timestamp、entities、rawPayload 和 confidence，并通过权威源库和冲突检测进入工作流。\r
      </p>\r
      <h3>15.2 问题：单模型推理无法覆盖复杂世界</h3>\r
      <p>\r
        单一模型容易形成单一路径和过度确定性。Causeway 的长期方案是多智能体推理与 Swarm Prediction Engine：Research Agent 负责收集市场和事件上下文，Probability Agent 给出概率估计，Skeptic Agent 寻找反例，Verification Agent 求证来源，Risk Agent 判断流动性和仓位，Execution Guard 判断是否允许进入预览。多智能体不是为了炫技，而是为了让分歧、假设、证据质量和风险显性化，并把复杂世界的多路径演化映射为可审查的市场响应计划。\r
      </p>\r
      <h3>15.3 问题：信号绩效无法被持续证明</h3>\r
      <p>\r
        如果没有长期 track record，AI 推荐很容易停留在短期展示。Causeway 需要为每个 signal 记录生成时间、市场价格、AI fair odds、edge、推荐方向、用户是否执行、执行价格、当前价格、未实现盈亏、最终结果和 Arc proof。只有这样，系统才能回答“AI 是否真的有效”。\r
      </p>\r
      <h3>15.4 问题：自动化执行需要更强治理</h3>\r
      <p>\r
        第五阶段的委托执行不是让 AI 无限制控制账户，而是让用户在明确规则下选择性授权。授权应包含市场类别、最大单笔金额、每日损失上限、最大相关敞口、可接受数据源、时间窗口、撤销条件和 emergency stop。未来若用户指定成熟智能体参与自动化流程，x402 可承担智能体服务调用与微支付，Arc 承担证明与记录，Causeway 承担权限治理与风控，真实交易仍必须遵守用户授权和可撤销边界。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">16 / Roadmap</p>\r
      <h2>五阶段技术路线图</h2>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 01</span><span class="tag">Market Data Foundation</span>\r
        <h3>先理解市场，再理解世界</h3>\r
        <p>\r
          第一阶段专注于 Polymarket 市场数据：event、market、outcome、tokenId、价格、成交量、流动性、订单簿、规则和状态。目标是让系统能够稳定表达真实可交易结构，并支持用户从市场详情页选择根 outcome 进入推理。\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 02</span><span class="tag">Reasoning Model</span>\r
        <h3>把一个事件映射到所有相关市场</h3>\r
        <p>\r
          构建更强的推理模型，对相关市场给出 relevance、direction、confidence、tradability 和 recommendation。引入 BUY / WATCH / AVOID、What Would Change My Mind、保守仓位建议和多智能体分歧检查，让 AI 更像交易研究团队，而不是聊天机器人。\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 03</span><span class="tag">Real-Time Scenario Generation</span>\r
        <h3>把新闻流转化为全市场响应剧本</h3>\r
        <p>\r
          接入实时事件流，自动抽取实体、主题、事件类型和影响路径，在全市场生成响应剧本。系统应输出受影响市场、缺失确认信号、风险状态和建议工作流，并逐步把事件推演扩展为平行市场世界模拟，而不是直接下单。\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 04</span><span class="tag">Verification & Arc Proof</span>\r
        <h3>下注前求证，推理后存证</h3>\r
        <p>\r
          构建权威数据源库，自动追溯底层事实；同时把关键 reasoning trace hash 写入 Arc，形成可验证历史记录。该阶段的目标是把速度、真实性和审计能力统一起来。\r
        </p>\r
      </div>\r
      <div class="phase-card">\r
        <span class="tag dark">Phase 05</span><span class="tag">Delegated AI Execution</span>\r
        <h3>用户可选地委托有限执行</h3>\r
        <p>\r
          在权限、预算、时间、市场范围和撤销机制成熟后，用户可选择让 AI 在限定条件下执行。未来用户也可以指定经过验证的成熟智能体参与委托流程，通过 x402 完成数据验证、风险评估和执行辅助的按次结算；该能力必须默认关闭，并通过 Arc proof、完整审计、紧急停止和权限过期机制治理。\r
        </p>\r
      </div>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">17 / Economic Model</p>\r
      <h2>商业模式与价值捕获</h2>\r
      <h3>17.1 收入模型</h3>\r
      <table>\r
        <thead><tr><th>模式</th><th>说明</th><th>适用阶段</th></tr></thead>\r
        <tbody>\r
          <tr><td>Premium Subscription</td><td>当前以 Arc USDC payment intent 解锁高级模型、更深推理、完整 reasoning trace、Arc proof 和监控能力；未来可扩展到基于 Arc 结算的 x402 按次调用和能力包。</td><td>Phase 1-3</td></tr>\r
          <tr><td>Builder Attribution</td><td>用户通过 Causeway 确认真实 Polymarket 订单，成交通过 builder code 归因。</td><td>Phase 1-5</td></tr>\r
          <tr><td>Signal API</td><td>向研究者、终端和策略系统提供结构化 signal、market graph 和 track record API。</td><td>Phase 2-4</td></tr>\r
          <tr><td>Team Workspace</td><td>为团队提供协作、权限、审计、报告、风险预算和策略库。</td><td>Phase 3-5</td></tr>\r
          <tr><td>x402 Agent Service Layer</td><td>未来允许外部数据源、验证服务、专业智能体和深度报告通过 x402 进行机器可读的按次访问和微支付。</td><td>Phase 3-5</td></tr>\r
          <tr><td>Swarm Prediction Reports</td><td>基于平行市场世界和多智能体辩论生成专业预测报告，按市场、事件或主题出售。</td><td>Phase 3-5</td></tr>\r
          <tr><td>Agent Marketplace</td><td>未来允许专业 agent、验证源、报告模板和策略模块通过 Arc USDC 与 x402 结算，并根据可验证 track record 建立声誉。</td><td>Phase 4-5</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>17.2 价值飞轮</h3>\r
      <p>\r
        更多市场数据带来更完整的市场图谱；更完整的图谱提高 AI 推理质量；更高质量的推理吸引更多用户生成真实反馈；更多反馈形成 signal track record；可验证 track record 提升信任；信任带来 premium、API、团队、x402 智能体服务、Swarm Prediction Reports 和 builder attribution 收入；收入反过来支持更好的数据源、模型、验证智能体、群体模拟系统和风控系统。\r
      </p>\r
    </section>\r
\r
    <section class="page">\r
      <p class="eyebrow">18 / Moat & KPI</p>\r
      <h2>护城河、指标与结论</h2>\r
      <h3>18.1 护城河</h3>\r
      <ul>\r
        <li><strong>市场结构理解：</strong>对 event、market、outcome token、CLOB 和订单限制的深度建模。</li>\r
        <li><strong>推理数据闭环：</strong>从 inference run 到 causal script、order intent、Arc proof 和 track record 的完整链路。</li>\r
        <li><strong>群体智能预测能力：</strong>把多智能体分工、平行市场世界、场景树和市场图谱结合，形成可验证的专业预测报告。</li>\r
        <li><strong>可验证历史：</strong>Arc proof 让信号绩效不只是后台记录，而是可审计对象。</li>\r
        <li><strong>用户治理边界：</strong>不以黑箱自动交易为核心，而以用户可控的智能执行为方向。</li>\r
        <li><strong>智能体经济入口：</strong>Arc USDC premium 与未来 x402 Agent Service Layer 为小额、频繁、可验证的 AI 能力结算提供基础。</li>\r
      </ul>\r
      <h3>18.2 核心指标</h3>\r
      <table class="kpi">\r
        <tbody>\r
          <tr><td>Market Coverage</td><td>同步市场数量、active market 覆盖率、outcome token 映射准确率。</td></tr>\r
          <tr><td>Inference Quality</td><td>推理成功率、schema 校验通过率、有效 signal 比例、No Trade 比例。</td></tr>\r
          <tr><td>Swarm Quality</td><td>智能体分歧度、校准加权共识、场景覆盖率、反例命中率、预测报告复盘表现。</td></tr>\r
          <tr><td>User Funnel</td><td>市场查看、推理启动、脚本保存、订单预览、用户确认、真实成交。</td></tr>\r
          <tr><td>Arc Proof Adoption</td><td>proof 生成数、anchor 数、验证成功率、ArcScan 点击率。</td></tr>\r
          <tr><td>Signal Track Record</td><td>信号后价格变化、最终准确率、PnL、用户执行率、退出建议命中率。</td></tr>\r
          <tr><td>Economics</td><td>Premium 转化率、USDC 支付成功率、x402 调用次数、agent service GMV、builder-attributed volume、API 收入。</td></tr>\r
        </tbody>\r
      </table>\r
      <h3>18.3 结论</h3>\r
      <p>\r
        Causeway 的价值不在于让用户更快点击交易按钮，而在于为预测市场建立一层可信的智能基础设施。它把市场结构、AI 推理、风险预览、用户确认、Arc 存证和绩效追踪连成一个闭环。短期，它让用户更好地理解和执行 Polymarket 市场；中期，它成为可验证的 prediction-market signal layer；长期，它可以演化为群体智能预测引擎，模拟现实事件在多市场中的传播，并输出专业预测报告。\r
      </p>\r
      <div class="callout">\r
        <strong>最终愿景：</strong>\r
        Causeway 不是“自动下注工具”，而是“预测万物的群体智能引擎”的早期形态：用户输入一个事件，系统理解市场、组织智能体、构建平行市场世界、求证事实、模拟路径、生成信号、保留证明，并由用户决定是否行动。长期看，Arc 负责可信记录与结算底座，x402 负责智能体服务调用，Causeway 负责预测市场智能编排。\r
      </div>\r
    </section>\r
\r
    <section>\r
      <p class="eyebrow">19 / References</p>\r
      <h2>参考资料</h2>\r
      <div class="source-list">\r
        <p>1. Wolfers, Justin, and Eric Zitzewitz, <em>Prediction Markets</em>, Journal of Economic Perspectives, 2004. https://pubs.aeaweb.org/doi/pdfplus/10.1257/0895330041371321</p>\r
        <p>2. Snowberg, Erik, Justin Wolfers, and Eric Zitzewitz, <em>Prediction Markets for Economic Forecasting</em>, NBER Working Paper 18222, 2012. https://www.nber.org/system/files/working_papers/w18222/w18222.pdf</p>\r
        <p>3. Wharton Rodney L. White Center working paper, prediction-market research, 2006. https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0608.pdf</p>\r
        <p>4. Cao, prediction-market research paper, New Zealand Association of Economists archive. https://www.nzae.org.nz/wp-content/uploads/2014/05/Cao.pdf</p>\r
        <p>5. Journal of Prediction Markets article archive, prediction-market and arbitrage research. https://www.ubplj.org/index.php/jpm/article/view/1796</p>\r
        <p>6. <em>Arbitrage trade in prediction markets</em>, research archive. https://www.researchgate.net/publication/262875038_Arbitrage_trade_in_prediction_markets</p>\r
        <p>7. arXiv preprint on modern prediction-market arbitrage and semantic market dependencies. https://arxiv.org/pdf/2508.03474.pdf</p>\r
        <p>8. KPMG, <em>Prediction markets: Paths to entry</em>, 2026. https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/prediction-markets-paths-to-entry.pdf</p>\r
        <p>9. CoinDesk, <em>Polymarket Resolves Presidential Election Contract</em>, 2024. https://www.coindesk.com/markets/2024/11/06/polymarket-resolves-presidential-election-contract</p>\r
        <p>10. Axios, <em>Polymarket gets big investment from New York Stock Exchange parent company</em>, 2025. https://www.axios.com/2025/10/07/polymarket-new-york-stock-exchange</p>\r
        <p>11. Polymarket Documentation, <em>Gamma Markets API Overview</em>. https://docs.polymarket.com/developers/gamma-markets-api/overview</p>\r
        <p>12. Polymarket Documentation, <em>Trading on the Polymarket CLOB</em>. https://docs.polymarket.com/developers/CLOB/trades/trades-data-api</p>\r
        <p>13. Polymarket Documentation, <em>Builder Program</em>. https://docs.polymarket.com/developers/builders/examples</p>\r
        <p>14. Arc Docs, <em>Connect to Arc</em>. https://docs.arc.io/integrate/connect-to-arc</p>\r
        <p>15. Arc Docs, <em>Arc Network</em>. https://docs.arc.network/arc-chain</p>\r
        <p>16. x402 Protocol, <em>Open payment protocol for the internet</em>. https://www.x402.org/</p>\r
        <p>17. Coinbase Developer Platform, <em>x402</em>. https://www.coinbase.com/developer-platform/products/x402/</p>\r
        <p>18. Cloudflare Docs, <em>Agents x402</em>. https://developers.cloudflare.com/agents/x402/</p>\r
      </div>\r
      <div class="disclaimer">\r
        Copyright © 2026 Causeway. 本文档为产品、技术与经济白皮书草案，不构成投资建议、法律建议、经纪服务、收益承诺或监管意见。本文提及的市场数据和行业信息来自公开资料，实际数据可能因统计口径、时间范围、平台定义和市场变化而不同。用户应独立判断并自行承担预测市场相关风险。\r
      </div>\r
    </section>\r
  </body>\r
</html>\r
`;document.body.classList.add("intro-playing");const j=[{icon:"01",title:"Election Market Chain",body:"Start from one election outcome and review the second-order markets it may affect before building any order.",tags:["Politics","Outcome Token"]},{icon:"02",title:"Macro Shock Script",body:"Trace how rates, CPI, commodities, crypto, and policy markets connect through a single market thesis.",tags:["Macro","Causal Graph"]},{icon:"03",title:"Sports Event Basket",body:"Choose a team or match outcome, then keep every related market and outcome visible for manual review.",tags:["Sports","Market Network"]},{icon:"04",title:"Open Vault Preview",body:"Package rule-based probability exposure with eligibility, risk budgets, and NAV-style reporting logic.",tags:["Vaults","Risk Budget"]}],E=[["01","SELECT ROOT MARKET","Start with a real Polymarket market and result condition, not a loose market title.","root: market + result"],["02","BUILD MARKET GRAPH","Causeway maps related markets, semantic relationships, and possible second-order effects.","graph: relevance | direction | confidence"],["03","SCORE THE OPPORTUNITY","Compare market pricing with AI-estimated probability, then account for fees, slippage, liquidity, rules, and source risk.","score = probability gap - costs - risk"],["04","PREVIEW AND REVIEW","Turn the signal into a user-reviewed action plan with optional audit records when stronger traceability is needed.","gate: preview | review | confirm"]],l="/app",d="/docs/",f=[{label:"Fed rate > 5.25%",icon:"FED",meta:"Root market",odds:"41%",x:50,y:50,center:!0},{label:"CPI print",icon:"CPI",meta:"18 markets",odds:"+0.7%",x:28,y:22},{label:"BTC weekly close",icon:"BTC",meta:"31 markets",odds:"-1.8%",x:64,y:18},{label:"Treasury auction",icon:"UST",meta:"12 markets",odds:"+2.1%",x:78,y:34},{label:"FOMC wording",icon:"DOC",meta:"9 markets",odds:"VERIFY",x:80,y:62},{label:"Dollar index",icon:"DXY",meta:"14 markets",odds:"+3.4%",x:62,y:82},{label:"Gold reaction",icon:"GLD",meta:"11 markets",odds:"-0.9%",x:35,y:80},{label:"Election economy",icon:"POL",meta:"24 markets",odds:"+1.2%",x:18,y:58},{label:"Bank stress",icon:"BNK",meta:"7 markets",odds:"WATCH",x:20,y:38}],c=[["EN","English"],["ZH","中文"],["KO","한국어"],["ES","Español"],["FR","Français"]],L={EN:I,ZH:S,KO:z,ES:q,FR:P},p={EN:{eyebrow:"- DOCS / WHITEPAPER",title:"Whitepaper v0.6, rebuilt as browsable docs.",body:"The whitepaper now lives inside the site as a chaptered product document. Switch language, scan the thesis, and open the sections that matter without downloading a PDF.",toc:"Chapter Index",reading:"Reading view"},ZH:{eyebrow:"- 文档 / 白皮书",title:"v0.6 白皮书，改为站内章节文档。",body:"白皮书不再作为主入口 PDF，而是在页面中按章节组织。你可以切换语言、浏览核心论点，并直接阅读需要的章节。",toc:"章节目录",reading:"阅读区"},KO:{eyebrow:"- 문서 / 백서",title:"v0.6 백서를 탐색 가능한 문서로 재구성했습니다.",body:"백서는 PDF 다운로드가 아니라 사이트 안의 장별 문서로 제공됩니다. 언어를 전환하고 핵심 논지를 빠르게 확인할 수 있습니다.",toc:"장 색인",reading:"읽기 화면"},ES:{eyebrow:"- DOCS / WHITEPAPER",title:"Whitepaper v0.6 convertido en documentación navegable.",body:"El whitepaper vive dentro del sitio como un documento por capítulos. Cambia el idioma, revisa la tesis y abre la sección que necesites sin descargar un PDF.",toc:"Índice de capítulos",reading:"Vista de lectura"},FR:{eyebrow:"- DOCS / LIVRE BLANC",title:"Le livre blanc v0.6 devient une documentation navigable.",body:"Le livre blanc est intégré au site sous forme de chapitres. Changez de langue, parcourez la thèse et ouvrez les sections utiles sans télécharger de PDF.",toc:"Index des chapitres",reading:"Vue de lecture"}},R=[["01","Market Data","Events, markets, result conditions, prices, depth, rules, and active state."],["02","Market Graph","Related markets, implication edges, mutual exclusion, exposure overlap, and affected themes."],["03","Probability Estimate","AI-estimated probabilities with assumptions, evidence quality, and confidence notes."],["04","Opportunity Score","Estimated edge after fees, spread, slippage, rule risk, source risk, and liquidity limits."],["05","User Gate","BUY, WATCH, VERIFY FIRST, or AVOID remains a preview until the user confirms action."],["06","Review Record","Reasoning, signal results, calibration, and track record become easier to review over time."]],_=[["rootMarket","Fed Funds Rate > 5.25% by Sep 30, 2026"],["resultCondition","YES outcome selected"],["marketOdds","41.0%"],["aiProbability","48.6%"],["opportunityScore","+4.2% after costs and risk"],["recommendation","VERIFY FIRST"],["riskFlags","source risk: medium / liquidity: pass"],["reviewRecord","optional audit trail"]],T=[["Inference Created","market snapshot + prompt schema"],["Review Capsule","stable reasoning record"],["Optional Anchor","audit trail before result"],["Signal Result","price and resolution tracking"],["Track Record","Brier, log loss, PnL, calibration"]],D=[["1,842","Signals tracked"],["72.4%","Illustrative win rate"],["0.128","Avg. Brier score"],["836","Audit anchored"]],M=[["Market-implied probability","Use prices as signals, not unconditional truth."],["Conservative Kelly","Shrink confidence and cap size by depth, budget, and correlation."],["Semantic relationships","Detect implication, mutual exclusion, and market-rule inconsistencies."],["Calibration metrics","Evaluate probability quality with Brier score, log loss, and track records."]],O=[["See the market","Start from one market and reveal the related markets, risks, and open questions around it."],["Review the reasoning","Keep assumptions, market context, and the decision path visible before taking action."],["Measure the signal","Track probability estimates, opportunity scores, source quality, and later outcomes."],["Expand with control","As agents mature, delegation can become optional, limited, revocable, and auditable."]],U=[{step:"01 / SIMULATE",label:"WORLD",title:"Build parallel market worlds.",body:"Causeway's long-term engine turns one real-world event into multiple market worlds with different assumptions, information delays, source confidence, and liquidity states.",fields:[["seed event","policy shock"],["agent groups","128"],["environment","market world"],["rounds","24"]]},{step:"02 / EVOLVE",label:"SWARM",title:"Let specialized agents disagree.",body:"Research, market graph, probability, skeptic, verification, risk, execution guard, and report agents debate the same market graph before a signal reaches preview.",flow:["research","skeptic","verify","risk"]},{step:"03 / PREDICT",label:"REPORT",title:"Compress debate into intelligence.",body:"The output is not an order. It is a structured market-intelligence object: scenario tree, probability estimate, opportunity score, risk budget, review record, and track record entry.",alert:"Future delegation stays optional, bounded, revocable, and auditable."}],F=[{icon:"event",title:"Events cast wider shadows",body:"A single headline can move through policy, macro, sports, crypto, and election markets. Causeway helps reveal the wider field before you act.",visual:"event -> market shadow"},{icon:"path",title:"Theses need structure",body:"Causeway turns one market idea into a readable path: what it may affect, why it matters, and where the next decision point sits.",visual:"thesis -> path -> decision"},{icon:"logic",title:"Reasoning must be visible",body:"Useful AI does not just answer. It shows assumptions, confidence, uncertainty, and the reasoning behind each market connection.",visual:"assumptions + confidence + why"},{icon:"bound",title:"Speed needs governance",body:"Fast response is only valuable when control stays clear. Causeway keeps review, confirmation, and final action inside a user-governed workflow.",visual:"reason -> review -> approve",highlight:!0},{icon:"view",title:"Previews reduce blind action",body:"Before a scenario becomes real exposure, Causeway turns it into a preview with expected action, limits, risk checks, and audit trail.",visual:"scenario -> preview -> record"},{icon:"mem",title:"Strategies need memory",body:"Repeated scripts can mature into transparent strategies with mandates, eligibility rules, risk budgets, and reporting logic.",visual:"script -> strategy -> report"}],v=[{phase:"01",status:"Now",theme:"Market Data Foundation",headline:"Understand the market before touching the world.",summary:"Phase one focuses on Polymarket market data first. External sources are a later source-object layer.",detail:"Causeway starts by building a reliable map of the market itself: events, markets, result conditions, prices, liquidity, order books, resolution state, and recent market changes. The goal is not to rush into news ingestion. The goal is to make sure every AI-generated path can resolve back to real, tradable market structure before it becomes a preview or user decision.",points:["Market and result-condition mapping","Liquidity and order book awareness","Dry-run previews before any real execution"],signal:"Data -> Structure"},{phase:"02",status:"Next",theme:"Reasoning Model",headline:"Map one event into every related market.",summary:"Build a stronger inference model that can identify all markets touched by a news event, then score relevance, direction, confidence, and suggested action.",detail:"A single event rarely affects only one market. A Federal Reserve signal may touch rates, inflation, equities, crypto, election narratives, and commodity expectations. This phase turns that relationship into an auditable market graph: each connected market gets a reason, an impact direction, a confidence score, and a recommended workflow state such as monitor, avoid, preview, or reduce size.",points:["Cross-market relationship graph","Relevance, direction, confidence, and tradability scoring","Structured recommendations that remain reviewable"],signal:"Event -> Market Graph"},{phase:"03",status:"Later",theme:"Real-Time Scenario Generation",headline:"Turn live news into cross-market scripts.",summary:"Build real-time news stream ingestion and automated scenario generation so one event can produce a full-market response plan quickly.",detail:"At this stage, Causeway moves from offline reasoning into live event response. The system watches real-time news flow, extracts the event, identifies entities and affected themes, then generates a complete market script: what happened, which markets matter, which outcomes should be watched, what confirmation signals are missing, and which actions should be queued for human review.",points:["Real-time news flow ingestion","Automatic script generation from one event","Fast all-market reaction while preserving review gates"],signal:"News -> Script"},{phase:"04",status:"Trust",theme:"Source Verification Layer",headline:"Verify the ground truth before action.",summary:"Before a bet is placed, Causeway should verify the deepest available source of truth through an authority-data library.",detail:"Speed is not enough if the source is wrong. This phase adds a verification layer that traces claims back to primary or authoritative sources: official releases, regulatory filings, sports league data, court documents, government databases, company statements, and on-chain records. Before an action is previewed, the system can show source trail, freshness, conflicts, and whether the original claim was corrected or misread.",points:["Authority source database","Primary-source trail and freshness checks","Conflict detection before order preview"],signal:"Claim -> Proof"},{phase:"05",status:"Future",theme:"Delegated AI Execution",headline:"Let users optionally delegate bounded execution to AI.",summary:"In the future, users may choose to leave the manual verification layer and grant limited account authority to AI for intelligent order execution.",detail:"Delegation is the future layer, not the default boundary. Users can choose to authorize AI execution only inside explicit limits: market categories, maximum order size, loss budget, time window, data-source requirements, and revocation rules. The system should maintain audit trails, permission expiry, and emergency stop controls so autonomy is optional, bounded, and accountable.",points:["Optional permission delegation","User-defined limits and risk budgets","Audit trails, expiry, and emergency revocation"],signal:"Approve -> Delegate"}],B=[{num:"01",title:"Market-native",body:"Causeway treats events, related markets, result conditions, liquidity, and rules as first-class objects instead of reducing a market to a title.",tag:"structure before signal"},{num:"02",title:"Reasoning-visible",body:"Every signal is expected to show assumptions, source state, confidence, risk flags, and the path from market data to preview.",tag:"inspectable AI"},{num:"03",title:"User-governed",body:"AI can expand a thesis and prepare an order plan, but custody, confirmation, and final action remain user-controlled by default.",tag:"control by default"}],N=[["Market structure","Events, related markets, result conditions","Titles and tabs","Loose text prompt","Bot-specific schema"],["AI output","Probability estimate, opportunity score, risk flags","Research notes","Natural language only","Trade trigger"],["Risk state","BUY / WATCH / VERIFY FIRST / AVOID","Manual judgment","Usually omitted","Often bypassed"],["Review record","Reasoning trail and optional audit anchor","Screenshots or notes","Conversation history","Rarely native"],["Control boundary","User confirmation by default","Required","Not applicable","May be optional"]],$=[["Will Causeway place trades for me automatically?","No. Causeway helps analyze market relationships, prepare risk previews, and shape action plans. Real orders remain user-confirmed by default."],["Why look beyond a single market?","One event can affect many related markets. Causeway organizes those relationships into a market map so users can see missed links, conflicts, and possible opportunities."],["How can AI reasoning be reviewed later?","Each run can preserve the market snapshot, assumptions, risk notes, and signal result. When stronger auditability is needed, the reasoning record can also be anchored on Arc."],["What is an opportunity score?","It is an estimated edge after price, fees, spread, slippage, liquidity limits, rule ambiguity, source risk, and model-confidence haircuts."],["What role does x402 play in Causeway?","x402 is better suited for future data, verification, report, and specialized-agent service payments. It is not the trading execution protocol."]];function V(e){return`
    <article class="recipe-card">
      <div class="recipe-top">
        <span class="recipe-icon">${e.icon}</span>
        <span class="ready">READY</span>
      </div>
      <h3>${e.title}</h3>
      <p>${e.body}</p>
      <div class="card-bottom">
        <div>${e.tags.map(r=>`<span class="tag">${r}</span>`).join("")}</div>
        <a href="#quickstart">Run</a>
      </div>
    </article>
  `}function w(e=""){return`<a class="nav-cta ${e}" href="${l}">Launch App</a>`}function H([e,r,a]){return`
    <article class="flow-step">
      <span>${e}</span>
      <h3>${r}</h3>
      <p>${a}</p>
    </article>
  `}function W([e,r]){return`<div><span>${e}</span><b>${r}</b></div>`}function G([e,r],a){return`
    <div class="proof-step" style="--proof-index: ${a}">
      <span>${String(a+1).padStart(2,"0")}</span>
      <strong>${e}</strong>
      <p>${r}</p>
    </div>
  `}function K([e,r]){return`<div><b>${e}</b><span>${r}</span></div>`}function Y([e,r]){return`
    <article class="research-card">
      <h3>${e}</h3>
      <p>${r}</p>
    </article>
  `}function J([e,r]){return`
    <article class="boundary-card">
      <span>${e}</span>
      <p>${r}</p>
    </article>
  `}function Z([e,r,a,n]){return`
    <div class="terminal-row">
      <span class="terminal-num">${e}</span>
      <div>
        <h3>${r}</h3>
        <div class="code-line"><span>$</span> ${n}<button type="button" aria-label="Copy command">Copy</button></div>
        <p>${a}</p>
      </div>
    </div>
  `}function Q(e){return`
    <article class="control-card">
      <div class="card-kicker"><span>${e.step}</span></div>
      <strong class="blue-label">${e.label}</strong>
      <h3>${e.title}</h3>
      <p>${e.body}</p>
      ${e.fields?`<div class="field-stack">${e.fields.map(([r,a])=>`<div><span>${r}</span><b>${a}</b></div>`).join("")}</div>`:""}
      ${e.flow?`<div class="flow-line">${e.flow.map(r=>`<span>${r}</span>`).join("<i>-></i>")}</div>
             <small class="metric">p50 - 37 ms - 1.24M decisions today</small>`:""}
      ${e.alert?`<div class="notice-box"><b>Preview gated.</b><span>${e.alert}</span></div>`:""}
    </article>
  `}function X(e){return`
    <article class="feature-card ${e.highlight?"feature-highlight":""}">
      <span class="feature-icon">${e.icon}</span>
      <h3>${e.title}</h3>
      <p>${e.body}</p>
      <div class="feature-visual">${e.visual}</div>
    </article>
  `}function ee(e,r){return`
    <article class="roadmap-card" style="--roadmap-index: ${r}">
      <div class="roadmap-card-head">
        <span class="roadmap-phase">Phase ${e.phase}</span>
        <span class="roadmap-status">${e.status}</span>
      </div>
      <h3>${e.theme}</h3>
      <p>${e.headline}</p>
      <div class="roadmap-signal"><span>${e.signal}</span></div>
    </article>
  `}function re(e,r){return`
    <details class="roadmap-detail" ${r===0?"open":""}>
      <summary>
        <span>Phase ${e.phase}</span>
        <strong>${e.theme}</strong>
        <i>+</i>
      </summary>
      <div>
        <p>${e.summary}</p>
        <p>${e.detail}</p>
        <ul>
          ${e.points.map(a=>`<li>${a}</li>`).join("")}
        </ul>
      </div>
    </details>
  `}function ae(e){return`
    <article class="compare-principle">
      <span>${e.num}</span>
      <h3>${e.title}</h3>
      <p>${e.body}</p>
      <b>${e.tag}</b>
    </article>
  `}function te(){return`
    <div class="compare-table">
      <div class="compare-head empty"></div>
      <div class="compare-head us"><img src="/assets/causeway-mark-reversed.svg" alt="" />Causeway <span>US</span></div>
      <div class="compare-head">Market Dashboard</div>
      <div class="compare-head">Generic AI Chat</div>
      <div class="compare-head">Automated Trading Bot</div>
      ${N.map(e=>`
            <div class="row-label">${e[0]}</div>
            <div class="us">${e[1]}</div>
            <div>${e[2]}</div>
            <div>${e[3]}</div>
            <div>${e[4]}</div>
          `).join("")}
    </div>
  `}function ne([e,r],a){return`
    <details ${a===0?"open":""}>
      <summary>${e}<span>+</span></summary>
      <p>${r}</p>
    </details>
  `}function se(){return`
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
            ${f.map(oe).join("")}
          </svg>
          ${f.map(ie).join("")}
        </div>
        <div class="sphere-footer">
          <span><b>Probability</b> 48.6%</span>
          <span><b>Opportunity</b> +4.2%</span>
          <span><b>gate</b> verify first</span>
        </div>
      </div>
    </div>
  `}function ie(e,r){return`
    <div class="${e.center?"market-node market-node-center":"market-node"}" style="--node-x: ${e.x}%; --node-y: ${e.y}%; --node-index: ${r}">
      <span>${e.icon}</span>
      <div>
        <b>${e.label}</b>
        <small>${e.meta}</small>
      </div>
      <em>${e.odds}</em>
    </div>
  `}function oe(e,r){return e.center?"":`<line x1="50" y1="50" x2="${e.x}" y2="${e.y}" style="--link-index: ${r}" />`}function y(e){return e.replaceAll("../../public/","/").replaceAll("../../","/")}function m(e,r){return e.querySelector(r)?.textContent.trim()||""}function de(e){const r=new DOMParser().parseFromString(L[e],"text/html"),a=r.querySelector(".cover"),n=[...r.body.children].filter(o=>o.tagName.toLowerCase()==="section"&&!o.classList.contains("cover")),t=a?m(a,"h1").replace(/\s+/g," "):"Causeway Whitepaper",s=a?y(a.innerHTML):"",i=[{id:"00",label:"00. Cover & Disclaimer",eyebrow:"00 / Cover",title:t,html:s},...n.map((o,h)=>{const g=m(o,"h2"),b=m(o,".eyebrow"),u=b.match(/^(\d{2})/)?.[1]||(h===0?"TOC":String(h).padStart(2,"0"));return{id:u,label:`${u==="TOC"?"TOC":u}. ${g}`,eyebrow:b,title:g,html:y(o.innerHTML)}})];return{coverTitle:t,sections:i}}function ce(e,r,a){return`
    <div class="docs-index-panel ${r===0?"is-active":""}" data-doc-index-panel="${e}">
      <span data-doc-copy="toc">${p[e].toc}</span>
      ${a.sections.map((n,t)=>`
            <button type="button" class="${t===0?"is-active":""}" data-doc-section="${n.id}">
              ${n.label}
            </button>
          `).join("")}
    </div>
  `}function le(e,r,a){const n=p[e];return`
    <article class="docs-language-panel ${r===0?"is-active":""}" data-doc-panel="${e}">
      <div class="docs-reading-head">
        <span>${n.reading}</span>
        <b>${a.coverTitle}</b>
      </div>
      <div class="docs-section-viewer">
        ${a.sections.map((t,s)=>`
              <section class="docs-original-section ${s===0?"is-active":""}" data-doc-section-panel="${t.id}">
                ${t.html}
              </section>
            `).join("")}
      </div>
    </article>
  `}function pe(){const e=p.EN,r=Object.fromEntries(c.map(([a])=>[a,de(a)]));return`
    <section class="docs-section section-band" id="docs">
      <div class="docs-shell">
        <div class="docs-top">
          <div class="section-copy">
            <p class="eyebrow" data-doc-copy="eyebrow">${e.eyebrow}</p>
            <h2 data-doc-copy="title">${e.title}</h2>
            <p data-doc-copy="body">${e.body}</p>
          </div>
          <div class="docs-controls" aria-label="Document language">
            ${c.map(([a,n],t)=>`<button type="button" class="${t===0?"is-active":""}" data-doc-lang="${a}"><span>${a}</span>${n}</button>`).join("")}
          </div>
        </div>
        <div class="docs-body">
          <aside class="docs-index">
            ${c.map(([a],n)=>ce(a,n,r[a])).join("")}
          </aside>
          <div class="docs-panels">
            ${c.map(([a],n)=>le(a,n,r[a])).join("")}
          </div>
        </div>
      </div>
    </section>
  `}function x(){return`
    <div class="social-links" aria-label="Social links pending">
      <span class="social-icon" aria-label="X link pending"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L4.3 21H1.2l7.3-8.4L.8 3h6.5l4.4 5.8L16.8 3Zm-1.1 16.2h1.7L6.4 4.7H4.6l11.1 14.5Z"/></svg></span>
      <span class="social-icon" aria-label="Discord link pending"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.1 5.1A15.8 15.8 0 0 0 15.2 4l-.2.4a11 11 0 0 1 3.4 1.7 14.4 14.4 0 0 0-10.8 0A11 11 0 0 1 11 4.4L10.8 4a15.8 15.8 0 0 0-3.9 1.1C4.4 8.8 3.7 12.4 4 16a15.9 15.9 0 0 0 4.8 2.4l.9-1.5c-.5-.2-1-.4-1.5-.7l.4-.3a11.4 11.4 0 0 0 6.8 0l.4.3c-.5.3-1 .5-1.5.7l.9 1.5A15.9 15.9 0 0 0 20 16c.4-4.2-.7-7.7-2.9-10.9ZM9.3 14.1c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm5.4 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z"/></svg></span>
      <span class="social-icon" aria-label="Telegram link pending"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 4.2 18.4 19c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.9 13 2.3 11.6c-1-.3-1-1 .2-1.4l17.9-6.9c.8-.3 1.5.2 1.2.9Z"/></svg></span>
    </div>
  `}function ue(){return`
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
        <a href="${d}">Whitepaper</a>
        <a href="/#compare">Compare</a>
      </nav>
      ${w("nav-dapp")}
    </header>

    <main class="docs-page-main">
      ${pe()}
    </main>

    <footer class="site-footer">
      <span>(c) 2026 Causeway</span>
      <nav class="footer-links"><a href="${d}">Whitepaper</a><a href="/#roadmap">Roadmap</a><a href="/#compare">Compare</a><a href="/#faq">FAQ</a></nav>
      ${x()}
    </footer>
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
      <a href="#flow">Flow</a>
      <a href="#proof">Proof</a>
      <a href="#swarm">Swarm</a>
      <a href="#roadmap">Roadmap</a>
      <a href="${d}">Whitepaper</a>
      <a href="#compare">Compare</a>
    </nav>
    ${w("nav-dapp")}
  </header>

  <main id="top">
    <section class="hero section-band">
      <div class="hero-copy">
        <p class="badge"><img src="/assets/causeway-mark-primary.svg" alt="" /> Reasoning, review, and control layer</p>
        <h1 class="hero-title"><span class="title-ink">See the market </span><span class="title-muted">behind the </span><span class="title-blue title-reveal">market.</span></h1>
        <p class="lead">Causeway turns Polymarket market data into related-market maps, AI-estimated probabilities, risk previews, user-reviewed action plans, and records that can be revisited later.</p>
        <div class="actions">
          <a class="button primary" href="${l}">Launch App</a>
          <a class="button secondary" href="${d}">Read whitepaper</a>
        </div>
        <div class="proof-row">
          <div><b>Market-aware</b><span>SEES RELATED MARKETS</span></div>
          <div><b>Reviewable</b><span>REASONING + RISK TRAIL</span></div>
          <div><b>User-controlled</b><span>YOU APPROVE ACTION</span></div>
        </div>
      </div>
      ${se()}
    </section>

    <section class="why-now section-band">
      <div class="section-copy">
        <p class="eyebrow">- WHY NOW</p>
        <h2>Prediction markets need an intelligence layer.</h2>
        <p>As market count, liquidity, and institutional attention grow, users need systems that understand relationships, verify reasoning, measure signal quality, and keep final control explicit.</p>
      </div>
      <div class="status-strip">${O.map(J).join("")}</div>
    </section>

    <section class="intelligence-flow section-band" id="flow">
      <div class="section-copy wide">
        <p class="eyebrow">- INTELLIGENCE FLOW</p>
        <h2>One event. Many markets. One reviewable path.</h2>
        <p>Causeway does not stop at a generated answer. It turns market data, AI reasoning, execution checks, and proof records into a single auditable workflow.</p>
      </div>
      <div class="flow-grid">${R.map(H).join("")}</div>
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
        ${_.map(W).join("")}
      </div>
    </section>

    <section class="proof-system section-band" id="proof">
      <div class="section-copy">
        <p class="eyebrow">- ARC PROOF & SIGNAL TRACK RECORD</p>
        <h2>Review before performance.</h2>
        <p>Prediction markets judge today's reasoning against future outcomes. Causeway preserves the market snapshot, assumptions, and signal result; when stronger auditability is needed, the record can be anchored on Arc.</p>
      </div>
      <div class="proof-system-grid">
        <div class="proof-timeline">${T.map(G).join("")}</div>
        <div class="track-record-panel">
          <span class="panel-label-dark">Signal Track Record</span>
          <div class="metric-grid">${D.map(K).join("")}</div>
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
      <div class="recipe-grid">${j.map(V).join("")}</div>
      <a class="outline-link" href="#features">Browse all recipes</a>
    </section>

    <section class="quickstart section-band split" id="quickstart">
      <div class="split-copy">
        <p class="eyebrow">- QUICK START</p>
        <h2>From one market to a reviewable action plan.</h2>
        <p>Choose a root market, let Causeway map related markets, review probability estimates and opportunity score, then decide whether to watch, verify, avoid, or preview an order.</p>
        <a class="button primary" href="${l}">Launch App</a>
      </div>
      <div class="terminal-window">
        <div class="window-bar"><i></i><i></i><i></i><span>causeway-cli</span></div>
        ${E.map(Z).join("")}
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
      <div class="control-grid">${U.map(Q).join("")}</div>
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
      <div class="roadmap-grid">${v.map(ee).join("")}</div>
      <div class="roadmap-detail-list">${v.map(re).join("")}</div>
    </section>

    <section class="research-foundation section-band">
      <div class="section-copy">
        <p class="eyebrow">- RESEARCH FOUNDATION</p>
        <h2>Built for prediction-market math, not vibes.</h2>
        <p>The whitepaper grounds Causeway in market-implied probability, transaction-friction-adjusted edge, conservative sizing, semantic market relationships, and calibration metrics.</p>
      </div>
      <div class="research-grid">${M.map(Y).join("")}</div>
    </section>

    <section class="features section-band" id="features">
      <div class="section-copy">
        <p class="eyebrow">- MARKET INTELLIGENCE LAYER</p>
        <h2>Every event has a market shadow.</h2>
      </div>
      <div class="feature-grid">${F.map(X).join("")}</div>
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
      <div class="compare-principles">${B.map(ae).join("")}</div>
      ${te()}
    </section>

    <section class="faq-wrap section-band" id="faq">
      <div class="faq-intro">
        <p class="eyebrow">- FAQ</p>
        <h2>Trust starts with clear boundaries.</h2>
        <p>Causeway is designed to make market reasoning inspectable before any user-confirmed action. These are the boundaries that matter most.</p>
      </div>
      <div class="faq-list">${$.map(ne).join("")}</div>
    </section>

    <section class="final-cta">
      <img src="/assets/causeway-app-icon.png" alt="" />
      <h2>Ready when your thesis is.</h2>
      <p>Start with one outcome. Build the market graph. Preview before you act.</p>
      <div class="install-line"><span>$</span> causeway infer --root-market &lt;market&gt;<button type="button">Copy</button></div>
      <div class="actions center">
        <a class="button inverted" href="${l}">Launch App</a>
        <a class="button dark-outline" href="${d}">Read whitepaper</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <span>(c) 2026 Causeway</span>
    <nav class="footer-links"><a href="${d}">Whitepaper</a><a href="#roadmap">Roadmap</a><a href="#compare">Compare</a><a href="#faq">FAQ</a></nav>
    ${x()}
  </footer>
`;window.location.pathname.replace(/\/$/,"")==="/docs"&&(document.querySelector("#app").innerHTML=ue());document.querySelectorAll(".code-line button, .install-line button").forEach(e=>{e.addEventListener("click",async()=>{const r=e.parentElement.textContent.replace("Copy","").trim();try{await navigator.clipboard.writeText(r),e.textContent="Copied",setTimeout(()=>{e.textContent="Copy"},1200)}catch{e.textContent="Copy"}})});const me=[".hero-copy > *",".hero-graphic",".why-now .section-copy > *",".boundary-card",".intelligence-flow .section-copy > *",".flow-step",".object-copy > *",".object-panel",".proof-system .section-copy > *",".proof-step",".track-record-panel",".section-copy > *",".split-copy > *",".terminal-window",".recipe-card",".control-card",".image-point-copy > *",".logo-constellation",".roadmap-top > *",".roadmap-track",".roadmap-card",".roadmap-detail",".research-card",".docs-top > *",".docs-index",".docs-language-panel.is-active",".feature-card",".compare-top > *",".compare-principle",".compare-table",".faq-intro > *",".faq-list",".final-cta > *"].join(",");document.querySelectorAll(me).forEach((e,r)=>{e.classList.add("reveal-item"),e.style.setProperty("--reveal-delay",`${Math.min(r%6,5)*70}ms`)});const k=()=>{document.body.classList.remove("intro-playing"),document.body.classList.add("intro-complete")};window.matchMedia("(prefers-reduced-motion: reduce)").matches?k():window.setTimeout(k,2250);const A=new IntersectionObserver(e=>{e.forEach(r=>{r.isIntersecting&&(r.target.classList.add("is-visible"),A.unobserve(r.target))})},{rootMargin:"0px 0px -12% 0px",threshold:.12});document.querySelectorAll(".reveal-item").forEach(e=>A.observe(e));function C(e,r){const a=document.querySelector(`[data-doc-index-panel="${e}"]`),n=document.querySelector(`[data-doc-panel="${e}"]`),s=(a?.querySelector(`[data-doc-section="${r}"]`)||a?.querySelector("[data-doc-section]"))?.dataset.docSection;a?.querySelectorAll("[data-doc-section]").forEach(i=>{i.classList.toggle("is-active",i.dataset.docSection===s)}),n?.querySelectorAll("[data-doc-section-panel]").forEach(i=>{i.classList.toggle("is-active",i.dataset.docSectionPanel===s)})}document.querySelectorAll("[data-doc-lang]").forEach(e=>{e.addEventListener("click",()=>{const r=e.dataset.docLang,a=p[r],n=document.querySelector(".docs-index-panel.is-active [data-doc-section].is-active")?.dataset.docSection||"00";document.querySelectorAll("[data-doc-lang]").forEach(t=>{t.classList.toggle("is-active",t===e)}),document.querySelectorAll("[data-doc-index-panel]").forEach(t=>{t.classList.toggle("is-active",t.dataset.docIndexPanel===r)}),document.querySelectorAll("[data-doc-panel]").forEach(t=>{t.classList.toggle("is-active",t.dataset.docPanel===r)}),document.querySelectorAll("[data-doc-copy]").forEach(t=>{t.textContent=a[t.dataset.docCopy]}),C(r,n)})});document.querySelectorAll("[data-doc-section]").forEach(e=>{e.addEventListener("click",()=>{const r=e.closest("[data-doc-index-panel]")?.dataset.docIndexPanel||"EN";C(r,e.dataset.docSection),document.querySelector(".docs-body")?.scrollIntoView({block:"start",behavior:"smooth"})})});
