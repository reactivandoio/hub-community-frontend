/**
 * Sends files to Strapi's media library through the `/api/upload` route and
 * returns the ids Strapi gave them, ready to be linked in a mutation.
 *
 * Every failure becomes an `UploadError` whose message can be shown to the
 * admin as is: the caller must not save the record as if the upload worked.
 */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export async function uploadFiles(...files: File[]): Promise<string[]> {
  const body = new FormData();
  files.forEach(file => body.append('files', file));

  let response: Response;
  try {
    response = await fetch('/api/upload', { method: 'POST', body });
  } catch {
    throw new UploadError(
      'Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.'
    );
  }

  if (response.status === 413) {
    throw new UploadError(
      'A imagem é grande demais para o servidor aceitar. Use uma imagem menor.',
      413
    );
  }

  // A proxy in front of the route may answer in HTML, so the body is read as
  // text and only trusted when it parses.
  const text = await response.text();
  let payload: any = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    console.error('Upload error:', response.status, text);
    throw new UploadError(
      `Não foi possível enviar a imagem (erro ${response.status}). Tente novamente.`,
      response.status
    );
  }

  const ids = (Array.isArray(payload) ? payload : [])
    .map((file: any) => file?.id?.toString() || file?.documentId)
    .filter(Boolean);
  if (ids.length === 0) {
    throw new UploadError(
      'O servidor não confirmou o envio da imagem. Tente novamente.'
    );
  }
  return ids;
}
