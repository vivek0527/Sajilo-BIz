'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, X, SwitchCamera, Loader2, Zap } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const scanSeqRef = useRef(0);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [containerId] = useState(() => `barcode-scanner-view-${Math.random().toString(36).substring(2, 9)}`);

  const safeStop = useCallback(async (scanner: Html5Qrcode | null) => {
    if (!scanner) return;
    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
    } catch {
      // Ignore errors when scanner is not running
    }
    try {
      scanner.clear();
    } catch {
      // Ignore clear errors
    }
    // Clean up container DOM directly
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  }, [containerId]);

  const startScanner = useCallback(async (facing: 'environment' | 'user') => {
    if (!mountedRef.current) return;
    const seq = ++scanSeqRef.current;
    setIsStarting(true);
    setError(null);

    // Stop and clear any existing scanner
    await safeStop(scannerRef.current);
    scannerRef.current = null;

    // Small delay to let the DOM settle
    await new Promise((r) => setTimeout(r, 100));
    if (!mountedRef.current || seq !== scanSeqRef.current) return;

    try {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }

      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: facing },
        {
          fps: 15,
          qrbox: (width, height) => {
            // Keep it small and responsive on mobile viewports
            return {
              width: Math.min(width * 0.85, 260),
              height: Math.min(height * 0.7, 130),
            };
          },
          aspectRatio: 1.7777778, // Standard 16:9 aspect ratio
          disableFlip: true, // Do not flip images, to keep EAN scanning readable
        },
        (decodedText) => {
          if (!mountedRef.current || seq !== scanSeqRef.current) return;
          // Debounce: prevent duplicate scans
          setLastScanned((prev) => {
            if (prev === decodedText) return prev;
            onScan(decodedText);
            return decodedText;
          });
          setTimeout(() => {
            if (mountedRef.current) setLastScanned(null);
          }, 2000);
        },
        () => {
          // Ignore scanning failures
        }
      );

      // If unmounted or sequence changed during startup, stop it
      if (!mountedRef.current || seq !== scanSeqRef.current) {
        await safeStop(scanner);
        return;
      }

      setIsStarting(false);
    } catch (err: any) {
      if (!mountedRef.current || seq !== scanSeqRef.current) return;
      setIsStarting(false);
      if (err?.message?.includes('Permission') || err?.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err?.message?.includes('NotFoundError') || err?.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError(err?.message || 'Failed to start camera.');
      }
    }
  }, [containerId, onScan, safeStop]);

  useEffect(() => {
    mountedRef.current = true;
    startScanner(facingMode);

    return () => {
      mountedRef.current = false;
      safeStop(scannerRef.current);
      scannerRef.current = null;
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchCamera = async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    await startScanner(newFacing);
  };

  const handleClose = async () => {
    mountedRef.current = false;
    await safeStop(scannerRef.current);
    scannerRef.current = null;
    onClose();
  };

  return (
    <div className="relative w-full max-w-[280px] sm:max-w-[340px] rounded-xl border border-border bg-black shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Floating Controls (Top Right) */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-lg p-1">
        <button
          type="button"
          onClick={handleSwitchCamera}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/60 text-white/80 hover:text-white hover:bg-black transition-all"
          title="Switch Camera"
        >
          <SwitchCamera size={13} />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-red-500/20 bg-red-950/50 text-red-400 hover:bg-red-950/80 hover:text-red-200 transition-all"
          title="Close Scanner"
        >
          <X size={13} />
        </button>
      </div>

      {/* Floating Scanned Badge (Bottom Center) */}
      {lastScanned && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-emerald-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in duration-150">
          <Zap size={11} className="animate-pulse" />
          Scanned: <span className="font-mono">{lastScanned}</span>
        </div>
      )}

      {/* Scanner View */}
      <div className="relative bg-black w-full !h-auto">
        <div id={containerId} className="w-full !h-auto [&_video]:block [&_video]:w-full [&_video]:!h-auto" />

        {isStarting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 min-h-[160px]">
            <Loader2 className="animate-spin text-primary" size={22} />
            <span className="text-[10px] text-muted-foreground">Starting camera...</span>
          </div>
        )}

        {error && (
          <div className="p-6 flex flex-col items-center justify-center gap-2 text-center bg-black min-h-[160px]">
            <Camera size={24} className="text-muted-foreground" />
            <p className="text-xs text-red-500 max-w-[200px]">{error}</p>
            <button
              type="button"
              onClick={() => startScanner(facingMode)}
              className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-all"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
