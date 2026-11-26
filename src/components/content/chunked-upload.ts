// Sends one file to a Google Drive resumable-upload session, in chunks,
// straight from the browser. Reports progress (0–1) and returns the new
// Drive file id. A failed chunk is tried again a few times — phones on
// shaky Wi-Fi are the normal case here.

const CHUNK = 16 * 1024 * 1024; // multiple of 256 KiB, as Drive requires

function putChunk(url: string, blob: Blob, start: number, total: number, onProgress: (loaded: number) => void) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${start + blob.size - 1}/${total}`);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Netzwerkfehler"));
    xhr.ontimeout = () => reject(new Error("Zeitüberschreitung"));
    xhr.timeout = 10 * 60_000;
    xhr.send(blob);
  });
}

/** After a broken chunk: ask Drive how much it already has (-1 = unknown). */
function queryOffset(url: string, total: number) {
  return new Promise<{ done: string | null; next: number }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", `bytes */${total}`);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) return resolve({ done: xhr.responseText, next: total });
      const range = xhr.getResponseHeader("Range"); // "bytes=0-1234"
      const m = range?.match(/-(\d+)$/);
      resolve({ done: null, next: m ? Number(m[1]) + 1 : xhr.status === 308 && !range ? 0 : -1 });
    };
    xhr.onerror = () => resolve({ done: null, next: -1 });
    xhr.send();
  });
}

export async function uploadToDrive(
  sessionUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const total = file.size;
  const idFrom = (body: string) => {
    const json = JSON.parse(body || "{}") as { id?: string };
    if (!json.id) throw new Error("Upload ohne Datei-ID beendet");
    return json.id;
  };
  let start = 0;
  while (start < total) {
    const from = start;
    const end = Math.min(from + CHUNK, total);
    let next = -1;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await putChunk(sessionUrl, file.slice(from, end), from, total, (loaded) =>
          onProgress(Math.min(1, (from + loaded) / total)),
        );
        if (res.status === 200 || res.status === 201) {
          onProgress(1);
          return idFrom(res.body);
        }
        if (res.status === 308) {
          next = end;
          break;
        }
        throw new Error(`Upload-Fehler ${res.status}`);
      } catch (err) {
        if (attempt >= 4) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        const q = await queryOffset(sessionUrl, total);
        if (q.done) return idFrom(q.done);
        if (q.next >= 0 && q.next !== from) {
          next = q.next;
          break;
        }
      }
    }
    start = next;
  }
  throw new Error("Upload unvollständig");
}
