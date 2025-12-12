"use client";

import React, { useEffect, useState } from "react";

// Note: Ensure you have this CSS file or add these styles to your globals.css
// import "../../assets/styles/dynamicreport.css"; 

interface DynamicReportProps {
  jsonData: any[];
}

const DynamicReport: React.FC<DynamicReportProps> = ({ jsonData }) => {
  const [reportHtml, setReportHtml] = useState<string>("");

  useEffect(() => {
    if (jsonData?.length > 0) {
      const html = generateDynamicReport(jsonData);
      setReportHtml(html);
    }
  }, [jsonData]);

  useEffect(() => {
    if (reportHtml) {
      const container = document.getElementById("dynamic-report");
      if (container) container.innerHTML = reportHtml;
    }
  }, [reportHtml]);

  return (
    <div id="main-div" style={{ height: "100%", width: "100%", overflow: "auto" }}>
      <div id="dynamic-report"></div>
    </div>
  );
};

export default DynamicReport;

// ================== HELPER FUNCTIONS ==================

function generateDynamicReport(jsonData: any[]): string {
  let tableData = "";
  let tableData_ = "";
  const prefixMap: Record<string, string> = {};
  let fieldPrefix: Record<string, string> = {};
  let fieldSuffix: Record<string, string> = {};
  let bodySortKeys: string[] = [];
  let bodyFieldOrder: string[] = [];

  function multiSort(array: any[], sortKeys: string[]) {
    return array.sort((a, b) => {
      for (let key of sortKeys) {
        const trimmedKey = key.trim();
        if (a[trimmedKey] < b[trimmedKey]) return -1;
        if (a[trimmedKey] > b[trimmedKey]) return 1;
      }
      return 0;
    });
  }

  function groupBy(array: any[], key: string) {
    const trimmedKey = key.trim();
    return array.reduce((result: any, currentValue: any) => {
      (result[currentValue[trimmedKey]] =
        result[currentValue[trimmedKey]] || []).push(currentValue);
      return result;
    }, {});
  }

  function generateTitleHeader(titleHeader: any) {
    return `
      <div class="title-header text-center mb-6">
        <h1 class="text-2xl font-bold uppercase">${titleHeader.MainHeading}</h1>
        <h2 class="text-sm text-gray-500 mt-1">${titleHeader.SubHeading || ""}</h2>
      </div>
    `;
  }

  function generateNestedSubsummaries(
    data: any[],
    subsummaries: any[],
    level = 0,
    key = ""
  ): string {
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
    
    const groupedEntries = Object.entries(groupedData).sort(
      ([aKey], [bKey]) => {
        let result;
        // Fix: Explicitly cast keys to string to avoid TS errors in comparison
        const numA = Number(aKey);
        const numB = Number(bKey);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          result = numA - numB;
        } else {
          result = String(aKey).localeCompare(String(bKey));
        }
        return sortOrder === "asc" ? result : -result;
      }
    );

    const totals = currentSubsummary.SubsummaryTotal || [];
    const displayFields = currentSubsummary.SubsummaryDisplay || [];

    let html = "";

    // Fix: Explicit typing for the loop
    for (const [groupValue, group] of groupedEntries as [string, any[]][]) {
      const groupFieldPrefix = prefixMap[groupField] || fieldPrefix[groupField.trim()] || "";
      const groupFieldSuffix = fieldSuffix[groupField.trim()] || "";

      let displayInfo = "";
      displayFields.forEach((field: string) => {
        const trimmedField = field.trim();
        const prefix = prefixMap[field] || fieldPrefix[trimmedField] || "";
        const suffix = fieldSuffix[trimmedField] || "";
        const value = group[0]?.[field] || "";
        displayInfo += `<span class="display-item mr-4"><span class="font-semibold">${field}:</span> <span class="text-gray-700">${prefix}${value}${suffix}</span></span>`;
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
        <div class="subsummary level-${level} mt-4 mb-2">
          <h${level + 3} class="subsummary-header font-bold text-lg text-indigo-700 border-b border-indigo-100 pb-1 mb-2">
            <span class="field-name">${groupField.trim()}</span>: ${groupFieldPrefix}${groupValue || "N/A"}${groupFieldSuffix}
          </h${level + 3}>
          ${
            displayInfo
              ? `<div class="subsummary-display text-sm text-gray-600 mb-2 pl-2">${displayInfo}</div>`
              : ""
          }
          <div class="subsummary-content pl-4 border-l-2 border-indigo-50">
            ${generateNestedSubsummaries(
              group,
              subsummaries,
              level + 1,
              groupField.trim() + "-" + groupValue
            )}
            ${
              totals.length > 0 ? generateSectionTotals(groupTotals) : ""
            }
          </div>
        </div>
      `;
    }

    return html;
  }

  function generateSectionTotals(totals: Record<string, number>) {
    let html =
      '<div class="section-totals mt-2 pt-2 border-t border-gray-200"><div class="totals-title font-semibold text-xs uppercase text-gray-500 mb-1">Subtotals</div><div class="totals-grid flex gap-6">';
    for (let [field, total] of Object.entries(totals)) {
      const formattedTotal = total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      html += `
        <div class="total-item">
          <span class="total-label text-sm text-gray-600 mr-2">${field}:</span>
          <span class="total-value font-bold text-gray-800">${formattedTotal}</span>
        </div>
      `;
    }
    html += "</div></div>";
    return html;
  }

  function generateTrailingSummary(summaryFields: string[], bodyData: any[]) {
    let totals: Record<string, number> = {};
    if (!summaryFields || summaryFields.length === 0) return "";

    summaryFields.forEach((field) => {
      const trimmedField = field.trim();
      totals[trimmedField] = bodyData.reduce(
        (sum, row) => sum + (parseFloat(row[trimmedField]) || 0),
        0
      );
    });

    let html = '<div class="trailing-summary mt-8 pt-4 border-t-2 border-black"> <h3 class="text-xl font-bold mb-4">Grand Total</h3><table class="w-full max-w-md">';
    for (let [field, total] of Object.entries(totals)) {
      const formattedTotal = total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      html += `<tr><td class="py-1 text-gray-600 font-medium">Total ${field}</td><td class="text-right font-bold text-lg">${formattedTotal}</td></tr>`;
    }
    html += "</table></div>";
    return html;
  }

  function generateBodyTable(
    data: any[],
    sortKeys: string[],
    tableData_: string
  ) {
    const sortedData = multiSort(data, sortKeys);
    const displayFields =
      bodyFieldOrder && bodyFieldOrder.length > 0
        ? bodyFieldOrder
        : Object.keys(data[0]) || [];

    let html = `<div class="overflow-x-auto my-2"><table class="body-table w-full text-left text-sm border-collapse" data-table-heading="${tableData_}"><thead class="bg-gray-100"><tr>`;
    displayFields.forEach((field) => {
      html += `<th class="p-2 font-semibold text-gray-700 border-b border-gray-300">${field.trim()}</th>`;
    });
    html += "</tr></thead><tbody>";

    sortedData.forEach((row) => {
      html += "<tr class='hover:bg-gray-50 border-b border-gray-100'>";
      displayFields.forEach((field) => {
        // Apply prefix/suffix logic here if needed
        const val = row[field];
        const prefix = fieldPrefix[field] || "";
        const suffix = fieldSuffix[field] || "";
        
        // Simple formatting check
        let displayVal = val || "";
        if (typeof val === 'number') {
             // Basic formatting, relies on prefixes mostly
             displayVal = val; 
        }

        html += `<td class="p-2 text-gray-600">${prefix}${displayVal}${suffix}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody></table></div>";
    return html;
  }

  let reportHtml = '<div class="dynamic-report font-sans text-gray-800" id="dynamic-printable-report">';
  reportHtml += `<div class="current-date text-right text-xs text-gray-400 mb-4">${new Date().toLocaleDateString()}</div>`;

  const titleHeader = jsonData.find((item) => "TitleHeader" in item);
  if (titleHeader) reportHtml += generateTitleHeader(titleHeader.TitleHeader);

  const bodyData = jsonData.find((item) => "Body" in item)?.Body?.BodyField;
  
  const bodySection = jsonData.find((item) => "Body" in item)?.Body;
  if(bodySection) {
      bodySortKeys = bodySection.Sorting || [];
      bodyFieldOrder = bodySection.BodyFieldOrder || [];
      fieldPrefix = bodySection.FieldPrefix || {};
      fieldSuffix = bodySection.FieldSuffix || {};
  }

  if (bodyData) {
    const subsummaries = jsonData
      .filter((item) => "Subsummary" in item)
      .map((item) => item.Subsummary);
    
    reportHtml += generateNestedSubsummaries(bodyData, subsummaries);

    const trailingSummary = jsonData.find(
      (item) => "TrailingGrandSummary" in item
    );
    if (trailingSummary) {
      reportHtml += generateTrailingSummary(
        trailingSummary.TrailingGrandSummary.TrailingGrandSummary,
        bodyData
      );
    }
  }

  reportHtml += "</div>";
  return reportHtml;
}