"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  addToast: (type: ToastType, title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

// Map styles to types for cleaner JSX
const TOAST_STYLES: Record<ToastType, string> = {
  success: "bg-white border-green-500 text-slate-800",
  error: "bg-white border-red-500 text-slate-800",
  warning: "bg-white border-amber-500 text-slate-800",
  info: "bg-white border-blue-500 text-slate-800",
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    // Industrial Standard: Use crypto.randomUUID for unique IDs
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2);

    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      
      {/* Toast Container (Fixed Overlay) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border border-opacity-20 transition-all animate-in slide-in-from-right-full
              ${TOAST_STYLES[toast.type]}
            `}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle size={18} className="text-green-600" />}
              {toast.type === 'error' && <AlertCircle size={18} className="text-red-600" />}
              {/* Changed Warning Icon to AlertTriangle for distinction */}
              {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-600" />}
              {toast.type === 'info' && <Info size={18} className="text-blue-600" />}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h4 className="text-sm font-semibold">{toast.title}</h4>
              {toast.message && <p className="text-xs text-slate-500 mt-1">{toast.message}</p>}
            </div>

            {/* Close Button */}
            <button 
              onClick={() => removeToast(toast.id)} 
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider />");
  }
  return context;
}