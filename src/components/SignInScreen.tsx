export function SignInScreen({ onSignIn, error }: { onSignIn: () => void; error: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
        <div className="text-3xl">🚀</div>
        <h1 className="text-xl font-extrabold text-white">FIRE & IBKR Капітал</h1>
        <p className="text-xs text-slate-400">Увійди через Google, щоб бачити свої дані на всіх пристроях.</p>
        <button
          type="button"
          onClick={onSignIn}
          className="w-full bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-xl px-4 py-2.5 text-sm transition"
        >
          Увійти через Google
        </button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
