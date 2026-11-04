"use client";
import { Monitor, Pause, Play, Crosshair, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesktopState } from "@/hooks/use-desktop";
export function DesktopPanel({ available, state, error, running, calibrate, arm, pause }: {
  available: boolean; state: DesktopState | null; error: string; running: boolean;
  calibrate(): void; arm(): void; pause(): void;
}) {
  return <section className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5" aria-label="Windows desktop controller">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="rounded-lg bg-indigo-100 p-2.5 text-indigo-600"><Monitor size={19}/></span><div><h2 className="text-sm font-semibold">Windows desktop control</h2><p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{available ? "Control the primary monitor across Chrome, Firefox, Edge and desktop apps. Tracking continues when another app has focus." : "Use the Windows desktop app to control other pages and applications. A regular browser session stays in practice mode."}</p></div></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-medium text-indigo-600">{!available ? "Desktop app required" : state?.armed ? "Actions enabled" : "Actions paused"}</span></div>
    {available ? <><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!running || !state?.connected} onClick={calibrate}><Crosshair size={13}/>Calibrate full screen</Button><Button size="sm" disabled={!running || !state?.calibrated || !state.connected} onClick={state?.armed ? pause : arm}>{state?.armed ? <Pause size={13}/> : <Play size={13}/>} {state?.armed ? "Pause desktop actions" : "Enable desktop actions · 3s delay"}</Button></div><p className="mt-3 text-[10px] leading-5 text-slate-500"><ShieldCheck className="mr-1 inline" size={12}/>Emergency stop: <strong>Ctrl + Alt + F8</strong>. The top gaze toolbar provides Pause/Resume, scroll mode, right/double click, drag/drop, keyboard, Back, next tab and app switching. Recalibrate after moving the camera or changing display settings.</p><p className="mt-2 text-[10px] text-slate-500">{state?.calibrated ? "Desktop calibration ready" : "Start camera → calibrate full screen → enable actions"}{state?.emergency ? " · Emergency stop latched: use Enable to resume" : ""}</p></> : <a className="mt-3 inline-block text-xs font-medium text-indigo-600 underline" href="https://github.com/vams2krish/iris-control-dl/blob/main/desktop/README.md">Windows installation and controls</a>}
    {(error || state?.error) && <p role="alert" className="mt-3 text-xs text-rose-700">{error || state?.error}</p>}
  </section>;
}
