# L-039: Fix FileMaker 500 "No Records" Error in Report Generation

**Date:** 2026-05-13  
**Scope:** backend  
**Template:** Slow Moving Items (`e17b7c39-1618-46f5-8767-f276a8060da8`)

---

## Problem

Report generation was failing at **Fetch Order 3** with:

```
Fetch order 3 failed: Failed to fetch data from FileMaker: 500
```

Reported via stream endpoint: `POST /api/templates/e17b7c39.../generate/stream`

---

## Root Cause

**FileMaker Data API quirk**: When a `_find` request returns **zero matching records**, FileMaker returns **HTTP 500** with a JSON body containing `"errorCode": "401"` (FM Error 401 = "No records match the request").

This is NOT a real server error — it's expected behavior when a joined table has no matching rows for the given primary keys.

The affected code in `src/lib/utils/utility.ts` (`fetchFmRecord`):

```ts
// Before fix — throws on 500 even if it's just "no records"
if (!dataRes.ok) {
    if (dataRes.status === 401) {
        return { token, data: [], recordCount: 0 };
    }
    throw new Error(`Failed to fetch data from FileMaker: ${dataRes.status}`);
}
```

**Why Fetch Order 3 specifically:**  
- FO1: `MaterialLineItemArchived` — fetches rows matching `ActualPurch_Qty > 0`  
- FO2: `LineItemArchived` — joined on `ItemNo` (some items may have no sales)  
- **FO3: `PRD` — joined on `ItemNo` — when no PRD records match the given ItemNos, FileMaker returns 500+FM401**  
- FO4: `WHP` — downstream of PRD

---

## Fix Applied

**File:** `src/lib/utils/utility.ts` (lines 347–381)

Added a graceful handler for HTTP 500 responses from FileMaker's Data API. When `status === 500`, the response body is parsed to check for FileMaker error code `401` (no records). If found, an empty dataset is returned instead of throwing.

```ts
if (dataRes.status === 500) {
    const errBody = await dataRes.json();
    const fmErrorCode = errBody?.messages?.[0]?.code || errBody?.response?.messages?.[0]?.code;
    if (fmErrorCode === "401" || fmErrorCode === 401) {
        return { token, data: [], recordCount: 0 };
    }
}
```

---

## Verification

- ESLint ran on `utility.ts` — no new errors introduced (pre-existing `no-explicit-any` warnings unchanged)
- Fix aligns with the existing HTTP 401 (auth failure) graceful handling pattern

---

## Status: COMPLETED
