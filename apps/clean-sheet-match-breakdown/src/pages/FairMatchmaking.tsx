import { useEffect, useMemo, useRef, useState } from "react";
import { CANDIDATE_POOL, SAMPLE_QUEUERS } from "../data/candidatePool";
import { compareResults, findFairMatch, findLegacyMatch } from "../lib/matchmakingEngine";
import { QueuerPicker } from "../components/matchmaking/QueuerPicker";
import { QueuerCard } from "../components/matchmaking/QueuerCard";
import { SearchPanel } from "../components/matchmaking/SearchPanel";
import { CandidatePoolTable } from "../components/matchmaking/CandidatePoolTable";

const ROUND_DELAY_MS = 420;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function FairMatchmaking() {
  const [activeId, setActiveId] = useState(SAMPLE_QUEUERS[0].id);
  const queuer = useMemo(
    () => SAMPLE_QUEUERS.find((q) => q.id === activeId)!,
    [activeId],
  );

  const legacy = useMemo(() => findLegacyMatch(queuer, CANDIDATE_POOL), [queuer]);
  const fair = useMemo(() => findFairMatch(queuer, CANDIDATE_POOL), [queuer]);
  const comparison = useMemo(() => compareResults(legacy, fair), [legacy, fair]);

  const [roundsShown, setRoundsShown] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRoundsShown(0);
    setRevealed(false);

    const totalRounds = fair.searchRound ?? 1;

    if (prefersReducedMotion()) {
      setRoundsShown(totalRounds);
      setRevealed(true);
      return;
    }

    for (let i = 1; i <= totalRounds; i++) {
      timers.current.push(
        setTimeout(() => setRoundsShown(i), i * ROUND_DELAY_MS),
      );
    }
    timers.current.push(
      setTimeout(
        () => setRevealed(true),
        totalRounds * ROUND_DELAY_MS + 250,
      ),
    );

    return () => timers.current.forEach(clearTimeout);
  }, [fair]);

  return (
    <div>
      <header className="page-header">
        <span className="eyebrow">Clean Sheet · Matchmaking</span>
        <h1 className="display">Fair Matchmaking</h1>
        <p className="page-sub">
          Same queue, same instant, two algorithms. Legacy searches by squad
          rating. Clean Sheet searches by skill. Watch what each one finds.
        </p>
      </header>

      <QueuerPicker queuers={SAMPLE_QUEUERS} activeId={activeId} onSelect={setActiveId} />

      <main className="card">
        <QueuerCard queuer={queuer} />

        <div className="search-grid">
          <SearchPanel
            title="Legacy Matchmaking"
            subtitle="Targets an inflated OVR floor. Ignores skill entirely."
            result={legacy}
            roundsShown={1}
            revealed={revealed}
            tone="legacy"
          />
          <SearchPanel
            title="Clean Sheet Matchmaking"
            subtitle="Searches by skill rating first. Squad value isn't read."
            result={fair}
            roundsShown={roundsShown}
            revealed={revealed}
            tone="fair"
          />
        </div>

        {revealed && (
          <>
            <section className="section">
              <div className={`spend-card ${comparison.ratio > 1 ? "decisive" : "not-decisive"}`}>
                <span className="eyebrow">The Gap, Side by Side</span>
                <p>{comparison.statement}</p>
              </div>
            </section>

            <CandidatePoolTable pool={CANDIDATE_POOL} legacy={legacy} fair={fair} />
          </>
        )}
      </main>

      <footer className="app-footer">
        Prototype of feature #2 from the Clean Sheet rebuild brief. Legacy
        matchmaking is simulated to match the reviewed behavior — nearest
        squad rating to an inflated target, filtered only by connection.
        Fair matchmaking searches by skill rating in widening bands and never
        reads squad value. Both run against the same fixed queue snapshot so
        the comparison is apples to apples.
      </footer>
    </div>
  );
}
