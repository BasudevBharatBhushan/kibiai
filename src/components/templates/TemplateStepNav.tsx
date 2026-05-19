"use client";

import Link from "next/link";
import clsx from "clsx";
import { Settings, SlidersHorizontal, Zap, BarChart3, ChevronRight } from "lucide-react";

type TemplateStep = "setup" | "configurator" | "generate" | "charts";

interface TemplateStepNavProps {
  slug: string;
  templateId: string;
  templateName: string;
  activeStep: TemplateStep;
  hasSetup?: boolean;
  hasConfig?: boolean;
}

const STEPS: {
  key: TemplateStep;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  path: (base: string) => string;
}[] = [
  {
    key: "setup",
    label: "Setup",
    shortLabel: "Setup",
    icon: <Settings size={13} strokeWidth={2} />,
    path: (base) => `${base}/setup`,
  },
  {
    key: "configurator",
    label: "Report Builder",
    shortLabel: "Builder",
    icon: <SlidersHorizontal size={13} strokeWidth={2} />,
    path: (base) => `${base}/configurator`,
  },
  {
    key: "generate",
    label: "Generate Report",
    shortLabel: "Generate",
    icon: <Zap size={13} strokeWidth={2} />,
    path: (base) => `${base}/generate`,
  },
  {
    key: "charts",
    label: "Chart Builder",
    shortLabel: "Charts",
    icon: <BarChart3 size={13} strokeWidth={2} />,
    path: (base) => `${base}/charts`,
  },
];

/**
 * TemplateStepNav
 *
 * Renders a professional step-based navigation bar for template sub-pages.
 * Used in place of the old TemplateNavBar, integrated into the page body.
 *
 * Breadcrumb pattern:
 *   Report Templates › Setup › Report Builder › Generate Report › Chart Builder
 *                    [Template Name subtitle]
 */
export function TemplateStepNav({
  slug,
  templateId,
  templateName,
  activeStep,
  hasSetup = false,
  hasConfig = false,
}: TemplateStepNavProps) {
  const base = `/${slug}/templates/${templateId}`;
  const activeIndex = STEPS.findIndex((s) => s.key === activeStep);

  return (
    <div className="mb-6">
      {/* Step pills row */}
      <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm px-2 py-2 w-fit">
        {/* Back to templates */}
        <Link
          href={`/${slug}/templates`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors rounded-xl hover:bg-blue-50"
        >
          Report Templates
        </Link>

        {STEPS.map((step, idx) => {
          const isActive = step.key === activeStep;
          const stepIndex = idx;
          // Determine if step is accessible
          const isAccessible =
            step.key === "setup" ||
            (step.key === "configurator" && hasSetup) ||
            ((step.key === "generate" || step.key === "charts") && hasConfig);

          const isBefore = stepIndex < activeIndex;
          const isAfter = stepIndex > activeIndex;

          return (
            <div key={step.key} className="flex items-center">
              <ChevronRight size={14} className="text-slate-200 mx-0.5 shrink-0" />
              {isAccessible && !isActive ? (
                <Link
                  href={step.path(base)}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    isBefore
                      ? "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  )}
                >
                  {step.icon}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </Link>
              ) : (
                <span
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : isAfter
                      ? "text-slate-300 cursor-default"
                      : "text-slate-400 cursor-default"
                  )}
                >
                  {step.icon}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Template name subtitle */}
      {templateName && (
        <div className="mt-3 flex items-center gap-2.5">
          <div className="w-1 h-5 bg-blue-500 rounded-full" />
          <p className="text-[13px] font-semibold text-slate-500 tracking-wide">
            {templateName}
          </p>
        </div>
      )}
    </div>
  );
}
