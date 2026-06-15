"use client";

import React from "react";
import clsx from "clsx";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

/**
 * Standard container that ensures X-axis alignment with the Header.
 * Uses the same max-width and padding classes.
 */
export default function PageContainer({ 
  children, 
  className,
  maxWidth = "max-w-[1600px]" 
}: PageContainerProps) {
  return (
    <div className={clsx(
      "mx-auto w-full px-4 sm:px-6 lg:px-8",
      maxWidth,
      className
    )}>
      {children}
    </div>
  );
}
