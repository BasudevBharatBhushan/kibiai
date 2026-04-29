"use client";

import { useCompany } from "@/components/providers/CompanyProvider";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { CreateTemplateModal } from "@/components/templates/CreateTemplateModal";
import { TemplatePreviewPanel } from "@/components/templates/TemplatePreviewPanel";
import {
  Plus,
  FileText,
  Calendar,
  Filter,
  Search,
  ChevronRight,
  LayoutTemplate,
  Users,
  Zap,
  ArrowRight,
  Settings,
} from "lucide-react";
import { useHeader } from "@/context/HeaderContext";
import { useAccessControl } from "@/context/AccessControlContext";
import { SubHeader } from "@/components/layout/SubHeader";
import { apiClient } from "@/utils/apiClient";
import clsx from "clsx";

// ── Navigation destination resolver ───────────────────────────────────────────

function getTemplateDestination(
  template: any,
  activeView: "admin" | "user",
  slug: string
): string {
  const id = template.report_template_id;
  if (activeView === "user") return `/${slug}/templates/${id}/generate`;
  if (!template.has_setup) return `/${slug}/templates/${id}/setup`;
  return `/${slug}/templates/${id}/configurator`;
}

// ── View Toggle ───────────────────────────────────────────────────────────────

function ViewToggle({
  activeView,
  onSwitch,
}: {
  activeView: "admin" | "user";
  onSwitch: (v: "admin" | "user") => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      <button
        onClick={() => onSwitch("admin")}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200",
          activeView === "admin"
            ? "bg-white text-indigo-600 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        <LayoutTemplate size={13} />
        Admin View
      </button>
      <button
        onClick={() => onSwitch("user")}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200",
          activeView === "user"
            ? "bg-white text-emerald-600 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        <Users size={13} />
        User View
      </button>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "Active";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded",
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      )}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          isActive ? "bg-emerald-500" : "bg-amber-500"
        )}
      />
      {status}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { company, isLoading: companyLoading, error } = useCompany();
  const { setBreadcrumbs, setBackHref } = useHeader();
  const {
    isSuperAdmin,
    isAdmin,
    isLoading: acLoading,
    activeView,
    setActiveView,
    can,
    templatePermissions,
  } = useAccessControl();
  const params = useParams();
  const slug = params?.company_slug as string;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  useEffect(() => {
    setBreadcrumbs([]);
    setBackHref(null);
  }, [setBreadcrumbs, setBackHref]);

  useEffect(() => {
    if (company?.id) fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const fetchTemplates = async () => {
    if (!company?.id) return;
    try {
      setIsLoading(true);
      const data = await apiClient.get<{ success: boolean; templates: any[] }>(
        `/api/company/templates?company_id=${company.id}`
      );
      if (data.success) setTemplates(data.templates);
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setIsLoading(false);
    }
  };

  const modules = useMemo(() => {
    const mods = new Set<string>();
    templates.forEach((t) => {
      if (t.modules?.module_name) mods.add(t.modules.module_name);
    });
    return Array.from(mods).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = t.report_template_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesModule =
        selectedModule === "all" || t.modules?.module_name === selectedModule;
      if (!matchesSearch || !matchesModule) return false;
      if (activeView === "user" && !isSuperAdmin) {
        const perm = templatePermissions.find(
          (p) => p.report_template_id === t.report_template_id
        );
        return perm?.can_generate_report === true;
      }
      return true;
    });
  }, [templates, searchQuery, selectedModule, activeView, isSuperAdmin, templatePermissions]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (companyLoading || acLoading || (isLoading && templates.length === 0)) {
    return (
      <div className="animate-pulse space-y-6 py-8">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-100 rounded" />
          <div className="h-10 w-32 bg-slate-100 rounded" />
        </div>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="text-xl font-semibold text-red-500 mb-2">Workspace Error</h2>
        <p className="text-slate-500">{error || "Company not found"}</p>
      </div>
    );
  }

  const canCreateTemplate = isSuperAdmin || can("create_template");

  return (
    <>
      <div className="py-6 max-w-[1500px] mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <SubHeader
          title="Report Templates"
          subtitle={
            activeView === "admin"
              ? "Admin View — configure & manage templates"
              : "User View — select a template to generate your report"
          }
          rightElement={
            <div className="flex items-center gap-3">
              {isAdmin && (
                <ViewToggle activeView={activeView} onSwitch={setActiveView} />
              )}
              {activeView === "admin" && canCreateTemplate && (
                <button
                  id="create-template-btn"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-bold
                             shadow-md shadow-indigo-200/60 transition-all duration-200
                             hover:shadow-lg hover:shadow-indigo-300/60 hover:-translate-y-0.5 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #636ae8, #818cf8)" }}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  New Template
                </button>
              )}
            </div>
          }
        />

        {/* ── Search + Filter bar ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5 mt-1">
          <div className="relative flex-1 group">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all text-sm shadow-sm"
            />
          </div>
          <div className="relative flex-shrink-0">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all text-sm appearance-none cursor-pointer shadow-sm min-w-[160px]"
            >
              <option value="all">All Modules</option>
              {modules.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
            <ChevronRight size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
          </div>
        </div>

        {/* ── Split Layout ─────────────────────────────────────────────────── */}
        {/*  Two independent panels with a proper gap, each with own border    */}
        <div className="flex gap-4" style={{ height: "700px" }}>

          {/* ── Left panel: template list ──────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-w-0">

            {/* Sticky column header */}
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/80">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest w-12">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Template</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest hidden sm:table-cell w-32">Module</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest hidden md:table-cell w-24">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest hidden lg:table-cell w-32">Updated</th>
                    <th className="w-28" />
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable rows */}
            <div className="flex-1 overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
                    <FileText size={22} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-semibold text-sm">No templates found</p>
                  <p className="text-slate-400 text-xs mt-1.5 max-w-[220px]">
                    {activeView === "user"
                      ? "You don't have access to any templates yet."
                      : "Try adjusting your search or filters."}
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse table-fixed">
                  <tbody>
                    {filteredTemplates.map((template, index) => {
                      const isSelected =
                        selectedTemplate?.report_template_id === template.report_template_id;
                      const destination = getTemplateDestination(template, activeView, slug);
                      const userPerm = templatePermissions.find(
                        (p) => p.report_template_id === template.report_template_id
                      );
                      const hasAccess =
                        isSuperAdmin ||
                        (activeView === "admin"
                          ? userPerm?.can_modify_template || userPerm?.can_create_template
                          : userPerm?.can_generate_report);

                      return (
                        <tr
                          key={template.report_template_id}
                          onClick={() => setSelectedTemplate(isSelected ? null : template)}
                          className={clsx(
                            "group cursor-pointer border-b border-slate-50 transition-all duration-150",
                            isSelected
                              ? "bg-indigo-50/70"
                              : "hover:bg-slate-50"
                          )}
                          style={isSelected ? { boxShadow: "inset 3px 0 0 #6366f1" } : {}}
                        >
                          {/* # */}
                          <td className="px-4 py-3.5 w-12">
                            <span className={clsx(
                              "inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold tabular-nums",
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                            )}>
                              {index + 1}
                            </span>
                          </td>

                          {/* Template name + meta */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={clsx(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-indigo-50 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white"
                              )}>
                                <FileText size={15} />
                              </div>
                              <div className="min-w-0">
                                <div className={clsx(
                                  "text-sm font-semibold truncate leading-tight",
                                  isSelected ? "text-indigo-700" : "text-slate-800 group-hover:text-indigo-700"
                                )}>
                                  {template.report_template_name}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  v{template.version_number} · {template.report_template_id.split("-")[0]}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Module */}
                          <td className="px-4 py-3.5 hidden sm:table-cell w-32">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold uppercase tracking-wide">
                              <Zap size={9} className="text-slate-400" />
                              {template.modules?.module_name || "General"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 hidden md:table-cell w-24">
                            <StatusBadge status={template.report_template_status} />
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3.5 hidden lg:table-cell w-32">
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Calendar size={11} />
                              {new Date(template.updated_on || template.created_on).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Navigate — pill CTA */}
                          <td className="px-2 py-3.5 text-right w-28 overflow-hidden">
                            {isSuperAdmin || hasAccess ? (
                              <a
                                href={destination}
                                onClick={(e) => e.stopPropagation()}
                                className={clsx(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors duration-200 whitespace-nowrap select-none shadow-sm",
                                  activeView === "user"
                                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                    : template.has_setup
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                    : "bg-amber-500 text-white hover:bg-amber-600"
                                )}
                                title={
                                  activeView === "user"
                                    ? "Generate Report"
                                    : template.has_setup
                                    ? "Open Configurator"
                                    : "Complete Setup"
                                }
                              >
                                {activeView === "user" ? (
                                  <><Zap size={10} />Generate</>
                                ) : template.has_setup ? (
                                  <><Settings size={10} />Open</>
                                ) : (
                                  <><ArrowRight size={10} />Setup</>
                                )}
                                <ArrowRight size={10} className="opacity-70" />
                              </a>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-300 cursor-not-allowed select-none">
                                No access
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer: row count */}
            <div className="shrink-0 border-t border-slate-100 px-4 py-2 bg-slate-50/60">
              <p className="text-[11px] text-slate-400">
                {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>
          </div>

          {/* ── Right panel: report preview ────────────────────────────────── */}
          <div className="w-[540px] shrink-0 h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <TemplatePreviewPanel template={selectedTemplate} />
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      {showCreateModal && company && (
        <CreateTemplateModal
          companyId={company.id}
          companySlug={slug}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchTemplates}
        />
      )}
    </>
  );
}
