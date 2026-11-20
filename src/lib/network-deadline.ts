export const NETWORK_DEADLINE_MS = 15000;

/** Bound the full SDK operation, including token lookup and response parsing. */
export function withNetworkDeadline<T extends PromiseLike<unknown>>(operation: T, timeoutMs = NETWORK_DEADLINE_MS): Promise<Awaited<T>> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new DOMException("Network request timed out", "TimeoutError")), timeoutMs);
  });
  return Promise.race([Promise.resolve(operation), deadline]).finally(() => clearTimeout(timer));
}

/** Keep the transport deadline active while the response body is consumed. */
export function boundedFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = NETWORK_DEADLINE_MS): Promise<Response> {
  const callerSignal = init && "signal" in init ? init.signal : input instanceof Request ? input.signal : undefined;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
  return fetch(input, { ...init, signal });
}
