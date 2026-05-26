"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCompany } from "@/components/providers/CompanyProvider";
import { useAccessControl } from "@/context/AccessControlContext";
import kibiaiLogo from "@/assets/kibiai.png";
import {
  Building2,
  ChevronRight,
  Home,
  LogOut,
  User,
  Settings,
  Menu,
  X,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useHeader } from "@/context/HeaderContext";
import { useParams, useRouter, usePathname } from "next/navigation";
import clsx from "clsx";

// ── Utilities ─────────────────────────────────────────────────────────────────
function getPlanStyle(plan: string) {
  const n = (plan || "").toLowerCase();
  if (n.includes("teams"))      return { from: "#2563eb", to: "#1d4ed8", label: plan };
  if (n.includes("pro"))        return { from: "#7c3aed", to: "#6d28d9", label: plan };
  if (n.includes("starter"))    return { from: "#0ea5e9", to: "#0284c7", label: plan };
  if (n.includes("enterprise")) return { from: "#0f172a", to: "#1e293b", label: plan };
  return                               { from: "#2563eb", to: "#1d4ed8", label: plan || "Free" };
}

function firstNameFromEmail(email: string): string {
  const local = email?.split("@")[0] ?? "Admin";
  const part  = local.split(/[._\-]/)[0] ?? local;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

// ── Plan Badge ────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const s = getPlanStyle(plan);
  return (
    <span
      className="plan-shimmer inline-flex items-center gap-1 px-2 py-[2px] text-white text-[9px] font-semibold tracking-wider uppercase rounded-full"
      style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
    >
      <svg
        className="w-2.5 h-2.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
      </svg>
      {s.label}
    </span>
  );
}

// ── Compact Breadcrumbs ──────────────────────────────────────────────────────
// Icon-only summary used when full breadcrumbs would collide with the right-side
// header actions. Clicking the … reveals the full path in a small popover.
function CompactBreadcrumbs({
  crumbs,
  expanded,
  onToggle,
}: {
  crumbs: { label: string; href?: string }[];
  expanded: boolean;
  onToggle: (e: React.MouseEvent) => void;
}) {
  const last = crumbs[crumbs.length - 1];
  const middle = crumbs.slice(0, -1);

  return (
    <div className="relative flex items-center min-w-0">
      {middle.length > 0 && (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            title={middle.map(c => c.label).join(" › ")}
            aria-haspopup="menu"
            aria-expanded={expanded}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <ChevronRight className="mx-1.5 h-3 w-3 text-slate-300 shrink-0" />
        </>
      )}
      <span className="text-[13px] font-semibold text-blue-600 truncate max-w-[180px]">
        {last?.label}
      </span>

      {expanded && middle.length > 0 && (
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[200px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {middle.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                >
                  <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
                  <span className="truncate">{crumb.label}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-500">
                  <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
                  <span className="truncate">{crumb.label}</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Header Component ─────────────────────────────────────────────────────────
export default function Header() {
  const { company, isLoading: companyLoading } = useCompany();
  const { breadcrumbs, headerActions } = useHeader();
  const { isSuperAdmin } = useAccessControl();
  const params  = useParams();
  const router  = useRouter();
  const pathname = usePathname();
  const slug    = params?.company_slug as string;

  // Scroll-collapse
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollY = useRef(0);

  // Dropdowns
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Breadcrumb collision detection — when the full-text breadcrumbs would
  // overflow their container (because page action buttons claim more width),
  // collapse to an icon-only summary (Home > … > current).
  const breadcrumbNavRef = useRef<HTMLElement>(null);
  const breadcrumbMeasureRef = useRef<HTMLDivElement>(null);
  const [compactBreadcrumbs, setCompactBreadcrumbs] = useState(false);
  const [crumbsExpanded, setCrumbsExpanded] = useState(false);

  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("Admin");

  useEffect(() => {
    const fetchMe = async () => {
      try {
        // Cache-busting with timestamp
        const res = await fetch(`/api/auth/me?v=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          console.log("Header User Data:", data);
          if (data.user) {
            setUserName(data.user.name || "");
            setUserEmail(data.user.email || "");
            setUserRole(data.user.role || "Admin");
          }
        } else {
          console.error("Header: Auth fetch failed with status", res.status);
        }
      } catch (err) {
        console.error("Header: Failed to fetch user info", err);
      }
    };
    fetchMe();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const cur = window.scrollY;
      setCollapsed(cur > 60 && cur > lastScrollY.current);
      lastScrollY.current = cur;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Compare the hidden full-text measurer against the visible nav width.
  // Use a small slack to avoid flapping when widths are within a few pixels.
  useEffect(() => {
    const containerEl = breadcrumbNavRef.current;
    const measureEl = breadcrumbMeasureRef.current;
    if (!containerEl || !measureEl) return;

    const SLACK = 8;
    const recompute = () => {
      const available = containerEl.clientWidth;
      const needed = measureEl.scrollWidth;
      setCompactBreadcrumbs(needed > available - SLACK);
    };

    recompute();

    const ro = new ResizeObserver(recompute);
    ro.observe(containerEl);
    ro.observe(measureEl);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [breadcrumbs, headerActions, collapsed]);

  useEffect(() => {
    if (!crumbsExpanded) return;
    const close = () => setCrumbsExpanded(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [crumbsExpanded]);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Use a full page reload instead of router.push so that React state
    // (including AccessControlContext) is fully cleared. A soft navigation
    // keeps accountId in memory, causing the login page to redirect back.
    window.location.href = `/${slug}/login`;
  };

  const displayName = userName || (userEmail ? firstNameFromEmail(userEmail) : "Admin");
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const planLabel = company?.plan_name || company?.plan || "Free";

  // Don't show header on login page
  if (pathname?.endsWith("/login")) return null;
  if (!company && !companyLoading) return null;

  return (
    <>
      <style>{`
        .wh-glass {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .wh-border-gradient::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #e2e8f0 10%, #cbd5e1 50%, #e2e8f0 90%, transparent 100%);
        }
        .plan-shimmer { position: relative; overflow: hidden; }
        .plan-shimmer::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: wh-shimmer 3s ease-in-out infinite;
        }
        @keyframes wh-shimmer {
          0%, 100% { left: -100%; }
          50% { left: 100%; }
        }
        .wh-nav-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 500;
          color: #64748b;
          border-radius: 8px;
          transition: all 0.2s;
          position: relative;
        }
        .wh-nav-item:hover {
          color: #1e293b;
          background: #f1f5f9;
        }
        .wh-nav-item.active {
          color: #1e293b;
        }
        .wh-nav-item::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          width: 0;
          height: 2px;
          background: #2563eb;
          border-radius: 1px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(-50%);
        }
        .wh-nav-item.active::after {
          width: 100%;
        }
        .wh-dropdown {
          opacity: 0;
          visibility: hidden;
          transform: translateY(-8px) scale(0.96);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .wh-dropdown.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }
        .wh-mobile-drawer {
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .wh-mobile-drawer.open {
          transform: translateX(0);
        }
      `}</style>

      <header
        className={clsx(
          "wh-glass wh-border-gradient fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          collapsed ? "h-[48px]" : "h-[64px]"
        )}
      >
        <div className="mx-auto h-full w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Left: Logo + Company Info */}
          <div className="flex items-center gap-3 shrink-0">
            {companyLoading ? (
              <>
                <div className="h-[40px] w-[40px] rounded-lg bg-slate-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <div className={clsx(
                  "relative transition-all duration-300 overflow-hidden",
                  collapsed ? "w-0 opacity-0" : "w-[40px] opacity-100"
                )}>
                  <div className="relative h-[40px] w-[40px]">
                    {company?.logo ? (
                      <Image src={company.logo} alt={company.name} fill className="object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
                        <Building2 className="h-5 w-5 text-blue-400" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col leading-tight">
                  <span className={clsx("font-bold text-slate-800", collapsed ? "text-sm" : "text-base")}>
                    {company?.name || "Workspace"}
                  </span>
                  {!collapsed && (
                    <div className="mt-1">
                      <PlanBadge plan={planLabel} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Center: Breadcrumbs */}
          <nav ref={breadcrumbNavRef} className="hidden md:flex items-center ml-10 flex-1 overflow-hidden min-w-0">
            <div className="h-4 w-[1px] bg-slate-200 mr-4 shrink-0" />

            {!pathname?.includes("/generate") && breadcrumbs.length > 0 && (
              <>
                {/* Visible breadcrumbs — compact or full based on collision check */}
                <div className="flex items-center overflow-hidden min-w-0">
                  {compactBreadcrumbs ? (
                    <CompactBreadcrumbs
                      crumbs={breadcrumbs}
                      expanded={crumbsExpanded}
                      onToggle={(e) => { e.stopPropagation(); setCrumbsExpanded(o => !o); }}
                    />
                  ) : (
                    breadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <ChevronRight className="mx-2 h-3 w-3 text-slate-300 shrink-0" />}
                        {crumb.href ? (
                          <Link
                            href={crumb.href}
                            className="text-[13px] font-medium text-slate-400 hover:text-blue-600 transition-colors whitespace-nowrap"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-semibold text-blue-600 whitespace-nowrap truncate max-w-[200px]">
                            {crumb.label}
                          </span>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>

                {/* Hidden measurer: always renders full-text version so we can
                    compare its natural width against the visible nav width.
                    Position: absolute keeps it out of layout flow. */}
                <div
                  ref={breadcrumbMeasureRef}
                  aria-hidden
                  className="absolute -left-[9999px] top-0 flex items-center whitespace-nowrap pointer-events-none"
                  style={{ visibility: "hidden" }}
                >
                  {breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <ChevronRight className="mx-2 h-3 w-3" />}
                      <span className="text-[13px] font-medium">{crumb.label}</span>
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}
          </nav>

          {/* Right: Nav + Page Actions (injected by page) + User */}
          <div className="flex items-center gap-2">

            <div className="hidden sm:flex items-center gap-1">

              <Link href={`/${slug}/templates`} className={clsx("wh-nav-item", pathname?.includes("/templates") && "active")}>
                <Home className="h-4 w-4" />
                <span className="hidden lg:inline">Templates</span>
              </Link>

              {/* Admin Dashboard — Superadmin only (T-016) */}
              {isSuperAdmin && (
                <Link href={`/${slug}/admin`} className={clsx("wh-nav-item", pathname?.includes("/admin") && "active")}>
                  <Settings className="h-4 w-4" />
                  <span className="hidden lg:inline">Admin Dashboard</span>
                </Link>
              )}
            </div>

            {/* Page-specific action buttons (e.g. panel toggles from configurator) */}
            {headerActions && (
              <>
                <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
                <div className="hidden sm:flex items-center">{headerActions}</div>
              </>
            )}

            <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden sm:block" />

            {/* Powered by KiBiAI */}
            <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 transition-all duration-300 group cursor-default">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">Powered by</span>
              <div className="relative w-20 h-10 group-hover:scale-105 transition-transform duration-300">
                <Image src={kibiaiLogo} alt="KiBiAI Logo" fill className="object-contain" />
              </div>
            </div>

            <div className="h-6 w-[1px] bg-slate-200 mx-1" />

            {/* User */}
            <div className="relative" ref={userDropdownRef}>
              <button 
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-600">{avatarInitial}</span>
                </div>
                <div className="hidden lg:flex flex-col text-left leading-none">
                  <span className="text-[12px] font-semibold text-slate-700">
                    {displayName.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-blue-400/80 font-medium mt-0.5">
                    {userRole}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              <div className={clsx("wh-dropdown absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50", userDropdownOpen && "open")}>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50">
                  <User className="h-4 w-4" /> Profile
                </button>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50">
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <div className="h-[1px] bg-slate-100 my-1" />
                <button 
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </div>

            <button onClick={() => setMobileDrawerOpen(true)} className="md:hidden p-2 text-slate-500">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div 
        className={clsx("fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300", mobileDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none")} 
        onClick={() => setMobileDrawerOpen(false)} 
      />
      <div className={clsx("wh-mobile-drawer fixed top-0 right-0 bottom-0 w-72 bg-white z-[70] md:hidden shadow-2xl flex flex-col", mobileDrawerOpen && "open")}>
        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              {company?.logo ? (
                <Image src={company.logo} alt={company.name} fill className="object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
                  <Building2 className="h-4 w-4 text-blue-400" />
                </div>
              )}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-slate-800">{company?.name || "Workspace"}</span>
              <div className="mt-0.5"><PlanBadge plan={planLabel} /></div>
            </div>
          </div>
          <button onClick={() => setMobileDrawerOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1 flex-1">
          <Link 
            href={`/${slug}/templates`} 
            onClick={() => setMobileDrawerOpen(false)}
            className={clsx("flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium rounded-lg transition-colors", pathname?.includes("/templates") ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50")}
          >
            <Home className="h-4 w-4" /> Templates
          </Link>
          {/* Admin Dashboard — Superadmin only (T-016) */}
          {isSuperAdmin && (
            <Link 
              href={`/${slug}/admin`} 
              onClick={() => setMobileDrawerOpen(false)}
              className={clsx("flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium rounded-lg transition-colors", pathname?.includes("/admin") ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50")}
            >
              <Settings className="h-4 w-4" /> Admin Dashboard
            </Link>
          )}
        </nav>

        <div className="p-4 border-t bg-slate-50/30">
          <div className="flex items-center gap-3 px-2 py-3 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-600">{avatarInitial}</span>
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="text-[14px] font-semibold text-slate-800">{displayName}</span>
              <span className="text-[11px] text-blue-400/80 font-medium mt-1">{userRole}</span>
            </div>
          </div>
          
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-[14px] font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>

          <div className="mt-6 flex items-center justify-center gap-2 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Powered by</span>
            <div className="relative w-20 h-10">
              <Image src={kibiaiLogo} alt="KiBiAI Logo" fill className="object-contain" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
