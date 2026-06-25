import React from 'react';
import { DollarSign, Landmark, Compass, DollarSign as RevenueIcon } from 'lucide-react';

export default function MarketAnalysis({ tam, sam, som, revenueModel = [] }) {
  return (
    <div className="space-y-6">
      
      {/* TAM/SAM/SOM Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* TAM */}
        <div className="p-5 border border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 rounded-3xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Landmark className="w-4.5 h-4.5" />
            </span>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
              TAM (Total Market)
            </span>
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed pt-1.5">
            {tam || 'Total addressable customer base worldwide.'}
          </p>
        </div>

        {/* SAM */}
        <div className="p-5 border border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 rounded-3xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-450">
              <Compass className="w-4.5 h-4.5" />
            </span>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
              SAM (Serviceable Market)
            </span>
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed pt-1.5">
            {sam || 'The segment targeted by your specific products.'}
          </p>
        </div>

        {/* SOM */}
        <div className="p-5 border border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 rounded-3xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-450">
              <DollarSign className="w-4.5 h-4.5" />
            </span>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
              SOM (Obtainable Market)
            </span>
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed pt-1.5">
            {som || 'The subset you expect to capture realistically.'}
          </p>
        </div>

      </div>

      {/* Revenue Models Block */}
      {revenueModel && revenueModel.length > 0 && (
        <div className="p-5 border border-gray-150 dark:border-gray-755 bg-gray-50/20 dark:bg-gray-900/5 rounded-3xl space-y-3">
          <h4 className="text-xs font-black text-gray-800 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <RevenueIcon className="w-4.5 h-4.5 text-blue-500" />
            Proposed Revenue Streams
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {revenueModel.map((model, i) => (
              <div
                key={i}
                className="p-3 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-750 rounded-2xl text-[10px] font-semibold text-gray-650 dark:text-gray-400 leading-relaxed shadow-sm flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                <span>{model}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
