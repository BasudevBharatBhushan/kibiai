
// Options for different join types in reports
export const JOIN_TYPES = [
  { label: "Inner Join", value: "inner" },
  { label: "Left Join", value: "left" },
  { label: "Right Join", value: "right" }
];

// Options for sorting data in reports
export const SORT_ORDERS = [
  { label: "Ascending", value: "asc" },
  { label: "Descending", value: "desc" }
];

// Options for filtering data in reports
export const FILTER_OPERATORS = [
  { label: "Equals (==)", value: "==" },
  { label: "Not Empty (*)", value: "*" },
  { label: "Is Empty (=)", value: "=" },
  { label: "Greater Than (>)", value: ">" },
  { label: "Less Than (<)", value: "<" },
  { label: "Greater/Equal (>=)", value: ">=" },
  { label: "Less/Equal (<=)", value: "<=" }
];