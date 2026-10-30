export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readForm(request) {
  const type = (request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!["application/x-www-form-urlencoded", "multipart/form-data"].includes(type)) {
    throw new HttpError(415, "Use a form content type.");
  }
  const limit = 32 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new HttpError(413, "Form is too large.");
  const chunks = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new HttpError(413, "Form is too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return await new Response(new Blob(chunks), { headers: { "content-type": request.headers.get("content-type") } }).formData();
  } catch {
    throw new HttpError(400, "Invalid form body.");
  }
}
