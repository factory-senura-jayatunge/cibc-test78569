// @ts-check
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/;
const ZERO_TRACE_ID = '0'.repeat(32);

/** @param {string | string[] | undefined} header */
const first = (header) => (Array.isArray(header) ? header[0] : header);

/**
 * Reuses the caller's X-Request-ID when it is safe to echo into logs and headers, so a request
 * can be followed from an upstream proxy into OBR. Otherwise starts a new one. A W3C
 * `traceparent` header contributes its trace ID for correlation with an upstream trace.
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {() => string} [generate]
 * @returns {{ requestId: string, traceId?: string }}
 */
export function requestContext(headers, generate = randomUUID) {
  const incoming = first(headers[REQUEST_ID_HEADER]);
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : generate();
  const traceId = TRACEPARENT.exec(first(headers.traceparent) ?? '')?.[1];
  return traceId && traceId !== ZERO_TRACE_ID ? { requestId, traceId } : { requestId };
}
