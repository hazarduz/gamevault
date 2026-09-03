// The Barcode Detection API (BarcodeDetector) ships in Chrome on Android
// but isn't in TypeScript's built-in DOM lib yet. This is a minimal
// ambient declaration covering only what components/BarcodeScanner.tsx
// uses. Feature-detect with `"BarcodeDetector" in window` before use —
// it's absent on desktop Chrome and in insecure contexts.

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: ReadonlyArray<{ x: number; y: number }>;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
