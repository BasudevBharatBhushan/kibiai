"use client";

import React, { useState, useEffect } from "react";
import { useCompany } from "@/components/providers/CompanyProvider";
import { Search, Plus, Check, Shield } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { useHeader } from "@/context/HeaderContext";
import { apiClient } from "@/utils/apiClient";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, StaffSkeleton, ModuleSkeleton, PermissionSkeleton } from "@/components/ui/Skeleton";

interface Role {
  role_id: string;
  role_name: string;
  is_super_admin: boolean;
}

interface User {
  user_id: string;
  user_email: string;
  full_name: string;
  designation: string;
  user_status: string;
  roles: Role;
}

interface Module {
  module_id: string;
  module_name: string;
  has_access: boolean;
}

interface Permissions {
  can_generate_report: boolean;
  can_modify_template: boolean;
  can_create_template: boolean;
  can_delete_template: boolean;
  can_generate_charts: boolean;
  can_analyze_charts: boolean;
}

interface Template {
  report_template_id: string;
  report_template_name: string;
  permissions: Permissions;
}

export default function AdminDashboardPage() {
  const { company, roles: availableRoles, isLoading: companyLoading } = useCompany();
  const { setBreadcrumbs, resetHeader } = useHeader();
  const params = useParams();
  const slug = params?.company_slug as string;

  const [staff, setStaff] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [staffSearch, setStaffSearch] = useState("");
  
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  
  const [newStaff, setNewStaff] = useState({ full_name: "", user_email: "", designation: "", role_id: "", password: "" });
  const [newModule, setNewModule] = useState({ module_name: "", module_code: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Set Breadcrumbs
  useEffect(() => {
    setBreadcrumbs([
      { label: company?.name || "Company", href: `/${slug}` },
      { label: "Admin Dashboard" },
    ]);
    return () => resetHeader();
  }, [slug, company?.name, setBreadcrumbs, resetHeader]);

  // Fetch Staff
  const fetchStaff = async () => {
    if (!company?.id) return;
    setLoadingStaff(true);
    try {
      const data = await apiClient.get<{ success: boolean, users: User[] }>('/api/company/staff', {
        params: { search: staffSearch },
        companyId: company.id
      });
      if (data.success) {
        setStaff(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch staff", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchStaff, 300);
    return () => clearTimeout(timeout);
  }, [staffSearch, company?.id]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await apiClient.post<{ success: boolean, error?: string }>('/api/company/staff', newStaff, {
        companyId: company?.id
      });
      if (data.success) {
        setIsStaffModalOpen(false);
        setNewStaff({ full_name: "", user_email: "", designation: "", role_id: "", password: "" });
        fetchStaff();
      }
    } catch (err: any) {
      alert(err.message || "Failed to add staff");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await apiClient.post<{ success: boolean, error?: string }>('/api/company/modules', newModule, {
        companyId: company?.id
      });
      if (data.success) {
        setIsModuleModalOpen(false);
        setNewModule({ module_name: "", module_code: "" });
        if (selectedUserId) {
          fetchModulesForUser();
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to add module");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchModulesForUser = async () => {
    if (!selectedUserId || !company?.id) return;
    setLoadingModules(true);
    try {
      const data = await apiClient.get<{ success: boolean, modules: Module[] }>('/api/company/modules/access', {
        params: { userId: selectedUserId },
        companyId: company.id
      });
      if (data.success) {
        setModules(data.modules || []);
      }
    } catch (err) {
      console.error("Failed to fetch modules", err);
    } finally {
      setLoadingModules(false);
    }
  };

  useEffect(() => {
    fetchModulesForUser();
  }, [selectedUserId, company?.id]);

  const fetchTemplatesForModule = async () => {
    if (!selectedUserId || !selectedModuleId || !company?.id) return;
    setLoadingTemplates(true);
    try {
      const data = await apiClient.get<{ success: boolean, templates: Template[] }>('/api/company/templates/permissions', {
        params: { userId: selectedUserId, moduleId: selectedModuleId },
        companyId: company.id
      });
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTemplatesForModule();
  }, [selectedUserId, selectedModuleId, company?.id]);

  const toggleModuleAccess = async (moduleId: string, hasAccess: boolean) => {
    if (!selectedUserId || !company?.id) return;
    
    // Optimistic update
    setModules(prev => prev.map(m => m.module_id === moduleId ? { ...m, has_access: hasAccess } : m));
    
    try {
      await apiClient.put('/api/company/modules/access', { 
        userId: selectedUserId, 
        moduleId, 
        hasAccess 
      }, { companyId: company.id });
    } catch (err) {
      console.error("Failed to toggle module access", err);
    }
  };

  const updateTemplatePermission = async (templateId: string, updatedPermissions: Permissions) => {
    if (!selectedUserId || !company?.id) return;

    // Optimistic update
    setTemplates(prev => prev.map(t => t.report_template_id === templateId ? { ...t, permissions: updatedPermissions } : t));

    try {
      await apiClient.put('/api/company/templates/permissions', { 
        userId: selectedUserId, 
        templateId, 
        permissions: updatedPermissions 
      }, { companyId: company.id });
    } catch (err) {
      console.error("Failed to update template permission", err);
    }
  };

  const selectedUser = staff.find(u => u.user_id === selectedUserId);
  const selectedModule = modules.find(m => m.module_id === selectedModuleId);
  const selectedTemplate = templates.find(t => t.report_template_id === selectedTemplateId);

  if (companyLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-600 font-medium animate-pulse">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 font-sans">
      {/* Main Content Area */}
      <main className="flex p-6 gap-6 overflow-hidden h-[calc(100vh-64px)]">
        
        {/* Column 1: Staff */}
        <section className="w-1/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-50">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Staff Directory</h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search staff members..." 
                className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3">
            {loadingStaff ? (
              <StaffSkeleton />
            ) : staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="bg-gray-50 rounded-full p-4 mb-3">
                  <Search className="text-gray-300" size={32} />
                </div>
                <p className="text-gray-400 text-sm">No staff members found</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {staff.map((user) => {
                  const rolesArray = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : []);
                  const primaryRole = rolesArray[0] || { role_name: "No Role", is_super_admin: false };
                  const isSuperAdmin = primaryRole.is_super_admin;
                  
                  return (
                    <div 
                      key={user.user_id}
                      onClick={() => {
                        if (!isSuperAdmin) setSelectedUserId(user.user_id);
                      }}
                      className={clsx(
                        "flex items-center gap-3 p-3 rounded-lg transition-all border group",
                        isSuperAdmin ? "cursor-default opacity-70 bg-gray-50/50 border-gray-100" : "cursor-pointer hover:bg-gray-50 hover:border-indigo-100",
                        selectedUserId === user.user_id && !isSuperAdmin
                          ? "border-indigo-400 bg-indigo-50/50 shadow-sm" 
                          : "border-transparent"
                      )}
                    >
                      <div className={clsx(
                        "h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:scale-105",
                        isSuperAdmin ? "bg-gradient-to-br from-indigo-500 to-indigo-600" : "bg-gradient-to-br from-cyan-500 to-cyan-600"
                      )}>
                        <Shield size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate text-sm">{user.full_name || "Unknown"}</div>
                        <div className="text-[11px] text-gray-500 truncate">{user.user_email}</div>
                        <div className="text-[11px] text-indigo-400 font-medium truncate">{user.designation || "User"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={clsx(
                          "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                          isSuperAdmin 
                            ? "text-indigo-600 bg-indigo-50 border-indigo-100" 
                            : "text-gray-600 bg-gray-50 border-gray-200"
                        )}>
                          {primaryRole.role_name}
                        </div>
                        {isSuperAdmin && (
                          <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-tighter mt-1">
                            Super Access
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-50 bg-gray-50/30">
            <button 
              onClick={() => setIsStaffModalOpen(true)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/20 active:scale-[0.98]"
            >
              <Plus size={18} /> Add New Staff
            </button>
          </div>
        </section>

        {/* Column 2: Modules */}
        <section className="w-1/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">
              Module Access
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Configuring <span className="font-semibold text-indigo-500">{selectedUser ? selectedUser.full_name : '...'}</span>
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedUserId ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-40">
                <Shield className="text-gray-300 mb-2" size={24} />
                <p className="text-sm">Select a staff member to manage modules</p>
              </div>
            ) : loadingModules ? (
              <ModuleSkeleton />
            ) : (
              <div className="flex flex-col gap-3">
                {modules.map((module) => (
                  <div 
                    key={module.module_id}
                    onClick={() => setSelectedModuleId(module.module_id)}
                    className={clsx(
                      "flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border group",
                      selectedModuleId === module.module_id 
                        ? "border-indigo-400 bg-indigo-50/30 shadow-sm" 
                        : "border-gray-50 hover:border-indigo-100 hover:bg-gray-50/50"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{module.module_name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Template level control enabled</div>
                    </div>
                    <button 
                      className={clsx(
                        "w-6 h-6 rounded-lg flex items-center justify-center border transition-all",
                        module.has_access ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white border-gray-200 group-hover:border-indigo-300"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModuleAccess(module.module_id, !module.has_access);
                      }}
                    >
                      {module.has_access && <Check size={16} strokeWidth={3} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-50 bg-gray-50/30">
            <button 
              onClick={() => setIsModuleModalOpen(true)}
              className="w-full py-2.5 bg-white border border-gray-200 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-white hover:border-indigo-300 hover:text-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} /> Add Module
            </button>
          </div>
        </section>

        {/* Column 3: Templates */}
        <section className="w-1/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">
              Templates
            </h2>
            <p className="text-xs text-gray-400 mt-1 truncate">
              For <span className="font-semibold text-indigo-500">{selectedModule ? selectedModule.module_name : '...'}</span>
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedModuleId ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-40">
                <Shield className="text-gray-300 mb-2" size={24} />
                <p className="text-sm">Select a module to view templates</p>
              </div>
            ) : loadingTemplates ? (
              <ModuleSkeleton />
            ) : templates.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-10">No templates found</div>
            ) : (
              <div className="flex flex-col gap-3">
                {templates.map((template) => {
                  const perms = Object.values(template.permissions).filter(Boolean).length;
                  const hasAny = perms > 0;
                  
                  return (
                    <div 
                      key={template.report_template_id}
                      onClick={() => setSelectedTemplateId(template.report_template_id)}
                      className={clsx(
                        "flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border group",
                        selectedTemplateId === template.report_template_id 
                          ? "border-indigo-400 bg-indigo-50/30 shadow-sm" 
                          : "border-gray-50 hover:border-indigo-100 hover:bg-gray-50/50"
                      )}
                    >
                      <div className="pr-2">
                        <div className="font-semibold text-gray-800 text-sm line-clamp-2">{template.report_template_name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 font-medium">{perms}/6 Active</div>
                      </div>
                      <button 
                        className={clsx(
                          "w-6 h-6 shrink-0 rounded-lg flex items-center justify-center border transition-all",
                          hasAny ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white border-gray-200 group-hover:border-indigo-300"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newPerms = hasAny 
                            ? { can_generate_report: false, can_modify_template: false, can_create_template: false, can_delete_template: false, can_generate_charts: false, can_analyze_charts: false }
                            : { can_generate_report: true, can_modify_template: true, can_create_template: true, can_delete_template: true, can_generate_charts: true, can_analyze_charts: true };
                          updateTemplatePermission(template.report_template_id, newPerms);
                        }}
                      >
                        {hasAny && <Check size={16} strokeWidth={3} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Column 4: Permissions */}
        <section className="w-1/4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Permissions</h2>
            <div className="text-[11px] text-gray-400 mt-1 font-medium">
              Fine-tuning <span className="text-indigo-500">{selectedTemplate ? selectedTemplate.report_template_name : '...'}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedTemplate ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-40">
                <Shield className="text-gray-300 mb-2" size={24} />
                <p className="text-sm">Select a template to configure individual permissions</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">

                <div className="flex flex-col gap-1 flex-1 space-y-4">

                  {/* ── Admin / Superadmin Level ──────────────────── */}
                  <div>
                    <div className="flex items-center gap-2 px-2 py-2 mb-1">
                      <div className="flex-1 h-px bg-indigo-100" />
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-1">
                        🔐 Admin / Superadmin
                      </span>
                      <div className="flex-1 h-px bg-indigo-100" />
                    </div>
                    {[
                      { key: 'can_modify_template', label: 'Modify Templates (AI)' },
                      { key: 'can_create_template', label: 'Create Templates (AI)' },
                      { key: 'can_delete_template', label: 'Delete Templates' },
                      { key: 'can_analyze_charts', label: 'Analyze Charts (AI)' },
                    ].map((action) => (
                      <div key={action.key} className="flex justify-between items-center py-3 px-3 rounded-xl hover:bg-indigo-50/40 transition-all border border-transparent hover:border-indigo-100">
                        <span className="text-sm font-medium text-gray-700">{action.label}</span>
                        <button
                          className={clsx(
                            "w-10 h-6 rounded-full relative transition-all duration-200",
                            selectedTemplate.permissions[action.key as keyof Permissions] ? "bg-indigo-500" : "bg-gray-200"
                          )}
                          onClick={() => {
                            const newPerms = { ...selectedTemplate.permissions, [action.key]: !selectedTemplate.permissions[action.key as keyof Permissions] };
                            updateTemplatePermission(selectedTemplate.report_template_id, newPerms);
                          }}
                        >
                          <div className={clsx("absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm", selectedTemplate.permissions[action.key as keyof Permissions] ? "left-5" : "left-1")} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* ── User Level ────────────────────────────────── */}
                  <div>
                    <div className="flex items-center gap-2 px-2 py-2 mb-1">
                      <div className="flex-1 h-px bg-emerald-100" />
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap flex items-center gap-1">
                        👤 User Level
                      </span>
                      <div className="flex-1 h-px bg-emerald-100" />
                    </div>
                    {[
                      { key: 'can_generate_report', label: 'Generate Reports' },
                      { key: 'can_generate_charts', label: 'Generate Charts' },
                    ].map((action) => (
                      <div key={action.key} className="flex justify-between items-center py-3 px-3 rounded-xl hover:bg-emerald-50/40 transition-all border border-transparent hover:border-emerald-100">
                        <span className="text-sm font-medium text-gray-700">{action.label}</span>
                        <button
                          className={clsx(
                            "w-10 h-6 rounded-full relative transition-all duration-200",
                            selectedTemplate.permissions[action.key as keyof Permissions] ? "bg-emerald-500" : "bg-gray-200"
                          )}
                          onClick={() => {
                            const newPerms = { ...selectedTemplate.permissions, [action.key]: !selectedTemplate.permissions[action.key as keyof Permissions] };
                            updateTemplatePermission(selectedTemplate.report_template_id, newPerms);
                          }}
                        >
                          <div className={clsx("absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm", selectedTemplate.permissions[action.key as keyof Permissions] ? "left-5" : "left-1")} />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>
                
                {/* Full Access Toggle */}
                <div className="mt-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200 cursor-pointer hover:scale-[1.02] transition-all active:scale-[0.98]"
                  onClick={() => {
                    const isAll = Object.values(selectedTemplate.permissions).every(Boolean);
                    const newPerms = isAll 
                            ? { can_generate_report: false, can_modify_template: false, can_create_template: false, can_delete_template: false, can_generate_charts: false, can_analyze_charts: false }
                            : { can_generate_report: true, can_modify_template: true, can_create_template: true, can_delete_template: true, can_generate_charts: true, can_analyze_charts: true };
                    updateTemplatePermission(selectedTemplate.report_template_id, newPerms);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold">Grant Full Access</div>
                      <div className="text-[10px] text-indigo-100 mt-1 opacity-90">Enable all template capabilities</div>
                    </div>
                    <div className={clsx(
                      "w-6 h-6 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30",
                      Object.values(selectedTemplate.permissions).every(Boolean) && "bg-white text-indigo-600"
                    )}>
                      {Object.values(selectedTemplate.permissions).every(Boolean) && <Check size={16} strokeWidth={4} />}
                    </div>
                  </div>
                </div>
                
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Add Staff Modal */}
      <Modal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} title="Add New Staff Member">
        <form onSubmit={handleAddStaff} className="flex flex-col gap-5 p-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
              <input 
                required
                type="text" 
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={newStaff.full_name}
                onChange={e => setNewStaff({...newStaff, full_name: e.target.value})}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input 
                required
                type="email" 
                placeholder="john@example.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={newStaff.user_email}
                onChange={e => setNewStaff({...newStaff, user_email: e.target.value})}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Default Password (Optional)</label>
              <input 
                type="text" 
                placeholder="SecurePassword123"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={newStaff.password}
                onChange={e => setNewStaff({...newStaff, password: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Designation</label>
              <input 
                type="text" 
                placeholder="Manager"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={newStaff.designation}
                onChange={e => setNewStaff({...newStaff, designation: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">System Role</label>
              <select 
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                value={newStaff.role_id}
                onChange={e => setNewStaff({...newStaff, role_id: e.target.value})}
              >
                <option value="" disabled>Select Role</option>
                {availableRoles.map(role => (
                  <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                ))}
              </select>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all mt-2 shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-[0.98]"
          >
            {isSubmitting ? "Processing..." : "Create Staff Member"}
          </button>
        </form>
      </Modal>

      {/* Add Module Modal */}
      <Modal isOpen={isModuleModalOpen} onClose={() => setIsModuleModalOpen(false)} title="Register New Module">
        <form onSubmit={handleAddModule} className="flex flex-col gap-5 p-2">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Module Name</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Inventory Management"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={newModule.module_name}
              onChange={e => setNewModule({...newModule, module_name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Module Code</label>
            <input 
              required
              type="text" 
              placeholder="e.g. INV_MOD"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={newModule.module_code}
              onChange={e => setNewModule({...newModule, module_code: e.target.value})}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all mt-2 shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-[0.98]"
          >
            {isSubmitting ? "Registering..." : "Add Module to Company"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
