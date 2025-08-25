"use client";
import React, { useState } from "react";

interface ReportSetupJson {
  host: string;
  data_fetching_protocol: string;
  tables: Record<string, any>;
  relationships: Array<{
    primary_table: string;
    joined_table: string;
    source: string;
    target: string;
  }>;
}

interface ReportConfigJson {
  db_defination: Array<{
    primary_table: string;
    joined_table: string;
    source?: string;
    target?: string;
    fetch_order: number;
  }>;
  date_range_fields?: Record<string, Record<string, string>>;
  filters?: Record<string, Record<string, any>>;
  [key: string]: any;
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
}

const ReportDataFetcher: React.FC = () => {
  const [reportSetup, setReportSetup] = useState<string>("");
  const [reportConfig, setReportConfig] = useState<string>("");
  const [fetchStatuses, setFetchStatuses] = useState<FetchStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dbManager] = useState(() => new IndexedDBManager());
  const [logs, setLogs] = useState<string[]>([]);

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
          file: "KibiAiDemo",
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
            ContactType: {
              type: "text",
              label: "ContactType",
            },
          },
        },
        Activity: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: null,
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
        Leads: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: null,
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
        Opportunity: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: null,
          fields: {
            OpportunityID: {
              type: "text",
              label: "OpportunityID",
            },
            ActivityID: {
              type: "text",
              label: "ActivityID",
            },
            OpportunityStage: {
              type: "text",
              label: "OpportunityStage",
            },
            EstimatedValue: {
              type: "number",
              label: "EstimatedValue",
            },
            CloseDate: {
              type: "date",
              label: "CloseDate",
            },
            SalesID: {
              type: "text",
              label: "SalesID",
            },
          },
        },
        Sales: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: null,
          fields: {
            SalesID: {
              type: "text",
              label: "SalesID",
            },
            ContactID: {
              type: "text",
              label: "ContactID",
            },
            SalesDate: {
              type: "date",
              label: "SalesDate",
            },
            PaymentStatus: {
              type: "text",
              label: "PaymentStatus",
            },
          },
        },
        Products: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: null,
          fields: {
            ItemNo: {
              type: "text",
              label: "ItemNo",
            },
            ItemName: {
              type: "text",
              label: "ItemName",
            },
            UnitPrice: {
              type: "text",
              label: "UnitPrice",
            },
            Inventory: {
              type: "text",
              label: "Inventory",
            },
            Category: {
              type: "text",
              label: "Category",
            },
            IsActive: {
              type: "text",
              label: "IsActive",
            },
          },
        },
        SalesLines: {
          file: "KibiAIDemo",
          username: "Developer",
          password: "adminbiz",
          layout: null,
          fields: {
            LineID: {
              type: "text",
              label: "LineID",
            },
            SalesID: {
              type: "text",
              label: "SalesID",
            },
            ItemNo: {
              type: "text",
              label: "ItemNo",
            },
            Quantity: {
              type: "number",
              label: "Quantity",
            },
            LinePrice: {
              type: "number",
              label: "LinePrice",
            },
            ProfitMargin: {
              type: "number",
              label: "ProfitMargin",
            },
            Tax: {
              type: "number",
              label: "Tax",
            },
          },
        },
      },
      relationships: [
        {
          primary_table: "Contacts",
          joined_table: "Leads",
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
        {
          primary_table: "Opportunity",
          joined_table: "Sales",
          source: "SalesID",
          target: "SalesID",
        },
        {
          primary_table: "Sales",
          joined_table: "SalesLines",
          source: "SalesID",
          target: "SalesID",
        },
        {
          primary_table: "SalesLines",
          joined_table: "Products",
          source: "ItemNo",
          target: "ItemNo",
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
          primary_table: "Activity",
          joined_table: "",
          fetch_order: 1,
        },
        {
          primary_table: "Activity",
          joined_table: "Leads",
          source: "LeadID",
          target: "LeadID",
          fetch_order: 2,
        },
        {
          primary_table: "Leads",
          joined_table: "Contacts",
          source: "ContactID",
          target: "ContactID",
          fetch_order: 3,
        },
      ],
      date_range_fields: {
        Activity: {
          DueDate: "04/01/2025...04/30/2025",
        },
      },
      filters: {
        Activity: {
          ActivityType: "*",
        },
      },
    },
    null,
    2
  );

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
    </div>
  );
};

export default ReportDataFetcher;
