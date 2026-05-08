import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { GitHubAdapter } from "@/lib/adapters/github";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// POST /api/tasks/[taskId]/delegate — delegate a task to someone
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { type, identifier } = await req.json();
  // type: "email" | "github"
  // identifier: email address or github username

  if (!type || !identifier) {
    return NextResponse.json(
      { error: "type and identifier required" },
      { status: 400 }
    );
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    include: { source: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Check if delegatee is an existing Iketrix user
  let existingUser = null;
  if (type === "email") {
    existingUser = await prisma.user.findUnique({
      where: { email: identifier },
    });
  }

  // If delegatee is an Iketrix user, create the task on their board
  if (existingUser) {
    await prisma.task.create({
      data: {
        title: task.title,
        description: task.description,
        externalUrl: task.externalUrl,
        userId: existingUser.id,
        quadrant: "do", // delegated tasks default to "do" for the recipient
        status: "active",
      },
    });
  }

  // GitHub assignment
  if (type === "github" && task.source && task.externalId) {
    const adapter = new GitHubAdapter();
    const connection = {
      id: task.source.id,
      type: task.source.type,
      name: task.source.name,
      accessToken: task.source.accessToken,
    };
    await adapter.assignTask(connection, task.externalId, identifier);
  }

  // Email notification
  if (type === "email" && resend) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iketrix.vercel.app";
    await resend.emails.send({
      from: "Iketrix <noreply@iketrix.app>",
      to: identifier,
      subject: `Task delegated to you: ${task.title}`,
      html: `
        <h2>A task has been delegated to you</h2>
        <h3>${task.title}</h3>
        ${task.description ? `<p>${task.description}</p>` : ""}
        ${task.externalUrl ? `<p><a href="${task.externalUrl}">View original</a></p>` : ""}
        <hr />
        <p>
          ${existingUser ? "View this task on your Iketrix board." : ""}
          ${!existingUser ? `<a href="${appUrl}">Join Iketrix</a> to manage your tasks with an AI-powered Eisenhower Matrix.` : ""}
        </p>
      `,
    });
  }

  // Update the task as delegated
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "delegated",
      delegatedTo: identifier,
      delegatedAt: new Date(),
      quadrant: "delegate",
    },
  });

  return NextResponse.json({
    task: updated,
    notified: type === "email" && !!resend,
    assignedOnGitHub: type === "github" && !!task.source,
    existingUser: !!existingUser,
  });
}
