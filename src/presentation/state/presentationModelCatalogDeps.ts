export type PresentationModelCatalogDeps = {
  presentationModelId: string;
  setPresentationModelId: (
    id: string | ((prev: string) => string),
  ) => void;
  apiKeysVersion: number;
  setApiKeysVersion: (value: number | ((prev: number) => number)) => void;
  imageProvider: "gemini" | "openai";
  setImageProvider: (provider: "gemini" | "openai") => void;
};
