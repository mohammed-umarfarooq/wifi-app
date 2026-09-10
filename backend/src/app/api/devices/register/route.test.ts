import { POST } from "@/app/api/devices/register/route";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

jest.mock("@/lib/auth");

describe("POST /api/devices/register", () => {
  const mockPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 if unauthorized", async () => {
    (auth.getSession as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost/api/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Test Device", macAddress: "00:11:22:33:44:55" })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 if name is missing", async () => {
    (auth.getSession as jest.Mock).mockResolvedValue({
      user: { id: "user_1" }
    });

    const req = new Request("http://localhost/api/devices/register", {
      method: "POST",
      body: JSON.stringify({ macAddress: "00:11:22:33:44:55" })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should register a device and return 200", async () => {
    (auth.getSession as jest.Mock).mockResolvedValue({
      user: { id: "user_1" }
    });

    const mockDevice = { id: "dev_1", name: "Test Device", userId: "user_1", macAddress: "00:11:22:33:44:55" };
    mockPrisma.device.create.mockResolvedValue(mockDevice);

    const req = new Request("http://localhost/api/devices/register", {
      method: "POST",
      body: JSON.stringify({ name: "Test Device", macAddress: "00:11:22:33:44:55" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("dev_1");
  });
});
