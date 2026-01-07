"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { ReportConfig, ReportSetup , DbDefinition , SortField , CustomCalcField } from "../lib/types/reportConfigTypes";


// Actions 

type Action = 


  | { type: "SET_HEADER"; payload: string }
  | { type: "SET_DESCRIPTION"; payload: string }


  | { type: "ADD_DB_DEF"; payload: DbDefinition }
  | { type: "UPDATE_DB_DEF"; payload: { index: number; field: keyof DbDefinition; value: string | number | undefined } }
  | { type: "REMOVE_DB_DEF"; payload: number }
  | { type: "LOAD_INITIAL_CONFIG"; payload: ReportConfig }
  | { type: "LOAD_SETUP"; payload: ReportSetup }

  | { type: "ADD_GROUP"; payload: string } // payload is the unique Group Name (Key)
  | { type: "REMOVE_GROUP"; payload: string }
  | { type: "UPDATE_GROUP_MAIN"; payload: { groupKey: string; field: string; value: any } }
  // Nested Display Fields
  | { type: "ADD_GROUP_DISPLAY"; payload: string } // payload is groupKey
  | { type: "REMOVE_GROUP_DISPLAY"; payload: { groupKey: string; index: number } }
  | { type: "UPDATE_GROUP_DISPLAY"; payload: { groupKey: string; index: number; field: 'table' | 'field'; value: string } }
  // Nested Total Fields
  | { type: "ADD_GROUP_TOTAL"; payload: string } // payload is groupKey
  | { type: "REMOVE_GROUP_TOTAL"; payload: { groupKey: string; index: number } }
  | { type: "UPDATE_GROUP_TOTAL"; payload: { groupKey: string; index: number; field: 'table' | 'field'; value: string } }

  // Report Columns
  | { type: "ADD_COLUMN" }
  | { type: "REMOVE_COLUMN"; payload: number }
  | { type: "UPDATE_COLUMN"; payload: { index: number; field: 'table' | 'field'; value: string } }
  // Body Sort Order
  | { type: "ADD_BODY_SORT" }
  | { type: "REMOVE_BODY_SORT"; payload: number }
  | { type: "UPDATE_BODY_SORT"; payload: { index: number; field: keyof SortField ; value: string } }

 
  | { type: "REORDER_COLUMNS"; payload: { sourceIndex: number; destinationIndex: number } }
  | { type: "REORDER_BODY_SORTS"; payload: { sourceIndex: number; destinationIndex: number } }
  | { type: "REORDER_GROUPS"; payload: { sourceIndex: number; destinationIndex: number } }

  | { type: "ADD_CALC" }
  | { type: "REMOVE_CALC"; payload: number }
  | { type: "UPDATE_CALC"; payload: { index: number; field: keyof CustomCalcField ; value: string | number } }
  // Nested Dependencies
  | { type: "ADD_CALC_DEP"; payload: number } // payload = calcIndex
  | { type: "REMOVE_CALC_DEP"; payload: { calcIndex: number; depIndex: number } }
  | { type: "UPDATE_CALC_DEP"; payload: { calcIndex: number; depIndex: number; value: string } }
  // Filters & Dates (Bulk Sync)
  | { type: "SYNC_DATE_RANGES"; payload: Record<string, Record<string, string>> }
  | { type: "SYNC_FILTERS"; payload: Record<string, Record<string, string>> }
  // Grand Summary (List Operations)
  | { type: "ADD_SUMMARY_FIELD" }
  | { type: "REMOVE_SUMMARY_FIELD"; payload: number }
  | { type: "UPDATE_SUMMARY_FIELD"; payload: { index: number; value: string } }
  | { type: "REORDER_SUMMARY_FIELDS"; payload: { sourceIndex: number; destinationIndex: number } }
  // Loading Report 
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_FULL_REPORT"; payload: { config: ReportConfig; setup: ReportSetup; fmRecordId: string } }
  | { type: "SET_REPORT_PREVIEW"; payload: any[] };



// 2. Define the State Structure
interface ReportState {
  config: ReportConfig;
  setup: ReportSetup | null;
  fmRecordId: string | null;
  isLoading: boolean;
  reportPreview: any | null; 
}

// 3. Initial Default State (Empty)
const initialState: ReportState = {
  setup: null, 
  fmRecordId: null,
  isLoading: false,
  reportPreview: null,
  config: {
    report_header: "",
    response_to_user: "",
    db_defination: [],
    report_columns: [],
    group_by_fields: {},
    filters: {},
    date_range_fields: {},
    body_sort_order: [],
    summary_fields: [],
    custom_calculated_fields: []
  },
};

// 4. The Reducer (The Logic Engine)

function reportReducer(state: ReportState, action: Action): ReportState {
  switch (action.type) {
    
    case "SET_HEADER":
      return {
        ...state,
        config: { ...state.config, report_header: action.payload },
      };

    case "SET_DESCRIPTION":
      return {
        ...state,
        config: { ...state.config, response_to_user: action.payload },
      };

    case "ADD_DB_DEF":
      return {
        ...state,
        config: {
          ...state.config,
          db_defination: [...state.config.db_defination, action.payload],
        },
      };

    case "UPDATE_DB_DEF":
      const newDbDef = [...state.config.db_defination];
      (newDbDef[action.payload.index] as any)[action.payload.field] = action.payload.value;

      return {
        ...state,
        config: { ...state.config, db_defination: newDbDef },
      };

    case "REMOVE_DB_DEF":
      return {
        ...state,
        config: {
          ...state.config,
          db_defination: state.config.db_defination.filter(
            (_, i) => i !== action.payload
          ),
        },
      };
      
    case "LOAD_INITIAL_CONFIG":
      return {
         ...state,
         config: action.payload
      }

    case "LOAD_SETUP":
      return {
        ...state,
        setup: action.payload
      }
      
    case "ADD_GROUP":
      return {
        ...state,
        config: {
          ...state.config,
          group_by_fields: {
            ...state.config.group_by_fields,
            [action.payload]: { 
                table: "", field: "", sort_order: "asc", display: [], group_total: [] 
            }
          }
        }
      };

    case "REMOVE_GROUP":
      const { [action.payload]: deleted, ...remainingGroups } = state.config.group_by_fields;
      return {
        ...state,
        config: { ...state.config, group_by_fields: remainingGroups }
      };

    case "UPDATE_GROUP_MAIN":
      return {
        ...state,
        config: {
          ...state.config,
          group_by_fields: {
            ...state.config.group_by_fields,
            [action.payload.groupKey]: {
                ...state.config.group_by_fields[action.payload.groupKey],
                [action.payload.field]: action.payload.value
            }
          }
        }
      };

    // --- Nested Display Fields ---
    case "ADD_GROUP_DISPLAY":
      const groupDisp = state.config.group_by_fields[action.payload];
      return {
        ...state,
        config: {
            ...state.config,
            group_by_fields: {
                ...state.config.group_by_fields,
                [action.payload]: {
                    ...groupDisp,
                    display: [...groupDisp.display, { table: "", field: "" }]
                }
            }
        }
      };

    case "UPDATE_GROUP_DISPLAY":
      const gDisp = state.config.group_by_fields[action.payload.groupKey];
      const newDisplay = [...gDisp.display];
      newDisplay[action.payload.index][action.payload.field] = action.payload.value;
      return {
        ...state,
        config: {
            ...state.config,
            group_by_fields: {
                ...state.config.group_by_fields,
                [action.payload.groupKey]: { ...gDisp, display: newDisplay }
            }
        }
      };

    case "REMOVE_GROUP_DISPLAY":
        const gDispRem = state.config.group_by_fields[action.payload.groupKey];
        return {
            ...state,
            config: {
                ...state.config,
                group_by_fields: {
                    ...state.config.group_by_fields,
                    [action.payload.groupKey]: {
                        ...gDispRem,
                        display: gDispRem.display.filter((_, i) => i !== action.payload.index)
                    }
                }
            }
        };

    // --- Nested Total Fields (Copy logic from Display Fields) ---
    case "ADD_GROUP_TOTAL":
      const groupTot = state.config.group_by_fields[action.payload];
      return {
        ...state,
        config: {
            ...state.config,
            group_by_fields: {
                ...state.config.group_by_fields,
                [action.payload]: {
                    ...groupTot,
                    group_total: [...groupTot.group_total, { table: "", field: "" }]
                }
            }
        }
      };

    case "UPDATE_GROUP_TOTAL":
      const gTot = state.config.group_by_fields[action.payload.groupKey];
      const newTotal = [...gTot.group_total];
      newTotal[action.payload.index][action.payload.field] = action.payload.value;
      return {
        ...state,
        config: {
            ...state.config,
            group_by_fields: {
                ...state.config.group_by_fields,
                [action.payload.groupKey]: { ...gTot, group_total: newTotal }
            }
        }
      };
      
    case "REMOVE_GROUP_TOTAL":
        const gTotRem = state.config.group_by_fields[action.payload.groupKey];
        return {
            ...state,
            config: {
                ...state.config,
                group_by_fields: {
                    ...state.config.group_by_fields,
                    [action.payload.groupKey]: {
                        ...gTotRem,
                        group_total: gTotRem.group_total.filter((_, i) => i !== action.payload.index)
                    }
                }
            }
        }

// --- Report Columns ---
    case "ADD_COLUMN":
      return {
        ...state,
        config: {
          ...state.config,
          report_columns: [...state.config.report_columns, { table: "", field: "" }]
        }
      };

    case "REMOVE_COLUMN":
      return {
        ...state,
        config: {
          ...state.config,
          report_columns: state.config.report_columns.filter((_, i) => i !== action.payload)
        }
      };

    case "UPDATE_COLUMN":
      const newCols = [...state.config.report_columns];
      newCols[action.payload.index][action.payload.field] = action.payload.value;
      return {
        ...state,
        config: { ...state.config, report_columns: newCols }
      };

    // --- Body Sort Order ---
    case "ADD_BODY_SORT":
      return {
        ...state,
        config: {
          ...state.config,
          body_sort_order: [...state.config.body_sort_order, { field: "", sort_order: "asc" }]
        }
      };

    case "REMOVE_BODY_SORT":
      return {
        ...state,
        config: {
          ...state.config,
          body_sort_order: state.config.body_sort_order.filter((_, i) => i !== action.payload)
        }
      };

    case "UPDATE_BODY_SORT":
      const newSorts = [...state.config.body_sort_order];

      (newSorts[action.payload.index] as any)[action.payload.field] = action.payload.value;
      
      return {
        ...state,
        config: { ...state.config, body_sort_order: newSorts }
      };
    
    case "REORDER_COLUMNS": {
      const { sourceIndex, destinationIndex } = action.payload;
      const newCols = [...state.config.report_columns];
      const [removed] = newCols.splice(sourceIndex, 1);
      newCols.splice(destinationIndex, 0, removed);
      return {
        ...state,
        config: { ...state.config, report_columns: newCols }
      };
    }

    case "REORDER_BODY_SORTS": {
      const { sourceIndex, destinationIndex } = action.payload;
      const newSorts = [...state.config.body_sort_order];
      const [removed] = newSorts.splice(sourceIndex, 1);
      newSorts.splice(destinationIndex, 0, removed);
      return {
        ...state,
        config: { ...state.config, body_sort_order: newSorts }
      };
    }

    case "REORDER_GROUPS": {
      const { sourceIndex, destinationIndex } = action.payload;
      // Convert object to array of [key, value]
      const entries = Object.entries(state.config.group_by_fields);
      // Remove item from source
      const [removed] = entries.splice(sourceIndex, 1);
      // Insert at destination
      entries.splice(destinationIndex, 0, removed);
      // Convert back to object
      const newGroups = Object.fromEntries(entries);
      
      return {
        ...state,
        config: { ...state.config, group_by_fields: newGroups }
      };
    }

    case "ADD_CALC":
      return {
        ...state,
        config: {
          ...state.config,
          custom_calculated_fields: [
            ...state.config.custom_calculated_fields,
            { field_name: "", label: "", format: "number", formula: "", dependencies: [] }
          ]
        }
      };

    case "REMOVE_CALC":
      return {
        ...state,
        config: {
          ...state.config,
          custom_calculated_fields: state.config.custom_calculated_fields.filter((_, i) => i !== action.payload)
        }
      };

    case "UPDATE_CALC":
      const newCalcs = [...state.config.custom_calculated_fields];
      (newCalcs[action.payload.index] as any)[action.payload.field] = action.payload.value;
      
      return {
        ...state,
        config: { ...state.config, custom_calculated_fields: newCalcs }
      };

    case "ADD_CALC_DEP":
      const calcToAdd = state.config.custom_calculated_fields[action.payload];
      const updatedCalcsAdd = [...state.config.custom_calculated_fields];
      updatedCalcsAdd[action.payload] = {
        ...calcToAdd,
        dependencies: [...calcToAdd.dependencies, ""]
      };
      return {
        ...state,
        config: { ...state.config, custom_calculated_fields: updatedCalcsAdd }
      };

    case "REMOVE_CALC_DEP":
      const { calcIndex, depIndex } = action.payload;
      const calcToRem = state.config.custom_calculated_fields[calcIndex];
      const updatedCalcsRem = [...state.config.custom_calculated_fields];
      updatedCalcsRem[calcIndex] = {
        ...calcToRem,
        dependencies: calcToRem.dependencies.filter((_, i) => i !== depIndex)
      };
      return {
        ...state,
        config: { ...state.config, custom_calculated_fields: updatedCalcsRem }
      };

    case "UPDATE_CALC_DEP":
      const { calcIndex: cIdx, depIndex: dIdx, value } = action.payload;
      const calcToUpd = state.config.custom_calculated_fields[cIdx];
      const updatedCalcsUpd = [...state.config.custom_calculated_fields];
      const newDeps = [...calcToUpd.dependencies];
      newDeps[dIdx] = value;
      updatedCalcsUpd[cIdx] = { ...calcToUpd, dependencies: newDeps };
      return {
        ...state,
        config: { ...state.config, custom_calculated_fields: updatedCalcsUpd }
      };
    
case "SYNC_DATE_RANGES":
      return {
        ...state,
        config: { ...state.config, date_range_fields: action.payload }
      };

    case "SYNC_FILTERS":
      return {
        ...state,
        config: { ...state.config, filters: action.payload }
      };

    // --- Grand Summary ---
    case "ADD_SUMMARY_FIELD":
      return {
        ...state,
        config: {
          ...state.config,
          summary_fields: [...state.config.summary_fields, ""]
        }
      };

    case "REMOVE_SUMMARY_FIELD":
      return {
        ...state,
        config: {
          ...state.config,
          summary_fields: state.config.summary_fields.filter((_, i) => i !== action.payload)
        }
      };

    case "UPDATE_SUMMARY_FIELD":
      const newSummaries = [...state.config.summary_fields];
      newSummaries[action.payload.index] = action.payload.value;
      return {
        ...state,
        config: { ...state.config, summary_fields: newSummaries }
      };

    case "REORDER_SUMMARY_FIELDS": {
      const { sourceIndex, destinationIndex } = action.payload;
      const newSum = [...state.config.summary_fields];
      const [removed] = newSum.splice(sourceIndex, 1);
      newSum.splice(destinationIndex, 0, removed);
      return {
        ...state,
        config: { ...state.config, summary_fields: newSum }
      };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "LOAD_FULL_REPORT":
      return {
        ...state,
        config: action.payload.config,
        setup: action.payload.setup,
        fmRecordId: action.payload.fmRecordId,
        isLoading: false
      };
    
    
    case "SET_REPORT_PREVIEW":
      return { ...state, reportPreview: action.payload };  

    default:
      return state;
  }
}


// 5. Create Context
const ReportContext = createContext<{
  state: ReportState;
  dispatch: React.Dispatch<Action>;
} | null>(null);


// 6. The Provider Component (Wraps the app)
export function ReportProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reportReducer, initialState);

  const contextValue = React.useMemo(() => ({ state, dispatch }), [state]);

  return (
    <ReportContext.Provider value={contextValue}>
      {children}
    </ReportContext.Provider>
  );
}

// 7. Custom Hook for easy access
export function useReport() {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error("useReport must be used within a ReportProvider");
  }
  return context;
}
