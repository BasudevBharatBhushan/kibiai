import { useReport } from "@/context/ReportContext";

export function useSchema() {

  const { state } = useReport();
  
  // 1. Get ALL Tables (Only for the "Relationships" section)
  const getAllTables = () => {
    if (!state.setup?.tables) return [];
    return Object.keys(state.setup.tables);
  };

  // 2. Get ONLY Tables used in Relationships (For Reports, Filters, Groups)
  const getConnectedTables = () => {
    const uniqueTables = new Set<string>();
    
    // Always include tables defined in the relationships
    state.config.db_defination.forEach(def => {
      if (def.primary_table) uniqueTables.add(def.primary_table);
      if (def.joined_table) uniqueTables.add(def.joined_table);
    });

    return Array.from(uniqueTables);
  };

  // 3. Get Fields for a Table (with optional Type Filtering)
  // Usage: getFieldOptions("Sales", "date") -> Returns only date fields
  const getFieldOptions = (tableName: string, typeFilter?: string) => {
    // Handle "calculated" table specifically
    if (tableName === "calculated") {
       return state.config.custom_calculated_fields
         .filter(c => c.field_name) // Ensure name exists
         .map(c => ({
            value: c.field_name,
            label: c.label || c.field_name,
            type: "number" // calculated fields are numeric for now
         }));
    }

    // Handle normal tables
    if (!tableName || !state.setup?.tables?.[tableName]) return [];
    
    const fields = state.setup.tables[tableName].fields;
    
    // Convert Object to Array
    let options = Object.entries(fields).map(([key, def]) => ({
      value: key,
      label: def.label || key,
      type: def.type
    }));

    // Apply Filter if requested
    if (typeFilter) {
      if (typeFilter === "number") {
         // Include currency and percentage as "number"
         options = options.filter(f => ["number", "currency", "percentage"].includes(f.type));
      } else {
         options = options.filter(f => f.type === typeFilter);
      }
    }

    return options;
  };

  return { getAllTables, getConnectedTables, getFieldOptions };
}