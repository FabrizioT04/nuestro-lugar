// Preparación de fotos antes de subirlas: se redimensionan, se comprimen y se genera una
// miniatura. Al redibujar la imagen en un canvas se eliminan también los metadatos EXIF
// (incluida la ubicación GPS de la cámara).

const FULL_MAX_SIDE = 1920;
const FULL_QUALITY = 0.82;
const THUMB_MAX_SIDE = 480;
const THUMB_QUALITY = 0.72;

export interface PreparedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

type Source = ImageBitmap | HTMLImageElement;

async function decode(file: Blob): Promise<Source> {
  try {
    // Respeta la orientación EXIF (fotos de móvil giradas).
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Algunos formatos (p. ej. HEIC en Safari) solo se decodifican mediante <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const sizeOf = (source: Source) =>
  source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(source: Source, maxSide: number, quality: number) {
  const { width, height } = sizeOf(source);
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no puede procesar fotos");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  // WebP pesa menos; Safari antiguo no lo genera y devuelve PNG, en ese caso usamos JPEG.
  const webp = await toBlob(canvas, "image/webp", quality);
  const blob = webp?.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg", quality);
  if (!blob) throw new Error("No se pudo comprimir la foto");
  return { blob, width: canvas.width, height: canvas.height };
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let source: Source;
  try {
    source = await decode(file);
  } catch {
    throw new Error(`No se pudo abrir "${file.name}". Prueba con una foto JPG o PNG.`);
  }
  try {
    const full = await encode(source, FULL_MAX_SIDE, FULL_QUALITY);
    const thumb = await encode(source, THUMB_MAX_SIDE, THUMB_QUALITY);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    if ("close" in source) source.close();
  }
}
