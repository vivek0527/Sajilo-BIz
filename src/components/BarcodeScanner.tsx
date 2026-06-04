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
          qrbox: { width: 260, height: 140 },
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
    <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Zap size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Barcode Scanner</h3>
            <p className="text-[10px] text-muted-foreground">Point camera at product barcode</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSwitchCamera}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            title="Switch Camera"
          >
            <SwitchCamera size={16} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-all"
            title="Close Scanner"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scanner View */}
      <div className="relative bg-black">
        <div id={containerId} className="w-full" />

        {isStarting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 min-h-[200px]">
            <Loader2 className="animate-spin text-primary" size={28} />
            <span className="text-xs text-muted-foreground">Initializing camera...</span>
          </div>
        )}

        {error && (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
            <Camera size={32} className="text-muted-foreground" />
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => startScanner(facingMode)}
              className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-border bg-secondary/20 text-center">
        {lastScanned ? (
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-500 font-semibold animate-in fade-in duration-200">
            <Zap size={14} />
            Scanned: <span className="font-mono">{lastScanned}</span>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Align the barcode within the scanner frame. Auto-detects EAN, UPC, Code 128, and more.
          </p>
        )}
      </div>
    </div>
  );
}
