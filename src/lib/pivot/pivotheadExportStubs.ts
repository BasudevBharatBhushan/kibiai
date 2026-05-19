function unsupportedExportFeature(): never {
  throw new Error("Pivot export features are not enabled in this application.");
}

export const utils = {
  book_new: unsupportedExportFeature,
  json_to_sheet: unsupportedExportFeature,
  book_append_sheet: unsupportedExportFeature,
};

export function writeFile(): never {
  return unsupportedExportFeature();
}

export class jsPDF {
  constructor() {
    unsupportedExportFeature();
  }
}

export function autoTable(): never {
  return unsupportedExportFeature();
}

const stub = {
  utils,
  writeFile,
  jsPDF,
  autoTable,
};

export default stub;
