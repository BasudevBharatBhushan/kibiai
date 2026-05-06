"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { useHeader } from "@/context/HeaderContext";
import { SubHeader } from "@/components/layout/SubHeader";
import Link from "next/link";

interface TemplateInfo {
  report_template_id: string;
  report_template_name: string;
  report_template_status: string;
  modules: { module_name: string; module_code: string } | null;
}

export default function TemplateSetupPage() {
  const { setBreadcrumbs, setBackHref } = useHeader();
  const params = useParams();
  const router = useRouter();
  const slug = params?.company_slug as string;
  const templateId = params?.template_id as string;

  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/company/templates/${templateId}/setup`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Template not found");
        
        setTemplate(data.template);
        
        // Update header
        setBreadcrumbs([
          { label: "Report Templates", href: `/${slug}/templates` },
          { label: "Setup" },
          { label: "Report Builder", href: `/${slug}/templates/${templateId}/configurator` },
          { label: "Chart Builder", href: `/${slug}/templates/${templateId}/charts` },
        ]);
        setBackHref(`/${slug}/templates`);
      } catch (err: any) {
        setError(err.message || "Failed to load template");
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [templateId, slug, setBreadcrumbs, setBackHref]);

  if (loading) {
    return (
      <div className="sp-page pt-8">
        <div className="sp-header animate-pulse border-none">
          <div className="h-9 w-64 bg-slate-100 rounded-xl"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 animate-pulse">
          <div className="md:col-span-1 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl border border-slate-100/50"></div>
            ))}
          </div>
          <div className="md:col-span-3 h-[600px] bg-slate-50 rounded-3xl border border-slate-100/50"></div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="sp-error pt-20">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Template</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">{error || "The requested template could not be found or loaded."}</p>
        <Link href={`/${slug}/templates`} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
          Back to Templates
        </Link>
      </div>
    );
  }

  return (
    <div className="sp-page pt-8">
      <SubHeader 
        title={template.report_template_name}
        subtitle="Configure data connectivity, table mappings, and AI report structure for this template"
        backHref={`/${slug}/templates`}
        rightElement={
          <div className="flex items-center gap-3">
            <div id="setup-wizard-save-container"></div>
            <div id="setup-wizard-continue-container"></div>
            {template.modules && (
              <div className="sp-module-badge">
                {template.modules.module_name}
              </div>
            )}
            <div className={`sp-status-badge sp-status-${template.report_template_status.toLowerCase()}`}>
              {template.report_template_status}
            </div>
          </div>
        }
      />

      {/* ── Setup Wizard ── */}
      <SetupWizard
        templateId={templateId}
        companySlug={slug}
      />

      <style jsx>{`
        .sp-page {
          max-width: 1440px;
          margin: 0 auto;
          padding-left: 20px;
          padding-right: 20px;
        }

        .sp-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 60vh;
          font-size: 15px;
          color: #64748b;
        }

        .sp-spin {
          animation: sp-spin 0.8s linear infinite;
          color: #636ae8;
        }

        @keyframes sp-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .sp-error {
          text-align: center;
          padding: 40px;
        }


        .sp-module-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 6px 14px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid #e2e8f0;
        }

        .sp-status-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 6px 14px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sp-status-draft {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .sp-status-active {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }
      `}</style>
    </div>
  );
}
