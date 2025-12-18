"use client";

import React, { useState } from "react";
import "../../styles/reportConfig.css"
import { ChevronRight, ChevronDown } from "lucide-react";

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function CollapsibleCard({ 
  title, 
  children, 
  defaultOpen = false, 
  className = "",
  action ,
  icon
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

        {icon && (
            <span className="text-indigo-600 bg-indigo-50 p-1.5 rounded-md">
              {icon}
            </span>
          )}
        
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