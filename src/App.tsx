import { useMemo } from "react";
import { AssetsPanel } from "./components/AssetsPanel";
import { BillsPanel, FireWidgets } from "./components/FireWidgets";
import { GoalsPanel, TransactionsPanel } from "./components/GoalsPanel";
import { Header } from "./components/Header";
import { SettingsPanel } from "./components/SettingsPanel";
import { SnapshotsPanel } from "./components/SnapshotsPanel";
import { ToastContainer, useToasts } from "./components/Toasts";
import { getFireProgress, getFireRules, getPortfolioTotals } from "./domain/calc";
import { normalizeState } from "./domain/defaults";
import type { AppState } from "./domain/types";
import { useFireState } from "./hooks/useFireState";
import { localStorageStorage } from "./storage/localStorageStorage";

const storage = localStorageStorage;

export default function App() {
  const { state, update, loaded, status } = useFireState(storage);
  const { toasts, notify } = useToasts();

  const rules = useMemo(() => getFireRules(state.settings), [state.settings]);
  const totals = useMemo(() => getPortfolioTotals(state.assets), [state.assets]);
  const progress = useMemo(() => getFireProgress(rules, totals), [rules, totals]);

  if (!loaded) return null;

  const patch = <K extends keyof AppState>(key: K, fn: (prev: AppState[K]) => AppState[K]) =>
    update((s) => ({ ...s, [key]: fn(s[key]) }));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fire-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("📥 Резервну копію завантажено!");
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      update(() => normalizeState(parsed));
      notify("📤 Дані відновлено з файлу!");
    } catch {
      notify("⚠️ Не вдалося прочитати JSON файл!", "amber");
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <ToastContainer toasts={toasts} />
      <div className="max-w-7xl mx-auto space-y-6">
        <Header
          rules={rules}
          totals={totals}
          progress={progress}
          status={status}
          storageLabel={storage.label}
          onExport={exportJson}
          onImport={importJson}
        />

        <SettingsPanel
          settings={state.settings}
          retirementSummary={`🎯 Вихід на пенсію у ${progress.retireAge.toFixed(1)} років (через ${progress.yearsLeft} р. ${progress.remMonths} м.)`}
          onChange={(settings) => update((s) => ({ ...s, settings }))}
        />

        <FireWidgets rules={rules} totals={totals} progress={progress} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <BillsPanel rules={rules} monthlyDividends={progress.monthlyDividends} />
          <AssetsPanel
            assets={state.assets}
            monthlySave={rules.mandatoryMonthlySave}
            onChange={(fn) => patch("assets", fn)}
            notify={notify}
          />
        </div>

        <SnapshotsPanel state={state} totals={totals} onChange={(fn) => patch("snapshots", fn)} notify={notify} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GoalsPanel
            goals={state.goals}
            transactions={state.transactions}
            onGoalsChange={(fn) => patch("goals", fn)}
            notify={notify}
          />
          <TransactionsPanel
            goals={state.goals}
            transactions={state.transactions}
            onTransactionsChange={(fn) => patch("transactions", fn)}
            notify={notify}
          />
        </div>
      </div>
    </div>
  );
}
