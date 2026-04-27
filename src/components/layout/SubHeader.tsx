import React, { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface SubHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  rightElement?: ReactNode;
  className?: string;
}

export function SubHeader({ title, subtitle, backHref, rightElement, className = "" }: SubHeaderProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 ${className}`}>
      <div className="flex items-start gap-4">
        {backHref && (
          <Link 
            href={backHref}
            className="mt-1 flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all duration-300 group shadow-sm hover:shadow active:scale-95 shrink-0"
            title="Go Back"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform duration-300" />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-400 mt-1.5 text-sm font-medium max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {rightElement && (
        <div className="flex items-center gap-3">
          {rightElement}
        </div>
      )}
    </div>
  );
}
