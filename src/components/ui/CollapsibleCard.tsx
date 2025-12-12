"use client";

import React, { useState } from "react";
import "../../styles/reportConfig.css"
import { ChevronRight, ChevronDown } from "lucide-react";

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  action?: React.ReactNode; // Optional button in header ("+ Add")
}

export function CollapsibleCard({ 
  title, 
  children, 
  defaultOpen = false, 
  className = "",
  action 
}: CollapsibleCardProps) {

  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`card-base ${className}`}>
      {/* Header */}
      <div 
        className="card-header-wrapper"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="card-title">
          <span className="text-indigo-600 transition-transform duration-200">
            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </span>
          <h2>{title}</h2>
        </div>
        
        {/* Action Button (Prevent bubble up) */}
        {action && (
          <div onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </div>

      {/* Content */}
      {isOpen && (
        <div className="card-content">
          {children}
        </div>
      )}
    </div>
  );
}