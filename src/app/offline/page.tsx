export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-balance text-2xl font-semibold">You’re offline</h1>
      <p className="mt-2 text-pretty text-sm text-slate-600 dark:text-slate-300">
        Check your connection and try again. Previously visited pages might still load.
      </p>
    </main>
  );
}

