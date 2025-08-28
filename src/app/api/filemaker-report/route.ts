import { NextRequest, NextResponse } from "next/server";
import { InMemoryDataManager } from "@/lib/DataManager";
import {
  ReportSetupJson,
  ReportConfigJson,
  reportSetupSchema,
  reportConfigSchema,
} from "@/lib/types";
import {
  extractPkeysFromData,
  processFetchOrder,
  stitch,
  generateReportStructure,
} from "@/app/utils/utility";

import {
  fmSignIn,
  fmVerifySession,
  fmGetRecordById,
  fmSetRecordById,
} from "@/app/utils/filemaker";

const FM_LAYOUT = "MultiTableReport Filtered Datas";

export async function POST(req: NextRequest) {
  const dataManager = new InMemoryDataManager();

  try {
    const { recordId, username, password, existingToken } = await req.json();

    if (!recordId || !username || !password) {
      return NextResponse.json(
        {
          status: "error",
          detail: "recordId, username, and password are required",
        },
        { status: 400 }
      );
    }

    let token = existingToken ?? null;

    // Step 1: Sign in or validate existing token
    if (token) {
      const isValid = await fmVerifySession(token);
      if (!isValid) {
        token = await fmSignIn(username, password);
      }
    } else {
      token = await fmSignIn(username, password);
    }

    // Step 2: Fetch FileMaker record
    const fieldData = await fmGetRecordById(FM_LAYOUT, recordId, token);

    if (!fieldData?.SetupJson || !fieldData?.AIResponseJson) {
      return NextResponse.json(
        {
          status: "error",
          detail:
            "report_setup or report_config is missing in FileMaker record",
        },
        { status: 400 }
      );
    }

    // Step 3: Parse and validate
    let setupJson: ReportSetupJson;
    let configJson: ReportConfigJson;

    try {
      setupJson =
        typeof fieldData.SetupJson === "string"
          ? JSON.parse(fieldData.SetupJson)
          : fieldData.SetupJson;

      configJson =
        typeof fieldData.AIResponseJson === "string"
          ? JSON.parse(fieldData.AIResponseJson)
          : fieldData.AIResponseJson;
    } catch (error) {
      return NextResponse.json(
        {
          status: "error",
          detail: "Invalid JSON format in FileMaker fields",
          nextJSError:
            error instanceof Error ? error.message : "JSON parsing failed",
        },
        { status: 400 }
      );
    }

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

    // Step 4: Process fetch orders
    dataManager.clearAll();
    dataManager.addLog("Data manager initialized and cleared");

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

    // Step 5: Verify token again before updating record
    const isStillValid = await fmVerifySession(token);
    if (!isStillValid) {
      token = await fmSignIn(username, password);
    }

    await fmSetRecordById(
      FM_LAYOUT,
      recordId,
      {
        ReportStructuredData: JSON.stringify(reportStructureJson),
        "PKeysValueList(1)": dataManager.getPkeys(1)?.join(",") || "",
        "PKeysValueList(2)": dataManager.getPkeys(2)?.join(",") || "",
        "PKeysValueList(3)": dataManager.getPkeys(3)?.join(",") || "",
        "PKeysValueList(4)": dataManager.getPkeys(4)?.join(",") || "",
        "PKeysValueList(5)": dataManager.getPkeys(5)?.join(",") || "",
        "RawDataSet(1)": JSON.stringify(dataManager.getDataset(1)) || "",
        "RawDataSet(2)": JSON.stringify(dataManager.getDataset(2)) || "",
        "RawDataSet(3)": JSON.stringify(dataManager.getDataset(3)) || "",
        "RawDataSet(4)": JSON.stringify(dataManager.getDataset(4)) || "",
        "RawDataSet(5)": JSON.stringify(dataManager.getDataset(5)) || "",
      },
      token
    );

    return NextResponse.json(
      {
        status: "ok",
        report_structure_json: reportStructureJson,
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
