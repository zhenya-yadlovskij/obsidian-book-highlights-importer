export interface ImportCommandHost {
  readonly addCommand: (command: {
    readonly id: string;
    readonly name: string;
    readonly callback: () => void;
  }) => unknown;
}

export const registerImportBookHighlightsCommand = (
  host: ImportCommandHost,
  openWizard: () => void,
): void => {
  host.addCommand({
    id: "import-book-highlights",
    name: "Import Book Highlights",
    callback: openWizard,
  });
};
