import { AutobahnClient, AutobahnProviderError } from './autobahn.client';

describe('AutobahnClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requests the warning endpoint with an encoded motorway identifier', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ warning: [{ identifier: 'warning-1' }] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    await expect(
      new AutobahnClient().fetchWarnings('A1 / test'),
    ).resolves.toEqual([{ identifier: 'warning-1' }]);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'https://verkehr.autobahn.de/o/autobahn/A1%20%2F%20test/services/warning',
      ),
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('retries a transient provider failure once before succeeding', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ warning: [] }), { status: 200 }),
      );
    global.fetch = fetchMock;

    await expect(new AutobahnClient().fetchWarnings('A1')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an invalid provider response', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ wrong: [] }), { status: 200 }),
      );
    global.fetch = fetchMock;

    await expect(new AutobahnClient().fetchWarnings('A1')).rejects.toEqual(
      expect.objectContaining<Partial<AutobahnProviderError>>({
        message: 'Autobahn warning response did not contain a warning array',
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
