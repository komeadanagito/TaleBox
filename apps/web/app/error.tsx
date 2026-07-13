'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-semibold mb-2">页面发生错误</h2>
      <p className="text-slate-400 mb-6 max-w-md">
        {error.message || '加载页面时遇到了一些问题。'}
      </p>
      <button
        onClick={() => reset()}
        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium rounded-xl transition-all font-sans"
      >
        重试
      </button>
    </div>
  );
}
