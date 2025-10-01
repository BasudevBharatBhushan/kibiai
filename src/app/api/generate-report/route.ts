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

interface ReportConfigJson {
  db_defination: Array<{
    primary_table: string;
    joined_table?: string;
    source?: string;
    target?: string;
    fetch_order: number;
    join_type?:"left" | "inner" | "";
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
      joined_table: z.string(),
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


      if(!table){
      return []
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
      pKeyField = source;
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
        joinType:string
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
            joinType: def.join_type?.toLowerCase() === "left" ? "left" : "inner"
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
    const bodyFields = resultData.map((record) => {
      const outputRecord: Record<string, any> = {};
      uniqueFields.forEach((field) => {
        const value =
          record[field.field] !== undefined ? record[field.field] : "--";
        outputRecord[field.label] = value;
      });
      return outputRecord;
    });

    const stitchResult: StitchResult = {
      BodyField: bodyFields,
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
    function getFieldLabel(table: string, field: string): string {
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
    const bodyFieldOrder = reportStructure.report_columns
      ? reportStructure.report_columns.map((col) =>
          getFieldLabel(col.table, col.field)
        )
      : [];

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

    // Get BodySortOrder from body_sort_order in reportStructure (using labels)
    const bodySortOrder: Array<{ Column: string; Order: string }> = [];
    if (reportStructure.body_sort_order) {
      reportStructure.body_sort_order.forEach((sortItem: any) => {
        // Find the field label by matching the sort field name with setup labels
        let fieldLabel: string | null = null;

        Object.keys(setupJson.tables || {}).forEach((tableName) => {
          const table = setupJson.tables?.[tableName];
          const tableFields = table?.fields;

          if (table && tableFields) {
            Object.keys(tableFields).forEach((fieldName) => {
              const field = tableFields[fieldName];
              if (field && field.label === sortItem.field) {
                fieldLabel = sortItem.field;
              }
            });
          }
        });

        // If not found by label, try to find by field name in report columns
        if (!fieldLabel) {
          const reportCol = reportStructure.report_columns?.find(
            (col) => col.field === sortItem.field
          );
          if (reportCol) {
            fieldLabel = getFieldLabel(reportCol.table, reportCol.field);
          }
        }

        if (fieldLabel && !excludeLabelsSet.has(fieldLabel)) {
          bodySortOrder.push({
            Column: fieldLabel,
            Order: sortItem.sort_order === "asc" ? "Asc" : "Desc",
          });
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
        { status: 400 }
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
        { status: 400 }
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
        { status: 400 }
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
        { status: 400 }
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
      { status: 200 }
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
      { status: 500 }
    );
  }
}
