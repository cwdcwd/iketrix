import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { GitHubAdapter } from "@/lib/adapters/github";
import { Resend } from "resend";
import { createClerkClient } from "@clerk/nextjs/server";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// POST /api/tasks/[taskId]/delegate — delegate a task to a contact or agent
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const body = await req.json();
  const { mode } = body;
  // mode: "contact" | "agent"

  if (!mode || !["contact", "agent"].includes(mode)) {
    return NextResponse.json(
      { error: "mode must be 'contact' or 'agent'" },
      { status: 400 }
    );
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    include: { source: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // --- Delegate to Contact ---
  if (mode === "contact") {
    const { contactId } = body;
    if (!contactId) {
      return NextResponse.json({ error: "contactId required for contact delegation" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId: user.id },
      include: { linkedUser: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // If contact is a linked user, create the task on their board
    if (contact.linkedUser) {
      let matrix = await prisma.matrix.findFirst({
        where: { userId: contact.linkedUser.id },
        orderBy: { createdAt: "asc" },
      });
      if (!matrix) {
        matrix = await prisma.matrix.create({
          data: { userId: contact.linkedUser.id, name: "My Tasks" },
        });
      }

      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          externalUrl: task.externalUrl,
          userId: contact.linkedUser.id,
          matrixId: matrix.id,
          quadrant: "do",
          status: "active",
        },
      });
    } else {
      // Not a user yet — send Clerk invitation if not already invited
      if (!contact.clerkInvitationId) {
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
          await prisma.contact.update({
            where: { id: contact.id },
            data: { clerkInvitationId: invitation.id, inviteStatus: "pending" },
          });
        } catch (err) {
          console.error("[delegate] Failed to send Clerk invitation:", err);
        }
      }
    }

    // GitHub assignment if applicable
    if (task.source && task.externalId) {
      const adapter = new GitHubAdapter();
      const connection = {
        id: task.source.id,
        type: task.source.type,
        name: task.source.name,
        accessToken: task.source.accessToken,
      };
      // Use email or linked user's GitHub username if available
      try {
        await adapter.assignTask(connection, task.externalId, contact.email);
      } catch {
        // Non-critical — log and continue
      }
    }

    // Email notification
    if (resend) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iketrix.vercel.app";
      await resend.emails.send({
        from: "Iketrix <noreply@iketrix.app>",
        to: contact.email,
        subject: `Task delegated to you: ${task.title}`,
        html: `
          <h2>A task has been delegated to you</h2>
          <h3>${task.title}</h3>
          ${task.description ? `<p>${task.description}</p>` : ""}
          ${task.externalUrl ? `<p><a href="${task.externalUrl}">View original</a></p>` : ""}
          <hr />
          <p>
            ${contact.linkedUser ? "View this task on your Iketrix board." : ""}
            ${!contact.linkedUser ? `<a href="${appUrl}">Join Iketrix</a> to manage your tasks with an AI-powered Eisenhower Matrix.` : ""}
          </p>
        `,
      });
    }

    // Update the task as delegated
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "delegated",
        delegatedTo: contact.email,
        delegatedToContactId: contact.id,
        delegatedAt: new Date(),
        quadrant: "delegate",
      },
    });

    return NextResponse.json({
      task: updated,
      notified: !!resend,
      existingUser: !!contact.linkedUser,
    });
  }

  // --- Delegate to Agent ---
  if (mode === "agent") {
    // Reuse existing conversation or create a new one
    let conversation = await prisma.agentConversation.findUnique({
      where: { taskId },
    });

    if (conversation) {
      // Reactivate if it was completed/abandoned
      if (conversation.status !== "active") {
        conversation = await prisma.agentConversation.update({
          where: { id: conversation.id },
          data: { status: "active" },
        });
      }
    } else {
      conversation = await prisma.agentConversation.create({
        data: {
          taskId,
          userId: user.id,
          status: "active",
        },
      });
    }

    // Mark task as delegated to agent
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "delegated",
        delegatedTo: "agent",
        delegatedAt: new Date(),
        quadrant: "delegate",
      },
    });

    return NextResponse.json({
      task: { ...task, status: "delegated", delegatedTo: "agent" },
      conversationId: conversation.id,
    });
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}
