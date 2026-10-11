import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, FileAudio, Loader2, Mic, Square, X } from "lucide-react";
import { mediaApi } from "@/services/api/media";

/** Tope de una grabación: es un mensaje de voz, no un pódcast. */
const MAX_RECORDING_MS = 3 * 60 * 1000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export interface AudioItem {
  status: "uploading" | "done" | "error";
  mediaId?: string;
  durationMs: number | null;
  /** URL para escucharlo: blob: local mientras se sube o la del Worker si ya estaba guardado. */
  url?: string;
  error?: string;
}

const formatClock = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Duración de un archivo de audio según el navegador (null si no la sabe). */
function measureDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : null);
    audio.onerror = () => resolve(null);
    audio.src = url;
  });
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
}

/** Estado del audio de un formulario: grabar o elegir un archivo, y subirlo. */
export function useAudioUpload() {
  const [audio, setAudio] = useState<AudioItem | null>(null);

  async function upload(blob: Blob, durationMs: number | null) {
    const url = URL.createObjectURL(blob);
    if (blob.size > MAX_AUDIO_BYTES) {
      setAudio({ status: "error", durationMs, url, error: "El audio supera 10 MB" });
      return;
    }
    setAudio({ status: "uploading", durationMs, url });
    try {
      const uploaded = await mediaApi.uploadAudio(blob, durationMs);
      setAudio({ status: "done", mediaId: uploaded.id, durationMs: uploaded.durationMs ?? durationMs, url });
    } catch (err) {
      setAudio({ status: "error", durationMs, url, error: err instanceof Error ? err.message : "No se pudo subir" });
    }
  }

  const setSaved = useCallback((saved: { id: string; durationMs: number | null; url: string } | null) => {
    setAudio(saved ? { status: "done", mediaId: saved.id, durationMs: saved.durationMs, url: saved.url } : null);
  }, []);

  return {
    audio,
    setSaved,
    upload,
    remove: () => setAudio(null),
    uploadedId: audio?.status === "done" ? (audio.mediaId ?? null) : null,
    busy: audio?.status === "uploading",
  };
}

type Props = Pick<ReturnType<typeof useAudioUpload>, "audio" | "upload" | "remove">;

export function AudioRecorder({ audio, upload, remove }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canRecord = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && pickMimeType() !== undefined;

  // Si se sale de la pantalla grabando, se suelta el micrófono.
  useEffect(() => () => recorderRef.current?.stream.getTracks().forEach((track) => track.stop()), []);

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("No se pudo usar el micrófono. Revisa el permiso del navegador.");
      return;
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS && recorder.state === "recording") recorder.stop();
    }, 250);

    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    recorder.onstop = () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      setRecording(false);
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (blob.size > 0) void upload(blob, Date.now() - startedAt);
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setElapsed(0);
    setRecording(true);
  }

  async function chooseFile(file: File) {
    setError(null);
    const url = URL.createObjectURL(file);
    const durationMs = await measureDuration(url);
    URL.revokeObjectURL(url);
    await upload(file, durationMs);
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-blush-50 px-4 py-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-blush-500" aria-hidden />
        <span className="flex-1 font-semibold text-blush-700" aria-live="polite">
          Grabando… {formatClock(elapsed)} <span className="font-normal text-ink-soft">/ {formatClock(MAX_RECORDING_MS)}</span>
        </span>
        <button
          type="button"
          onClick={() => recorderRef.current?.stop()}
          className="inline-flex items-center gap-1.5 rounded-full bg-blush-500 px-4 py-2 text-sm font-semibold text-paper"
        >
          <Square size={14} fill="currentColor" aria-hidden /> Detener
        </button>
      </div>
    );
  }

  if (audio) {
    return (
      <div className="rounded-2xl bg-lavender-100 p-3">
        <div className="flex items-center gap-2">
          {audio.status === "uploading" && <Loader2 size={18} className="shrink-0 animate-spin text-lavender-500" aria-label="Subiendo" />}
          {audio.status === "error" && <AlertCircle size={18} className="shrink-0 text-blush-700" aria-hidden />}
          {audio.url && <audio controls preload="metadata" src={audio.url} className="h-10 min-w-0 flex-1" />}
          <button
            type="button"
            onClick={remove}
            aria-label="Quitar audio"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/90 text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        {audio.status === "error" && <p className="mt-2 text-sm font-semibold text-blush-700">{audio.error}</p>}
        {audio.status === "uploading" && <p className="mt-2 text-xs text-ink-soft">Subiendo audio…</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {canRecord && (
          <button
            type="button"
            onClick={startRecording}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-lavender-300 py-4 text-sm font-semibold text-lavender-500 transition hover:bg-lavender-100"
          >
            <Mic size={22} strokeWidth={1.75} aria-hidden />
            Grabar mensaje
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-lavender-300 py-4 text-sm font-semibold text-lavender-500 transition hover:bg-lavender-100 ${canRecord ? "" : "col-span-2"}`}
        >
          <FileAudio size={22} strokeWidth={1.75} aria-hidden />
          Elegir audio
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void chooseFile(file);
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-blush-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-soft">Una nota de voz de hasta 3 minutos, o un audio de hasta 10 MB.</p>
    </div>
  );
}
