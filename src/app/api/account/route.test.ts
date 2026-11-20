import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), deleteUser: vi.fn(), storageFrom: vi.fn(), listPhotos: vi.fn(), removePhotos: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { admin: { deleteUser: mocks.deleteUser } }, storage: { from: mocks.storageFrom } }) }));
const accountId = "94e31bf1-735b-4573-a3d8-720048e91136";
const otherId = "55aaa08c-aa34-4961-9321-42d84638ca00";
const request = (id?: string) => new Request("https://day.example/api/account", { method: "DELETE", headers: { "Content-Type": "application/json", Origin: "https://day.example" }, body: JSON.stringify({ confirmation: "УДАЛИТЬ", accountId: id }) });
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: accountId } }, error: null });
  mocks.deleteUser.mockReset().mockResolvedValue({ error: null });
  mocks.listPhotos.mockReset().mockResolvedValue({ data: [], error: null });
  mocks.removePhotos.mockReset().mockResolvedValue({ data: [], error: null });
  mocks.storageFrom.mockReset().mockReturnValue({ list: mocks.listPhotos, remove: mocks.removePhotos });
});
afterEach(() => vi.unstubAllEnvs());
describe("account deletion identity", () => {
  it("requires the account whose deletion was confirmed", async () => {
    expect((await DELETE(request())).status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("rejects a confirmation from another account", async () => {
    expect((await DELETE(request(otherId))).status).toBe(409);
    expect(mocks.listPhotos).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("deletes only the authenticated, explicitly confirmed account", async () => {
    const response = await DELETE(request(accountId));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(accountId);
  });
  it("does not delete without an authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await DELETE(request(accountId))).status).toBe(401);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});

const photo = (name: string) => ({ id: "storage-object-id", name, created_at: "2026-11-20T00:00:00Z", updated_at: "2026-11-20T00:00:00Z", last_accessed_at: "2026-11-20T00:00:00Z", metadata: { mimetype: "image/jpeg", size: 128 } });

describe("account deletion cloud photos", () => {
  it("removes only the authenticated user's photos before deleting the account", async () => {
    mocks.listPhotos
      .mockResolvedValueOnce({ data: [photo("926ff1de-b23d-46f2-b1ce-c63cc279b71f"), photo("b63194a3-6501-4de2-b3f0-9e1412ca9b85")], error: null })
      .mockResolvedValueOnce({ data: [photo("09e86283-0b85-46e1-830e-5dd65257d88b")], error: null });
    const response = await DELETE(request(accountId));
    expect(response.status).toBe(200);
    expect(mocks.storageFrom).toHaveBeenCalledExactlyOnceWith("day-photos");
    expect(mocks.listPhotos.mock.calls).toEqual(Array.from({ length: 3 }, () => [accountId, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } }]));
    expect(mocks.removePhotos.mock.calls).toEqual([
      [[`${accountId}/926ff1de-b23d-46f2-b1ce-c63cc279b71f`, `${accountId}/b63194a3-6501-4de2-b3f0-9e1412ca9b85`]],
      [[`${accountId}/09e86283-0b85-46e1-830e-5dd65257d88b`]],
    ]);
    expect(mocks.removePhotos.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]);
    expect(mocks.listPhotos.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]);
  });

  it("deletes an account with an empty photo folder without removing unrelated files", async () => {
    expect((await DELETE(request(accountId))).status).toBe(200);
    expect(mocks.listPhotos).toHaveBeenCalledExactlyOnceWith(accountId, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
    expect(mocks.removePhotos).not.toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(accountId);
  });

  it.each(["list", "remove"])("keeps the account when storage %s fails", async (operation) => {
    if (operation === "list") mocks.listPhotos.mockResolvedValue({ data: null, error: { message: "Storage unavailable" } });
    else {
      mocks.listPhotos.mockResolvedValue({ data: [photo("926ff1de-b23d-46f2-b1ce-c63cc279b71f")], error: null });
      mocks.removePhotos.mockResolvedValue({ data: null, error: { message: "Storage unavailable" } });
    }
    expect((await DELETE(request(accountId))).status).toBe(503);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("bounds a stalled storage operation and keeps the account", async () => {
    vi.useFakeTimers();
    try {
      mocks.listPhotos.mockReturnValue(new Promise(() => {}));
      const response = DELETE(request(accountId));
      await vi.waitFor(() => expect(mocks.listPhotos).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(15_000);
      expect((await response).status).toBe(503);
      expect(mocks.deleteUser).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not remove a path outside the expected UUID photo filenames", async () => {
    mocks.listPhotos.mockResolvedValue({ data: [photo(`../${otherId}/926ff1de-b23d-46f2-b1ce-c63cc279b71f`)], error: null });
    expect((await DELETE(request(accountId))).status).toBe(503);
    expect(mocks.removePhotos).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps the account when photos remain after 100 removal batches", async () => {
    mocks.listPhotos.mockResolvedValue({ data: [photo("926ff1de-b23d-46f2-b1ce-c63cc279b71f")], error: null });
    expect((await DELETE(request(accountId))).status).toBe(503);
    expect(mocks.removePhotos).toHaveBeenCalledTimes(100);
    expect(mocks.listPhotos).toHaveBeenCalledTimes(101);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("can delete the account after the last permitted removal batch empties its folder", async () => {
    for (let batch = 0; batch < 100; batch += 1) {
      mocks.listPhotos.mockResolvedValueOnce({ data: [photo("926ff1de-b23d-46f2-b1ce-c63cc279b71f")], error: null });
    }
    expect((await DELETE(request(accountId))).status).toBe(200);
    expect(mocks.removePhotos).toHaveBeenCalledTimes(100);
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(accountId);
  });
});
