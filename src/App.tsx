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
  {
    id: "fire",
    label: "FIRE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 13l4-4" />
      </svg>
    ),
  },
  {
    id: "assets",
    label: "Активи",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
      </svg>
    ),
  },
  {
    id: "goals",
    label: "Цілі",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Desktop: left rail. Phone: fixed bottom bar. Both drive the same tab state.
function SectionNav({ tab, onChange, variant }: { tab: TabId; onChange: (t: TabId) => void; variant: "rail" | "bottom" }) {
  const isRail = variant === "rail";
  return (
    <nav
      aria-label="Розділи"
      className={
        isRail
          ? "hidden lg:flex lg:flex-col lg:w-44 lg:shrink-0 lg:sticky lg:top-8 lg:self-start gap-1"
          : "fixed inset-x-0 bottom-0 z-40 lg:hidden grid grid-cols-3 gap-1 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-900/95 backdrop-blur border-t border-slate-800"
      }
    >
      {TABS.map((t) => {
        const active = tab === t.id;
        const base = isRail
          ? "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          : "flex flex-col items-center gap-1 py-1 rounded-xl text-[11px] font-semibold transition-colors";
        const state = isRail
          ? active
            ? "bg-sky-500/15 text-sky-300"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          : active
            ? "text-sky-300"
            : "text-slate-400";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={active ? "page" : undefined}
            className={`${base} ${state}`}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

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
  const changeTab = useCallback((t: TabId) => {
    setTab(t);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, []);

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
      <div className="max-w-7xl mx-auto lg:flex lg:gap-6">
        <SectionNav tab={tab} onChange={changeTab} variant="rail" />
        <div className="flex-1 min-w-0 space-y-6 pb-24 lg:pb-0">
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

        <div id="panel-fire" hidden={tab !== "fire"} className="space-y-6">
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

        <div id="panel-assets" hidden={tab !== "assets"} className="space-y-6">
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

        <div id="panel-goals" hidden={tab !== "goals"} className="space-y-6">
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
      <SectionNav tab={tab} onChange={changeTab} variant="bottom" />
    </div>
  );
}
