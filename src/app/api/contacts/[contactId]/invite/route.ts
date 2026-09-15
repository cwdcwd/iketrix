import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { createClerkClient } from "@clerk/nextjs/server";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// POST /api/contacts/[contactId]/invite — send Clerk invitation
export async function POST(
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

  // Already linked — no invite needed
  if (contact.linkedUserId) {
    return NextResponse.json({ error: "Contact is already a user" }, { status: 400 });
  }

  // Already invited
  if (contact.clerkInvitationId && contact.inviteStatus === "pending") {
    return NextResponse.json({ error: "Invitation already pending" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iketrix.vercel.app";

  try {
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: contact.email,
      redirectUrl: appUrl,
      publicMetadata: {
        invitedBy: user.id,
        contactId: contact.id,
      },
    });

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        clerkInvitationId: invitation.id,
        inviteStatus: "pending",
      },
    });

    return NextResponse.json({ contact: updated, invitationId: invitation.id });
  } catch (err) {
    console.error("[invite] Failed to create Clerk invitation:", err);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}
