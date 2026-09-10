import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, role } = session.user as any;

  let devices;
  if (role === "ADMIN") {
    devices = await prisma.device.findMany({ include: { user: true } });
  } else {
    devices = await prisma.device.findMany({ where: { userId } });
  }

  return NextResponse.json(devices);
}
