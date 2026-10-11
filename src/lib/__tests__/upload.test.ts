import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadError, uploadFiles } from '../upload';

const file = () => new File(['x'], 'cover.jpg', { type: 'image/jpeg' });

const respond = (
  status: number,
  body: string,
  contentType = 'application/json'
) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(body, { status, headers: { 'Content-Type': contentType } })
    );

afterEach(() => vi.restoreAllMocks());

describe('uploadFiles', () => {
  it('posts the file to /api/upload and returns the Strapi ids', async () => {
    const fetchSpy = respond(200, JSON.stringify([{ id: 42 }]));

    await expect(uploadFiles(file())).resolves.toEqual(['42']);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/upload');
    expect((init?.body as FormData).get('files')).toBeInstanceOf(File);
  });

  it('turns a 413 into a "too large" message, even when the proxy answers in HTML', async () => {
    respond(
      413,
      '<html><body>413 Request Entity Too Large</body></html>',
      'text/html'
    );

    const error = await uploadFiles(file()).catch(e => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error.status).toBe(413);
    expect(error.message).toMatch(/grande demais/);
  });

  it('reports the status of any other server failure', async () => {
    respond(500, JSON.stringify({ error: 'Upload failed: boom' }));

    const error = await uploadFiles(file()).catch(e => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error.status).toBe(500);
    expect(error.message).toMatch(/500/);
  });

  it('fails when the server answers OK without any file id', async () => {
    respond(200, '[]');

    await expect(uploadFiles(file())).rejects.toBeInstanceOf(UploadError);
  });

  it('reports a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    const error = await uploadFiles(file()).catch(e => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error.message).toMatch(/conexão/);
  });
});
