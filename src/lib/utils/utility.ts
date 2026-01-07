// Utility functions for handling FileMaker records and OData batch responses
import { InMemoryDataManager } from "@/lib/data/DataManager";
import {
  ReportSetupJson,
  ReportConfigJson,
  FetchOrderDataset,
  StitchResult,
  ApiResponse,
  reportSetupSchema,
  reportConfigSchema,
} from "@/lib/types/types";

interface FileMakerRecord {
  fieldData: Record<string, any>;
  portalData: Record<string, any>;
  recordId: string;
  modId: string;
}

interface FlattenedRecord extends Record<string, any> {
  recordId: string;
}

import { NextRequest } from "next/server";

export interface FetchFmDataRequest {
  raw_dataset?: any;
  p_key_field?: string;
  p_keys?: string[];
  filter?: Record<string, string>;
  table: string;
  host: string;
  database: string;
  version: string;
  data_fetching_protocol: string;
  session_token?: string;
}

export function flattenFileMakerRecords(
  records: FileMakerRecord[]
): FlattenedRecord[] {
  return records.map((record) => ({
    ...record.fieldData,
    recordId: record.recordId,
  }));
}

export function parseODataBatchResponse(response: string): {
  records: any[];
  recordCount: number;
} {
  // Extract boundary from the response (looks for --b_ pattern)
  const boundaryMatch = response.match(/--b_[^\n\r]+/);
  if (!boundaryMatch) {
    throw new Error("No boundary found in response");
  }

  // console.log(response);

  const boundary = boundaryMatch[0];

  // Split response by boundary
  const parts = response.split(boundary);

  // Array to store all flattened records
  const results = [];
  let recordCount = 0;

  // Process each part
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Find JSON block (content between first { and last })
    const startPos = part.indexOf("{");
    const lastBracePos = part.lastIndexOf("}");

    if (startPos === -1 || lastBracePos === -1 || startPos >= lastBracePos) {
      continue; // Skip parts without valid JSON
    }

    const jsonBlock = part.substring(startPos, lastBracePos + 1);

    try {
      // Clean the JSON block by replacing invalid '?' values with null
      // This handles cases where '?' appears as a value (e.g., "QtyAvailable": ?)
      const cleanedJsonBlock = jsonBlock.replace(
        /:\s*\?(?=\s*[,}])/g,
        ": null"
      );

      // Parse the cleaned JSON block
      const parsedJson = JSON.parse(cleanedJsonBlock);

      // Extract the "value" array if it exists
      if (parsedJson.value && Array.isArray(parsedJson.value)) {
        // Add all records from this part's "value" array to results
        results.push(...parsedJson.value);
      }
      recordCount++;
    } catch (error: any) {
      // Skip invalid JSON blocks
      console.warn("Invalid JSON block found, skipping:", error.message);
      continue;
    }
  }

  let result: any = {};
  result.json = { records: results, recordCount };
  return result.json;
}

function convertOperator(value: string, key: string) {
  if (value.includes("...")) {
    const [d1, d2] = value.split("...").map((v) => v.trim());
    return `ge '${d1}' and ${key} le '${d2}'`;
  }
  if (value.startsWith(">=")) return `ge ${value.slice(2).trim()}`;
  if (value.startsWith(">")) return `gt ${value.slice(1).trim()}`;
  if (value.startsWith("<=")) return `le ${value.slice(2).trim()}`;
  if (value.startsWith("<")) return `lt ${value.slice(1).trim()}`;
  if (value.startsWith("==")) return `eq ${value.slice(2).trim()}`;
  if (value.startsWith("=")) return `eq ${value.slice(1).trim()}`;
  if (value === "*") return `ne null`;
  if (value === "") return `eq null`;
  return `contains(${key},'${value.trim()}')`;
}

export async function fetchFmRecord(
  reqBody: FetchFmDataRequest,
  basic_token: string
) {
  const {
    p_key_field,
    p_keys,
    filter,
    table,
    host,
    database,
    version,
    data_fetching_protocol,
    session_token,
  } = reqBody;

  // console.log(reqBody);
  // --- ODATA API Flow ---
  if (
    data_fetching_protocol === "odataapi" ||
    data_fetching_protocol === "o-data-api"
  ) {
    const batchBoundary = `b_${crypto.randomUUID()}`;
    let batchBody = "";

    if (p_keys && p_keys.length > 0) {
      if (!p_key_field)
        throw new Error("p_key_field is required when p_keys are provided");

      p_keys.forEach((pk, index) => {
        const queryParts: string[] = [];

        if (filter) {
          for (const key in filter) {
            const val = filter[key];
            queryParts.push(`${key} ${convertOperator(val, key)}`);
          }
        }
        queryParts.push(`${p_key_field} eq '${pk}'`);

        const filterQuery = queryParts.join(" and ");

        batchBody +=
          `--${batchBoundary}\n` +
          `Content-Type: application/http\n` +
          `Content-ID: ${index + 1}\n\n` +
          `GET /fmi/odata/${version}/${database}/${table}?filter=${filterQuery} HTTP/1.1\n` +
          `Content-Length: 0\n\n\n`;
      });
      batchBody += `--${batchBoundary}--`;
    } else {
      const queryParts: string[] = [];
      if (filter) {
        for (const key in filter) {
          const val = filter[key];
          queryParts.push(`${key} ${convertOperator(val, key)}`);
        }
      }
      const filterQuery = queryParts.length
        ? `?filter=${queryParts.join(" and ")}`
        : "";

      batchBody =
        `--${batchBoundary}\n` +
        `Content-Type: application/http\n` +
        `Content-ID: 1\n\n` +
        `GET /fmi/odata/${version}/${database}/${table}${filterQuery} HTTP/1.1\n` +
        `Content-Length: 0\n\n\n` +
        `--${batchBoundary}--`;
    }

    const odataUrl = `https://${host}/fmi/odata/${version}/${database}/$batch`;

    const odataRes = await fetch(odataUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic_token}`,
        "Content-Type": `multipart/mixed; boundary=${batchBoundary}`,
      },
      body: batchBody,
    });

    if (!odataRes.ok)
      throw new Error(`Failed to fetch data via OData: ${odataRes.status}`);

    const odataData = await odataRes.text();
    const parsedData = parseODataBatchResponse(odataData);

    return {
      data: parsedData.records,
      recordCount: parsedData.recordCount,
    };
  }

  // --- DATA API Flow ---
  if (
    data_fetching_protocol !== "dataapi" &&
    data_fetching_protocol !== "data-api"
  ) {
    throw new Error("Unsupported protocol");
  }

  let token = session_token;

  // Step 1: Validate token
  let isTokenValid = false;
  if (token) {
    const validateUrl = `https://${host}/fmi/data/${version}/validateSession`;
    const validateRes = await fetch(validateUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    isTokenValid = validateRes.ok;
  }

  // Step 2: Login if token is invalid or missing
  if (!isTokenValid) {
    const loginUrl = `https://${host}/fmi/data/${version}/databases/${database}/sessions`;
    const loginRes = await fetch(loginUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!loginRes.ok)
      throw new Error("Failed to authenticate with FileMaker Data API");

    const loginData = await loginRes.json();
    token = loginData.response.token;
  }

  // console.log("Using token:", token);
  // console.log(filter);

  // Step 3: Prepare find or get request
  let fetchUrl = `https://${host}/fmi/data/${version}/databases/${database}/layouts/${table}/records?_offset=1&_limit=5000`;
  let method = "GET";
  let body: any = undefined;

  if (
    (filter && Object.keys(filter).length > 0) ||
    (p_keys && p_keys.length > 0)
  ) {
    fetchUrl = `https://${host}/fmi/data/${version}/databases/${database}/layouts/${table}/_find`;
    method = "POST";

    if (p_keys && p_keys.length > 0) {
      if (!p_key_field)
        throw new Error("p_key_field is required when p_keys are provided");
      const queries = p_keys.map((pk) => ({
        [p_key_field]: pk,
        ...(filter || {}),
      }));
      body = JSON.stringify({ query: queries, offset: 1, limit: 5000 });
    } else {
      body = JSON.stringify({
        query: [filter || {}],
        offset: 1,
        limit: 5000,
      });
    }
  }
  // console.log("Fetch URL:", fetchUrl);
  // Step 4: Fetch data
  const dataRes = await fetch(fetchUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body } : {}),
  });

  if (!dataRes.ok)
    throw new Error(`Failed to fetch data from FileMaker: ${dataRes.status}`);

  // console.log(body);

  const data = await dataRes.json();

  // Step 5: Extract the fieldData and put in a flat array
  const FlattenedRecord = data.response
    ? flattenFileMakerRecords(data.response.data)
    : [];

  return {
    token,
    data: FlattenedRecord,
    recordCount: data.response?.dataInfo?.foundCount || 0,
  };
}

export function extractPkeysFromData(
  data: any[],
  sourceField: string
): string[] {
  const pkeys = data
    .map((record) => record[sourceField])
    .filter((key) => key != null && key !== "")
    .map((key) => String(key));

  return [...new Set(pkeys)];
}

export async function stitch(
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

    // Collect all required fields
    const requiredFields: Array<{
      table: string;
      field: string;
      label: string;
    }> = [];

    // Report columns
    if (reportStructure.report_columns) {
      reportStructure.report_columns.forEach((col) => {
        const label = fieldLabelMap[col.table]?.[col.field] ?? col.field;
        requiredFields.push({ table: col.table, field: col.field, label });
      });
    }

    // Group by fields
    if (reportStructure.group_by_fields) {
      Object.keys(reportStructure.group_by_fields).forEach((groupKey) => {
        const group = reportStructure.group_by_fields![groupKey];

        const mainLabel =
          fieldLabelMap[group.table]?.[group.field] ?? group.field;
        requiredFields.push({
          table: group.table,
          field: group.field,
          label: mainLabel,
        });

        if (group.display) {
          group.display.forEach((displayField) => {
            const displayLabel =
              fieldLabelMap[displayField.table]?.[displayField.field] ??
              displayField.field;
            requiredFields.push({
              table: displayField.table,
              field: displayField.field,
              label: displayLabel,
            });
          });
        }

        if (group.group_total) {
          group.group_total.forEach((totalField) => {
            const totalLabel =
              fieldLabelMap[totalField.table]?.[totalField.field] ??
              totalField.field;
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

    // Relationship map
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

    // Fetch datasets
    const datasetsByOrder: Record<number, any[]> = {};
    const fetchOrders = reportStructure.db_defination
      .map((def) => def.fetch_order)
      .sort((a, b) => a - b);

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

    // Base dataset
    let resultData: any[] = [];
    const firstOrder = Math.min(...fetchOrders);
    if (datasetsByOrder[firstOrder]) {
      resultData = datasetsByOrder[firstOrder].map((record) => ({
        ...record,
        _sourceTable: `fetch_order_${firstOrder}`,
        _recordId: record._recordId,
      }));
    }

    // Perform joins
    for (let i = 1; i < fetchOrders.length; i++) {
      const currentOrder = fetchOrders[i];
      if (datasetsByOrder[currentOrder]) {
        const joinDataset = datasetsByOrder[currentOrder];

        // Find relationship
        let relationship: any = null;
        Object.keys(relationshipMap).forEach((key) => {
          if (relationshipMap[key].fetchOrder === currentOrder) {
            relationship = relationshipMap[key];
          }
        });

        if (relationship) {
          const { source, target, tables, joinType } = relationship;

          const newResultData: any[] = [];
          resultData.forEach((baseRecord) => {
            const matchingRecords = joinDataset.filter((joinRecord) => {
              const baseValue = baseRecord[source];
              const joinValue = joinRecord[target];
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
                  _joinedTable: tables[1],
                  _joinedRecordId: matchRecord._recordId,
                });
              });
            } else {
              if (joinType === "left") {
                // keep base record (left join)
                newResultData.push(baseRecord);
              }
              // console.log('inner - joining')
              // inner join skips unmatched records
            }
          });

          resultData = newResultData;
        }
      }
    }

    // Final output
    const bodyFields = resultData.map((record) => {
      const outputRecord: Record<string, any> = {};
      uniqueFields.forEach((field) => {
        const value =
          record[field.field] !== undefined ? record[field.field] : "--";
        outputRecord[field.label] = value;
      });
      return outputRecord;
    });

    const stitchResult: StitchResult = { BodyField: bodyFields };
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

export async function processFetchOrder(
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

export function buildFilters(
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

export function generateReportStructure(
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

export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function parseBasicAuth(header?: string | null) {
  if (!header || !header.startsWith("Basic ")) return null;
  const base64 = header.split(" ")[1];
  try {
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return null;
    return {
      username: decoded.slice(0, idx),
      password: decoded.slice(idx + 1),
    };
  } catch {
    return null;
  }
}

export function requireEnv(name: string) {
  console.log(`Requiring env: ${name}`);
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function newLicenseId() {
  // Short, human-friendly ID. Adjust as needed.
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `LIC-${rnd}`;
}

export function nowISO() {
  return new Date().toISOString();
}
