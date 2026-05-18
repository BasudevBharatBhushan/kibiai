"use client";

import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import "@/styles/dynamicreport.css";
import { 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Printer, 
  FileSpreadsheet,
  Maximize,
  Minimize,
  X
} from "lucide-react";
import DOMPurify from "dompurify";
import type { ReportMetadata } from "@/lib/utils/reportMetadata";
import { formatDisplayDate } from "@/lib/utils/reportMetadata";

interface DynamicReportProps {
  jsonData: any[];
  previewMode?: boolean;
  /** Date range + filter sentences rendered as a subheader under the main heading */
  metadata?: ReportMetadata;
}

// --- CONFIGURATION ---
const A4_HEIGHT_PX = 1123; 
const CONTENT_HEIGHT = A4_HEIGHT_PX - 80; 

// --- SUB-COMPONENT: EXPANDED IFRAME VIEW ---
const ExpandedReportView = ({ htmlContent, onClose }: { htmlContent: string, onClose: () => void }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const doc = iframeRef.current?.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Expanded Report</title>
            <style>
              /* 1. Global Reset */
              html, body { 
                margin: 0; 
                padding: 0; 
                width: 100%;
                height: 100%;
                background: #525659; 
                font-family: Arial, sans-serif; 
                color: #000;
              }
              
              /* 2. Wrapper creates the scrollable area */
              .report-wrapper {
                width: 100%;
                min-height: 100vh;
                box-sizing: border-box;
                padding: 20px;
                display: flex;
                justify-content: center;
              }
              
              /* 3. Paper container - Forces 100% width per request */
              .report-paper {
                background: white;
                width: 100%;       
                max-width: 100%;   
                min-height: 100vh; 
                padding: 20px;
                box-shadow: 0 0 15px rgba(0,0,0,0.3);
                box-sizing: border-box;
              }

              /* 4. OVERRIDE: Force the inner dynamic-report to fill the paper */
              .dynamic-report {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                min-height: auto !important;
                box-shadow: none !important;
                font-size: 9pt;
                line-height: 1.2;
              }

              /* --- STYLES MATCHING dynamicreport.css --- */
              
              /* Header */
              .title-header { text-align: right; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 20px; display: flex; justify-content: flex-end; align-items: center; }
              .title-header h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0; color: #000; letter-spacing: 0.05em; }
              .title-header h2 { font-size: 10pt; font-weight: normal; margin: 0; color: #000; }
              .current-date { text-align: right; font-size: 9pt; color: #000; margin-bottom: 10px; }

              .report-scope { margin-top: 6px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 7.5pt; color: #94a3b8; font-weight: normal; text-transform: none; }
              .report-scope .scope-line { line-height: 1.3; }
              .report-scope .scope-label { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 7pt; color: #94a3b8; margin-right: 4px; }
              .report-scope .scope-field { color: #cbd5e1; margin-left: 4px; }

              /* Subsummaries */
              .subsummary { margin-bottom: 16px; }
              .subsummary.level-0 { margin-left: 0; }
              .subsummary.level-1 { margin-left: 20px; margin-top: 10px; }
              .subsummary.level-2 { margin-left: 40px; margin-top: 8px; }

              .subsummary-header { font-weight: bold; color: #000; padding: 4px 0; margin-bottom: 4px; display: flex; align-items: baseline; gap: 8px; }
              .subsummary.level-0 .subsummary-header { font-size: 11pt; border-bottom: 3px solid #333; text-transform: uppercase; }
              .subsummary.level-1 .subsummary-header { font-size: 10pt; border-bottom: 2px solid #666; }
              .subsummary.level-2 .subsummary-header { font-size: 9pt; border-bottom: 1px solid #999; }

              .subsummary-display { font-size: 9pt; color: #000; padding: 4px 0; display: flex; flex-wrap: wrap; gap: 15px; }
              .display-item { display: inline-flex; gap: 4px; }
              .display-label { font-weight: bold; }
              .subsummary-content { padding: 0; }

              /* Tables */
              table.body-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
              th { text-align: left; font-weight: bold; color: #000; border-bottom: 1px solid #000; padding: 6px 4px; text-transform: uppercase; font-size: 9pt; background: transparent; }
              td { padding: 4px; color: #000; vertical-align: top; border: none; }
              tr:nth-child(even) { background-color: transparent; }

              /* Totals */
              .section-totals { margin-top: 10px; padding: 8px 0; }
              .totals-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #000; border-bottom: 1px solid #666; padding-bottom: 2px; margin-bottom: 6px; display: inline-block; width: 100%; }
              .totals-grid { display: block; }
              .total-item { display: flex; justify-content: space-between; padding: 2px 0; }
              .total-label { font-size: 9pt; font-weight: bold; color: #000; }
              .total-value { font-size: 9pt; font-weight: normal; color: #000; }

              /* Grand Summary */
              .trailing-summary { margin-top: 20px; padding-top: 10px; border-top: none; }
              .trailing-summary h3 { font-size: 12pt; font-weight: bold; text-transform: uppercase; text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; color: #000; }
              .trailing-summary table { width: 100%; border-collapse: collapse; }
              .trailing-summary td { padding: 6px 0; font-size: 9pt; color: #000; }
              .trailing-summary td:first-child { font-weight: bold; text-transform: uppercase; width: 40%; }
              .trailing-summary td:last-child { text-align: right; }
            </style>
          </head>
          <body>
            <div class="report-wrapper">
              <div class="report-paper">
                <div class="dynamic-report">
                  ${htmlContent}
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      doc.close();
    }
  }, [htmlContent]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex flex-col">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-md shrink-0">
        <h2 className="font-bold text-gray-700 flex items-center gap-2">
          <Maximize size={18} className="text-indigo-600" />
          Expanded Report View
        </h2>
        <button 
          onClick={onClose}
          className="bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Minimize size={16} /> Collapse / Close
        </button>
      </div>
      
      {/* Iframe Container */}
      <div className="flex-1 bg-gray-500 overflow-hidden relative">
        <iframe 
          ref={iframeRef}
          className="w-full h-full border-none block"
          title="Expanded Report"
        />
      </div>
    </div>
  );
};


// --- MAIN COMPONENT ---
const DynamicReport: React.FC<DynamicReportProps> = ({ jsonData, previewMode = false, metadata }) => {
  const [reportHtml, setReportHtml] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  
  // UI State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Modal State
  const [showExpandedModal, setShowExpandedModal] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Portal Target State
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Attempt to mount to the header portal
    const target = document.getElementById('portal-report-actions');
    if (target) {
      setPortalTarget(target);
    } else {
      // Retry in case it mounts slightly after
      setTimeout(() => {
        setPortalTarget(document.getElementById('portal-report-actions'));
      }, 50);
    }
  }, []);

  // 1. Generate HTML — deferred to post-paint so the loading state renders first
  useEffect(() => {
    if (jsonData?.length > 0) {
      setIsCalculating(true); // show spinner immediately before any CPU work
      const id = setTimeout(() => {
        const html = generateDynamicReport(jsonData, metadata);
        setReportHtml(DOMPurify.sanitize(html));
      }, 0);
      return () => clearTimeout(id);
    }
  }, [jsonData, metadata]);

  // 2. Inject & Paginate
  useLayoutEffect(() => {
    if (reportHtml && containerRef.current) {
      containerRef.current.innerHTML = reportHtml;
      setCurrentPage(1);
      setTotalPages(1);
      setTimeout(runPagination, 100);
    }
  }, [reportHtml]);

  // 3. Handle Resize
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleResize = () => {
        clearTimeout(timeout);
        timeout = setTimeout(runPagination, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 4. Update Visibility
  useEffect(() => {
    if (!isCalculating) {
      updateVisibility(currentPage);
      document.getElementById("main-div")?.scrollTo(0, 0);
    }
  }, [currentPage, isCalculating]);


  // --- PAGINATION LOGIC ---
  const runPagination = () => {
    const root = containerRef.current;
    if (!root) return;

    const reportNode = root.querySelector('.dynamic-report') as HTMLElement;
    if (!reportNode) return;

    setIsCalculating(true);

    // RESET — writes only, no reads, no reflow
    reportNode.querySelectorAll('[style*="display: none"]').forEach(
      el => (el as HTMLElement).style.display = ''
    );
    reportNode.querySelectorAll('[data-page]').forEach(
      el => el.removeAttribute('data-page')
    );

    // ─── PASS 1: collect all atomic elements ───────────────────────────────────
    // We build a flat list of every element that needs a page number, then read
    // ALL their offsetHeights in one tight loop. The browser performs a single
    // layout calculation for the batch instead of one per element.
    const atomicElements: HTMLElement[] = [];
    const isHeader: boolean[] = []; // parallel flag array

    const headers = Array.from(
      reportNode.querySelectorAll('.title-header, .current-date')
    ) as HTMLElement[];
    headers.forEach(el => { atomicElements.push(el); isHeader.push(true); });

    const topSubsummaries = Array.from(
      reportNode.querySelectorAll('.subsummary.level-0')
    ) as HTMLElement[];

    if (topSubsummaries.length === 0) {
      // Flat table — add each body row
      reportNode.querySelectorAll('table.body-table tbody tr').forEach(r => {
        atomicElements.push(r as HTMLElement);
        isHeader.push(false);
      });
    } else {
      topSubsummaries.forEach(sub => {
        const head = sub.querySelector('.subsummary-header');
        const disp = sub.querySelector('.subsummary-display');
        if (head) { atomicElements.push(head as HTMLElement); isHeader.push(false); }
        if (disp) { atomicElements.push(disp as HTMLElement); isHeader.push(false); }

        const content = sub.querySelector('.subsummary-content');
        if (content) {
          Array.from(content.querySelectorAll(
            'tr, .subsummary-header, .subsummary-display, .section-totals'
          )).filter(el => {
            if (el.tagName === 'TR') return el.parentElement?.tagName === 'TBODY';
            return true;
          }).forEach(el => {
            atomicElements.push(el as HTMLElement);
            isHeader.push(false);
          });
        }
      });
    }

    const trailing = reportNode.querySelector('.trailing-summary') as HTMLElement | null;
    if (trailing) { atomicElements.push(trailing); isHeader.push(false); }

    // Single batch read — ONE browser layout flush for the entire report
    const heights = atomicElements.map(el => el.offsetHeight);

    // ─── PASS 2: assign pages using pre-read heights (writes only) ─────────────
    let pageIndex = 1;
    let currentHeight = 0;

    for (let i = 0; i < atomicElements.length; i++) {
      const el = atomicElements[i];
      const h = heights[i];

      if (isHeader[i]) {
        // Headers always go on page 1
        el.setAttribute('data-page', '1');
        currentHeight += h;
        continue;
      }

      if (h === 0) continue;

      if (currentHeight + h > CONTENT_HEIGHT && currentHeight > 50) {
        pageIndex++;
        currentHeight = 0;
      }
      currentHeight += h;
      el.setAttribute('data-page', pageIndex.toString());
    }

    setTotalPages(pageIndex);
    setIsCalculating(false);
    updateVisibility(1);
  };

  const updateVisibility = (targetPage: number) => {
    const root = containerRef.current;
    if (!root) return;
    const reportNode = root.querySelector('.dynamic-report') as HTMLElement;
    if (!reportNode) return;

    const paginated = Array.from(reportNode.querySelectorAll('[data-page]')) as HTMLElement[];
    paginated.forEach(el => {
        const p = parseInt(el.getAttribute('data-page') || '0');
        const isFixed = el.classList.contains('title-header') || el.classList.contains('current-date');
        
        if (isFixed) {
            el.style.display = targetPage === 1 ? '' : 'none';
        } else {
            if (p === targetPage) {
                if (el.tagName === 'TR') el.style.display = 'table-row';
                else el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        }
    });

    const tables = Array.from(reportNode.querySelectorAll('table.body-table')) as HTMLElement[];
    tables.forEach(table => {
        const visibleRow = Array.from(table.querySelectorAll('tr')).find(r => r.style.display !== 'none');
        table.style.display = visibleRow ? '' : 'none';
    });
    
    const subsummaries = Array.from(reportNode.querySelectorAll('.subsummary')) as HTMLElement[];
    subsummaries.forEach(sub => {
        const visibleChild = Array.from(sub.querySelectorAll('[data-page]')).find(c => (c as HTMLElement).style.display !== 'none');
        sub.style.display = visibleChild ? '' : 'none';
    });
  };


  // --- EXPORT HANDLERS ---
  const handleExportPDF = () => {
    if (!containerRef.current) return;

    const clone = containerRef.current.cloneNode(true) as HTMLElement;

    // Strip ALL inline display:none styles — covers both "display: none" and "display:none"
    clone.querySelectorAll('[style]').forEach(el => {
      const style = (el as HTMLElement).style;
      if (style.display === 'none' || style.display === '') {
        style.removeProperty('display');
      }
    });
    // Force all tables and rows visible
    clone.querySelectorAll('table').forEach(t => (t as HTMLElement).style.removeProperty('display'));
    clone.querySelectorAll('tr').forEach(r => (r as HTMLElement).style.removeProperty('display'));
    // Remove data-page attributes — browser CSS handles page breaks natively
    clone.querySelectorAll('[data-page]').forEach(el => el.removeAttribute('data-page'));
    // Remove current-date entirely — it was causing a blank first page in some configurations
    clone.querySelector('.current-date')?.remove();

    const printWindow = window.open('', '', 'width=900,height=1200');
    if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups for this site to print.");
        return;
    }

    // expanded view but trigger print
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 9pt; color: #000; }
            
            /* --- COPY OF STYLES FROM dynamicreport.css --- */
            .title-header { text-align: right; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 20px; display: flex; justify-content: flex-end; align-items: center; }
            .title-header h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0; color: #000; letter-spacing: 0.05em; }
            .title-header h2 { font-size: 10pt; font-weight: normal; margin: 0; color: #000; }
            .current-date { text-align: right; font-size: 9pt; color: #000; margin-bottom: 10px; }

            .report-scope { margin-top: 6px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 7.5pt; color: #94a3b8; font-weight: normal; text-transform: none; }
            .report-scope .scope-line { line-height: 1.3; }
            .report-scope .scope-label { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 7pt; color: #94a3b8; margin-right: 4px; }
            .report-scope .scope-field { color: #cbd5e1; margin-left: 4px; }

            .subsummary { margin-bottom: 16px; page-break-inside: avoid; }
            .subsummary.level-0 { margin-left: 0; }
            .subsummary.level-1 { margin-left: 20px; margin-top: 10px; }
            .subsummary.level-2 { margin-left: 40px; margin-top: 8px; }

            .subsummary-header { font-weight: bold; color: #000; padding: 4px 0; margin-bottom: 4px; display: flex; align-items: baseline; gap: 8px; }
            .subsummary.level-0 .subsummary-header { font-size: 11pt; border-bottom: 3px solid #333; text-transform: uppercase; }
            .subsummary.level-1 .subsummary-header { font-size: 10pt; border-bottom: 2px solid #666; }
            .subsummary.level-2 .subsummary-header { font-size: 9pt; border-bottom: 1px solid #999; }

            .subsummary-display { font-size: 9pt; color: #000; padding: 4px 0; display: flex; flex-wrap: wrap; gap: 15px; }
            .display-item { display: inline-flex; gap: 4px; }
            .display-label { font-weight: bold; }
            .subsummary-content { padding: 0; }

            table.body-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
            th { text-align: left; font-weight: bold; color: #000; border-bottom: 1px solid #000; padding: 6px 4px; text-transform: uppercase; font-size: 9pt; background: transparent; }
            td { padding: 4px; color: #000; vertical-align: top; border: none; }
            tr:nth-child(even) { background-color: transparent; }

            .section-totals { margin-top: 10px; padding: 8px 0; }
            .totals-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #000; border-bottom: 1px solid #666; padding-bottom: 2px; margin-bottom: 6px; display: inline-block; width: 100%; }
            .totals-grid { display: block; }
            .total-item { display: flex; justify-content: space-between; padding: 2px 0; }
            .total-label { font-size: 9pt; font-weight: bold; color: #000; }
            .total-value { font-size: 9pt; font-weight: normal; color: #000; }

            .trailing-summary { margin-top: 20px; padding-top: 10px; border-top: none; }
            .trailing-summary h3 { font-size: 12pt; font-weight: bold; text-transform: uppercase; text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; color: #000; }
            .trailing-summary table { width: 100%; border-collapse: collapse; }
            .trailing-summary td { padding: 6px 0; font-size: 9pt; color: #000; }
            .trailing-summary td:first-child { font-weight: bold; text-transform: uppercase; width: 40%; }
            .trailing-summary td:last-child { text-align: right; }

            @media print {
              @page { margin: 15mm; size: A4; }
              body { padding: 0; background: white; }
              tr { page-break-inside: avoid; }
              h1, h2, h3 { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          ${clone.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
  };

  const handleExportExcel = async () => {
     setIsExportingExcel(true);
     const tables = document.querySelectorAll('table.body-table') as NodeListOf<HTMLTableElement>;
     const sections: any[] = [];
     
     tables.forEach(table => {
         const heading = table.getAttribute('data-table-heading') || "Section";
         const rows = Array.from(table.rows);
         if (rows.length === 0) return;
         const headers = Array.from(rows[0].cells).map(cell => cell.textContent?.trim() || "");
         const dataRows = rows.slice(1).map(row => Array.from(row.cells).map(cell => cell.textContent?.trim() || ""));
         sections.push({ title: heading, headers, rows: dataRows, summary: {} });
     });

     try {
         const response = await fetch("https://kibiai-excel-formatter.onrender.com/generate-excel", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ sections })
         });
         if (!response.ok) throw new Error("Excel generation failed");
         const blob = await response.blob();
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement("a");
         a.href = url;
         a.download = `Report_${new Date().toISOString().split('T')[0]}.xlsx`;
         document.body.appendChild(a);
         a.click();
         a.remove();
     } catch (err: any) {
         console.error("Export Failed:", err);
     } finally {
         setIsExportingExcel(false);
     }
  };

  // --- RAW HTML (for Expanded View) ---
  
  const getRawHtml = () => {
    if (!containerRef.current) return "";
    const clone = containerRef.current.cloneNode(true) as HTMLElement;
    const hidden = clone.querySelectorAll('[style*="display: none"]');
    hidden.forEach(el => (el as HTMLElement).style.display = '');
    const tables = clone.querySelectorAll('table');
    tables.forEach(t => t.style.display = 'table');
    const rows = clone.querySelectorAll('tr');
    rows.forEach(r => r.style.display = 'table-row');
    return clone.innerHTML;
  };

  return (
    <div className="flex flex-col h-full relative bg-gray-100">
      
      {/* --- Controls Toolbar — hidden in previewMode --- */}
      {!previewMode && portalTarget ? createPortal(
        <div className="flex shrink-0 items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm transform transition-all translate-y-0.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded p-1 mr-4">
              {/* Pagination Controls */}
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isCalculating}
                className="p-1 rounded-sm hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="text-xs font-semibold text-slate-700 min-w-[90px] text-center flex items-center justify-center gap-1.5 uppercase tracking-wide">
                {isCalculating ? (
                    <><RefreshCw size={12} className="animate-spin"/> Calc...</>
                ) : (
                    `Page ${currentPage} / ${totalPages}`
                )}
              </span>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isCalculating}
                className="p-1 rounded-sm hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-colors"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
          </div>

          <div className="flex items-center gap-2">
              {/* Expand Toggle */}
              <button 
                  onClick={() => setShowExpandedModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
              >
                  <Maximize size={13} /> Expand
              </button>

              <button 
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
              >
                  <Printer size={13} /> PDF
              </button>

              <button 
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <FileSpreadsheet size={13} /> {isExportingExcel ? 'Exporting...' : 'Excel'}
              </button>
          </div>
        </div>,
        portalTarget
      ) : (!previewMode && (
        <div className="flex shrink-0 items-center justify-between bg-white border-b border-slate-200 px-4 py-2 shadow-sm z-10 w-full mb-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded p-1">
              {/* Pagination Controls */}
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isCalculating}
                className="p-1 rounded-sm hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="text-xs font-semibold text-slate-700 min-w-[90px] text-center flex items-center justify-center gap-1.5 uppercase tracking-wide">
                {isCalculating ? (
                    <><RefreshCw size={12} className="animate-spin"/> Calc...</>
                ) : (
                    `Page ${currentPage} / ${totalPages}`
                )}
              </span>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isCalculating}
                className="p-1 rounded-sm hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
          </div>

          <div className="flex items-center gap-2">
              {/* Expand Toggle */}
              <button 
                  onClick={() => setShowExpandedModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
              >
                  <Maximize size={13} /> Expand
              </button>

              <button 
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
              >
                  <Printer size={13} /> PDF
              </button>

              <button 
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <FileSpreadsheet size={13} /> {isExportingExcel ? 'Exporting...' : 'Excel'}
              </button>
          </div>
        </div>
      ))}

      {/* --- Normal Viewport --- */}
      <div 
        id="main-div" 
        className="flex-1 overflow-auto flex justify-center items-start"
      >
        {previewMode ? (
          // Preview mode: natural-flow layout, fills panel width, no A4 constraints
          <div className="w-full bg-white relative">
            {/* Preview mode loading overlay */}
            {isCalculating && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] gap-3">
                <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4" />
                </div>
                <p className="text-[11px] text-slate-400 font-medium tracking-wide uppercase">
                  Rendering…
                </p>
              </div>
            )}
            <div
              id="dynamic-report-container"
              ref={containerRef}
              className="w-full px-4 py-3"
            />
          </div>
        ) : (
          // Full report mode: A4 paper rendering
          <div
            className="bg-white shadow-xl relative"
            style={{
              width: '210mm',
              minHeight: '297mm',
              padding: '5mm 10mm',
              boxSizing: 'border-box',
            }}
          >
            {/* Progress overlay — replaces the plain opacity fade */}
            {isCalculating && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm border border-slate-100 rounded-2xl shadow-xl px-8 py-5 flex flex-col items-center gap-3">
                  <div className="w-52 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{
                        animation: 'reportProgress 1.4s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                    Rendering report…
                  </p>
                </div>
              </div>
            )}
            <div
              id="dynamic-report-container"
              ref={containerRef}
              className="h-full"
            >
              {/* HTML Injected Here */}
            </div>
          </div>
        )}

      </div>

      {/* --- EXPANDED MODAL (Iframe) --- */}
      {showExpandedModal && (
        <ExpandedReportView 
          htmlContent={getRawHtml()} 
          onClose={() => setShowExpandedModal(false)} 
        />
      )}

      {/* --- EXPORT TOAST LOADER --- */}
      {isExportingExcel && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
               <div className="relative flex h-5 w-5 justify-center items-center">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20"></span>
               </div>
               <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-100">Generating Excel Report</span>
                  <span className="text-[10px] text-slate-400 font-medium">Please wait a moment...</span>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default DynamicReport;


// ================== GENERATION LOGIC ==================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateScopeSubheader(metadata?: ReportMetadata): string {
  if (!metadata) return '';
  const parts: string[] = [];

  if (metadata.dateRange) {
    const { start, end, field } = metadata.dateRange;
    const fieldSuffix = field ? ` <span class="scope-field">(${escapeHtml(field)})</span>` : '';
    parts.push(
      `<span class="scope-line">${escapeHtml(formatDisplayDate(start))} &mdash; ${escapeHtml(formatDisplayDate(end))}${fieldSuffix}</span>`
    );
  }

  if (metadata.filters && metadata.filters.length > 0) {
    const formatted = metadata.filters.map(escapeHtml).join(' &middot; ');
    parts.push(`<span class="scope-line"><span class="scope-label">Filters:</span> ${formatted}</span>`);
  }

  if (parts.length === 0) return '';
  return `<div class="report-scope">${parts.join('')}</div>`;
}

function generateDynamicReport(jsonData: any[], metadata?: ReportMetadata): string {
  
  // 1. Parser for Sorting
  function parseSortValue(val: any): number | string {
      if (val === null || val === undefined || val === "") return -Infinity; 
      
      const strVal = String(val).trim();

      // A. Try Number First (e.g. "123.45")
      if (!isNaN(Number(strVal)) && strVal !== "") {
          return Number(strVal);
      }

      // Check length > 5 to avoid false positives like "10" or "Q1"
      if (strVal.length > 5) {
          const dateTs = Date.parse(strVal);
          if (!isNaN(dateTs)) {
              return dateTs; // Return timestamp (number) for correct sorting
          }
      }

      // C. Fallback to lowercase string
      return strVal.toLowerCase();
  }

  // 2. Updated MultiSort (Uses parser)
  function multiSort(array: any[], sortKeys: string[]) {
      return array.sort((a, b) => {
          for (let key of sortKeys) {
              const trimmedKey = key.trim();
              const valA = parseSortValue(a[trimmedKey]);
              const valB = parseSortValue(b[trimmedKey]);

              if (valA < valB) return -1;
              if (valA > valB) return 1;
          }
          return 0;
      });
  }

  function groupBy(array: any[], key: string) {
      const trimmedKey = key.trim();
      return array.reduce((result: any, currentValue: any) => {
          (result[currentValue[trimmedKey]] = result[currentValue[trimmedKey]] || []).push(currentValue);
          return result;
      }, {});
  }

  function getFieldAlignment(fieldName: string, sampleValue: any) {
      const currencyPrefixes = ['$', '€', '£', '₹', '¥', '₩', '₽', '₦', '₪'];
      const fieldHasCurrency = currencyPrefixes.some(prefix =>
          fieldName.includes(prefix) || (sampleValue && sampleValue.toString().trim().startsWith(prefix))
      );

      if (fieldHasCurrency) return 'right';
      if (sampleValue) {
          const trimmedValue = sampleValue.toString().trim();
          if (/[a-zA-Z]/.test(trimmedValue)) return 'left';
          const numericTest = trimmedValue.replace(/[%\s,]/g, '');
          if (!isNaN(parseFloat(numericTest)) && isFinite(numericTest as any)) return 'center';
          if (!isNaN(Date.parse(trimmedValue))) return 'center';
      }
      return 'left';
  }

  const titleHeader = jsonData.find(item => 'TitleHeader' in item);
  const bodyData = jsonData.find(item => 'Body' in item)?.Body.BodyField;
  const bodySortKeys = jsonData.find(item => 'Body' in item)?.Body.Sorting || [];
  const bodyFieldOrder = jsonData.find(item => 'Body' in item)?.Body.BodyFieldOrder || [];
  const bodySortOrder = jsonData.find(item => 'Body' in item)?.Body.BodySortOrder || [];
  const fieldPrefix = jsonData.find(item => 'Body' in item)?.Body.FieldPrefix || {};
  const fieldSuffix = jsonData.find(item => 'Body' in item)?.Body.FieldSuffix || {};
  
  const prefixMap = fieldPrefix || {};
  const suffixMap = fieldSuffix || {};

  let tableData = "";
  let tableData_ = "";

  function generateTitleHeader(titleHeader: any) {
      const scopeHtml = generateScopeSubheader(metadata);
      return `
      <div class="title-header">
          <div></div>
          <div>
             <h1>${titleHeader.MainHeading}</h1>
             <h2>${titleHeader.SubHeading || ""}</h2>
             ${scopeHtml}
          </div>
      </div>`;
  }

  function generateNestedSubsummaries(data: any[], subsummaries: any[], level = 0, key = ''): string {
      tableData = tableData ? tableData + "_" + key : key;

      if (level >= subsummaries.length) {
          tableData_ = tableData;
          tableData = "";
          return generateBodyTable(data, bodySortKeys, tableData_);
      }

      const currentSubsummary = subsummaries[level];
      const groupField = currentSubsummary.SubsummaryFields[0];
      const groupedData = groupBy(data, groupField);
      const sortOrder = (currentSubsummary.SortOrder || "asc").toLowerCase();
      
      const groupedEntries = Object.entries(groupedData).sort(([aKey], [bKey]) => {
          // Use parser for Group Keys too (e.g. Grouping by Month/Date)
          const valA = parseSortValue(aKey);
          const valB = parseSortValue(bKey);
          
          if (valA < valB) return sortOrder === "asc" ? -1 : 1;
          if (valA > valB) return sortOrder === "asc" ? 1 : -1;
          return 0;
      });

      const totals = currentSubsummary.SubsummaryTotal || [];
      const displayFields = currentSubsummary.SubsummaryDisplay || [];

      let html = '';

      for (let [groupValue, group] of groupedEntries as [string, any[]][]) {
          const groupFieldPrefix = prefixMap[groupField] || prefixMap[groupField.trim()] || '';
          const groupFieldSuffix = suffixMap[groupField.trim()] || '';

          let displayInfo = '';
          displayFields.forEach((field: string) => {
              const trimmedField = field.trim();
              const prefix = prefixMap[field] || prefixMap[trimmedField] || '';
              const suffix = suffixMap[trimmedField] || '';
              const value = group[0]?.[field] || '';
              displayInfo += `<span class="display-item"><span class="display-label">${field}:</span> <span class="display-value">${prefix}${value}${suffix}</span></span>`;
          });

          let groupTotals: Record<string, number> = {};
          totals.forEach((field: string) => {
              const sum = group.reduce((acc, item) => {
                  const value = parseFloat(item[field]);
                  return acc + (isNaN(value) ? 0 : value);
              }, 0);
              groupTotals[field] = sum;
          });

          html += `
          <div class="subsummary level-${level}">
              <h${level + 3} class="subsummary-header">
                  <span class="field-name">${groupField.trim()}</span>: ${groupFieldPrefix}${groupValue || 'N/A'}${groupFieldSuffix}
              </h${level + 3}>
              ${displayInfo ? `<div class="subsummary-display">${displayInfo}</div>` : ''}
              <div class="subsummary-content">
                  ${generateNestedSubsummaries(group, subsummaries, level + 1, groupField.trim() + "-" + groupValue)}
                  ${totals.length > 0 ? generateSectionTotals(groupTotals) : ''}
              </div>
          </div>`;
      }
      return html;
  }

  function generateSectionTotals(totals: Record<string, number>) {
      let html = '<div class="section-totals"><div class="totals-title">Totals</div><div class="totals-grid">';
      for (let [field, total] of Object.entries(totals)) {
          const trimmedField = field.trim();
          const prefix = prefixMap[field] || prefixMap[trimmedField] || '';
          const suffix = suffixMap[trimmedField] || '';
          const formattedTotal = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          html += `
          <div class="total-item">
              <span class="total-label">Total ${field}:</span>
              <span class="total-value">${prefix}${formattedTotal}${suffix}</span>
          </div>`;
      }
      html += '</div></div>';
      return html;
  }

  function generateBodyTable(data: any[], sortKeys: string[], tableData_: string) {
      const sortedData = multiSort(data, sortKeys);
      
      const displayFields = bodyFieldOrder && bodyFieldOrder.length > 0 
          ? bodyFieldOrder 
          : Object.keys(data[0]).filter(key => !sortKeys.includes(key));

      // Updated Column Sorting Logic
      if (bodySortOrder && Array.isArray(bodySortOrder) && bodySortOrder.length > 0) {
          sortedData.sort((a, b) => {
              for (const sortSpec of bodySortOrder) {
                  const column = sortSpec.Column;
                  const order = sortSpec.Order.toLowerCase();
                  if (a[column] === undefined || b[column] === undefined) continue;
                  
                  // USE PARSER HERE
                  const valA = parseSortValue(a[column]);
                  const valB = parseSortValue(b[column]);

                  if (valA !== valB) {
                      return order === 'asc' 
                          ? (valA < valB ? -1 : 1) 
                          : (valA > valB ? -1 : 1);
                  }
              }
              return 0;
          });
      }

      let html = `<table class="body-table" data-table-heading="${tableData_}"><thead><tr>`;
      displayFields.forEach((field: string) => {
          const sampleValue = sortedData[0]?.[field];
          const fullSample = (prefixMap[field] || '') + (sampleValue || '');
          const align = getFieldAlignment(field, fullSample);
          html += `<th style="text-align: ${align}">${field.trim()}</th>`;
      });
      html += '</tr></thead><tbody>';

      sortedData.forEach((row) => {
          html += '<tr>';
          displayFields.forEach((field: string) => {
              const trimmedField = field.trim();
              const prefix = prefixMap[field] || prefixMap[trimmedField] || '';
              const suffix = suffixMap[trimmedField] || '';
              
              let cellValue = row[field];
              if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                  const isDate = !isNaN(Date.parse(cellValue)) && isNaN(cellValue);
                  if (!isDate) {
                      const num = parseFloat(cellValue);
                      if (!isNaN(num)) {
                          if (prefix === '$' || /total|sum|price|cost/i.test(field)) {
                              cellValue = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          }
                      }
                  }
              }
              const displayVal = (cellValue !== undefined && cellValue !== null) ? cellValue : '';
              const fullVal = prefix + displayVal + suffix;
              const align = getFieldAlignment(field, fullVal);
              html += `<td style="text-align: ${align}">${fullVal}</td>`;
          });
          html += '</tr>';
      });
      html += '</tbody></table>';
      return html;
  }

  function generateTrailingSummary(summaryFields: string[], bodyData: any[]) {
      if (!summaryFields || summaryFields.length === 0) return '';
      
      let totals: Record<string, number> = {};
      summaryFields.forEach(field => {
          const trimmedField = field.trim();
          totals[trimmedField] = bodyData.reduce((sum, row) => sum + (parseFloat(row[trimmedField]) || 0), 0);
      });

      let html = '<div class="trailing-summary"><h3>Grand Total</h3><table>';
      for (let [field, total] of Object.entries(totals)) {
          const trimmedField = field.trim();
          const prefix = prefixMap[field] || prefixMap[trimmedField] || '';
          const suffix = suffixMap[trimmedField] || '';
          const formattedTotal = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          html += `<tr><td>Total ${field}</td><td>${prefix}${formattedTotal}${suffix}</td></tr>`;
      }
      html += '</table></div>';
      return html;
  }

  let reportHtml = '<div class="dynamic-report" id="dynamic-printable-report">';
  reportHtml += `<div class="current-date">Date: ${new Date().toLocaleDateString()}</div>`;

  if (titleHeader) {
      reportHtml += generateTitleHeader(titleHeader.TitleHeader);
  }

  if (bodyData) {
      const subsummaries = jsonData.filter(item => 'Subsummary' in item).map(item => item.Subsummary);
      reportHtml += generateNestedSubsummaries(bodyData, subsummaries);

      const trailingSummary = jsonData.find(item => 'TrailingGrandSummary' in item);
      if (trailingSummary) {
          reportHtml += generateTrailingSummary(trailingSummary.TrailingGrandSummary.TrailingGrandSummary, bodyData);
      }
  }

  reportHtml += '</div>';
  return reportHtml;
}