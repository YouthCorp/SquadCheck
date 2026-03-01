/**
 * Token Bucket Rate Limiter
 * Ensures API calls stay within per-minute and daily limits.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private lastRefill: number;
  private dailyCalls: number = 0;
  private readonly dailyLimit: number;
  private dailyResetAt: number;

  constructor(perMinute: number = 280, dailyLimit: number = 7500) {
    this.maxTokens = perMinute;
    this.tokens = perMinute;
    this.lastRefill = Date.now();
    this.dailyLimit = dailyLimit;
    this.dailyResetAt = this.nextMidnightUtc();
  }

  async acquire(): Promise<void> {
    this.checkDailyReset();

    if (this.dailyCalls >= this.dailyLimit) {
      const waitMs = this.dailyResetAt - Date.now();
      throw new DailyLimitError(this.dailyCalls, waitMs);
    }

    this.refill();

    if (this.tokens < 1) {
      const waitMs = Math.ceil(((1 - this.tokens) / this.maxTokens) * 60000) + 100;
      await this.sleep(waitMs);
      this.refill();
    }

    this.tokens -= 1;
    this.dailyCalls += 1;
  }

  get remaining(): { minute: number; daily: number } {
    this.refill();
    return {
      minute: Math.floor(this.tokens),
      daily: this.dailyLimit - this.dailyCalls,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + (elapsed / 60000) * this.maxTokens);
    this.lastRefill = now;
  }

  private checkDailyReset(): void {
    if (Date.now() >= this.dailyResetAt) {
      this.dailyCalls = 0;
      this.dailyResetAt = this.nextMidnightUtc();
    }
  }

  private nextMidnightUtc(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return tomorrow.getTime();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class DailyLimitError extends Error {
  constructor(
    public readonly callsMade: number,
    public readonly msUntilReset: number,
  ) {
    super(`Daily API limit reached (${callsMade} calls). Resets in ${Math.ceil(msUntilReset / 60000)} minutes.`);
    this.name = 'DailyLimitError';
  }
}
