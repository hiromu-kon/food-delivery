import { testClient } from 'hono/testing';
import { describe, expect, it } from 'vitest';

import { app } from '../../app';

describe('GET /health', () => {
  it('API が起動していれば status: ok を返す', async () => {
    const client = testClient(app);

    const res = await client.health.$get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
