import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

// POST /api/webhooks/clerk — handle Clerk webhook events
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] CLERK_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Verify webhook signature
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  let event: { type: string; data: Record<string, unknown> };

  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch (err) {
    console.error("[webhook] Verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle user.created event
  if (event.type === "user.created") {
    const { id: clerkId, email_addresses, first_name, last_name } = event.data as {
      id: string;
      email_addresses: Array<{ email_address: string }>;
      first_name: string | null;
      last_name: string | null;
    };

    const primaryEmail = email_addresses?.[0]?.email_address;
    if (!primaryEmail) return NextResponse.json({ received: true });

    // Auto-link any Contact records that match this email
    const contacts = await prisma.contact.findMany({
      where: { email: primaryEmail.toLowerCase(), linkedUserId: null },
    });

    if (contacts.length > 0) {
      // Find or create the user record
      let user = await prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            clerkId,
            email: primaryEmail.toLowerCase(),
            name: [first_name, last_name].filter(Boolean).join(" ") || null,
          },
        });
      }

      // Link contacts and update invite status
      await prisma.contact.updateMany({
        where: { email: primaryEmail.toLowerCase(), linkedUserId: null },
        data: { linkedUserId: user.id, inviteStatus: "accepted" },
      });

      // Clone pending delegated tasks to the new user's board
      const delegatedTasks = await prisma.task.findMany({
        where: {
          delegatedToContactId: { in: contacts.map((c) => c.id) },
          status: "delegated",
        },
      });

      for (const task of delegatedTasks) {
        // Get or create a default matrix for the new user
        let matrix = await prisma.matrix.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        });
        if (!matrix) {
          matrix = await prisma.matrix.create({
            data: { userId: user.id, name: "My Tasks" },
          });
        }

        await prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            externalUrl: task.externalUrl,
            userId: user.id,
            matrixId: matrix.id,
            quadrant: "do",
            status: "active",
          },
        });
      }

      console.log(
        `[webhook] Linked ${contacts.length} contacts and cloned ${delegatedTasks.length} tasks for ${primaryEmail}`
      );
    }
  }

  return NextResponse.json({ received: true });
}
