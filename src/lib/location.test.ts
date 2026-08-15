import { describe, expect, it } from "vitest";

import { isLocationStale, LOCATION_STALE_SECONDS } from "@/lib/location";

describe("isLocationStale", () => {
  it("não considera desatualizado logo após a atualização", () => {
    expect(isLocationStale(new Date())).toBe(false);
  });

  it("considera desatualizado passado o limite", () => {
    const atualizadoEm = new Date(Date.now() - (LOCATION_STALE_SECONDS + 5) * 1000);
    expect(isLocationStale(atualizadoEm)).toBe(true);
  });

  it("não considera desatualizado um segundo antes do limite", () => {
    const atualizadoEm = new Date(Date.now() - (LOCATION_STALE_SECONDS - 1) * 1000);
    expect(isLocationStale(atualizadoEm)).toBe(false);
  });
});
