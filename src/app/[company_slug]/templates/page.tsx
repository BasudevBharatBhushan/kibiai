"use client";

import { useCompany } from "@/components/providers/CompanyProvider";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { CreateTemplateModal } from "@/components/templates/CreateTemplateModal";
import { TemplatePreviewPanel } from "@/components/templates/TemplatePreviewPanel";
import { SetupLibraryModal } from "@/components/setup/SetupLibraryModal";
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
  FolderOpen,
  Pencil,
  Trash2,
  Check,
  X,
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

function EditableStatusBadge({ 
  status, 
  onChange, 
  disabled 
}: { 
  status: string; 
  onChange?: (newStatus: string) => void;
  disabled?: boolean;
}) {
  const isActive = status === "Active";
  const colorClasses = isActive
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "Archived"
    ? "bg-slate-50 text-slate-700 ring-slate-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";

  const dotClasses = isActive
    ? "bg-emerald-500"
    : status === "Archived"
    ? "bg-slate-500"
    : "bg-amber-500";

  if (!onChange || disabled) {
    return (
      <span className={clsx("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded ring-1", colorClasses)}>
        <span className={clsx("w-1.5 h-1.5 rounded-full", dotClasses)} />
        {status}
      </span>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <span className={clsx("absolute left-2 w-1.5 h-1.5 rounded-full pointer-events-none z-10", dotClasses)} />
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(
          "appearance-none pl-5 pr-5 py-0.5 text-[11px] font-semibold rounded ring-1 outline-none cursor-pointer hover:ring-2 transition-all",
          colorClasses
        )}
      >
        <option value="Draft">Draft</option>
        <option value="Active">Active</option>
        <option value="Archived">Archived</option>
      </select>
      <ChevronRight size={10} className="absolute right-1.5 pointer-events-none opacity-50 rotate-90" />
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
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active_draft");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Rename and Delete states
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const handleStartRename = (template: any) => {
    setEditingTemplateId(template.report_template_id);
    setEditingName(template.report_template_name);
  };

  const handleCancelRename = () => {
    setEditingTemplateId(null);
    setEditingName("");
  };

  const handleSaveRename = async (templateId: string) => {
    if (!editingName.trim()) return;
    try {
      setIsSaving(true);
      const res = await apiClient.patch<{ success: boolean; error?: string }>(
        `/api/company/templates/${templateId}`,
        { report_template_name: editingName }
      );
      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.report_template_id === templateId
              ? { ...t, report_template_name: editingName.trim() }
              : t
          )
        );
        if (selectedTemplate?.report_template_id === templateId) {
          setSelectedTemplate((prev: any) =>
            prev ? { ...prev, report_template_name: editingName.trim() } : null
          );
        }
        setEditingTemplateId(null);
        setEditingName("");
      } else {
        alert(res.error || "Failed to rename template.");
      }
    } catch (err: any) {
      console.error("Failed to rename template", err);
      alert(err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStatus = async (templateId: string, newStatus: string) => {
    try {
      setIsSaving(true);
      const res = await apiClient.patch<{ success: boolean; error?: string }>(
        `/api/company/templates/${templateId}`,
        { report_template_status: newStatus }
      );
      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.report_template_id === templateId
              ? { ...t, report_template_status: newStatus }
              : t
          )
        );
        if (selectedTemplate?.report_template_id === templateId) {
          setSelectedTemplate((prev: any) =>
            prev ? { ...prev, report_template_status: newStatus } : null
          );
        }
      } else {
        alert(res.error || "Failed to update status.");
      }
    } catch (err: any) {
      console.error("Failed to update status", err);
      alert(err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, name: string) => {
    const confirmed = confirm(
      `Are you sure you want to permanently delete "${name}"?\n\nThis will cascade delete all reports, chart templates, and charts generated from this template. This action CANNOT be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingTemplateId(templateId);
      const res = await apiClient.delete<{ success: boolean; error?: string }>(
        `/api/company/templates/${templateId}`
      );
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t.report_template_id !== templateId));
        if (selectedTemplate?.report_template_id === templateId) {
          setSelectedTemplate(null);
        }
      } else {
        alert(res.error || "Failed to delete template.");
      }
    } catch (err: any) {
      console.error("Failed to delete template", err);
      alert(err.message || "An error occurred.");
    } finally {
      setDeletingTemplateId(null);
    }
  };

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
      const matchesStatus =
        selectedStatus === "all" ? true
        : selectedStatus === "active_draft" ? (t.report_template_status === "Active" || t.report_template_status === "Draft")
        : t.report_template_status === selectedStatus;
      if (!matchesSearch || !matchesModule || !matchesStatus) return false;
      if (activeView === "user" && !isSuperAdmin) {
        const perm = templatePermissions.find(
          (p) => p.report_template_id === t.report_template_id
        );
        return perm?.can_generate_report === true;
      }
      return true;
    });
  }, [templates, searchQuery, selectedModule, selectedStatus, activeView, isSuperAdmin, templatePermissions]);

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
              {activeView === "admin" && (
                <button
                  onClick={() => setShowLibraryModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-bold
                             shadow-sm transition-all duration-200
                             hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                >
                  <FolderOpen size={16} />
                  Setups Library
                </button>
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
          <div className="relative flex-shrink-0">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all text-sm appearance-none cursor-pointer shadow-sm min-w-[140px]"
            >
              <option value="active_draft">Active & Draft</option>
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
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
                              {editingTemplateId === template.report_template_id ? (
                                <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="w-full text-sm font-semibold px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-150 text-slate-800 bg-slate-50"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveRename(template.report_template_id);
                                      else if (e.key === "Escape") handleCancelRename();
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveRename(template.report_template_id)}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 hover:text-emerald-700 hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50"
                                    title="Save"
                                  >
                                    <Check size={14} className="stroke-[2.5]" />
                                  </button>
                                  <button
                                    onClick={handleCancelRename}
                                    disabled={isSaving}
                                    className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 hover:text-rose-700 hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50"
                                    title="Cancel"
                                  >
                                    <X size={14} className="stroke-[2.5]" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between flex-1 min-w-0">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className={clsx(
                                        "text-sm font-semibold truncate leading-tight transition-colors duration-150",
                                        isSelected ? "text-indigo-700" : "text-slate-800 group-hover:text-indigo-700"
                                      )}>
                                        {template.report_template_name}
                                      </div>
                                      {deletingTemplateId === template.report_template_id && (
                                        <span className="text-[10px] text-rose-500 font-medium animate-pulse shrink-0">deleting...</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      v{template.version_number} · {template.report_template_id.split("-")[0]}
                                    </div>
                                  </div>

                                  {/* Inline Edit/Delete Actions for Authorized Admins */}
                                  {activeView === "admin" && deletingTemplateId !== template.report_template_id && (
                                    <div 
                                      className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2 shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {can("modify_template", template.report_template_id) && (
                                        <button
                                          onClick={() => handleStartRename(template)}
                                          className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 hover:scale-110 active:scale-95 transition-all duration-150"
                                          title="Rename Template"
                                        >
                                          <Pencil size={13} className="stroke-[2.2]" />
                                        </button>
                                      )}
                                      {can("delete_template", template.report_template_id) && (
                                        <button
                                          onClick={() => handleDeleteTemplate(template.report_template_id, template.report_template_name)}
                                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 hover:scale-110 active:scale-95 transition-all duration-150"
                                          title="Delete Template"
                                        >
                                          <Trash2 size={13} className="stroke-[2.2]" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
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
                          <td className="px-4 py-3.5 hidden md:table-cell w-24" onClick={(e) => e.stopPropagation()}>
                            <EditableStatusBadge
                              status={template.report_template_status}
                              disabled={!(activeView === "admin" && (can("modify_template", template.report_template_id) || isSuperAdmin))}
                              onChange={(val) => handleSaveStatus(template.report_template_id, val)}
                            />
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

      {/* Setups Library Modal */}
      {showLibraryModal && company && (
        <SetupLibraryModal
          companyId={company.id}
          onClose={() => setShowLibraryModal(false)}
        />
      )}
    </>
  );
}
