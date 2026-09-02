import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  recordTelemetry: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));
vi.mock("@/lib/observability/telemetry", () => ({
  recordTelemetry: mocks.recordTelemetry,
}));

import { POST } from "@/app/api/analytics/vitals/route";

function request(body: unknown) {
  return new NextRequest("https://example.test/api/analytics/vitals", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function envWithWrite(writeDataPoint: ReturnType<typeof vi.fn>) {
  return { env: { WEB_VITALS: { writeDataPoint } } };
}

beforeEach(() => {
  mocks.getCloudflareContext.mockReset();
  mocks.recordTelemetry.mockReset();
});

describe("POST /api/analytics/vitals", () => {
  it("writes exactly one data point for a production beacon and responds 200", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(
      request({
        name: "LCP",
        value: 1234.6,
        rating: "good",
        url: "/product/arctic-pulse-tool",
        isMobile: true,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it("writes exactly the five permitted values and nothing else", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    await POST(
      request({
        name: "LCP",
        value: 1234.6,
        rating: "good",
        url: "/product/arctic-pulse-tool",
        isMobile: true,
      }),
    );

    const call = writeDataPoint.mock.calls[0][0];
    expect(call.blobs).toEqual(["LCP", "good", "/product/[slug]", "true"]);
    expect(call.doubles).toEqual([1235]);
    expect(call.indexes).toEqual(["/product/[slug]"]);
    expect(Object.keys(call).sort()).toEqual(["blobs", "doubles", "indexes"]);
  });

  it("never carries the beacon's url, userAgent, id, or timestamp values", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    await POST(
      request({
        name: "LCP",
        value: 100,
        rating: "good",
        url: "/product/SENTINEL-URL-VALUE",
        isMobile: true,
        userAgent: "SENTINEL-UA-VALUE",
        id: "SENTINEL-ID-VALUE",
        timestamp: 918273645,
      }),
    );

    const serialized = JSON.stringify(writeDataPoint.mock.calls[0][0]);
    expect(serialized).not.toContain("SENTINEL-URL-VALUE");
    expect(serialized).not.toContain("SENTINEL-UA-VALUE");
    expect(serialized).not.toContain("SENTINEL-ID-VALUE");
    expect(serialized).not.toContain("918273645");
  });

  it("drops an unknown metric name without writing", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request({ name: "NOT_A_METRIC", value: 100, url: "/" }));

    expect(res.status).toBe(200);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("drops a beacon with a missing value without writing", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request({ name: "LCP", url: "/" }));

    expect(res.status).toBe(200);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("drops a beacon whose value is a string without writing", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request({ name: "LCP", value: "100", url: "/" }));

    expect(res.status).toBe(200);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("drops a beacon whose value is NaN without writing", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request({ name: "LCP", value: Number.NaN, url: "/" }));

    expect(res.status).toBe(200);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("drops a beacon whose value is Infinity without writing", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request({ name: "LCP", value: Number.POSITIVE_INFINITY, url: "/" }));

    expect(res.status).toBe(200);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("drops a beacon whose value is negative without writing", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request({ name: "LCP", value: -5, url: "/" }));

    expect(res.status).toBe(200);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("writes a fixed 'unknown' literal when rating is missing", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    await POST(request({ name: "LCP", value: 100, url: "/" }));

    expect(writeDataPoint.mock.calls[0][0].blobs[1]).toBe("unknown");
  });

  it("writes a fixed 'unknown' literal when rating is unrecognized", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    await POST(request({ name: "LCP", value: 100, rating: "bogus-rating", url: "/" }));

    expect(writeDataPoint.mock.calls[0][0].blobs[1]).toBe("unknown");
  });

  it("writes the fallback bucket for an unrecognized url instead of the raw path", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    await POST(request({ name: "LCP", value: 100, rating: "good", url: "/does/not/exist" }));

    const call = writeDataPoint.mock.calls[0][0];
    expect(call.blobs[2]).toBe("/other");
    expect(call.indexes).toEqual(["/other"]);
  });

  it("produces no write and a 200 response for an empty body", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request(""));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("produces no write and a 200 response for a non-JSON body", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request("this is not json"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("produces no write and a 200 response for a JSON null body", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request("null"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("produces no write and a 200 response for a JSON array body", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request("[1,2,3]"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("emits analytics.vitals_sink_unavailable exactly once and returns 200 when the binding is absent", async () => {
    mocks.getCloudflareContext.mockResolvedValue({ env: {} });

    const res = await POST(request({ name: "LCP", value: 100, rating: "good", url: "/" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.recordTelemetry).toHaveBeenCalledWith("analytics.vitals_sink_unavailable", {
      operation: "persist",
      outcome: "unavailable",
      provider: "analytics",
    });
  });

  it("still returns 200 when writeDataPoint throws", async () => {
    const writeDataPoint = vi.fn(() => {
      throw new Error("boom");
    });
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    const res = await POST(request({ name: "LCP", value: 100, rating: "good", url: "/" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("still returns 200 when getCloudflareContext itself rejects", async () => {
    mocks.getCloudflareContext.mockRejectedValue(new Error("context unavailable"));

    const res = await POST(request({ name: "LCP", value: 100, rating: "good", url: "/" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("scales CLS by 1000 before storing as an integer double", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    await POST(request({ name: "CLS", value: 0.123, rating: "good", url: "/" }));

    expect(writeDataPoint.mock.calls[0][0].doubles).toEqual([123]);
  });

  it("rounds a timing metric value to the nearest integer millisecond", async () => {
    const writeDataPoint = vi.fn();
    mocks.getCloudflareContext.mockResolvedValue(envWithWrite(writeDataPoint));

    await POST(request({ name: "LCP", value: 1234.6, rating: "good", url: "/" }));

    expect(writeDataPoint.mock.calls[0][0].doubles).toEqual([1235]);
  });
});
