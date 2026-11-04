"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { readFace } from "@/lib/gaze";
export type Face = NonNullable<ReturnType<typeof readFace>>;
export function useVision(onFrame: (face: Face | null, now: number) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const resources = useRef<{ detector?: FaceLandmarker; stream?: MediaStream; raf?: number; timer?: ReturnType<typeof setTimeout> }>({});
  const generation = useRef(0), callback = useRef(onFrame); callback.current = onFrame;
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState("");
  const stop = useCallback(() => {
    generation.current++; const r = resources.current;
    if (r.raf) cancelAnimationFrame(r.raf);
    if (r.timer) clearTimeout(r.timer);
    r.stream?.getTracks().forEach(t => t.stop()); r.detector?.close(); resources.current = {};
    if (video.current) video.current.srcObject = null;
    setStatus("idle"); callback.current(null, performance.now());
  }, []);
  const start = useCallback(async () => {
    stop(); const id = generation.current; setStatus("loading"); setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera needs HTTPS or localhost in a supported browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } }, audio: false });
      if (id !== generation.current) { stream.getTracks().forEach(t => t.stop()); return; }
      resources.current.stream = stream;
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/wasm");
      const detector = await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" }, runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: .6, minTrackingConfidence: .6 });
      if (id !== generation.current) { detector.close(); return; }
      resources.current.detector = detector;
      const element = video.current; if (!element) throw new Error("Camera preview unavailable");
      element.srcObject = stream; await element.play();
      if (id !== generation.current) return;
      setStatus("running"); let previous = 0, frameTime = -1;
      const tick = (now: number) => {
        if (id !== generation.current) return;
        try {
          if (now - previous >= 40 && element.readyState >= 2 && element.currentTime !== frameTime) {
            previous = now; frameTime = element.currentTime;
            const result = detector.detectForVideo(element, now);
            callback.current(result.faceLandmarks[0] ? readFace(result.faceLandmarks[0]) : null, now);
          }
          if (window.irisDesktop) resources.current.timer = setTimeout(() => tick(performance.now()), 40);
          else resources.current.raf = requestAnimationFrame(tick);
        } catch (cause) { stop(); setStatus("error"); setError(cause instanceof Error ? cause.message : "Tracking failed"); }
      };
      resources.current.raf = requestAnimationFrame(tick);
      stream.getVideoTracks()[0].addEventListener("ended", stop, { once: true });
    } catch (cause) {
      if (id !== generation.current) return;
      stop(); setStatus("error"); setError(cause instanceof Error && /chunk|dynamically imported/i.test(cause.message) ? "The application was updated. Reload this page to load the current camera files." : cause instanceof Error ? cause.message : "Camera could not start");
    }
  }, [stop]);
  useEffect(() => { const pause = () => { if (document.hidden && !window.irisDesktop) stop(); }; document.addEventListener("visibilitychange", pause); return () => { document.removeEventListener("visibilitychange", pause); stop(); }; }, [stop]);
  return { video, status, error, start, stop };
}
