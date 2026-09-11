export async function readCatalogImage(req: Request) {
  if (!req.body) throw Error('Choose an image.');
  const reader = req.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 5 * 1024 * 1024) {
      await reader.cancel();
      throw Error('Images must be under 5 MB.');
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const x of parts) {
    bytes.set(x, offset);
    offset += x.length;
  }
  const mime = req.headers.get('content-type'),
    decode = (a: number, b: number) =>
      new TextDecoder().decode(bytes.slice(a, b));
  const png =
      size > 24 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x),
    jpg = size > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    webp = size > 16 && decode(0, 4) === 'RIFF' && decode(8, 12) === 'WEBP';
  if (
    !(
      (mime === 'image/png' && png) ||
      (mime === 'image/jpeg' && jpg) ||
      (mime === 'image/webp' && webp)
    )
  )
    throw Error('Choose a PNG, JPEG or WebP image.');
  return { bytes, mime: mime! };
}
