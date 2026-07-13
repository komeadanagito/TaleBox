import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-6xl font-bold text-amber-500 mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">页面未找到</h2>
      <p className="text-slate-400 mb-6 max-w-md">
        抱歉，您访问的页面不存在或已被移除。
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium rounded-xl transition-all"
      >
        返回首页
      </Link>
    </div>
  );
}
