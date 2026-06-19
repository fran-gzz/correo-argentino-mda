import { db } from "../src/db/index";
import { regions } from "../src/db/schema";
import { eq } from "drizzle-orm";

const colorData = [
  { id: "CABA", color: "#FFCC00" },
  { id: "SUR", color: "#9B59B6" },
  { id: "PBA-LP", color: "#003B71" },
  { id: "NEA", color: "#2ECC71" },
  { id: "NOA", color: "#E74C3C" },
];

async function run() {
  console.log("Actualizando colores de regiones...\n");

  for (const { id, color } of colorData) {
    await db.update(regions).set({ color }).where(eq(regions.id, id));
    console.log(`  ${id.padEnd(6)} → ${color}`);
  }

  const result = await db.select().from(regions);
  console.log("\nRegiones actualizadas:");
  console.table(result);
}

run().catch(console.error);
