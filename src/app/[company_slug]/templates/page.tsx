"use client";

import { useCompany } from "@/components/providers/CompanyProvider";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { CreateTemplateModal } from "@/components/templates/CreateTemplateModal";
import { Plus, FileText, Settings, Calendar, Database, ArrowRight, Filter, Search, MoreVertical, LayoutGrid } from "lucide-react";
import { useHeader } from "@/context/HeaderContext";
import { SubHeader } from "@/components/layout/SubHeader";
import Link from "next/link";

export default function TemplatesPage() {
  const { company, isLoading: companyLoading, error } = useCompany();
  const { setBreadcrumbs, setBackHref } = useHeader();
  const params = useParams();
  const slug = params?.company_slug as string;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");

  // Clear header breadcrumbs as requested
  useEffect(() => {
    setBreadcrumbs([]);
    setBackHref(null);
  }, [setBreadcrumbs, setBackHref]);

  useEffect(() => {
    if (company?.id) {
      fetchTemplates();
    }
  }, [company?.id]);

  const fetchTemplates = async () => {
    if (!company?.id) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/company/templates?company_id=${company.id}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique modules for filtering
  const modules = useMemo(() => {
    const mods = new Set<string>();
    templates.forEach(t => {
      if (t.modules?.module_name) mods.add(t.modules.module_name);
    });
    return Array.from(mods).sort();
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = t.report_template_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule = selectedModule === "all" || t.modules?.module_name === selectedModule;
      return matchesSearch && matchesModule;
    });
  }, [templates, searchQuery, selectedModule]);

  if (companyLoading || (isLoading && templates.length === 0)) {
    return (
      <div className="animate-pulse space-y-6 py-8">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-100 rounded-md"></div>
          <div className="h-10 w-32 bg-slate-100 rounded-md"></div>
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-xl border border-slate-100"></div>
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

  return (
    <>
      <div className="py-8 max-w-[1400px] mx-auto">
        <SubHeader 
          title="Report Templates"
          subtitle="Manage and configure your AI reporting workflows"
          rightElement={
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
          }
        />

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
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
                {modules.map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ArrowRight size={14} className="rotate-90" />
              </div>
            </div>
          </div>
        </div>

        {/* List View */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Template Name</th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Version</th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Last Updated</th>
                  <th className="text-right px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <FileText size={24} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No templates found</p>
                        <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or search query</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((template) => (
                    <tr key={template.report_template_id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <FileText size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {template.report_template_name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium">ID: {template.report_template_id.split('-')[0]}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold uppercase tracking-tight border border-slate-200">
                          {template.modules?.module_name || "General"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${template.report_template_status === 'Active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                          <span className={`text-xs font-bold ${template.report_template_status === 'Active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {template.report_template_status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block">
                          v{template.version_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Calendar size={13} />
                          {new Date(template.created_on).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            href={`/${slug}/templates/${template.report_template_id}/setup`}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Setup"
                          >
                            <Settings size={18} />
                          </Link>
                          <button 
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Options"
                          >
                            <MoreVertical size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
