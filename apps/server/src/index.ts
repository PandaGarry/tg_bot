import { listWorlds, seedWorldContent, tick } from './sim';
import { startServer } from './net';

const PORT = Number(process.env.PORT ?? 8787);

console.log('ЭШФОЛЛ · сервер мира запускается');
for (const world of listWorlds()) {
  seedWorldContent(world.id);
  console.log(`  мир ${world.id}: ${world.name} (${world.kind})`);
}
tick(Date.now());
startServer(PORT);
