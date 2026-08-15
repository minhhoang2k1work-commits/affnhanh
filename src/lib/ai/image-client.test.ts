import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateReferenceImage } from './image-client';

describe('generateReferenceImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests a portrait production image and returns a data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'cG5n' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateReferenceImage({
      prompt: 'locked character in a cinematic room',
      aspectRatio: '9:16',
      apiKey: 'test-key',
    });

    expect(result).toBe('data:image/png;base64,cG5n');
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      model: 'gpt-image-2',
      size: '1024x1536',
      output_format: 'png',
    });
    expect(request.headers.Authorization).toBe('Bearer test-key');
  });

  it('surfaces provider errors with their response detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('quota exceeded', { status: 429 })));
    await expect(generateReferenceImage({ prompt: 'test', apiKey: 'test-key' }))
      .rejects.toThrow('quota exceeded');
  });
});
