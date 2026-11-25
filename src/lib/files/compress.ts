const MAX_EDGE = 2200;
const THRESHOLD = 1.5 * 1024 * 1024;

/** Shrinks large photos so uploads work on slow connections; anything else is returned unchanged. */
export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|webp)$/.test(file.type) || file.size < THRESHOLD) return file;
  try {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
