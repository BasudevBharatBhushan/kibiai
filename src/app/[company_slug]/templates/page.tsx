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
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      <button
        onClick={() => onSwitch("admin")}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
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
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
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
    <div className="flex items-center gap-1.5">
      <div
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          isActive
            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
        )}
      />
      <span
        className={clsx(
          "text-xs font-bold",
          isActive ? "text-emerald-600" : "text-amber-600"
        )}
      >
        {status}
      </span>
    </div>
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

  // Clear header
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

  // Unique modules for filter dropdown
  const modules = useMemo(() => {
    const mods = new Set<string>();
    templates.forEach((t) => {
      if (t.modules?.module_name) mods.add(t.modules.module_name);
    });
    return Array.from(mods).sort();
  }, [templates]);

  // Filter + permission-gate templates by view
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Search + module filter
      const matchesSearch = t.report_template_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesModule =
        selectedModule === "all" || t.modules?.module_name === selectedModule;

      if (!matchesSearch || !matchesModule) return false;

      // Permission gate for user view: only show templates with can_generate_report
      if (activeView === "user" && !isSuperAdmin) {
        const perm = templatePermissions.find(
          (p) => p.report_template_id === t.report_template_id
        );
        return perm?.can_generate_report === true;
      }

      return true;
    });
  }, [templates, searchQuery, selectedModule, activeView, isSuperAdmin, templatePermissions]);

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (companyLoading || acLoading || (isLoading && templates.length === 0)) {
    return (
      <div className="animate-pulse space-y-6 py-8">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-100 rounded-md" />
          <div className="h-10 w-32 bg-slate-100 rounded-md" />
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-xl border border-slate-100" />
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

  // Preview panel is always visible; content updates on selection
  const canCreateTemplate = isSuperAdmin || can("create_template");

  return (
    <>
      <div className="py-8 max-w-[1400px] mx-auto">
        {/* SubHeader with optional View Toggle */}
        <SubHeader
          title="Report Templates"
          subtitle={
            activeView === "admin"
              ? "Configure and manage AI reporting workflows"
              : "Select a template to generate your report"
          }
          rightElement={
            <div className="flex items-center gap-3">
              {/* View Toggle — only for admin/superadmin */}
              {isAdmin && (
                <ViewToggle
                  activeView={activeView}
                  onSwitch={setActiveView}
                />
              )}

              {/* Create button — only in admin view with permission */}
              {activeView === "admin" && canCreateTemplate && (
                <button
                  id="create-template-btn"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold
                             shadow-lg shadow-indigo-200 transition-all duration-300 hover:shadow-xl 
                             hover:shadow-indigo-300 hover:-translate-y-1 active:scale-95 whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg, #636ae8, #818cf8)" }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  New Template
                </button>
              )}
            </div>
          }
        />

        {/* View mode indicator pill */}
        <div className="mb-4">
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full",
              activeView === "admin"
                ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                : "bg-emerald-50 text-emerald-600 border border-emerald-100"
            )}
          >
            {activeView === "admin" ? (
              <><LayoutTemplate size={11} /> Admin View — configure &amp; manage templates</>
            ) : (
              <><Users size={11} /> User View — generate reports</>
            )}
          </span>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 group">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm appearance-none cursor-pointer shadow-sm min-w-[180px]"
              >
                <option value="all">All Modules</option>
                {modules.map((mod) => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          </div>
        </div>

        {/* Split Layout: List (flex-1) + Persistent Preview Panel (fixed 420px) */}
        <div className="flex gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" style={{ minHeight: '520px' }}>

          {/* Template List */}
          <div className="flex-1 overflow-x-auto border-r border-slate-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Template Name
                  </th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                    Module
                  </th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    Last Updated
                  </th>
                  <th className="text-right px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-16">
                    {/* Arrow column */}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <FileText size={24} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No templates found</p>
                        <p className="text-slate-400 text-xs mt-1">
                          {activeView === "user"
                            ? "You don't have access to any templates yet."
                            : "Try adjusting your filters or search query."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((template) => {
                    const isSelected =
                      selectedTemplate?.report_template_id === template.report_template_id;
                    const destination = getTemplateDestination(template, activeView, slug);

                    // Permission check for admin view actions
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
                        onClick={() =>
                          setSelectedTemplate(isSelected ? null : template)
                        }
                        className={clsx(
                          "transition-colors group cursor-pointer",
                          isSelected
                            ? "bg-indigo-50/60 border-l-2 border-l-indigo-500"
                            : "hover:bg-slate-50/50"
                        )}
                      >
                        {/* Name */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className={clsx(
                                "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300",
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                              )}
                            >
                              <FileText size={18} />
                            </div>
                            <div>
                              <div
                                className={clsx(
                                  "text-sm font-bold transition-colors",
                                  isSelected
                                    ? "text-indigo-600"
                                    : "text-slate-900 group-hover:text-indigo-600"
                                )}
                              >
                                {template.report_template_name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-medium">
                                v{template.version_number} · ID: {template.report_template_id.split("-")[0]}...
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Module */}
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold uppercase tracking-tight border border-slate-200">
                            {template.modules?.module_name || "General"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                          <StatusBadge status={template.report_template_status} />
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Calendar size={13} />
                            {new Date(template.updated_on || template.created_on).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Arrow navigation — single icon */}
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <a
                            href={destination}
                            onClick={(e) => e.stopPropagation()}
                            title={
                              activeView === "user"
                                ? "Generate Report"
                                : template.has_setup
                                ? "Open Configurator"
                                : "Complete Setup"
                            }
                            className={clsx(
                              "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                              isSuperAdmin || hasAccess
                                ? "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                : "text-slate-200 cursor-not-allowed pointer-events-none"
                            )}
                            aria-disabled={!(isSuperAdmin || hasAccess)}
                          >
                            <ChevronRight size={18} />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Persistent Preview Panel — always visible */}
          <div className="w-[420px] shrink-0">
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
