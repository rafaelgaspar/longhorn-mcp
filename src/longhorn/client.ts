export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class LonghornReadOnlyError extends Error {
  constructor(method: HttpMethod, path: string) {
    super(`Refusing ${method} ${path}: longhorn-mcp is running with --read-only`);
    this.name = 'LonghornReadOnlyError';
  }
}

export class LonghornApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = 'LonghornApiError';
    this.status = status;
    this.code = code;
  }
}

export interface LonghornClientOptions {
  baseUrl: string;
  readOnly: boolean;
}

/**
 * Thin wrapper over Longhorn manager's self-describing Rancher/norman-style
 * REST+RPC API (GET/POST/PUT/DELETE on /v1/<resource>[/{id}], RPC actions via
 * POST /v1/<resource>/{id}?action=<name>). The manager API is unauthenticated
 * in-cluster, so this client carries no credentials.
 */
export class LonghornClient {
  private readonly baseUrl: string;
  readonly readOnly: boolean;

  constructor(options: LonghornClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.readOnly = options.readOnly;
  }

  /** Low-level request. Every other method funnels through this so the read-only guard is centralized. */
  async request<T = unknown>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    if (this.readOnly && method !== 'GET') {
      throw new LonghornReadOnlyError(method, path);
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: unknown;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new LonghornApiError(response.status, undefined, `Longhorn API returned a non-JSON response: ${method} ${path} -> HTTP ${response.status}`);
      }
    }

    if (!response.ok) {
      const errObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;
      const message =
        errObj && typeof errObj.message === 'string'
          ? errObj.message
          : `Longhorn API request failed: ${method} ${path} -> HTTP ${response.status}`;
      const code = errObj && typeof errObj.code === 'string' ? errObj.code : undefined;
      throw new LonghornApiError(response.status, code, message);
    }

    return data as T;
  }

  list<T = unknown>(resource: string): Promise<T> {
    return this.request<T>('GET', `/v1/${resource}`);
  }

  get<T = unknown>(resource: string, id: string): Promise<T> {
    return this.request<T>('GET', `/v1/${resource}/${encodeURIComponent(id)}`);
  }

  create<T = unknown>(resource: string, body: unknown): Promise<T> {
    return this.request<T>('POST', `/v1/${resource}`, body);
  }

  update<T = unknown>(resource: string, id: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', `/v1/${resource}/${encodeURIComponent(id)}`, body);
  }

  /**
   * PUT on this API is a full-resource replace, not a merge-patch — verified
   * empirically against the live manager: PUTting only `{name, cron}` to an
   * existing recurring job silently reset `concurrency` to its zero-value
   * and dropped `groups` entirely. Fetches the current resource first and
   * merges `patch` on top before writing the full object back, so partial
   * update tools (node_update, recurringjob_update, etc.) can't silently
   * clobber fields the caller didn't mention. The manager tolerates
   * read-only norman metadata (`links`, `actions`, `type`, `id`, ...) coming
   * back in the PUT body — also verified live — so no stripping needed.
   */
  async updateMerged<T = unknown>(resource: string, id: string, patch: Record<string, unknown>): Promise<T> {
    // Fail fast on the same guard update() would hit anyway — no point
    // issuing the GET half of read-merge-write when the write half is
    // guaranteed to be refused.
    if (this.readOnly) {
      throw new LonghornReadOnlyError('PUT', `/v1/${resource}/${encodeURIComponent(id)}`);
    }
    const current = await this.get<Record<string, unknown>>(resource, id);
    return this.update<T>(resource, id, { ...current, ...patch });
  }

  delete<T = unknown>(resource: string, id: string): Promise<T> {
    return this.request<T>('DELETE', `/v1/${resource}/${encodeURIComponent(id)}`);
  }

  action<T = unknown>(resource: string, id: string, action: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', `/v1/${resource}/${encodeURIComponent(id)}?action=${encodeURIComponent(action)}`, body);
  }

  schemas<T = unknown>(): Promise<T> {
    return this.request<T>('GET', '/v1/schemas');
  }

  schema<T = unknown>(id: string): Promise<T> {
    return this.request<T>('GET', `/v1/schemas/${encodeURIComponent(id)}`);
  }
}
