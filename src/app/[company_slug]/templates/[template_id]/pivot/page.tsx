"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Table2 } from "lucide-react";

import { DynamicPivotTable } from "@/components/pivot/DynamicPivotTable";
import { useHeader } from "@/context/HeaderContext";
import { useToast } from "@/context/ToastContext";
import type { PivotMetadata } from "@/lib/pivot/pivotConfigGenerator";
import { apiClient } from "@/utils/apiClient";

type PivotBuilderResponse = {
  template_id: string;
  template_name: string;
  rows: Array<Record<string, unknown>>;
  fieldNames: string[];
  pivot_metadata: PivotMetadata;
};

function LoadingSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg animate-pulse">
          <Table2 className="h-6 w-6" />
        </div>
        <div className="space-y-2 text-center">
          <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function PivotPageContent() {
  const params = useParams();
  const { setBackHref, setBreadcrumbs } = useHeader();
  const { addToast } = useToast();

  const slug = params?.company_slug as string;
  const templateId = params?.template_id as string;

  const [pageData, setPageData] = useState<PivotBuilderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!templateId || !slug) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: PivotBuilderResponse }>(
          `/api/report-templates/${templateId}/pivot`
        );

        if (!res.success || !res.data) {
          throw new Error("Failed to load pivot builder");
        }

        setPageData(res.data);
        if (res.data.rows.length === 0) {
          addToast(
            "warning",
            "No Preview Data",
            "The template has no preview dataset yet. Update the configurator first."
          );
        }
      } catch (error: unknown) {
        addToast(
          "error",
          "Load Error",
          error instanceof Error ? error.message : "Failed to load pivot builder."
        );
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [addToast, slug, templateId]);

  useEffect(() => {
    if (!slug || !templateId) return;
    setBreadcrumbs([
      { label: "Report Templates", href: `/${slug}/templates` },
      { label: "Setup", href: `/${slug}/templates/${templateId}/setup` },
      { label: "Report Builder", href: `/${slug}/templates/${templateId}/configurator` },
      { label: "Pivot Builder" },
    ]);
    setBackHref(`/${slug}/templates/${templateId}/configurator`);
  }, [slug, templateId, setBreadcrumbs, setBackHref]);

  const saveMetadata = async (metadata: PivotMetadata) => {
    const res = await apiClient.patch<{ success: boolean; data: { pivot_metadata: PivotMetadata } }>(
      `/api/report-templates/${templateId}/pivot`,
      { metadata }
    );

    if (!res.success) {
      throw new Error("Failed to save pivot metadata");
    }

    setPageData((prev) =>
      prev
        ? {
            ...prev,
            pivot_metadata: res.data.pivot_metadata,
          }
        : prev
    );
    addToast("success", "Pivot Saved", "Pivot metadata saved to the report template.");
  };

  if (isLoading || !pageData) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 h-[calc(100vh-64px)] overflow-hidden bg-slate-50 p-4">
      <DynamicPivotTable
        data={pageData.rows}
        initialMetadata={pageData.pivot_metadata}
        onSave={saveMetadata}
      />
    </div>
  );
}

export default function PivotBuilderPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <PivotPageContent />
    </Suspense>
  );
}
