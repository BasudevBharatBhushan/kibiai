'use client';

import React from 'react';
import { FiX, FiSettings, FiBarChart2 } from 'react-icons/fi';
import { ChartConfig } from '@/lib/ChartTypes';

interface EditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  charts: ChartConfig[]; // Passing current charts
}

export default function EditPanel({ isOpen, onClose, charts }: EditPanelProps) {
  return (
    <>
      {/* 1. Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 2. Slide-over Panel */}
      <div 
        className={`fixed top-0 left-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <FiSettings size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-lg leading-tight">Configuration</h2>
              <p className="text-xs text-slate-500">Edit chart rules and data</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
            Active Charts ({charts.length})
          </p>

          {charts.map((chart) => (
            <div 
              key={chart.id}
              className="group p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
            >
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                <FiBarChart2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-700">
                  {chart.title}
                </h3>
                <p className="text-xs text-slate-400">
                  {chart.kind.charAt(0).toUpperCase() + chart.kind.slice(1)} Chart
                </p>
              </div>
            </div>
          ))}

          {charts.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              No charts available to configure.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}