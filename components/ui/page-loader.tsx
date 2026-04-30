"use client";

export function PageLoader({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-white/35 backdrop-blur-[1px]" />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#D8E3DE] bg-white px-6 py-5 shadow-lg">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#D8E3DE] border-t-[#00A27F]" />
          <p className="text-sm font-medium text-[#6B7280]">
            Cargando...
          </p>
        </div>
      </div>
    </>
  );
}