import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId } = session.user as any;
  const { name, macAddress } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const device = await prisma.device.create({
      data: {
        userId,
        name,
        macAddress,
      }
    });
    return NextResponse.json(device);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to register device", details: error.message }, { status: 500 });
  }
}
