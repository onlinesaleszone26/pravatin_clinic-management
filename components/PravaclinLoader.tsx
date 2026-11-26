import React from 'react';
import Image from 'next/image';

export function PravaclinLoader({ message = 'Loading Pravaclin...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-2 border-emerald-600/20 dark:border-emerald-400/20 border-t-[#047857] dark:border-t-emerald-400 animate-[spin_1.6s_linear_infinite] absolute" />
          <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-200/80 overflow-hidden flex items-center justify-center p-1.5">
            <Image
              src="/assets/pravaclin-logo.jpg"
              alt="Pravaclin"
              width={56}
              height={56}
              className="w-full h-full object-contain rounded-full animate-[spin_2.2s_linear_infinite]"
              referrerPolicy="no-referrer"
              priority
            />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Pravaclin
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
        </div>
      </div>
    </div>
  );
}
