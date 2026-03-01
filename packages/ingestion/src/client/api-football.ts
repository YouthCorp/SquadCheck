import axios, { AxiosInstance } from 'axios';
import { RateLimiter } from './rate-limiter';

export interface ApiResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | [];
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

export class ApiFootballClient {
  private readonly http: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly maxRetries: number = 3;

  constructor(apiKey: string, perMinute = 280, dailyLimit = 7500) {
    this.http = axios.create({
      baseURL: 'https://v3.football.api-sports.io',
      headers: { 'x-apisports-key': apiKey },
      timeout: 30000,
    });
    this.rateLimiter = new RateLimiter(perMinute, dailyLimit);
  }

  get remaining() {
    return this.rateLimiter.remaining;
  }

  async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<ApiResponse<T>> {
    await this.rateLimiter.acquire();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const { data } = await this.http.get<ApiResponse<T>>(endpoint, { params });

        const errors = data.errors;
        if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
          throw new ApiFootballError(endpoint, errors);
        }

        return data;
      } catch (err) {
        if (err instanceof ApiFootballError) throw err;
        if (attempt === this.maxRetries) throw err;

        const waitMs = 2000 * Math.pow(2, attempt - 1);
        console.warn(`  [Retry ${attempt}/${this.maxRetries}] ${endpoint} — waiting ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    throw new Error('Unreachable');
  }

  async requestAllPages<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const res = await this.request<T>(endpoint, { ...params, page });
      all.push(...res.response);
      totalPages = res.paging.total;
      page++;
    } while (page <= totalPages);

    return all;
  }
}

export class ApiFootballError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly errors: Record<string, string>,
  ) {
    super(`API-Football error on ${endpoint}: ${JSON.stringify(errors)}`);
    this.name = 'ApiFootballError';
  }
}
