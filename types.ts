export interface ImageFile {
  file: File;
  previewUrl: string;
}

export interface Base64Image {
  data: string;
  mimeType: string;
}

export interface HistoryItem {
  imageUrl: string;
  prompt: string;
}
