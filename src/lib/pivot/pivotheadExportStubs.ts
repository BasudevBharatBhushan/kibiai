// Stub for heavy export libraries (xlsx, jspdf, jspdf-autotable)
// This file is used to alias these dependencies in next.config.ts

// jspdf stubs
export class jsPDF {
  constructor() {
    console.warn("jsPDF stub called");
  }
  setFontSize() {}
  text() {}
  save() {}
  internal = {
    pageSize: {
      getWidth: () => 0,
      getHeight: () => 0,
    }
  };
}

// jspdf-autotable stubs
export const autoTable = () => {};

// xlsx stubs
export const utils = {
  aoa_to_sheet: () => ({ "!ref": "A1:A1", "!cols": [] }),
  decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
  encode_cell: () => "A1",
  book_new: () => ({}),
  book_append_sheet: () => {},
};

export const writeFile = () => {};

export default {};
