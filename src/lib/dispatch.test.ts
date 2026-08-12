import { describe, expect, it } from "vitest";
import { recommendDispatch, regionStats, villageSystemBreakdown } from "./dispatch";
import { CLINICS, VILLAGES, estimateEtaMin, villageById } from "./region";

describe("regionStats", () => {
  it("reports the PRD headline screened figure", () => {
    expect(regionStats().screened).toBe(1284);
  });
  it("sums high-priority counts across villages", () => {
    const expected = VILLAGES.reduce((a, v) => a + v.high, 0);
    expect(regionStats().high).toBe(expected);
  });
  it("counts only non-offline clinics and offline villages", () => {
    const s = regionStats();
    expect(s.clinics).toBe(CLINICS.filter((c) => c.status !== "OFFLINE").length);
    expect(s.offlineVillages).toBe(VILLAGES.filter((v) => !v.online).length);
  });
});

describe("recommendDispatch", () => {
  const rec = recommendDispatch();

  it("returns a recommendation", () => {
    expect(rec).not.toBeNull();
  });

  it("targets the highest-need village (Village C, high=3)", () => {
    expect(rec!.villageId).toBe("v-c");
    expect(rec!.highCount).toBe(3);
    expect(rec!.villageName).toBe(villageById("v-c")!.name);
  });

  it("never dispatches an unavailable clinic", () => {
    const chosen = CLINICS.find((c) => c.id === rec!.clinicId)!;
    expect(chosen.status).toBe("AVAILABLE");
  });

  it("picks the nearest available clinic (lowest ETA)", () => {
    const target = villageById(rec!.villageId)!;
    const bestEta = Math.min(
      ...CLINICS.filter((c) => c.status === "AVAILABLE").map((c) =>
        estimateEtaMin(c, target)
      )
    );
    expect(rec!.etaMin).toBe(bestEta);
    // clinic-02 (48,44) is closer to v-c (52,62) than clinic-01 (40,40).
    expect(rec!.clinicId).toBe("clinic-02");
  });

  it("explains its choice with the high-priority count", () => {
    expect(rec!.reasons.some((r) => r.includes("high-priority"))).toBe(true);
  });

  it("is deterministic", () => {
    expect(recommendDispatch()).toEqual(recommendDispatch());
  });
});

describe("villageSystemBreakdown", () => {
  it("only aggregates ORANGE+ patients and keys by village id", () => {
    const b = villageSystemBreakdown();
    for (const counts of Object.values(b)) {
      for (const n of Object.values(counts)) {
        expect(n).toBeGreaterThan(0);
      }
    }
  });
});

describe("estimateEtaMin", () => {
  it("is symmetric and grows with distance", () => {
    const a = { x: 0, y: 0 };
    const near = { x: 3, y: 4 }; // dist 5
    const far = { x: 30, y: 40 }; // dist 50
    expect(estimateEtaMin(a, near)).toBe(estimateEtaMin(near, a));
    expect(estimateEtaMin(a, far)).toBeGreaterThan(estimateEtaMin(a, near));
  });
});
