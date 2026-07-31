import Header from "./components/Header";
import KpiRow from "./components/KpiRow";
import ModuleRunList from "./components/ModuleRunList";
import InventoryAgingChart from "./components/InventoryAgingChart";
import GrossByMonthChart from "./components/GrossByMonthChart";
import HotLeadsTable from "./components/HotLeadsTable";
import AgingRepriceTable from "./components/AgingRepriceTable";
import {
  agingAndReprice,
  dealershipName,
  grossByMonth,
  hotLeads,
  inventoryAging,
  kpis,
  moduleRuns,
} from "./data/sampleData";

function App() {
  return (
    <div className="min-h-svh bg-[#f6f5f2] dark:bg-[#0f1013]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Header dealershipName={dealershipName} />
        <KpiRow kpis={kpis} />
        <ModuleRunList runs={moduleRuns} />
        <div className="grid gap-4 sm:grid-cols-2">
          <InventoryAgingChart data={inventoryAging} />
          <GrossByMonthChart data={grossByMonth} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <HotLeadsTable leads={hotLeads} />
          <AgingRepriceTable rows={agingAndReprice} />
        </div>
        <footer className="pb-4 pt-2 text-center text-xs text-neutral-400 dark:text-neutral-600">
          AgentFlow Pro — a DivinexAI Infrastructure OS vertical. Sample data shown for demo purposes.
        </footer>
      </div>
    </div>
  );
}

export default App;
