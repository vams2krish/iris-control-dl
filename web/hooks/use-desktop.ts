"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { map, median, type Profile, type Point, type ValidationReport } from "@/lib/gaze";
import {HeadPointer,type HeadReport} from "@/lib/head-pointer";
import type { Face } from "@/hooks/use-vision";
export type DesktopState = { connected: boolean; calibrated: boolean; armed: boolean; emergency: boolean; calibrating: boolean; mode: string; dragging: boolean; dwellMs: number; lockRadius: number; error: string; inputMode:"gaze"|"head";quality:ValidationReport|HeadReport|null };
export type DesktopConfig=number|{lockRadius?:number;inputMode?:"gaze"|"head"};
type DesktopAPI = {
  snapshot(): Promise<DesktopState>; arm(): Promise<DesktopState>; pause(): Promise<DesktopState>;
  calibrate(): Promise<DesktopState>; calibrated(report:ValidationReport|HeadReport): Promise<DesktopState>; cancelCalibration(): Promise<DesktopState>;
  configure(value:DesktopConfig): Promise<DesktopState>;
  frame(frame: { x: number; y: number; confidence: number; closed: boolean;inputMode:"gaze"|"head" }): void;
  onState(callback: (state: DesktopState) => void): () => void;
};
declare global { interface Window { irisDesktop?: DesktopAPI } }
export function useDesktop() {
  const [available, setAvailable] = useState(false), [state, setState] = useState<DesktopState | null>(null), [error, setError] = useState("");
  const profile = useRef<Profile | null>(null), smooth = useRef<{ x: number; y: number } | null>(null);
  const head=useRef(new HeadPointer()),centering=useRef<Point[]|null>(null),recent=useRef<Point[]>([]);
  const [centerCount,setCenterCount]=useState<number|null>(null);
  const inputMode=useRef<"gaze"|"head">("gaze");inputMode.current=state?.inputMode??"gaze";
  useEffect(() => {
    const api = window.irisDesktop; if (!api) return;
    setAvailable(true); api.snapshot().then(setState).catch(cause => setError(String(cause)));
    return api.onState(setState);
  }, []);
  const run = useCallback(async (operation: "arm" | "pause" | "calibrate" | "cancelCalibration") => {
    try { setError(""); const api = window.irisDesktop; if (!api) return false;
      if (operation === "calibrate") { profile.current = null; smooth.current = null; recent.current=[];head.current.reset(); }
      if(operation==="cancelCalibration"){profile.current=null;head.current.reset();smooth.current=null;centering.current=null;setCenterCount(null);}
      setState(await api[operation]()); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  }, []);
  const complete = useCallback(async (value: Profile, report:ValidationReport) => {
    try { const api = window.irisDesktop; if (!api) return; const next=await api.calibrated(report);profile.current=next.calibrated?value:null;smooth.current=null;recent.current=[];setState(next); }
    catch (cause) { profile.current = null; setError(String(cause)); }
  }, []);
  const process = useCallback((face: Face | null,now:number) => {
    const api = window.irisDesktop; if (!api) return;
    const mode=inputMode.current;
    if (!face || face.confidence < .65) { smooth.current=null;recent.current=[];head.current.lost();if(centering.current){centering.current=[];setCenterCount(0);}api.frame({x:.5,y:.5,confidence:0,closed:false,inputMode:mode});return; }
    if(mode==="head"&&centering.current){
      if(face.closed)return;centering.current.push(face.head);setCenterCount(centering.current.length);
      if(centering.current.length>=30){const report=head.current.center(centering.current);centering.current=null;setCenterCount(null);
        if(report.passed)void api.calibrated(report).then(setState).catch(c=>setError(String(c)));
        else {setError("Head moved during centering. Keep still and try Center head again.");void api.cancelCalibration().then(setState);}
      }return;
    }
    const previous=smooth.current;
    let raw:Point|null;
    if(mode==="head"){if(face.closed)head.current.lost();raw=face.closed?previous:head.current.update(face.head,now);}
    else if(profile.current){const p=map(profile.current,face.features);if(!face.closed){recent.current.push(p);if(recent.current.length>5)recent.current.shift();}raw=recent.current.length?{x:median(recent.current.map(v=>v.x)),y:median(recent.current.map(v=>v.y))}:p;}
    else raw=null;
    if(!raw){api.frame({x:.5,y:.5,confidence:0,closed:false,inputMode:mode});return;}
    const p=face.closed&&previous?previous:mode==="head"?raw:previous?{x:previous.x+.25*(raw.x-previous.x),y:previous.y+.25*(raw.y-previous.y)}:raw;
    if (!face.closed) smooth.current = p;
    api.frame({ ...p, confidence: face.confidence, closed: face.closed,inputMode:mode });
  }, []);
  const configure = useCallback(async (value:DesktopConfig) => { try { if(typeof value==="object"&&value.inputMode){profile.current=null;head.current.reset();smooth.current=null;centering.current=null;setCenterCount(null);}const next = await window.irisDesktop?.configure(value); if (next) setState(next); } catch (cause) { setError(String(cause)); } }, []);
  const centerHead=useCallback(async()=>{if(await run("calibrate")){centering.current=[];setCenterCount(0);setError("");}},[run]);
  return { available, state, error, run, complete, process, configure,centerHead,centerCount };
}
