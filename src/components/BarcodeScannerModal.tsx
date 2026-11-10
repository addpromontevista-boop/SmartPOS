import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, ScanLine, Keyboard } from 'lucide-react';

interface BarcodeScannerModalProps {
  products: any[];
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  products,
  onDetected,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'STARTING' | 'ACTIVE' | 'FALLBACK'>('STARTING');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let scanInterval: number | null = null;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraStatus('FALLBACK');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraStatus('ACTIVE');
        }

        // Use native BarcodeDetector API where supported (Chrome Android / macOS)
        const Win = window as unknown as { BarcodeDetector?: any };
        if (Win.BarcodeDetector) {
          const detector = new Win.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a'],
          });
          scanInterval = window.setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes && codes.length > 0 && codes[0].rawValue) {
                  onDetected(codes[0].rawValue);
                  onClose();
                }
              } catch {
                // Ignore frame decode error
              }
            }
          }, 350);
        }
      } catch {
        setCameraStatus('FALLBACK');
      }
    }

    startCamera();

    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onDetected, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Mobile Camera & USB/Bluetooth Barcode Scanner
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera Viewport */}
          <div className="relative h-48 rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraStatus === 'ACTIVE' ? 'block' : 'hidden'}`}
              muted
              playsInline
            />
            {cameraStatus !== 'ACTIVE' && (
              <div className="text-center px-6 space-y-2">
                <ScanLine className="w-8 h-8 text-blue-400 mx-auto" />
                <p className="text-xs text-slate-300">
                  {cameraStatus === 'STARTING'
                    ? 'Initializing mobile rear camera lens...'
                    : 'Camera feed standby in sandboxed preview — use quick barcode tap or manual/USB entry below.'}
                </p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_#ef4444]" />
          </div>

          {/* Manual / USB Wedge Entry */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                onDetected(manualCode.trim());
                onClose();
              }
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan with USB scanner or enter EAN-13 barcode..."
                className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap shrink-0"
            >
              Add Barcode
            </button>
          </form>

          {/* One-Tap Catalog Barcodes for Quick Testing */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tap a catalog barcode to simulate an instant optical scan:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onDetected(p.barcode);
                    onClose();
                  }}
                  className="min-h-[44px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/70 dark:bg-slate-800/50 text-left flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {p.barcode} · {p.sku}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                    Scan
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
