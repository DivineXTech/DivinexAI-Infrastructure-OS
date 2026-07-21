import { useMemo, useState } from "react";
import { SAMPLE_MATCHES } from "./data/matches";
import { computeVerdict } from "./lib/breakdownEngine";
import { ScoreHeader } from "./components/ScoreHeader";
import { ImpactBars } from "./components/ImpactBars";
import { SpendTransparency } from "./components/SpendTransparency";
import { MathReveal } from "./components/MathReveal";
import { MatchPicker } from "./components/MatchPicker";

export default function App() {
  const [activeId, setActiveId] = useState(SAMPLE_MATCHES[0].id);
  const match = useMemo(
    () => SAMPLE_MATCHES.find((m) => m.id === activeId)!,
    [activeId],
  );
  const verdict = useMemo(() => computeVerdict(match), [match]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="eyebrow">Clean Sheet · Post-Match</span>
        <h1 className="display">Why You Lost</h1>
        <p className="app-sub">
          Every number below comes from this match's own stats. No hidden
          scoring, no "the algorithm decided" — the breakdown is the math.
        </p>
      </header>

      <MatchPicker matches={SAMPLE_MATCHES} activeId={activeId} onSelect={setActiveId} />

      <main className="card">
        <ScoreHeader match={match} />

        <div className="verdict">
          <span className={`outcome-pill outcome-${verdict.outcome}`}>
            {verdict.outcome}
          </span>
          <h2 className="verdict-headline">{verdict.headline}</h2>
        </div>

        {verdict.factors.length > 0 && (
          <>
            <section className="section">
              <span className="eyebrow">Impact Breakdown</span>
              <ImpactBars factors={verdict.factors} primary={verdict.primaryFactor} />
            </section>

            <section className="section">
              <SpendTransparency
                statement={verdict.spendStatement}
                decisive={verdict.spendWasDecisive}
              />
            </section>

            <section className="section">
              <span className="eyebrow">Your Next Fix</span>
              <p className="coach-tip">{verdict.coachTip}</p>
            </section>

            <MathReveal rows={verdict.math} />
          </>
        )}
      </main>

      <footer className="app-footer">
        Prototype of feature #9 from the Clean Sheet rebuild brief — the
        attribution engine runs entirely client-side on the four sample
        matches above. In production, this stays deterministic; an LLM would
        only be layered on top to vary the phrasing, never to invent the
        numbers.
      </footer>
    </div>
  );
}
