"use client";

import React, { useEffect, useState } from "react";

interface ReportStructureJson {
  [key: string]: any;
}

interface DynamicReportProps {
  report_structure_json: ReportStructureJson[];
}

const DynamicReport: React.FC<DynamicReportProps> = ({
  report_structure_json,
}) => {
  const [reportHtml, setReportHtml] = useState<string>("");

  // Helper function to sort objects by multiple keys
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

  // Helper function to group array by key
  function groupBy(array: any[], key: string) {
    const trimmedKey = key.trim();
    return array.reduce((result: { [key: string]: any[] }, currentValue) => {
      (result[currentValue[trimmedKey]] =
        result[currentValue[trimmedKey]] || []).push(currentValue);
      return result;
    }, {});
  }

  // Generate Title Header
  function generateTitleHeader(titleHeader: any): string {
    return `
      <div class="title-header">
        <h1>${titleHeader.MainHeading}</h1>
        <h2>${titleHeader.SubHeading}</h2>
      </div>
    `;
  }

  // Generate nested subsummaries
  function generateNestedSubsummaries(
    data: any[],
    subsummaries: any[],
    level = 0,
    key = "",
    fieldPrefix: any,
    fieldSuffix: any,
    bodySortKeys: string[],
    bodyFieldOrder: string[],
    bodySortOrder: any[]
  ): string {
    let tableData = key ? `${key}` : "";

    if (level >= subsummaries.length) {
      return generateBodyTable(
        data,
        bodySortKeys,
        tableData,
        fieldPrefix,
        fieldSuffix,
        bodyFieldOrder,
        bodySortOrder
      );
    }

    const currentSubsummary = subsummaries[level];
    const groupField = currentSubsummary.SubsummaryFields[0];
    const groupedData = groupBy(data, groupField);
    const totals = currentSubsummary.SubsummaryTotal || [];
    const displayFields = currentSubsummary.SubsummaryDisplay || [];

    let html = "";

    for (let [groupValue, group] of Object.entries(groupedData)) {
      const groupFieldPrefix = fieldPrefix[groupField] || "";
      const groupFieldSuffix = fieldSuffix[groupField] || "";

      // Create display information
      let displayInfo = "";
      displayFields.forEach((field: string) => {
        const trimmedField = field.trim();
        const prefix = fieldPrefix[trimmedField] || "";
        const suffix = fieldSuffix[trimmedField] || "";
        const value = group[0]?.[field] || "";
        displayInfo += `<span class="display-item"><span class="display-label">${field}:</span> <span class="display-value">${prefix}${value}${suffix}</span></span>`;
      });

      // Calculate totals for this group
      let groupTotals: { [key: string]: number } = {};
      totals.forEach((field: string) => {
        const sum = group.reduce((acc: number, item: any) => {
          const value = parseFloat(item[field]);
          return acc + (isNaN(value) ? 0 : value);
        }, 0);
        groupTotals[field] = sum;
      });

      html += `
        <div class="subsummary level-${level}">
          <h${level + 3} class="subsummary-header">
            <span class="field-name">${groupField.trim()}</span>: ${groupFieldPrefix}${
        groupValue || "N/A"
      }${groupFieldSuffix}
          </h${level + 3}>
          ${
            displayInfo
              ? `<div class="subsummary-display">${displayInfo}</div>`
              : ""
          }
          <div class="subsummary-content">
            ${generateNestedSubsummaries(
              group,
              subsummaries,
              level + 1,
              `${groupField.trim()}-${groupValue}`,
              fieldPrefix,
              fieldSuffix,
              bodySortKeys,
              bodyFieldOrder,
              bodySortOrder
            )}
            ${
              totals.length > 0
                ? generateSectionTotals(groupTotals, fieldPrefix, fieldSuffix)
                : ""
            }
          </div>
        </div>
      `;
    }

    return html;
  }

  // Generate section totals
  function generateSectionTotals(
    totals: { [key: string]: number },
    fieldPrefix: any,
    fieldSuffix: any
  ): string {
    let html = '<div class="section-totals">';
    html += '<div class="totals-title">Totals</div>';
    html += '<div class="totals-grid">';

    for (let [field, total] of Object.entries(totals)) {
      const trimmedField = field.trim();
      const prefix = fieldPrefix[trimmedField] || "";
      const suffix = fieldSuffix[trimmedField] || "";
      const formattedTotal = total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      html += `
        <div class="total-item">
          <span class="total-label">Total ${field}:</span>
          <span class="total-value">${prefix}${formattedTotal}${suffix}</span>
        </div>
      `;
    }

    html += "</div></div>";
    return html;
  }

  // Generate Body Table
  function generateBodyTable(
    data: any[],
    sortKeys: string[],
    tableData_: string,
    fieldPrefix: any,
    fieldSuffix: any,
    bodyFieldOrder: string[],
    bodySortOrder: any[]
  ): string {
    const sortedData = multiSort([...data], sortKeys);
    const displayFields =
      bodyFieldOrder.length > 0
        ? bodyFieldOrder
        : Object.keys(data[0] || {}).filter(
            (key) => !sortKeys.includes(key) && !sortKeys.includes(` ${key}`)
          );

    // Apply body sort order if provided
    if (
      bodySortOrder &&
      Array.isArray(bodySortOrder) &&
      bodySortOrder.length > 0
    ) {
      sortedData.sort((a, b) => {
        for (const sortSpec of bodySortOrder) {
          const column = sortSpec.Column;
          const order = sortSpec.Order.toLowerCase();

          if (a[column] === undefined || b[column] === undefined) continue;

          const valA = a[column];
          const valB = b[column];
          const numA = parseFloat(valA);
          const numB = parseFloat(valB);
          const bothAreNumbers = !isNaN(numA) && !isNaN(numB);

          let compareA = bothAreNumbers ? numA : valA;
          let compareB = bothAreNumbers ? numB : valB;

          if (compareA !== compareB) {
            if (order === "asc") {
              return compareA < compareB ? -1 : 1;
            } else {
              return compareA > compareB ? -1 : 1;
            }
          }
        }
        return 0;
      });
    }

    let html = `<table class="body-table" data-table-heading="${tableData_}"><thead><tr>`;
    displayFields.forEach((field) => {
      html += `<th>${field.trim()}</th>`;
    });
    html += "</tr></thead><tbody>";

    sortedData.forEach((row) => {
      html += "<tr>";
      displayFields.forEach((field) => {
        const trimmedField = field.trim();
        const prefix = fieldPrefix[trimmedField] || "";
        const suffix = fieldSuffix[trimmedField] || "";

        let cellValue = row[field];
        if (/total|sum/i.test(field) && !isNaN(parseFloat(cellValue))) {
          cellValue = parseFloat(cellValue).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
        html += `<td>${prefix}${cellValue || ""}${suffix}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
    return html;
  }

  // Generate Trailing Grand Summary
  function generateTrailingSummary(
    summaryFields: string[],
    bodyData: any[],
    fieldPrefix: any,
    fieldSuffix: any
  ): string {
    if (!summaryFields || summaryFields.length === 0) {
      return "";
    }

    let totals: { [key: string]: number } = {};
    summaryFields.forEach((field) => {
      const trimmedField = field.trim();
      totals[trimmedField] = bodyData.reduce(
        (sum: number, row: any) => sum + (parseFloat(row[trimmedField]) || 0),
        0
      );
    });

    let html = '<div class="trailing-summary"><h3>Grand Total</h3><table>';
    for (let [field, total] of Object.entries(totals)) {
      const trimmedField = field.trim();
      const prefix = fieldPrefix[trimmedField] || "";
      const suffix = fieldSuffix[trimmedField] || "";
      const formattedTotal = total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      html += `<tr><td>Total ${field}</td><td>${prefix}${formattedTotal}${suffix}</td></tr>`;
    }
    html += "</table></div>";
    return html;
  }

  // Main function to generate dynamic report
  function generateDynamicReport(jsonData: any[]): string {
    let reportHtml =
      '<div class="dynamic-report" id="dynamic-printable-report">';

    // Add current date
    reportHtml += `<div class="current-date">${new Date().toLocaleDateString()}</div>`;

    // Find and generate Title Header
    const titleHeader = jsonData.find((item) => "TitleHeader" in item);
    if (titleHeader) {
      reportHtml += generateTitleHeader(titleHeader.TitleHeader);
    }

    // Find Body data and configurations
    const bodyData = jsonData.find((item) => "Body" in item)?.Body.BodyField;
    const bodySortKeys =
      jsonData.find((item) => "Body" in item)?.Body.Sorting || [];
    const bodyFieldOrder =
      jsonData.find((item) => "Body" in item)?.Body.BodyFieldOrder || [];
    const bodySortOrder =
      jsonData.find((item) => "Body" in item)?.Body.BodySortOrder || [];
    const fieldPrefix =
      jsonData.find((item) => "Body" in item)?.Body.FieldPrefix || {};
    const fieldSuffix =
      jsonData.find((item) => "Body" in item)?.Body.FieldSuffix || {};

    if (bodyData) {
      // Find and generate Subsummaries
      const subsummaries = jsonData
        .filter((item) => "Subsummary" in item)
        .map((item) => item.Subsummary);
      reportHtml += generateNestedSubsummaries(
        bodyData,
        subsummaries,
        0,
        "",
        fieldPrefix,
        fieldSuffix,
        bodySortKeys,
        bodyFieldOrder,
        bodySortOrder
      );

      // Find and generate Trailing Grand Summary
      const trailingSummary = jsonData.find(
        (item) => "TrailingGrandSummary" in item
      );
      if (trailingSummary) {
        reportHtml += generateTrailingSummary(
          trailingSummary.TrailingGrandSummary.TrailingGrandSummary,
          bodyData,
          fieldPrefix,
          fieldSuffix
        );
      }
    }

    reportHtml += "</div>";
    return reportHtml;
  }

  useEffect(() => {
    if (!report_structure_json || !Array.isArray(report_structure_json)) {
      setReportHtml("");
      return;
    }

    const generatedHtml = generateDynamicReport(report_structure_json);
    setReportHtml(generatedHtml);
  }, [report_structure_json]);

  return (
    <div
      className="dynamic-report-container"
      dangerouslySetInnerHTML={{ __html: reportHtml }}
    />
  );
};

export default DynamicReport;
