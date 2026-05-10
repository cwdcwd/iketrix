import { PrismaClient } from '../generated/prisma/client';

const p = new PrismaClient();

async function main() {
  const tasks = await p.task.findMany({
    include: { classification: true, source: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  for (const t of tasks) {
    console.log(JSON.stringify({
      id: t.id,
      title: t.title,
      quadrant: t.quadrant,
      status: t.status,
      externalId: t.externalId,
      classified: !!t.classification,
      classQuadrant: t.classification?.quadrant,
      confidence: t.classification?.confidence,
      source: t.source?.name
    }));
  }

  // Find unclassified tasks
  const unclassified = tasks.filter(t => !t.quadrant && t.status === 'active');
  if (unclassified.length > 0) {
    console.log(`\nFound ${unclassified.length} unclassified active tasks.`);
  }

  console.log(`Total tasks: ${tasks.length}`);
  await p.$disconnect();
}

main();
