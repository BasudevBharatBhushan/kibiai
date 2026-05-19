import React, { ReactNode } from "react";
import "../../styles/reportConfig.css"
import { ChevronRight, ChevronDown } from "lucide-react";

// Card Component
interface CardProps {
  children: ReactNode;
  className?: string;
}


export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`card-base ${className}`}>
      {children}
    </div>
  );
}

// Card Header Component
export function CardHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card-header-wrapper">
      <h2 className="card-title">
        <span className="text-indigo-600"> <ChevronRight size={20} /> </span> {title}
      </h2>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}