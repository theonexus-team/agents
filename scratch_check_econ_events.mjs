import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const envText = fs.readFileSync('C:/Users/tobia/AppData/Local/Programs/Git/tmp_envcheck14.txt', 'utf8');
const match = envText.match(/^DATABASE_URL="([^"]+)"/m);
const adapter = new PrismaPg({ connectionString: match[1] });
const prisma = new PrismaClient({ adapter });

async function main() {
  const all = await prisma.economicEvent.findMany({ orderBy: { releaseAt: 'asc' } });
  console.log(`Total EconomicEvent rows: ${all.length}`);
  console.log(`Now: ${new Date().toISOString()}`);
  for (const e of all) {
    const future = e.releaseAt.getTime() > Date.now() ? 'FUTURE' : 'past';
    console.log(`  ${e.releaseAt.toISOString()} [${future}] tagged=${e.tagged} ${e.country} - ${e.title}`);
  }

  const sync = await prisma.econCalendarSync.findUnique({ where: { id: 'singleton' } });
  console.log('\nEconCalendarSync:', JSON.stringify(sync, null, 2));

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
