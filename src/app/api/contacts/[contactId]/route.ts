import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// PATCH /api/contacts/[contactId] — update a contact
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await params;
  const { name } = await req.json();

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId: user.id },
  });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { name: name || null },
    include: {
      linkedUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ contact: updated });
}

// DELETE /api/contacts/[contactId] — remove a contact
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId: user.id },
  });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  await prisma.contact.delete({ where: { id: contactId } });

  return NextResponse.json({ success: true });
}
