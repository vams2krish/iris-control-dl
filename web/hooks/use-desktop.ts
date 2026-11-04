"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { map, type Profile } from "@/lib/gaze";
import type { Face } from "@/hooks/use-vision";
export type DesktopState = { connected: boolean; calibrated: boolean; armed: boolean; emergency: boolean; calibrating: boolean; mode: string; dragging: boolean; dwellMs: number; lockRadius: number; error: string };
type DesktopAPI = {
  snapshot(): Promise<DesktopState>; arm(): Promise<DesktopState>; pause(): Promise<DesktopState>;
  calibrate(): Promise<DesktopState>; calibrated(): Promise<DesktopState>; cancelCalibration(): Promise<DesktopState>;
  configure(value: number | { lockRadius: number }): Promise<DesktopState>;
  frame(frame: { x: number; y: number; confidence: number; closed: boolean }): void;
  onState(callback: (state: DesktopState) => void): () => void;
};
declare global { interface Window { irisDesktop?: DesktopAPI } }
export function useDesktop() {
  const [available, setAvailable] = useState(false), [state, setState] = useState<DesktopState | null>(null), [error, setError] = useState("");
  const profile = useRef<Profile | null>(null), smooth = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const api = window.irisDesktop; if (!api) return;
    setAvailable(true); api.snapshot().then(setState).catch(cause => setError(String(cause)));
    return api.onState(setState);
  }, []);
  const run = useCallback(async (operation: "arm" | "pause" | "calibrate" | "cancelCalibration") => {
    try { setError(""); const api = window.irisDesktop; if (!api) return false;
      if (operation === "calibrate") { profile.current = null; smooth.current = null; }
      setState(await api[operation]()); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  }, []);
  const complete = useCallback(async (value: Profile) => {
    try { const api = window.irisDesktop; if (!api) return; profile.current = value; smooth.current = null; setState(await api.calibrated()); }
    catch (cause) { profile.current = null; setError(String(cause)); }
  }, []);
  const process = useCallback((face: Face | null) => {
    const api = window.irisDesktop; if (!api) return;
    if (!face || face.confidence < .65 || !profile.current) { smooth.current = null; api.frame({ x: .5, y: .5, confidence: 0, closed: false }); return; }
    const raw = map(profile.current, face.features), previous = smooth.current;
    const p = face.closed && previous ? previous : previous ? { x: previous.x + .28 * (raw.x - previous.x), y: previous.y + .28 * (raw.y - previous.y) } : raw;
    if (!face.closed) smooth.current = p;
    api.frame({ ...p, confidence: face.confidence, closed: face.closed });
  }, []);
  const configure = useCallback(async (value: number | { lockRadius: number }) => { try { const next = await window.irisDesktop?.configure(value); if (next) setState(next); } catch (cause) { setError(String(cause)); } }, []);
  return { available, state, error, run, complete, process, configure };
}
