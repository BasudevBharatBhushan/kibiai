import { ReportSetup } from "./reportConfigTypes";

export const MOCK_SETUP: ReportSetup = {
  host: "kibiz-linux.smtech.cloud",
  relationships: [], 
  tables: {
    Contacts: {
      file: "KiBiAIDemo",
      username: "Developer",
      password: "adminbiz",
      layout: "Contacts",
      fields: {
        ContactID: { type: "text", label: "Contact ID" },
        FullName: { type: "text", label: "Contact Name" },
        Email: { type: "text", label: "Email" },
        Phone: { type: "text", label: "Phone" },
        City: { type: "text", label: "City" },
        State: { type: "text", label: "State" },
        Country: { type: "text", label: "Country" }
      }
    },
    Sales: {
      file: "KiBiAIDemo",
      username: "Developer",
      password: "adminbiz",
      layout: "Sales",
      fields: {
        SalesID: { type: "text", label: "Sales ID" },
        ContactID: { type: "text", label: "Contact ID" },
        SalesDate: { type: "date", label: "Sales Date" },
        PaymentStatus: { type: "text", label: "Payment Status", valuelist: "Overdue, Paid, Pending" }
      }
    },
    SalesLines: {
      file: "KiBiAIDemo",
      username: "Developer",
      password: "adminbiz",
      layout: "SalesLines",
      fields: {
        LineID: { type: "text", label: "Line ID" },
        SalesID: { type: "text", label: "Sales ID" },
        ItemNo: { type: "text", label: "Item No" },
        Quantity: { type: "number", label: "Quantity" },
        LinePrice: { type: "number", label: "Line Price", prefix: "$" },
        ProfitMargin: { type: "number", label: "Profit Margin" },
        Tax: { type: "number", label: "Tax" }
      }
    },
    Products: {
      file: "KiBiAIDemo",
      username: "Developer",
      password: "adminbiz",
      layout: "Products",
      fields: {
        ItemNo: { type: "text", label: "Item No" },
        ItemName: { type: "text", label: "Item Name" },
        UnitPrice: { type: "text", label: "Unit Price", prefix: "$" },
        UnitCost: { type: "text", label: "Unit Cost", prefix: "$" },
        Inventory: { type: "text", label: "Inventory" },
        Category: { type: "text", label: "Category" },
        IsActive: { type: "text", label: "IsActive", valuelist: "True, False" }
      }
    }
  }
};