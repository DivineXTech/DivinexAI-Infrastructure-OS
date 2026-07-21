import { useState } from "react";
import WhyYouLost from "./pages/WhyYouLost";
import FairMatchmaking from "./pages/FairMatchmaking";
import PackOdds from "./pages/PackOdds";

type Tab = "why-you-lost" | "matchmaking" | "packs";

export default function App() {
  const [tab, setTab] = useState<Tab>("why-you-lost");

  return (
    <div className="app">
      <nav className="tab-nav" aria-label="Prototype sections">
        <button
          className={`tab-btn ${tab === "why-you-lost" ? "active" : ""}`}
          onClick={() => setTab("why-you-lost")}
        >
          Why You Lost
        </button>
        <button
          className={`tab-btn ${tab === "matchmaking" ? "active" : ""}`}
          onClick={() => setTab("matchmaking")}
        >
          Fair Matchmaking
        </button>
        <button
          className={`tab-btn ${tab === "packs" ? "active" : ""}`}
          onClick={() => setTab("packs")}
        >
          Pack Odds
        </button>
      </nav>

      {tab === "why-you-lost" && <WhyYouLost />}
      {tab === "matchmaking" && <FairMatchmaking />}
      {tab === "packs" && <PackOdds />}
    </div>
  );
}
