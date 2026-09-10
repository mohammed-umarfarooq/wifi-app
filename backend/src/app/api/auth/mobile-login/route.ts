import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { username, password, name, macAddress } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Generate secure mobile API token
    const apiToken = crypto.randomBytes(32).toString("hex");

    // Enforce 1 USER -> 1 ACTIVE DEVICE: delete all other devices for this user
    await prisma.device.deleteMany({ where: { userId: user.id } });

    // Create the new device and issue token
    const device = await prisma.device.create({
      data: {
        userId: user.id,
        name: name || "Android Device",
        macAddress: macAddress || null,
        apiToken,
      }
    });

    return NextResponse.json({
      token: apiToken,
      device: {
        id: device.id,
        name: device.name,
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Login failed", details: error.message }, { status: 500 });
  }
}
