// /**
//  * Parses a raw OData batch response into a flat JSON array of records
//  * @param response - Raw OData batch response (as string)
//  * @returns Array of parsed record objects
//  */
// export function parseODataBatchResponse(response: string): any[] {
//   const boundaryRegex = /--b_[\w-]+/; // match boundary marker like --b_...
//   const parts = response
//     .split(boundaryRegex)
//     .map((part) => part.trim())
//     .filter(Boolean);

//   const results: any[] = [];
//   //   console.log(parts);

//   for (const part of parts) {
//     // Find the first JSON block in this part
//     const startPos = part.indexOf("{");
//     const endPos = part.lastIndexOf("}");

//     if (startPos >= 0 && endPos > startPos) {
//       const jsonBlock = part.substring(startPos, endPos + 1);

//       try {
//         const parsed = JSON.parse(jsonBlock);

//         // Extract the "value" array if it exists
//         if (parsed.value && Array.isArray(parsed.value)) {
//           results.push(...parsed.value);
//         }
//       } catch (e) {
//         // Ignore malformed JSON blocks
//         console.log("Malformed JSON block, skipping:", e);
//         continue;
//       }
//     }
//   }

//   return results;
// }
// export function parseODataBatchResponse(response: string): any[] {
//   const boundaryRegex = /--b_[^\r\n]+/g; // match full boundary lines
//   const parts = response
//     .split(boundaryRegex)
//     .map((part) => part.trim())
//     .filter(Boolean);

//   const results: any[] = [];

//   for (const part of parts) {
//     // Extract *all* JSON blocks inside the part
//     const jsonMatches = part.match(/{[\s\S]*?}/g);
//     if (!jsonMatches) continue;

//     for (const match of jsonMatches) {
//       try {
//         const parsed = JSON.parse(match);

//         if (parsed.value && Array.isArray(parsed.value)) {
//           results.push(...parsed.value);
//         }
//       } catch (e) {
//         console.log("Skipping malformed JSON:", e);
//       }
//     }
//   }

//   return results;
// }

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
