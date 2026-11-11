import { useCallback, useMemo, useState } from "react";
import { AssetsPanel } from "./components/AssetsPanel";
import { BillsPanel, FireWidgets } from "./components/FireWidgets";
import { GenericAssetsPanel } from "./components/GenericAssetsPanel";
import { GoalsPanel } from "./components/GoalsPanel";
import { Header } from "./components/Header";
import { SettingsPanel } from "./components/SettingsPanel";
import { SnapshotsPanel } from "./components/SnapshotsPanel";
import { ToastContainer, useToasts } from "./components/Toasts";
import { getFireProgress, getFireRules, moveBillLevelTo } from "./domain/calc";
import type { FxCache } from "./domain/currency";
import { normalizeState } from "./domain/defaults";
import type { AppState } from "./domain/types";
import { computeWealth, getGoalBalance } from "./domain/wealth";
import { SignInScreen } from "./components/SignInScreen";
import { db, isFirebaseConfigured } from "./firebase/client";
import { useAuth } from "./hooks/useAuth";
import { useFireState } from "./hooks/useFireState";
import { useFxRates } from "./hooks/useFxRates";
import type { StateStorage } from "./storage/StateStorage";
import { createFirestoreStorage } from "./storage/firestoreStorage";
import { localStorageStorage } from "./storage/localStorageStorage";

const TABS = [
  { id: "fire", label: "FIRE" },
  { id: "assets", label: "Активи" },
  { id: "goals", label: "Цілі" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const auth = useAuth();

  if (!isFirebaseConfigured) return <Dashboard storage={localStorageStorage} />;
  if (!auth.ready) return null;
  if (!auth.user) return <SignInScreen onSignIn={auth.signIn} error={auth.error} />;

  return (
    <CloudDashboard
      key={auth.user.uid}
      uid={auth.user.uid}
      email={auth.user.email ?? ""}
      onSignOut={auth.signOutUser}
    />
  );
}

function CloudDashboard({ uid, email, onSignOut }: { uid: string; email: string; onSignOut: () => void }) {
  const storage = useMemo(() => createFirestoreStorage(db!, uid), [uid]);
  return <Dashboard storage={storage} account={{ email, uid, onSignOut }} />;
}

interface Account {
  email: string;
  uid: string;
  onSignOut: () => void;
}

function Dashboard({ storage, account }: { storage: StateStorage; account?: Account }) {
  const { state, update, loaded, loadError, status } = useFireState(storage);
  const { toasts, notify } = useToasts();
  const setFx = useCallback((fx: FxCache) => update((s) => ({ ...s, fx })), [update]);
  const { status: fxStatus, refresh: refreshFx } = useFxRates(loaded, setFx);
  const [tab, setTab] = useState<TabId>("fire");

  const rules = useMemo(() => getFireRules(state.settings), [state.settings]);
  const wealth = useMemo(() => computeWealth(state), [state.assets, state.genericAssets, state.fx]);
  const fireAvailable = wealth.fireGenericValue !== null;
  const progress = useMemo(
    () => getFireProgress(rules, wealth.fireStocks, new Date(), wealth.fireGenericValue ?? 0),
    [rules, wealth],
  );
  const balances = useMemo(
    () => Object.fromEntries(state.goals.map((g) => [g.id, getGoalBalance(g.id, state)])),
    [state.goals, state.assets, state.genericAssets, state.fx],
  );

  if (loadError) {
    return (
      <div className="p-8 text-center text-sm text-rose-300 space-y-3">
        <p>⚠️ Не вдалося завантажити дані з хмари (перевір правила Firestore та свій UID).</p>
        {account && (
          <p className="text-slate-400">
            Твій UID: <code className="select-all text-slate-200">{account.uid}</code>
          </p>
        )}
        {account && (
          <button type="button" onClick={account.onSignOut} className="underline text-slate-300">
            Вийти
          </button>
        )}
      </div>
    );
  }
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
        {account && (
          <div className="flex flex-wrap justify-end items-center gap-3 text-[11px] text-slate-400">
            <span>{account.email}</span>
            <span>
              UID: <code className="select-all text-slate-300">{account.uid}</code>
            </span>
            <button type="button" onClick={account.onSignOut} className="underline hover:text-slate-200">
              Вийти
            </button>
          </div>
        )}
        <Header
          rules={rules}
          totals={wealth.stocks}
          wealth={wealth.combinedWealth}
          fireAvailable={fireAvailable}
          progress={progress}
          status={status}
          storageLabel={storage.label}
          onExport={exportJson}
          onImport={importJson}
        />

        {!fireAvailable && (
          <div className="bg-amber-950/30 border border-amber-800/60 text-amber-300 text-sm rounded-2xl p-5">
            ⚠️ Показники FIRE недоступні: немає курсу для {wealth.missingCurrencies.join(", ")}. Онови курси в блоці «Інші активи».
          </div>
        )}

        <div role="tablist" aria-label="Розділи" className="flex gap-1 border-b border-slate-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${
                tab === t.id
                  ? "border-sky-400 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="panel-fire" aria-labelledby="tab-fire" hidden={tab !== "fire"} className="space-y-6">
          <SettingsPanel
            settings={state.settings}
            retirementSummary={
              fireAvailable
                ? `🎯 Вихід на пенсію у ${progress.retireAge.toFixed(1)} років (через ${progress.yearsLeft} р. ${progress.remMonths} м.)`
                : "🎯 Прогноз FIRE недоступний: немає курсу для активів, прив'язаних до FIRE"
            }
            onChange={(settings) => update((s) => ({ ...s, settings }))}
          />

          {fireAvailable && (
            <FireWidgets rules={rules} totals={wealth.fireStocks} staticCapital={wealth.fireGenericValue ?? 0} progress={progress} />
          )}

          <BillsPanel
            rules={rules}
            investedCapital={wealth.fireStocks.totalMarketValue}
            order={state.billLevelOrder}
            onMove={(id, toIndex) => patch("billLevelOrder", (order) => moveBillLevelTo(order, id, toIndex))}
          />
        </div>

        <div role="tabpanel" id="panel-assets" aria-labelledby="tab-assets" hidden={tab !== "assets"} className="space-y-6">
          <AssetsPanel
            assets={state.assets}
            goals={state.goals}
            monthlySave={rules.mandatoryMonthlySave}
            onChange={(fn) => patch("assets", fn)}
            notify={notify}
          />

          <GenericAssetsPanel
            genericAssets={state.genericAssets}
            goals={state.goals}
            fx={state.fx}
            fxStatus={fxStatus}
            onRefreshFx={() => void refreshFx()}
            onChange={(fn) => patch("genericAssets", fn)}
            notify={notify}
          />

          <SnapshotsPanel
            state={state}
            totals={wealth.stocks}
            wealth={wealth.combinedWealth}
            fxFresh={fxStatus.fresh}
            onChange={(fn) => patch("snapshots", fn)}
            notify={notify}
          />
        </div>

        <div role="tabpanel" id="panel-goals" aria-labelledby="tab-goals" hidden={tab !== "goals"} className="space-y-6">
          <GoalsPanel
            goals={state.goals}
            assets={state.assets}
            genericAssets={state.genericAssets}
            balances={balances}
            targetFireCapital={rules.targetFireCapital}
            onGoalsChange={(fn) => patch("goals", fn)}
            onTransactionsChange={(fn) => patch("transactions", fn)}
            notify={notify}
          />
        </div>
      </div>
    </div>
  );
}
