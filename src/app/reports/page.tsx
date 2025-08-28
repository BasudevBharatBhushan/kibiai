"use client";
import React, { useState } from "react";
import DynamicReport from "../../components/DynamicReport";
//Import the CSS
import "./reports.css";

interface ReportSetupJson {
  host?: string; // from old
  data_fetching_protocol?: string; // from old
  tables: Record<
    string,
    {
      file: string;
      username: string;
      password: string;
      layout?: string | null; // optional for new compatibility
      fields?: Record<
        string,
        {
          label: string;
          prefix?: string;
          suffix?: string;
        }
      >;
    }
  >; // merged: old had any, new has defined fields
  relationships?: Array<{
    primary_table: string;
    joined_table: string;
    source?: string; // optional for new compatibility
    target?: string; // optional for new compatibility
  }>;
}
interface ReportConfigJson {
  db_defination: Array<{
    primary_table: string;
    joined_table: string;
    source?: string; // optional for new
    target?: string; // optional for new
    fetch_order: number;
  }>;
  report_columns?: Array<{
    table: string;
    field: string;
  }>; // from new (optional to avoid breaking old)
  group_by_fields?: Record<
    string,
    {
      table: string;
      field: string;
      display?: Array<{ table: string; field: string }>;
      group_total?: Array<{ table: string; field: string }>;
    }
  >; // from new
  date_range_fields?: Record<string, Record<string, string>>; // from old
  filters?: Record<string, Record<string, any>>; // from old
  [key: string]: any; // to allow future extensions (from old)
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

interface FetchStatus {
  order: number;
  table: string;
  status: "pending" | "fetching" | "success" | "error";
  recordCount?: number;
  error?: string;
}

class IndexedDBManager {
  private dbName = "ReportDataDB";
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores for datasets and pkeys
        if (!db.objectStoreNames.contains("datasets")) {
          db.createObjectStore("datasets", { keyPath: "fetch_order" });
        }
        if (!db.objectStoreNames.contains("pkeys")) {
          db.createObjectStore("pkeys", { keyPath: "fetch_order" });
        }
        // Create results store separately
        if (!db.objectStoreNames.contains("results")) {
          db.createObjectStore("results", { keyPath: "result_type" });
        }
      };
    });
  }

  async storeDataset(fetchOrder: number, data: any[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction(["datasets"], "readwrite");
    const store = transaction.objectStore("datasets");

    return new Promise((resolve, reject) => {
      const request = store.put({ fetch_order: fetchOrder, data });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async storePkeys(fetchOrder: number, pkeys: string[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction(["pkeys"], "readwrite");
    const store = transaction.objectStore("pkeys");

    return new Promise((resolve, reject) => {
      const request = store.put({ fetch_order: fetchOrder, pkeys });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getDataset(fetchOrder: number): Promise<any[] | null> {
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction(["datasets"], "readonly");
    const store = transaction.objectStore("datasets");

    return new Promise((resolve, reject) => {
      const request = store.get(fetchOrder);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.data || null);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction(["datasets", "pkeys"], "readwrite");

    return new Promise((resolve, reject) => {
      let completed = 0;
      const complete = () => {
        completed++;
        if (completed === 2) resolve();
      };

      const datasetsRequest = transaction.objectStore("datasets").clear();
      const pkeysRequest = transaction.objectStore("pkeys").clear();

      datasetsRequest.onerror = pkeysRequest.onerror = () =>
        reject(new Error("Clear failed"));
      datasetsRequest.onsuccess = pkeysRequest.onsuccess = complete;
    });
  }

  async saveStitchResult(
    dbManager: IndexedDBManager,
    stitchResult: any,
    resultType: string = "report_body_json"
  ): Promise<void> {
    if (!dbManager.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = dbManager.db!.transaction(["results"], "readwrite");
      const store = transaction.objectStore("results");

      // Handle transaction errors
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error("Transaction aborted"));

      const request = store.put({
        result_type: resultType,
        data: stitchResult,
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // console.log("Stitch result saved to IndexedDB");
        resolve();
      };
    });
  }
}

const ReportDataFetcher: React.FC = () => {
  const [reportSetup, setReportSetup] = useState<string>("");
  const [reportConfig, setReportConfig] = useState<string>("");
  const [fetchStatuses, setFetchStatuses] = useState<FetchStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dbManager] = useState(() => new IndexedDBManager());
  const [logs, setLogs] = useState<string[]>([]);
  const [reportStructuredData, setReportStructuredData] = useState<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const updateFetchStatus = (order: number, updates: Partial<FetchStatus>) => {
    setFetchStatuses((prev) =>
      prev.map((status) =>
        status.order === order ? { ...status, ...updates } : status
      )
    );
  };

  const buildFilters = (
    table: string,
    configFilters?: Record<string, Record<string, any>>,
    dateRangeFields?: Record<string, Record<string, string>>
  ) => {
    const filters: Record<string, any> = {};

    // Add table-specific filters
    if (configFilters && configFilters[table]) {
      Object.assign(filters, configFilters[table]);
    }

    // Add date range filters
    if (dateRangeFields && dateRangeFields[table]) {
      Object.assign(filters, dateRangeFields[table]);
    }

    return Object.keys(filters).length > 0 ? filters : {};
  };

  const extractPkeysFromData = (data: any[], sourceField: string): string[] => {
    const pkeys = data
      .map((record) => record[sourceField])
      .filter((key) => key != null && key !== "")
      .map((key) => String(key));

    // Return unique pkeys
    return [...new Set(pkeys)];
  };

  const fetchDataFromAPI = async (
    table: string,
    setupJson: ReportSetupJson,
    filters: Record<string, any>,
    pKeyField?: string,
    pKeys?: string[]
  ): Promise<any[]> => {
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
      p_keys: pKeys ?? [],
      filter: filters,
      table: isDataApi ? tableConfig.layout ?? table : table,
      host: setupJson.host,
      database: tableConfig.file,
      version: isDataApi ? "vLatest" : "v4",
      data_fetching_protocol: setupJson.data_fetching_protocol,
      ...(isDataApi && { session_token: "" }),
    };

    addLog(
      `Fetching data from table: ${table} with ${pKeys?.length || 0} pkeys`
    );

    const response = await fetch("/api/filemaker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(
          `${tableConfig.username}:${tableConfig.password}`
        )}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `API call failed: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return result.data || [];
  };

  const processFetchOrder = async (
    fetchDef: ReportConfigJson["db_defination"][0],
    setupJson: ReportSetupJson,
    configJson: ReportConfigJson,
    previousDataset?: any[]
  ): Promise<{ data: any[]; nextPkeys: string[] }> => {
    const { fetch_order, primary_table, joined_table, source, target } =
      fetchDef;

    // Determine the main table for this fetch order
    const mainTable = fetch_order === 1 ? primary_table : joined_table;

    updateFetchStatus(fetch_order, { status: "fetching" });
    addLog(`Processing fetch order ${fetch_order} for table: ${mainTable}`);

    // Build filters for the main table
    const filters = buildFilters(
      mainTable,
      configJson.filters,
      configJson.date_range_fields
    );

    try {
      let pKeyField: string | undefined;
      let pKeysToUse: string[] | undefined;

      if (fetch_order === 1) {
        // First fetch order - no pkeys needed
        pKeyField = undefined;
        pKeysToUse = undefined;
      } else {
        // For subsequent orders, use source field as p_key_field and extract pkeys from previous dataset
        pKeyField = source;
        if (previousDataset && source) {
          pKeysToUse = extractPkeysFromData(previousDataset, source);
          addLog(
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

      // Store dataset in IndexedDB
      await dbManager.storeDataset(fetch_order, data);
      addLog(`Stored ${data.length} records for fetch order ${fetch_order}`);

      // Extract pkeys for next fetch order from current dataset using next fetch order's source field
      // We'll handle this in the main loop by looking ahead to the next fetch definition

      updateFetchStatus(fetch_order, {
        status: "success",
        recordCount: data.length,
      });

      return { data, nextPkeys: [] }; // nextPkeys will be calculated in main loop
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      updateFetchStatus(fetch_order, {
        status: "error",
        error: errorMessage,
      });
      throw new Error(`Fetch order ${fetch_order} failed: ${errorMessage}`);
    }
  };

  const startFetchProcess = async () => {
    if (!reportSetup.trim() || !reportConfig.trim()) {
      // alert("Please provide both report setup and config JSON");
      // return;
      setReportConfig(defaultConfigJson);
      setReportSetup(defaultSetupJson);
    }

    try {
      setIsProcessing(true);
      setLogs([]);

      // Initialize IndexedDB
      await dbManager.init();
      await dbManager.clearAll();
      addLog("IndexedDB initialized and cleared");

      // Parse JSON inputs
      const setupJson: ReportSetupJson = JSON.parse(reportSetup);
      const configJson: ReportConfigJson = JSON.parse(reportConfig);

      // Sort fetch definitions by fetch_order
      const sortedFetchDefs = [...configJson.db_defination].sort(
        (a, b) => a.fetch_order - b.fetch_order
      );

      // Initialize fetch statuses
      const initialStatuses: FetchStatus[] = sortedFetchDefs.map((def) => ({
        order: def.fetch_order,
        table: def.fetch_order === 1 ? def.primary_table : def.joined_table,
        status: "pending",
      }));
      setFetchStatuses(initialStatuses);

      addLog(
        `Starting sequential fetch process for ${sortedFetchDefs.length} fetch orders`
      );

      // Process each fetch order sequentially
      let currentDataset: any[] = [];

      for (let i = 0; i < sortedFetchDefs.length; i++) {
        const fetchDef = sortedFetchDefs[i];

        const result = await processFetchOrder(
          fetchDef,
          setupJson,
          configJson,
          currentDataset
        );

        // Update current dataset for next iteration
        currentDataset = result.data;

        // Store pkeys for next fetch order if there is one
        if (i < sortedFetchDefs.length - 1) {
          const nextFetchDef = sortedFetchDefs[i + 1];
          if (nextFetchDef.source && currentDataset.length > 0) {
            const nextPkeys = extractPkeysFromData(
              currentDataset,
              nextFetchDef.source
            );
            await dbManager.storePkeys(nextFetchDef.fetch_order, nextPkeys);
            addLog(
              `Extracted ${nextPkeys.length} pkeys from field: ${nextFetchDef.source} for next fetch order`
            );

            // If no pkeys available for next fetch, log warning
            if (nextPkeys.length === 0) {
              addLog(
                `Warning: No pkeys found for next fetch order ${nextFetchDef.fetch_order}`
              );
            }
          }
        }
      }

      addLog("✅ All fetch orders completed successfully!");
      //Stich results
      const stitchResult = await stitch(setupJson, configJson, dbManager);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Fetch process failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: FetchStatus["status"]) => {
    switch (status) {
      case "pending":
        return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
      case "fetching":
        return (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      case "success":
        return <div className="w-4 h-4 bg-green-500 rounded-full" />;
      case "error":
        return <div className="w-4 h-4 bg-red-500 rounded-full" />;
    }
  };

  const defaultSetupJson = JSON.stringify(
    {
      host: "kibiz.smtech.cloud",
      data_fetching_protocol: "data-api",
      tables: {
        Contacts: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: "Contacts",
          fields: {
            ContactID: {
              type: "text",
              label: "ContactID",
            },
            FullName: {
              type: "text",
              label: "FullName",
            },
            Email: {
              type: "text",
              label: "Email",
            },
            Phone: {
              type: "text",
              label: "Phone",
            },
            City: {
              type: "text",
              label: "City",
            },
            State: {
              type: "text",
              label: "State",
            },
            Country: {
              type: "text",
              label: "Country",
            },
          },
        },
        Leads: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: "Leads",
          fields: {
            LeadID: {
              type: "text",
              label: "LeadID",
            },
            ContactID: {
              type: "text",
              label: "ContactID",
            },
            LeadSource: {
              type: "text",
              label: "LeadSource",
            },
            LeadStatus: {
              type: "text",
              label: "LeadStatus",
            },
            CreatedDate: {
              type: "date",
              label: "CreatedDate",
            },
            Notes: {
              type: "text",
              label: "Notes",
            },
          },
        },
        Activity: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: "Activity",
          fields: {
            ActivityID: {
              type: "text",
              label: "ActivityID",
            },
            LeadID: {
              type: "text",
              label: "LeadID",
            },
            ActivityType: {
              type: "text",
              label: "ActivityType",
            },
            Subject: {
              type: "text",
              label: "Subject",
            },
            DueDate: {
              type: "date",
              label: "DueDate",
            },
            Completed: {
              type: "text",
              label: "Completed",
            },
            Notes: {
              type: "text",
              label: "Notes",
            },
          },
        },
        Opportunity: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: "Opportunity",
          fields: {
            OpportunityID: {
              type: "text",
              label: "Opportunity ID",
            },
            ActivityID: {
              type: "text",
              label: "Activity ID",
            },
            OpportunityStage: {
              type: "text",
              label: "Opportunity Stage",
            },
            EstimatedValue: {
              type: "number",
              label: "Estimated Value",
            },
            CloseDate: {
              type: "date",
              label: "Close Date",
            },
            SalesID: {
              type: "text",
              label: "Sales ID",
            },
          },
        },
      },
      relationships: [
        {
          primary_table: "Leads",
          joined_table: "Contacts",
          source: "ContactID",
          target: "ContactID",
        },
        {
          primary_table: "Leads",
          joined_table: "Activity",
          source: "LeadID",
          target: "LeadID",
        },
        {
          primary_table: "Activity",
          joined_table: "Opportunity",
          source: "ActivityID",
          target: "ActivityID",
        },
      ],
    },

    null,
    2
  );

  const defaultConfigJson = JSON.stringify(
    {
      db_defination: [
        {
          primary_table: "Opportunity",
          joined_table: "",
          fetch_order: 1,
        },
        {
          primary_table: "Opportunity",
          joined_table: "Activity",
          source: "ActivityID",
          target: "ActivityID",
          fetch_order: 2,
        },
        {
          primary_table: "Activity",
          joined_table: "Leads",
          source: "LeadID",
          target: "LeadID",
          fetch_order: 3,
        },
        {
          primary_table: "Leads",
          joined_table: "Contacts",
          source: "ContactID",
          target: "ContactID",
          fetch_order: 4,
        },
      ],
      date_range_fields: {
        Opportunity: {
          CloseDate: "01/01/2025...12/31/2025",
        },
      },
      filters: {
        Opportunity: {
          OpportunityStage: "*",
        },
      },
      group_by_fields: {
        "Opportunity Stage": {
          table: "Opportunity",
          field: "OpportunityStage",
          sort_order: "asc",
          display: [
            {
              table: "Contacts",
              field: "FullName",
            },
            {
              table: "Leads",
              field: "LeadSource",
            },
          ],
          group_total: [
            {
              table: "Opportunity",
              field: "EstimatedValue",
            },
          ],
        },
      },
      report_columns: [
        {
          table: "Opportunity",
          field: "OpportunityStage",
        },
        {
          table: "Contacts",
          field: "FullName",
        },
        {
          table: "Leads",
          field: "LeadSource",
        },
        {
          table: "Opportunity",
          field: "EstimatedValue",
        },
        {
          table: "Opportunity",
          field: "CloseDate",
        },
        {
          table: "Opportunity",
          field: "SalesID",
        },
      ],
      body_sort_order: [
        {
          field: "Opportunity Stage",
          sort_order: "asc",
        },
      ],
      summary_fields: ["Estimated Value"],
      report_header:
        "Opportunity Pipeline by Stage with Customer and Lead Info - 2025",
      response_to_user:
        "Generating a detailed opportunity pipeline report for 2025, including customer names, lead sources, estimated values, and close dates categorized by opportunity stage.",
    },
    null,
    2
  );

  async function stitch(
    setupJson: ReportSetupJson,
    reportStructure: ReportConfigJson,
    dbManager: IndexedDBManager
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
            fieldLabelMap[group.table] &&
            fieldLabelMap[group.table][group.field]
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
            };
          }
        });
      }

      // Get datasets from IndexedDB by fetch order
      const datasetsByOrder: Record<number, any[]> = {};

      // Get sorted fetch orders
      const fetchOrders = reportStructure.db_defination
        .map((def) => def.fetch_order)
        .sort((a, b) => a - b);

      // Fetch datasets from IndexedDB
      for (const order of fetchOrders) {
        const dataset = await dbManager.getDataset(order);
        if (dataset && Array.isArray(dataset)) {
          // Transform the new data format - extract fields directly from the object
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
                // Keep base record even if no matches found (left join behavior)
                newResultData.push(baseRecord);
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

      // Save the stitched result to IndexedDB
      // console.log(stitchResult);
      const report_structure_json = generateReportStructure(
        stitchResult,
        reportStructure,
        setupJson
      );

      await dbManager.saveStitchResult(
        dbManager,
        stitchResult,
        "report_body_json"
      );
      await dbManager.saveStitchResult(
        dbManager,
        report_structure_json,
        "report_structure_json"
      );

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

      // Fix: More explicit null checks for table.fields
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
              // Store prefix and suffix if they exist
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

          // Fix: Separate table.fields check
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

          // Fix: Separate table.fields check here too
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

      setReportStructuredData(result);

      return result;
    } catch (error) {
      throw new Error(
        `Report structure generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Report Data Fetcher
        </h1>
        <p className="text-gray-600">
          Sequential data fetching with IndexedDB storage
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Forms */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Setup JSON
            </label>
            <textarea
              value={reportSetup || defaultSetupJson}
              onChange={(e) => setReportSetup(e.target.value)}
              className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
              placeholder="Enter report setup JSON..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Config JSON
            </label>
            <textarea
              value={reportConfig || defaultConfigJson}
              onChange={(e) => setReportConfig(e.target.value)}
              className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
              placeholder="Enter report config JSON..."
            />
          </div>

          <button
            onClick={startFetchProcess}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-4 h-4">▶</div>
            {isProcessing ? "Processing..." : "Start Fetch Process"}
          </button>
        </div>

        {/* Status and Logs */}
        <div className="space-y-4">
          {/* Fetch Status */}
          {fetchStatuses.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Fetch Status</h3>
              <div className="space-y-2">
                {fetchStatuses.map((status) => (
                  <div
                    key={status.order}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status.status)}
                      <span className="font-medium">Order {status.order}</span>
                      <span className="text-gray-600">({status.table})</span>
                    </div>
                    <div className="text-right text-sm">
                      {status.recordCount !== undefined && (
                        <div className="text-green-600">
                          {status.recordCount} records
                        </div>
                      )}
                      {status.error && (
                        <div
                          className="text-red-600 max-w-32 truncate"
                          title={status.error}
                        >
                          {status.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              <h3 className="text-white font-semibold mb-2">Process Logs</h3>
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="report-preview">
        <DynamicReport report_structure_json={reportStructuredData} />
      </div>
    </div>
  );
};

export default ReportDataFetcher;
