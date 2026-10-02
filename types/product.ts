export type ProductImage = {
  id: string;
  url: string;
  width?: number;
  height?: number;
  source?: string;
};

export type AnalyzeResult = {
  title?: string;
  images: ProductImage[];
};

export type Preset = "mimitoys-standard" | "mimitoys-no-text" | "shopee-plain";
