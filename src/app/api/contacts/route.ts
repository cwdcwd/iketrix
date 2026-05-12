import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/contacts — list user's contacts
export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") || "";

  const contacts = await prisma.contact.findMany({
    where: {
      userId: user.id,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      linkedUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contacts });
}

// POST /api/contacts — create a contact
export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, name } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if contact already exists
  const existing = await prisma.contact.findUnique({
    where: { userId_email: { userId: user.id, email: normalizedEmail } },
  });
  if (existing) {
    return NextResponse.json({ error: "Contact already exists", contact: existing }, { status: 409 });
  }

  // Check if the email belongs to an existing Iketrix user
  const linkedUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  const contact = await prisma.contact.create({
    data: {
      userId: user.id,
      email: normalizedEmail,
      name: name || null,
      linkedUserId: linkedUser?.id || null,
      inviteStatus: linkedUser ? "accepted" : null,
    },
    include: {
      linkedUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
