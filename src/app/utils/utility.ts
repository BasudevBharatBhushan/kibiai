// Utility functions for handling FileMaker records and OData batch responses

interface FileMakerRecord {
  fieldData: Record<string, any>;
  portalData: Record<string, any>;
  recordId: string;
  modId: string;
}

interface FlattenedRecord extends Record<string, any> {
  recordId: string;
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

  console.log(response);

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
