// pages/api/generate-report.ts or app/api/generate-report/route.ts (depending on your Next.js setup)

import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchFmRecord } from "@/app/utils/utility";

// Types
interface ReportSetupJson {
  host?: string;
  data_fetching_protocol?: string;
  tables: Record<
    string,
    {
      file: string;
      username: string;
      password: string;
      layout?: string | null;
      fields?: Record<
        string,
        {
          label: string;
          prefix?: string;
          suffix?: string;
        }
      >;
    }
  >;
  relationships?: Array<{
    primary_table: string;
    joined_table: string;
    source?: string;
    target?: string;
  }>;
}
interface CustomCalculatedField {
  field_name: string;
  label?: string;
  formula: string;
  dependencies: string[];
  format?: "currency" | "percentage" | "number";
}

interface ReportConfigJson {
  db_defination: Array<{
    primary_table: string;
    joined_table?: string;
    source?: string;
    target?: string;
    fetch_order: number;
    join_type?: "left" | "inner" | "";
  }>;
  report_columns?: Array<{
    table: string;
    field: string;
  }>;
  group_by_fields?: Record<
    string,
    {
      table: string;
      field: string;
      sort_order?: string;
      display?: Array<{ table: string; field: string }>;
      group_total?: Array<{ table: string; field: string }>;
    }
  >;
  date_range_fields?: Record<string, Record<string, string>>;
  filters?: Record<string, Record<string, any>>;
  body_sort_order?: Array<{
    field: string;
    sort_order: string;
  }>;
  summary_fields?: string[];
  custom_calculated_fields?: CustomCalculatedField[];
  report_header?: string;
  response_to_user?: string;
  [key: string]: any;
}

interface FetchOrderDataset {
  order: number;
  data: Array<{
    PrimaryKey: string;
    [key: string]: any;
  }>;
}

interface StitchResult {
  BodyField: Record<string, any>[];
}

interface ApiResponse {
  status: "ok" | "error";
  detail?: string;
  nextJSError?: any;
  report_structure_json?: any;
  stitch_result?: StitchResult;
  processing_logs?: string[];
}

// Validation Schemas
const reportSetupSchema = z.object({
  host: z.string().optional(),
  data_fetching_protocol: z.string().optional(),
  tables: z.record(
    z.string(),
    z.object({
      file: z.string(),
      username: z.string(),
      password: z.string(),
      layout: z.string().nullable().optional(),
      fields: z

        .record(
          z.string(),
          z.object({
            label: z.string(),
            prefix: z.string().optional(),
            suffix: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
  relationships: z
    .array(
      z.object({
        primary_table: z.string(),
        joined_table: z.string(),
        source: z.string().optional(),
        target: z.string().optional(),
      })
    )
    .optional(),
});

const reportConfigSchema = z.object({
  db_defination: z.array(
    z.object({
      primary_table: z.string(),
      joined_table: z.string().optional(),
      source: z.string().optional(),
      target: z.string().optional(),
      fetch_order: z.number(),
    })
  ),
  report_columns: z
    .array(
      z.object({
        table: z.string(),
        field: z.string(),
      })
    )
    .optional(),
  group_by_fields: z
    .record(
      z.string(),
      z.object({
        table: z.string(),
        field: z.string(),
        display: z
          .array(
            z.object({
              table: z.string(),
              field: z.string(),
            })
          )
          .optional(),
        group_total: z
          .array(
            z.object({
              table: z.string(),
              field: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  date_range_fields: z
    .record(z.string(), z.record(z.string(), z.string()))
    .optional(),
  filters: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  body_sort_order: z
    .array(
      z.object({
        field: z.string(),
        sort_order: z.string(),
      })
    )
    .optional(),
  summary_fields: z.array(z.string()).optional(),
  report_header: z.string().optional(),
  response_to_user: z.string().optional(),
});

// In-memory storage for processing
class InMemoryDataManager {
  private datasets: Record<number, any[]> = {};
  private pkeys: Record<number, string[]> = {};
  private results: Record<string, any> = {};
  private logs: string[] = [];

  storeDataset(fetchOrder: number, data: any[]): void {
    this.datasets[fetchOrder] = data;
  }

  storePkeys(fetchOrder: number, pkeys: string[]): void {
    this.pkeys[fetchOrder] = pkeys;
  }

  getDataset(fetchOrder: number): any[] | null {
    return this.datasets[fetchOrder] || null;
  }

  getPkeys(fetchOrder: number): string[] | null {
    return this.pkeys[fetchOrder] || null;
  }

  saveResult(resultType: string, data: any): void {
    this.results[resultType] = data;
  }

  getResult(resultType: string): any | null {
    return this.results[resultType] || null;
  }

  addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push(`[${timestamp}] ${message}`);
  }

  getLogs(): string[] {
    return this.logs;
  }

  clearAll(): void {
    this.datasets = {};
    this.pkeys = {};
    this.results = {};
    this.logs = [];
  }
}

// Helper Functions
function buildFilters(
  table: string | undefined,
  configFilters?: Record<string, Record<string, any>>,
  dateRangeFields?: Record<string, Record<string, string>>
) {
  if (!table) {
    return {};
  }

  const filters: Record<string, any> = {};

  if (configFilters && configFilters[table]) {
    Object.assign(filters, configFilters[table]);
  }

  if (dateRangeFields && dateRangeFields[table]) {
    Object.assign(filters, dateRangeFields[table]);
  }

  return Object.keys(filters).length > 0 ? filters : {};
}

function extractPkeysFromData(data: any[], sourceField: string): string[] {
  const pkeys = data
    .map((record) => record[sourceField])
    .filter((key) => key != null && key !== "")
    .map((key) => String(key));

  return [...new Set(pkeys)];
}

async function fetchDataFromAPI(
  table: string | undefined,
  setupJson: ReportSetupJson,
  filters: Record<string, any>,
  pKeyField?: string,
  pKeys?: string[]
): Promise<any[]> {
  if (!table) {
    return [];
  }

  const tableConfig = setupJson.tables[table];
  if (!tableConfig) {
    throw new Error(`Table configuration not found: ${table}`);
  }

  const isDataApi =
    setupJson.data_fetching_protocol === "dataapi" ||
    setupJson.data_fetching_protocol === "data-api";

  const payload = {
    raw_dataset: "",
    p_key_field: pKeyField ?? "",
    p_keys: Array.isArray(pKeys) ? pKeys : [],
    filter: filters ?? {},
    table: isDataApi ? tableConfig.layout?.trim() || table : table,
    host: setupJson.host ?? "",
    database: tableConfig.file ?? "",
    version: isDataApi ? "vLatest" : "v4",
    data_fetching_protocol: setupJson.data_fetching_protocol ?? "",
    session_token: isDataApi ? "" : "", // always empty string, safe default
  };

  const token = Buffer.from(
    `${tableConfig.username}:${tableConfig.password}`
  ).toString("base64");

  //   const response = await fetch(
  //     `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/filemaker`,
  //     {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Basic ${Buffer.from(
  //           `${tableConfig.username}:${tableConfig.password}`
  //         ).toString("base64")}`,
  //       },
  //       body: JSON.stringify(payload),
  //     }
  //   );

  const response = await fetchFmRecord(payload, token);

  //   if (!response.ok) {
  //     throw new Error(
  //       `API call failed: ${response.status} ${response.statusText}`
  //     );
  //   }

  const result = response;
  return result.data || [];
}

async function processFetchOrder(
  fetchDef: ReportConfigJson["db_defination"][0],
  setupJson: ReportSetupJson,
  configJson: ReportConfigJson,
  dataManager: InMemoryDataManager,
  previousDataset?: any[]
): Promise<{ data: any[]; nextPkeys: string[] }> {
  const { fetch_order, primary_table, joined_table, source, target } = fetchDef;
  const mainTable = fetch_order === 1 ? primary_table : joined_table;

  dataManager.addLog(
    `Processing fetch order ${fetch_order} for table: ${mainTable}`
  );

  const filters = buildFilters(
    mainTable,
    configJson.filters,
    configJson.date_range_fields
  );

  try {
    let pKeyField: string | undefined;
    let pKeysToUse: string[] | undefined;

    if (fetch_order === 1) {
      pKeyField = undefined;
      pKeysToUse = undefined;
    } else {
      pKeyField = target;
      if (previousDataset && source) {
        pKeysToUse = extractPkeysFromData(previousDataset, source);
        dataManager.addLog(
          `Using ${pKeysToUse.length} pkeys from previous dataset field: ${source}`
        );
      } else {
        pKeysToUse = [];
      }
    }

    const data = await fetchDataFromAPI(
      mainTable,
      setupJson,
      filters,
      pKeyField,
      pKeysToUse
    );

    dataManager.storeDataset(fetch_order, data);
    dataManager.addLog(
      `Stored ${data.length} records for fetch order ${fetch_order}`
    );

    return { data, nextPkeys: [] };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Fetch order ${fetch_order} failed: ${errorMessage}`);
  }
}

/**
 * ✅ Calculates custom fields using HyperFormula for Excel-style formulas
 *
 * @param bodyFields - Array of stitched row objects (with label keys)
 * @param customFields - Array of custom calculated field definitions
 * @param fieldLabelMap - Mapping of table.field -> label (for reverse lookup)
 * @returns Modified bodyFields with calculated fields added
 *
 * Time Complexity: O(n × m) where n = rows, m = calculated fields
 * Space Complexity: O(n × m) for HyperFormula sheet data
 */

// function calculateCustomFields(
//   bodyFields: Record<string, any>[],
//   customFields: CustomCalculatedField[],
//   fieldLabelMap: Record<string, Record<string, string>>
// ): Record<string, any>[] {
//   if (!customFields || customFields.length === 0) return bodyFields;
//   if (!bodyFields || bodyFields.length === 0) return bodyFields;

//   try {
//     const { HyperFormula } = require("hyperformula");

//     // Reverse map: label → fieldName
//     const labelToFieldMap: Record<string, string> = {};
//     Object.keys(fieldLabelMap).forEach((tableName) => {
//       Object.keys(fieldLabelMap[tableName]).forEach((fieldName) => {
//         const label = fieldLabelMap[tableName][fieldName];
//         labelToFieldMap[label] = fieldName;
//       });
//     });

//     customFields.forEach((calcField) => {
//       const { field_name, formula, dependencies, format } = calcField;

//       if (
//         !field_name ||
//         !formula ||
//         !dependencies ||
//         dependencies.length === 0
//       ) {
//         console.warn("⚠️ Invalid calculated field:", calcField);
//         return;
//       }

//       console.log("\n==============================");
//       console.log("🧮 Processing Calculated Field:", field_name);
//       console.log("==============================");

//       const dependencyLabels: string[] = [];
//       const missingDeps: string[] = [];

//       // Resolve dependency labels
//       dependencies.forEach((dep) => {
//         let foundLabel: string | null = null;

//         Object.keys(fieldLabelMap).forEach((table) => {
//           if (fieldLabelMap[table][dep]) {
//             foundLabel = fieldLabelMap[table][dep];
//           }
//         });

//         if (!foundLabel) {
//           const matchingCalc = customFields.find((cf) => cf.field_name === dep);
//           if (matchingCalc) {
//             const calcLabel = matchingCalc.label || matchingCalc.field_name;
//             if (bodyFields[0][calcLabel] !== undefined) {
//               foundLabel = calcLabel;
//             }
//           }
//         }

//         if (foundLabel) dependencyLabels.push(foundLabel);
//         else {
//           console.log("❌ Missing dependency:", dep);
//           missingDeps.push(dep);
//         }
//       });

//       if (missingDeps.length > 0) return;

//       // Build sheet input
//       const sheetData: any[][] = [];
//       sheetData.push(dependencyLabels);

//       bodyFields.forEach((row, rowIndex) => {
//         const dataRow: any[] = [];

//         dependencyLabels.forEach((label) => {
//           let rawValue = row[label];
//           let value = rawValue;

//           console.log(`\n🔹 Row ${rowIndex}, Field "${label}"`);
//           console.log(
//             "   🔍 Raw incoming value:",
//             rawValue,
//             `typeof=${typeof rawValue}`
//           );

//           // Handle empty
//           if (
//             value === undefined ||
//             value === null ||
//             value === "" ||
//             value === "--"
//           ) {
//             console.log("   ⚠️ Empty → using 0");
//             value = 0;
//           }

//           if (typeof value === "string") {
//             const trimmed = value.trim();
//             console.log("   ✂ Trimmed:", trimmed);

//             // Detect hidden chars
//             if (/[\u00A0\r\n\t]/.test(trimmed)) {
//               console.log(
//                 "   ❗ Hidden whitespace detected:",
//                 JSON.stringify(trimmed)
//               );
//             }

//             // Detect MM/DD/YYYY (02/15/2025)

//             const mmddyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;

//             if (mmddyyyy.test(trimmed)) {
//               const match = trimmed.match(mmddyyyy);

//               if (match) {
//                 const [, mm, dd, yyyy] = match;
//                 const iso = `${yyyy}-${mm}-${dd}`;
//                 console.log(
//                   "   ✔ MM/DD/YYYY detected → converting to ISO:",
//                   trimmed,
//                   "→",
//                   iso
//                 );
//                 value = iso;
//               } else {
//                 console.log(
//                   "   ❌ MM/DD/YYYY regex matched but trimmed.match() returned null. Value:",
//                   trimmed
//                 );
//               }
//             }
//           }

//           console.log(
//             "   🔎 FINAL value sent to HF:",
//             value,
//             `typeof=${typeof value}`
//           );
//           dataRow.push(value);
//         });

//         sheetData.push(dataRow);
//       });

//       console.log("\n📄 Final Sheet Data sent to HyperFormula:");
//       console.log(JSON.stringify(sheetData, null, 2));

//       // Initialize HF
//       const hfInstance = HyperFormula.buildEmpty({ licenseKey: "gpl-v3" });
//       const sheetName = "CalcSheet";
//       hfInstance.addSheet(sheetName);
//       const sheetId = hfInstance.getSheetId(sheetName)!;
//       hfInstance.setSheetContent(sheetId, sheetData);

//       // pre-process formula
//       let processedFormula = formula.trim();
//       if (processedFormula.startsWith("="))
//         processedFormula = processedFormula.substring(1);

//       dependencies.forEach((dep, index) => {
//         const colLetter = String.fromCharCode(65 + index);
//         const regex = new RegExp(`\\b${dep}\\b`, "g");
//         // processedFormula = processedFormula.replace(regex, `${colLetter}2`);
//         processedFormula = processedFormula.replace(
//           regex,
//           `CONCAT("\\"", TEXT(${colLetter}2,"yyyy-mm-dd"), "\\"")`
//         );
//       });

//       console.log("\n🧪 Formula Template:", processedFormula);

//       // Calculate per row
//       bodyFields.forEach((row, rowIndex) => {
//         const rowFormula = processedFormula.replace(
//           /([A-Z]+)(\d+)/g,
//           (match, col) => `${col}${rowIndex + 2}`
//         );

//         // console.log(`\n➡ Row ${rowIndex} → Evaluating: =${rowFormula}`);

//         hfInstance.setCellContents(
//           { sheet: sheetId, col: dependencyLabels.length, row: rowIndex + 1 },
//           [["=" + rowFormula]]
//         );

//         const cellValue = hfInstance.getCellValue({
//           sheet: sheetId,
//           col: dependencyLabels.length,
//           row: rowIndex + 1,
//         });

//         // console.log("   ↪ HF Output:", cellValue);

//         let finalValue = cellValue;

//         if (typeof cellValue !== "number" || isNaN(cellValue)) {
//           // console.log("   ❗ INVALID result → '--'");
//           finalValue = "--";
//         }

//         const displayLabel = calcField.label || field_name;
//         row[displayLabel] = finalValue;
//       });

//       console.log(`\n✅ Completed Calculated Field: ${field_name}`);
//     });

//     return bodyFields;
//   } catch (error) {
//     console.error("❌ HyperFormula calculation failed:", error);
//     return bodyFields;
//   }
// }

function calculateCustomFields(
  bodyFields: Record<string, any>[],
  customFields: CustomCalculatedField[],
  fieldLabelMap: Record<string, Record<string, string>>
): Record<string, any>[] {
  if (!customFields || customFields.length === 0) return bodyFields;
  if (!bodyFields || bodyFields.length === 0) return bodyFields;

  try {
    const { HyperFormula } = require("hyperformula");

    // Helper: Convert date string to Excel serial number
    const dateToExcelSerial = (dateStr: string): number | null => {
      // Handle MM/DD/YYYY format
      const mmddyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      let isoDate = dateStr;

      if (mmddyyyy.test(dateStr.trim())) {
        const match = dateStr.trim().match(mmddyyyy);
        if (match) {
          const [, mm, dd, yyyy] = match;
          isoDate = `${yyyy}-${mm}-${dd}`;
        }
      }

      // Parse ISO date (YYYY-MM-DD) to Date object
      const parsed = new Date(isoDate);
      if (isNaN(parsed.getTime())) return null;

      // Excel serial: days since December 30, 1899 (Excel's epoch)
      const excelEpoch = new Date(1899, 11, 30);
      const diffMs = parsed.getTime() - excelEpoch.getTime();
      const excelSerial = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return excelSerial;
    };

    // Reverse map: label → fieldName
    const labelToFieldMap: Record<string, string> = {};
    Object.keys(fieldLabelMap).forEach((tableName) => {
      Object.keys(fieldLabelMap[tableName]).forEach((fieldName) => {
        const label = fieldLabelMap[tableName][fieldName];
        labelToFieldMap[label] = fieldName;
      });
    });

    customFields.forEach((calcField) => {
      const { field_name, formula, dependencies, format } = calcField;

      if (
        !field_name ||
        !formula ||
        !dependencies ||
        dependencies.length === 0
      ) {
        console.warn("⚠️ Invalid calculated field:", calcField);
        return;
      }

      console.log(`\n🧮 Processing: ${field_name}`);
      console.log(`📝 Formula: ${formula}`);

      const dependencyLabels: string[] = [];
      const missingDeps: string[] = [];

      // Resolve dependency labels
      dependencies.forEach((dep) => {
        let foundLabel: string | null = null;

        Object.keys(fieldLabelMap).forEach((table) => {
          if (fieldLabelMap[table][dep]) {
            foundLabel = fieldLabelMap[table][dep];
          }
        });

        if (!foundLabel) {
          const matchingCalc = customFields.find((cf) => cf.field_name === dep);
          if (matchingCalc) {
            const calcLabel = matchingCalc.label || matchingCalc.field_name;
            if (bodyFields[0][calcLabel] !== undefined) {
              foundLabel = calcLabel;
            }
          }
        }

        if (foundLabel) dependencyLabels.push(foundLabel);
        else missingDeps.push(dep);
      });

      if (missingDeps.length > 0) {
        console.warn(`⚠️ Missing dependencies:`, missingDeps);
        return;
      }

      // Build sheet input with date conversion
      const sheetData: any[][] = [];
      sheetData.push(dependencyLabels);

      bodyFields.forEach((row) => {
        const dataRow: any[] = [];

        dependencyLabels.forEach((label) => {
          let value = row[label];

          // Handle empty/null values
          if (
            value === undefined ||
            value === null ||
            value === "" ||
            value === "--"
          ) {
            value = 0;
            dataRow.push(value);
            return;
          }

          // If it's a string, check if it's a date
          if (typeof value === "string") {
            const trimmed = value.trim();

            // Detect date patterns (MM/DD/YYYY or YYYY-MM-DD)
            const datePattern = /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/;

            if (datePattern.test(trimmed)) {
              // Convert date string to Excel serial number
              const excelSerial = dateToExcelSerial(trimmed);

              if (excelSerial !== null) {
                console.log(`📅 Converted "${trimmed}" → ${excelSerial}`);
                value = excelSerial;
              } else {
                console.warn(`⚠️ Failed to convert date: "${trimmed}"`);
                value = 0;
              }
            } else {
              // Not a date - clean numeric string
              const cleaned = trimmed.replace(/[^0-9.-]/g, "");
              const parsed = parseFloat(cleaned);
              value = isNaN(parsed) ? 0 : parsed;
            }
          }

          dataRow.push(value);
        });

        sheetData.push(dataRow);
      });

      // Initialize HyperFormula with proper configuration
      const hfInstance = HyperFormula.buildEmpty({
        licenseKey: "gpl-v3",
        // Set null date to December 30, 1899 (Excel standard)
        nullDate: { year: 1899, month: 12, day: 30 },
      });

      const sheetName = "CalcSheet";
      hfInstance.addSheet(sheetName);
      const sheetId = hfInstance.getSheetId(sheetName)!;
      hfInstance.setSheetContent(sheetId, sheetData);

      // DEBUG: Test TODAY() function
      console.log("\n🔍 DEBUG: Testing TODAY() function...");
      hfInstance.setCellContents(
        { sheet: sheetId, col: dependencyLabels.length + 1, row: 0 },
        [["=TODAY()"]]
      );
      const todayValue = hfInstance.getCellValue({
        sheet: sheetId,
        col: dependencyLabels.length + 1,
        row: 0,
      });
      console.log(
        `📅 TODAY() returns: ${todayValue} (type: ${typeof todayValue})`
      );

      // Convert today to readable date for verification
      if (typeof todayValue === "number") {
        const todayDate = new Date(1899, 11, 30 + todayValue);
        console.log(
          `📅 TODAY() as date: ${todayDate.toISOString().split("T")[0]}`
        );
      }

      // Pre-process formula (replace field names with column references)
      let processedFormula = formula.trim();
      if (processedFormula.startsWith("=")) {
        processedFormula = processedFormula.substring(1);
      }

      dependencies.forEach((dep, index) => {
        const colLetter = String.fromCharCode(65 + index);
        const regex = new RegExp(`\\b${dep}\\b`, "g");
        processedFormula = processedFormula.replace(regex, `${colLetter}2`);
      });

      console.log(`🧪 Processed formula: ${processedFormula}`);

      // Calculate per row
      bodyFields.forEach((row, rowIndex) => {
        try {
          const rowFormula = processedFormula.replace(
            /([A-Z]+)(\d+)/g,
            (match, col) => `${col}${rowIndex + 2}`
          );

          console.log(`\n📊 Row ${rowIndex}: =${rowFormula}`);

          hfInstance.setCellContents(
            { sheet: sheetId, col: dependencyLabels.length, row: rowIndex + 1 },
            [["=" + rowFormula]]
          );

          const cellValue = hfInstance.getCellValue({
            sheet: sheetId,
            col: dependencyLabels.length,
            row: rowIndex + 1,
          });

          console.log(`   Result: ${cellValue} (type: ${typeof cellValue})`);

          let finalValue: any = cellValue;

          if (typeof cellValue === "number" && !isNaN(cellValue)) {
            switch (format) {
              case "percentage":
                finalValue = Math.round(cellValue * 10000) / 100;
                break;
              case "currency":
                finalValue = Math.round(cellValue * 100) / 100;
                break;
              case "number":
              default:
                finalValue = Math.round(cellValue * 100) / 100;
                break;
            }
          } else if (cellValue instanceof Error) {
            finalValue = "--";
            console.warn(`⚠️ Formula error:`, cellValue.message);
          } else {
            finalValue = "--";
          }

          const displayLabel = calcField.label || field_name;
          row[displayLabel] =
            typeof finalValue === "string"
              ? finalValue.replace(/\u00A0/g, " ").trim()
              : finalValue;

          console.log(`   ✅ Final value: ${finalValue}`);
        } catch (error) {
          const displayLabel = calcField.label || field_name;
          console.error(`❌ Error in row ${rowIndex}:`, error);
          row[displayLabel] = "--";
        }
      });

      console.log(`\n✅ Completed: ${field_name}`);
    });

    return bodyFields;
  } catch (error) {
    console.error("❌ HyperFormula calculation failed:", error);
    return bodyFields;
  }
}
async function stitch(
  setupJson: ReportSetupJson,
  reportStructure: ReportConfigJson,
  dataManager: InMemoryDataManager
): Promise<StitchResult> {
  try {
    // Create field label mapping from setup JSON
    const fieldLabelMap: Record<string, Record<string, string>> = {};
    Object.keys(setupJson.tables).forEach((tableName) => {
      const tableFields = setupJson.tables[tableName]?.fields;
      if (tableFields) {
        fieldLabelMap[tableName] = {};
        Object.keys(tableFields).forEach((fieldName) => {
          fieldLabelMap[tableName][fieldName] = tableFields[fieldName]?.label;
        });
      }
    });

    // Get all required fields from report structure
    const requiredFields: Array<{
      table: string;
      field: string;
      label: string;
    }> = [];

    // Add report columns
    if (reportStructure.report_columns) {
      reportStructure.report_columns.forEach((col) => {
        // ✅ Skip empty/invalid columns
        if (
          !col.table ||
          !col.field ||
          col.table.trim() === "" ||
          col.field.trim() === ""
        ) {
          return; // Skip this entry
        }

        // ✅ NEW: Check if this is a calculated field
        if (
          col.table === "calculated" &&
          reportStructure.custom_calculated_fields
        ) {
          const calcField = reportStructure.custom_calculated_fields.find(
            (cf) => cf.field_name === col.field
          );

          if (calcField) {
            const label = calcField.label || col.field;
            requiredFields.push({
              table: col.table,
              field: col.field,
              label: label, // ✅ Use the label from custom_calculated_fields
            });
            return;
          }
        }

        const label =
          fieldLabelMap[col.table] && fieldLabelMap[col.table][col.field]
            ? fieldLabelMap[col.table][col.field]
            : col.field;

        requiredFields.push({
          table: col.table,
          field: col.field,
          label: label,
        });
      });
    }

    // Add group by fields and their display fields
    if (reportStructure.group_by_fields) {
      Object.keys(reportStructure.group_by_fields).forEach((groupKey) => {
        const group = reportStructure.group_by_fields![groupKey];

        // Add the main group field
        const mainLabel =
          fieldLabelMap[group.table] && fieldLabelMap[group.table][group.field]
            ? fieldLabelMap[group.table][group.field]
            : group.field;
        requiredFields.push({
          table: group.table,
          field: group.field,
          label: mainLabel,
        });

        // Add display fields
        if (group.display && Array.isArray(group.display)) {
          group.display.forEach((displayField) => {
            const displayLabel =
              fieldLabelMap[displayField.table] &&
              fieldLabelMap[displayField.table][displayField.field]
                ? fieldLabelMap[displayField.table][displayField.field]
                : displayField.field;
            requiredFields.push({
              table: displayField.table,
              field: displayField.field,
              label: displayLabel,
            });
          });
        }

        // Add group total fields
        if (group.group_total && Array.isArray(group.group_total)) {
          group.group_total.forEach((totalField) => {
            const totalLabel =
              fieldLabelMap[totalField.table] &&
              fieldLabelMap[totalField.table][totalField.field]
                ? fieldLabelMap[totalField.table][totalField.field]
                : totalField.field;
            requiredFields.push({
              table: totalField.table,
              field: totalField.field,
              label: totalLabel,
            });
          });
        }
      });
    }

    // Remove duplicates
    const uniqueFields = requiredFields.filter(
      (field, index, self) =>
        index ===
        self.findIndex(
          (f) => f.table === field.table && f.field === field.field
        )
    );

    // Build relationship map from report structure
    const relationshipMap: Record<
      string,
      {
        source: string;
        target: string;
        fetchOrder: number;
        tables: string[];
        joinType: string;
      }
    > = {};

    if (reportStructure.db_defination) {
      reportStructure.db_defination.forEach((def) => {
        if (def.joined_table && def.source && def.target) {
          const key = `${def.primary_table}_${def.joined_table}`;
          relationshipMap[key] = {
            source: def.source,
            target: def.target,
            fetchOrder: def.fetch_order,
            tables: [def.primary_table, def.joined_table],
            joinType:
              def.join_type?.toLowerCase() === "left" ? "left" : "inner",
          };
        }
      });
    }

    // Get datasets from dataManager by fetch order
    const datasetsByOrder: Record<number, any[]> = {};
    const fetchOrders = reportStructure.db_defination
      .map((def) => def.fetch_order)
      .sort((a, b) => a - b);

    // Fetch datasets from dataManager
    for (const order of fetchOrders) {
      const dataset = dataManager.getDataset(order);
      if (dataset && Array.isArray(dataset)) {
        datasetsByOrder[order] = dataset.map((record) => ({
          ...record,
          _sourceTable: `fetch_order_${order}`,
          _recordId:
            record.PrimaryKey || record.recordId || `record_${Math.random()}`,
        }));
      }
    }

    // Start with fetch order 1 as base
    let resultData: any[] = [];
    const firstOrder = Math.min(...fetchOrders);

    if (datasetsByOrder[firstOrder]) {
      resultData = datasetsByOrder[firstOrder].map((record) => ({
        ...record,
        _sourceTable: `fetch_order_${firstOrder}`,
        _recordId: record._recordId,
      }));
    }

    // Join with other fetch orders based on relationships
    for (let i = 1; i < fetchOrders.length; i++) {
      const currentOrder = fetchOrders[i];
      if (datasetsByOrder[currentOrder]) {
        const joinDataset = datasetsByOrder[currentOrder];

        // Find the relationship for this order
        let relationship: any = null;
        Object.keys(relationshipMap).forEach((key) => {
          if (relationshipMap[key].fetchOrder === currentOrder) {
            relationship = relationshipMap[key];
          }
        });

        if (relationship) {
          const { source, target, tables, joinType } = relationship;

          // Perform the join
          const newResultData: any[] = [];
          resultData.forEach((baseRecord) => {
            const matchingRecords = joinDataset.filter((joinRecord) => {
              const baseValue = baseRecord[relationship.source];
              const joinValue = joinRecord[relationship.target];
              return (
                baseValue !== undefined &&
                joinValue !== undefined &&
                baseValue.toString() === joinValue.toString()
              );
            });

            if (matchingRecords.length > 0) {
              matchingRecords.forEach((matchRecord) => {
                newResultData.push({
                  ...baseRecord,
                  ...matchRecord,
                  _joinedTable: relationship.tables[1],
                  _joinedRecordId: matchRecord._recordId,
                });
              });
            } else {
              if (joinType === "left") {
                // console.log(joinType === "left" , baseRecord)

                // keep base record (left join)
                newResultData.push(baseRecord);
              }
              // inner join skips unmatched records
            }
          });
          resultData = newResultData;
        }
      }
    }

    // Create final output with proper field labels
    // const bodyFields = resultData.map((record) => {
    //   const outputRecord: Record<string, any> = {};
    //   uniqueFields.forEach((field) => {
    //     if (field.table === "calculated") {
    //       return; // Skip, will be calculated later
    //     }
    //     const value =
    //       record[field.field] !== undefined ? record[field.field] : "--";
    //     outputRecord[field.label] = value;
    //   });
    //   return outputRecord;
    // });
    const bodyFields = resultData.map((record) => {
      const outputRecord: Record<string, any> = {};
      uniqueFields.forEach((field) => {
        // For calculated fields, skip here - they'll be added later
        if (field.table === "calculated") {
          return;
        }

        const value =
          record[field.field] !== undefined ? record[field.field] : "--";
        outputRecord[field.label] = value;
      });
      return outputRecord;
    });

    const bodyFieldsWithCalculations = calculateCustomFields(
      bodyFields,
      reportStructure.custom_calculated_fields || [],
      fieldLabelMap
    );

    const stitchResult: StitchResult = {
      BodyField: bodyFieldsWithCalculations,
    };

    // Save the stitched result
    dataManager.saveResult("report_body_json", stitchResult);

    return stitchResult;
  } catch (error) {
    throw new Error(
      `Data stitching failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function generateReportStructure(
  stitchResult: StitchResult,
  reportStructure: ReportConfigJson,
  setupJson: ReportSetupJson
): any[] {
  try {
    // Create field label mapping from setup JSON
    const fieldLabelMap: Record<string, Record<string, string>> = {};
    const fieldPrefixMap: Record<string, Record<string, string>> = {};
    const fieldSuffixMap: Record<string, Record<string, string>> = {};

    Object.keys(setupJson.tables || {}).forEach((tableName) => {
      const table = setupJson.tables?.[tableName];
      const tableFields = table?.fields;

      if (table && tableFields) {
        fieldLabelMap[tableName] = {};
        fieldPrefixMap[tableName] = {};
        fieldSuffixMap[tableName] = {};

        Object.keys(tableFields).forEach((fieldName) => {
          const field = tableFields[fieldName];
          if (field) {
            fieldLabelMap[tableName][fieldName] = field.label || fieldName;
            if (field.prefix) {
              fieldPrefixMap[tableName][fieldName] = field.prefix;
            }
            if (field.suffix) {
              fieldSuffixMap[tableName][fieldName] = field.suffix;
            }
          }
        });
      }
    });

    // Helper function to get label for a field
    // In generateReportStructure function, update the getFieldLabel helper:
    function getFieldLabel(table: string, field: string): string {
      // Handle calculated fields
      if (table === "calculated") {
        const calcField = reportStructure.custom_calculated_fields?.find(
          (cf) => cf.field_name === field
        );
        return calcField?.label || field;
      }

      return fieldLabelMap[table]?.[field] || field;
    }

    // Helper function to get prefix for a field label
    function getFieldPrefix(fieldLabel: string): string | null {
      for (const tableName in fieldPrefixMap) {
        const tableFields = fieldPrefixMap[tableName];
        if (tableFields) {
          for (const fieldName in tableFields) {
            if (fieldLabelMap[tableName]?.[fieldName] === fieldLabel) {
              return tableFields[fieldName];
            }
          }
        }
      }
      return null;
    }

    // Helper function to get suffix for a field label
    function getFieldSuffix(fieldLabel: string): string | null {
      for (const tableName in fieldSuffixMap) {
        const tableFields = fieldSuffixMap[tableName];
        if (tableFields) {
          for (const fieldName in tableFields) {
            if (fieldLabelMap[tableName]?.[fieldName] === fieldLabel) {
              return tableFields[fieldName];
            }
          }
        }
      }
      return null;
    }

    // Get BodyFieldOrder from report_columns (using labels)
    // const bodyFieldOrder = reportStructure.report_columns
    //   ? reportStructure.report_columns.map((col) =>
    //       getFieldLabel(col.table, col.field)
    //     )
    //   : [];

    // In generateReportStructure function, update the bodyFieldOrder section:
    const bodyFieldOrder: string[] = [];

    if (reportStructure.report_columns) {
      reportStructure.report_columns.forEach((col) => {
        // Skip if table/field is empty
        if (!col.table || !col.field) return;

        const label = getFieldLabel(col.table, col.field);

        // Don't add duplicates
        if (!bodyFieldOrder.includes(label)) {
          bodyFieldOrder.push(label);
        }
      });
    }

    // IMPORTANT: Make sure group by fields are NOT automatically excluded here
    // They should only be excluded if they appear in excludeLabelsSet

    // if (reportStructure.custom_calculated_fields) {
    //   reportStructure.custom_calculated_fields.forEach((calcField) => {
    //     // Only add if not already in bodyFieldOrder
    //     if (!bodyFieldOrder.includes(calcField.field_name)) {
    //       bodyFieldOrder.push(calcField.field_name);
    //     }
    //   });
    // }
    if (reportStructure.custom_calculated_fields) {
      reportStructure.custom_calculated_fields.forEach((calcField) => {
        const displayLabel = calcField.label || calcField.field_name;
        if (!bodyFieldOrder.includes(displayLabel)) {
          bodyFieldOrder.push(displayLabel);
        }
      });
    }

    const result: any[] = [];

    // 1. TitleHeader
    result.push({
      TitleHeader: {
        MainHeading: reportStructure.report_header || "Report",
        SubHeading: "Kibizsystems.com",
      },
    });

    // 2. Subsummary - Handle multiple group_by_fields
    const excludeLabelsSet = new Set<string>();
    if (reportStructure.group_by_fields) {
      Object.keys(reportStructure.group_by_fields).forEach((groupKey) => {
        const group = reportStructure.group_by_fields?.[groupKey];
        if (group) {
          // Get the label for the main field
          const mainFieldLabel = getFieldLabel(group.table, group.field);
          excludeLabelsSet.add(mainFieldLabel);

          // Get display field labels
          const displayLabels: string[] = [];
          if (group.display && Array.isArray(group.display)) {
            group.display.forEach((displayField) => {
              const displayLabel = getFieldLabel(
                displayField.table,
                displayField.field
              );
              excludeLabelsSet.add(displayLabel);
              displayLabels.push(displayLabel);
            });
          }

          // Get subsummary total fields (use labels)
          const subsummaryTotal: string[] = [];
          if (group.group_total && Array.isArray(group.group_total)) {
            group.group_total.forEach((totalField) => {
              const totalLabel = getFieldLabel(
                totalField.table,
                totalField.field
              );
              subsummaryTotal.push(totalLabel);
            });
          }

          result.push({
            Subsummary: {
              Sorting: [mainFieldLabel],
              SubsummaryFields: [mainFieldLabel],
              SubsummaryTotal: subsummaryTotal,
              SubsummaryDisplay: displayLabels,
            },
          });
        }
      });
    }

    // 3. Body
    // Filter out fields used in subsummary and subsummary display
    const filteredBodyFields = bodyFieldOrder.filter(
      (label) => !excludeLabelsSet.has(label)
    );

    // console.log("Excluded labels:", Array.from(excludeLabelsSet));
    // console.log("Filtered body fields:", filteredBodyFields);
    // console.log("Body field order (full):", bodyFieldOrder);
    // console.log(
    //   "Looking for sort field:",
    //   reportStructure.body_sort_order?.[0]?.field
    // );

    // Get BodySortOrder from body_sort_order in reportStructure (using labels)
    // const bodySortOrder: Array<{ Column: string; Order: string }> = [];
    // if (reportStructure.body_sort_order) {
    //   reportStructure.body_sort_order.forEach((sortItem: any) => {
    //     // Find the field label by matching the sort field name with setup labels
    //     let fieldLabel: string | null = null;

    //     Object.keys(setupJson.tables || {}).forEach((tableName) => {
    //       const table = setupJson.tables?.[tableName];
    //       const tableFields = table?.fields;

    //       if (table && tableFields) {
    //         Object.keys(tableFields).forEach((fieldName) => {
    //           const field = tableFields[fieldName];
    //           if (field && field.label === sortItem.field) {
    //             fieldLabel = sortItem.field;
    //           }
    //         });
    //       }
    //     });

    //     // If not found by label, try to find by field name in report columns
    //     if (!fieldLabel) {
    //       const reportCol = reportStructure.report_columns?.find(
    //         (col) => col.field === sortItem.field
    //       );
    //       if (reportCol) {
    //         fieldLabel = getFieldLabel(reportCol.table, reportCol.field);
    //       }
    //     }

    //     if (fieldLabel && !excludeLabelsSet.has(fieldLabel)) {
    //       bodySortOrder.push({
    //         Column: fieldLabel,
    //         Order: sortItem.sort_order === "asc" ? "Asc" : "Desc",
    //       });
    //     }
    //   });
    // }
    // In generateReportStructure function, update the bodySortOrder section:
    // In generateReportStructure function, update the bodySortOrder section:
    const bodySortOrder: Array<{ Column: string; Order: string }> = [];
    if (reportStructure.body_sort_order) {
      reportStructure.body_sort_order.forEach((sortItem: any) => {
        let fieldLabel: string | null = null;

        // First, try to find the field in report_columns to get the table
        if (reportStructure.report_columns) {
          const reportCol = reportStructure.report_columns.find(
            (col) => col.field === sortItem.field
          );

          if (reportCol) {
            // Use getFieldLabel to get the proper label
            fieldLabel = getFieldLabel(reportCol.table, reportCol.field);
          }
        }

        // If not found in report_columns, check calculated fields
        if (!fieldLabel && reportStructure.custom_calculated_fields) {
          const calcField = reportStructure.custom_calculated_fields.find(
            (cf) => cf.field_name === sortItem.field
          );
          if (calcField) {
            fieldLabel = calcField.label || calcField.field_name;
          }
        }

        // If still not found, try to find by field name in setup JSON
        if (!fieldLabel) {
          Object.keys(setupJson.tables || {}).forEach((tableName) => {
            const table = setupJson.tables?.[tableName];
            const tableFields = table?.fields;

            if (table && tableFields) {
              // Check if this field exists in this table
              if (tableFields[sortItem.field]) {
                // Get the label from the field definition
                fieldLabel =
                  tableFields[sortItem.field]?.label || sortItem.field;
              }
            }
          });
        }

        // Last resort: use the field name as-is
        if (!fieldLabel) {
          fieldLabel = sortItem.field;
        }

        // Check if this field is in the filtered body fields
        if (fieldLabel && filteredBodyFields.includes(fieldLabel)) {
          bodySortOrder.push({
            Column: fieldLabel,
            Order: sortItem.sort_order === "asc" ? "Asc" : "Desc",
          });
        } else {
          console.warn(
            `⚠️ Sort field "${sortItem.field}" (label: "${fieldLabel}") not found in body fields`
          );
        }
      });
    }

    // Build FieldPrefix and FieldSuffix objects for body fields
    const fieldPrefix: Record<string, string> = {};
    const fieldSuffix: Record<string, string> = {};
    filteredBodyFields.forEach((fieldLabel) => {
      const prefix = getFieldPrefix(fieldLabel);
      const suffix = getFieldSuffix(fieldLabel);
      if (prefix) {
        fieldPrefix[fieldLabel] = prefix;
      }
      if (suffix) {
        fieldSuffix[fieldLabel] = suffix;
      }
    });
    if (reportStructure.custom_calculated_fields) {
      reportStructure.custom_calculated_fields.forEach((calcField) => {
        const displayLabel = calcField.label || calcField.field_name;

        if (filteredBodyFields.includes(displayLabel)) {
          const { format } = calcField;

          switch (format) {
            case "currency":
              fieldPrefix[displayLabel] = "$";
              break;
            case "percentage":
              fieldSuffix[displayLabel] = "%";
              break;
            case "number":
              // No prefix/suffix for plain numbers
              break;
            default:
              break;
          }
        }
      });
    }
    const bodySection = {
      Body: {
        BodyField: stitchResult.BodyField,
        BodyFieldOrder: filteredBodyFields,
        BodySortOrder: bodySortOrder,
        FieldPrefix: fieldPrefix,
        FieldSuffix: fieldSuffix,
        Sorting: [] as string[],
      },
    };

    // Set Sorting from Subsummary.Sorting (if still applicable)
    if (reportStructure.group_by_fields) {
      Object.keys(reportStructure.group_by_fields).forEach((groupKey) => {
        const group = reportStructure.group_by_fields?.[groupKey];
        if (group) {
          const mainFieldLabel = getFieldLabel(group.table, group.field);
          if (filteredBodyFields.includes(mainFieldLabel)) {
            bodySection.Body.Sorting.push(mainFieldLabel);
          }
        }
      });
    }

    result.push(bodySection);

    // 4. TrailingGrandSummary
    const trailingGrandSummary: string[] = [];
    if (reportStructure.summary_fields) {
      reportStructure.summary_fields.forEach((summaryField: any) => {
        // Find the field label by matching the summary field name with setup labels
        let fieldLabel: string | null = null;

        Object.keys(setupJson.tables || {}).forEach((tableName) => {
          const table = setupJson.tables?.[tableName];
          const tableFields = table?.fields;

          if (table && tableFields) {
            Object.keys(tableFields).forEach((fieldName) => {
              const field = tableFields[fieldName];
              if (field && field.label === summaryField) {
                fieldLabel = summaryField;
              }
            });
          }
        });

        // If not found by label, try to find by field name in report columns
        if (!fieldLabel) {
          const reportCol = reportStructure.report_columns?.find(
            (col) => col.field === summaryField
          );
          if (reportCol) {
            fieldLabel = getFieldLabel(reportCol.table, reportCol.field);
          }
        }

        if (fieldLabel) {
          trailingGrandSummary.push(fieldLabel);
        }
      });
    }

    result.push({
      TrailingGrandSummary: {
        TrailingGrandSummary: trailingGrandSummary,
      },
    });

    return result;
  } catch (error) {
    throw new Error(
      `Report structure generation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Main API Handler

// 🟩 Added at the very top of the file
// ✅ Minimal & correct OPTIONS handler (no body, correct status)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export const maxDuration =300 ;

export async function POST(req: NextRequest) {
  const dataManager = new InMemoryDataManager();

  try {
    const body = await req.json();

    const { report_setup, report_config } = body;

    if (!report_setup || !report_config) {
      return NextResponse.json(
        {
          status: "error",
          detail: "Both report_setup and report_config are required",
          nextJSError: "Missing required fields: report_setup, report_config",
        },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    let setupJson: ReportSetupJson;
    let configJson: ReportConfigJson;

    try {
      setupJson =
        typeof report_setup === "string"
          ? JSON.parse(report_setup)
          : report_setup;
      configJson =
        typeof report_config === "string"
          ? JSON.parse(report_config)
          : report_config;
    } catch (error) {
      return NextResponse.json(
        {
          status: "error",
          detail: "Invalid JSON format in request body",
          nextJSError:
            error instanceof Error ? error.message : "JSON parsing failed",
        },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // validate schemas
    const setupValidation = reportSetupSchema.safeParse(setupJson);
    if (!setupValidation.success) {
      return NextResponse.json(
        {
          status: "error",
          detail: "Invalid report_setup structure",
          nextJSError: setupValidation.error.issues,
        },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const configValidation = reportConfigSchema.safeParse(configJson);
    if (!configValidation.success) {
      return NextResponse.json(
        {
          status: "error",
          detail: "Invalid report_config structure",
          nextJSError: configValidation.error.issues,
        },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Initialize data manager
    dataManager.clearAll();
    dataManager.addLog("Data manager initialized and cleared");

    // Sort and process fetch orders
    const sortedFetchDefs = [...configJson.db_defination].sort(
      (a, b) => a.fetch_order - b.fetch_order
    );

    let currentDataset: any[] = [];

    for (let i = 0; i < sortedFetchDefs.length; i++) {
      const fetchDef = sortedFetchDefs[i];

      const result = await processFetchOrder(
        fetchDef,
        setupJson,
        configJson,
        dataManager,
        currentDataset
      );

      currentDataset = result.data;

      if (i < sortedFetchDefs.length - 1) {
        const nextFetchDef = sortedFetchDefs[i + 1];
        if (nextFetchDef.source && currentDataset.length > 0) {
          const nextPkeys = extractPkeysFromData(
            currentDataset,
            nextFetchDef.source
          );
          dataManager.storePkeys(nextFetchDef.fetch_order, nextPkeys);
          dataManager.addLog(
            `Extracted ${nextPkeys.length} pkeys for next fetch order`
          );

          if (nextPkeys.length === 0) {
            dataManager.addLog(`Warning: No pkeys found for next fetch order`);
          }
        }
      }
    }

    dataManager.addLog("✅ All fetch orders completed successfully!");

    const stitchResult = await stitch(setupJson, configJson, dataManager);
    dataManager.addLog("✅ Data stitching completed successfully!");

    const reportStructureJson = generateReportStructure(
      stitchResult,
      configJson,
      setupJson
    );
    dataManager.addLog(
      "✅ Report structure generation completed successfully!"
    );
    dataManager.saveResult("report_structure_json", reportStructureJson);

    return NextResponse.json(
      {
        status: "ok",
        report_structure_json: reportStructureJson,
        // stitch_result: stitchResult,
        processing_logs: dataManager.getLogs(),
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    dataManager.addLog(`❌ Process failed: ${errorMessage}`);

    return NextResponse.json(
      {
        status: "error",
        detail: errorMessage,
        nextJSError: error instanceof Error ? error : "Unknown server error",
        processing_logs: dataManager.getLogs(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
