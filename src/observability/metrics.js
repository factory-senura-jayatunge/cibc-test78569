// @ts-check
// In-process HTTP metrics rendered in the Prometheus text exposition format (version 0.0.4).
// Labels use route templates such as /api/statements/:accountId, never raw paths, so account
// numbers stay out of metrics and label cardinality stays bounded.

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];
export const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/** @param {string} value */
const escapeLabel = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

/** @param {Record<string, string>} labels */
const formatLabels = (labels) => {
  const pairs = Object.entries(labels).map(([key, value]) => `${key}="${escapeLabel(value)}"`);
  return pairs.length ? `{${pairs.join(',')}}` : '';
};

/**
 * @param {{ uptimeSeconds?: () => number, memoryUsage?: () => NodeJS.MemoryUsage }} [options]
 */
export function createMetrics({ uptimeSeconds = () => process.uptime(), memoryUsage = () => process.memoryUsage() } = {}) {
  /** @type {Map<string, { labels: Record<string, string>, value: number }>} */
  const requests = new Map();
  /** @type {Map<string, { labels: Record<string, string>, buckets: number[], sum: number, count: number }>} */
  const durations = new Map();

  /**
   * @param {{ method: string, route: string, status: number, durationSeconds: number }} observation
   */
  function observeRequest({ method, route, status, durationSeconds }) {
    const counterLabels = { method, route, status: String(status) };
    const counterKey = formatLabels(counterLabels);
    const counter = requests.get(counterKey) ?? { labels: counterLabels, value: 0 };
    counter.value += 1;
    requests.set(counterKey, counter);

    const histogramLabels = { method, route };
    const histogramKey = formatLabels(histogramLabels);
    const histogram = durations.get(histogramKey) ?? { labels: histogramLabels, buckets: DURATION_BUCKETS.map(() => 0), sum: 0, count: 0 };
    DURATION_BUCKETS.forEach((bound, index) => {
      if (durationSeconds <= bound) histogram.buckets[index] += 1;
    });
    histogram.sum += durationSeconds;
    histogram.count += 1;
    durations.set(histogramKey, histogram);
  }

  function render() {
    const lines = ['# HELP http_requests_total HTTP requests handled, by method, route template, and status.', '# TYPE http_requests_total counter'];
    for (const { labels, value } of requests.values()) lines.push(`http_requests_total${formatLabels(labels)} ${value}`);

    lines.push(
      '# HELP http_request_duration_seconds HTTP request latency, by method and route template.',
      '# TYPE http_request_duration_seconds histogram',
    );
    for (const { labels, buckets, sum, count } of durations.values()) {
      DURATION_BUCKETS.forEach((bound, index) => {
        lines.push(`http_request_duration_seconds_bucket${formatLabels({ ...labels, le: String(bound) })} ${buckets[index]}`);
      });
      lines.push(`http_request_duration_seconds_bucket${formatLabels({ ...labels, le: '+Inf' })} ${count}`);
      lines.push(`http_request_duration_seconds_sum${formatLabels(labels)} ${sum}`);
      lines.push(`http_request_duration_seconds_count${formatLabels(labels)} ${count}`);
    }

    const memory = memoryUsage();
    lines.push(
      '# HELP process_uptime_seconds Seconds since the process started.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${uptimeSeconds()}`,
      '# HELP process_resident_memory_bytes Resident set size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${memory.rss}`,
      '# HELP nodejs_heap_used_bytes V8 heap in use, in bytes.',
      '# TYPE nodejs_heap_used_bytes gauge',
      `nodejs_heap_used_bytes ${memory.heapUsed}`,
    );
    return `${lines.join('\n')}\n`;
  }

  return { observeRequest, render };
}
