import { describe, expect, it } from "vitest";
import {
  bloomSeriesData,
  timelineSeriesData,
} from "@/pages/Admin/AgentData/TaskAnalysisComparePage";

const record = (id: number, result: any) => ({
  id,
  title: `T${id}`,
  created_at: "2026-01-01T00:00:00Z",
  result,
  normalizedResult: result,
  compareKey: `${id}-0`,
});

describe("comparison chart data", () => {
  it("keeps missing Bloom levels as gaps instead of zero", () => {
    const data = bloomSeriesData([
      record(1, { bloom: { 记忆: 3 } }),
      record(2, { bloom: { 记忆: 0, 理解: 2 } }),
      record(3, {}),
    ], "理解");
    expect(data).toEqual([null, 2, null]);
  });

  it("uses real bucket_start minutes and aligns records by the earliest bucket", () => {
    const series = timelineSeriesData([
      record(1, { timeline_buckets: [
        { bucket_start: "2026-01-01T00:00:00Z", question_count: 1 },
        { bucket_start: "2026-01-01T00:03:00Z", question_count: 2 },
      ] }),
      record(2, { timeline_buckets: [
        { bucket_start: "2026-01-01T00:01:00Z", question_count: 3 },
      ] }),
    ]);
    expect(series[0].data).toEqual([[0, 1], [3, 2]]);
    expect(series[1].data).toEqual([[1, 3]]);
  });

  it("ignores buckets without a valid timestamp", () => {
    const series = timelineSeriesData([
      record(1, { timeline_buckets: [
        { bucket_start: "invalid", question_count: 9 },
        { bucket_start: "2026-01-01T00:02:00Z", question_count: 4 },
      ] }),
    ]);
    expect(series[0].data).toEqual([[0, 4]]);
  });
});
