"use client";

import Link from "next/link";
import { ChevronLeft, Settings, SlidersHorizontal, Zap, BarChart3 } from "lucide-react";
import clsx from "clsx";

type PageContext = "setup" | "configurator" | "generate" | "charts";

interface TemplateNavBarProps {
  slug: string;
  templateId: string;
  current: PageContext;
  hasSetup?: boolean;
  hasConfig?: boolean;
}

interface NavLink {
  label: string;
  href: string;
  icon: React.ReactNode;
  direction: "back" | "forward";
}

/**
 * TemplateNavBar
 *
 * Renders context-aware navigation links between the four template pages:
 * Setup → Configurator → Generate → Charts
 */
export function TemplateNavBar({
  slug,
  templateId,
  current,
  hasSetup: _hasSetup = false,
  hasConfig = false,
}: TemplateNavBarProps) {
  const base = `/${slug}/templates/${templateId}`;

  const links: NavLink[] = [];

  switch (current) {
    case "setup":
      if (hasConfig) {
        links.push({
          label: "Configurator",
          href: `${base}/configurator`,
          icon: <SlidersHorizontal size={14} />,
          direction: "forward",
        });
      }
      links.push({
        label: "Templates",
        href: `/${slug}/templates`,
        icon: <ChevronLeft size={14} />,
        direction: "back",
      });
      break;

    case "configurator":
      links.push({
        label: "Setup",
        href: `${base}/setup`,
        icon: <Settings size={14} />,
        direction: "back",
      });
      if (hasConfig) {
        links.push({
          label: "Generate",
          href: `${base}/generate`,
          icon: <Zap size={14} />,
          direction: "forward",
        });
        links.push({
          label: "Charts",
          href: `${base}/charts`,
          icon: <BarChart3 size={14} />,
          direction: "forward",
        });
      }
      break;

    case "generate":
      links.push({
        label: "Configurator",
        href: `${base}/configurator`,
        icon: <SlidersHorizontal size={14} />,
        direction: "back",
      });
      links.push({
        label: "Setup",
        href: `${base}/setup`,
        icon: <Settings size={14} />,
        direction: "back",
      });
      links.push({
        label: "Charts",
        href: `${base}/charts`,
        icon: <BarChart3 size={14} />,
        direction: "forward",
      });
      break;

    case "charts":
      links.push({
        label: "Generate",
        href: `${base}/generate`,
        icon: <Zap size={14} />,
        direction: "back",
      });
      links.push({
        label: "Setup",
        href: `${base}/setup`,
        icon: <Settings size={14} />,
        direction: "back",
      });
      break;
  }

  if (links.length === 0) return null;

  const backLinks = links.filter((l) => l.direction === "back");
  const forwardLinks = links.filter((l) => l.direction === "forward");

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3 mb-2">
      {/* Back links */}
      <div className="flex items-center gap-2">
        {backLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium"
          >
            <ChevronLeft size={14} />
            {link.label}
          </Link>
        ))}
      </div>

      {/* Forward links */}
      {forwardLinks.length > 0 && (
        <div className="flex items-center gap-2">
          {forwardLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90",
              )}
              style={{
                background:
                  link.label === "Charts"
                    ? "#7c3aed"
                    : link.label === "Generate"
                    ? "#059669"
                    : "#2563eb",
              }}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
