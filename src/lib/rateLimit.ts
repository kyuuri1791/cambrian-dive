/**
 * サーバーの CPU 時間を守るための、簡単な呼び出し回数の制限。
 * サーバーのメモリ上で数えるだけなので、サーバーが再起動すると数え直しになる。
 */

type Options = {
  /** 同じ接続元から、windowMs の間に呼べる回数 */
  perClient: number;
  /** サイト全体で、windowMs の間に呼べる回数 */
  total: number;
  windowMs: number;
};

export function createRateLimiter({ perClient, total, windowMs }: Options) {
  const clients = new Map<string, number[]>();
  let all: number[] = [];

  return function allow(client: string) {
    const now = Date.now();
    const since = now - windowMs;
    all = all.filter((t) => t > since);
    const hits = (clients.get(client) ?? []).filter((t) => t > since);

    // 古い記録を掃除して、メモリが増え続けないようにする
    if (clients.size > 5000) {
      for (const [key, times] of clients) {
        if (times.every((t) => t <= since)) clients.delete(key);
      }
    }

    if (hits.length >= perClient || all.length >= total) {
      clients.set(client, hits);
      return false;
    }
    hits.push(now);
    clients.set(client, hits);
    all.push(now);
    return true;
  };
}

/**
 * 接続元の IP アドレス。
 * X-Forwarded-For の先頭は利用者が自由に書けるので、
 * 手前のサーバーが付け足す末尾の値を使う。
 */
export function clientIp(request: Request) {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)!.trim();
  return "unknown";
}
