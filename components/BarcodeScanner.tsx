"use client";

import { useEffect, useRef, useState } from "react";

// Single-photo barcode capture. Tapping the button opens the phone
// camera (capture="environment"); the still image is decoded on-device
// with the native BarcodeDetector. The button hides itself where that
// API is unavailable (desktop Chrome, insecure contexts / the plain-http
// LAN address).
const FORMATS = ["ean_13", "upc_a", "ean_8", "upc_e"];

export default function BarcodeScanner({
  onScan,
  disabled,
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checked after mount so SSR and first client render agree (both
  // render nothing) — avoids a hydration mismatch.
  useEffect(() => {
    setSupported(typeof window.BarcodeDetector === "function");
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same photo be re-picked
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const detector = new window.BarcodeDetector!({ formats: FORMATS });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close?.();

      const value = codes.find((c) => /^\d{8,14}$/.test(c.rawValue))?.rawValue;
      if (!value) {
        setError("No barcode found in that photo — get closer and fill the frame.");
        return;
      }
      onScan(value);
    } catch (err: any) {
      setError(err?.message || "Couldn't read that photo.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="btn-secondary whitespace-nowrap"
      >
        {busy ? "Reading…" : "Scan barcode"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFile}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
