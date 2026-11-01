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
import { SignInScreen } from "./components/SignInScreen";
import { db, isFirebaseConfigured } from "./firebase/client";
import { useAuth } from "./hooks/useAuth";
import { useFireState } from "./hooks/useFireState";
import type { StateStorage } from "./storage/StateStorage";
import { createFirestoreStorage } from "./storage/firestoreStorage";
import { localStorageStorage } from "./storage/localStorageStorage";

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

  const rules = useMemo(() => getFireRules(state.settings), [state.settings]);
  const totals = useMemo(() => getPortfolioTotals(state.assets), [state.assets]);
  const progress = useMemo(() => getFireProgress(rules, totals), [rules, totals]);

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
