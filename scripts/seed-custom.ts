import { seedDatabase } from './seed-data';

async function main() {
  try {
    await seedDatabase();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main();
