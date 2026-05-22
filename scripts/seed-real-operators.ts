import fs from "node:fs";
import path from "node:path";
import { db } from "../src/db/index";
import { operators, operatorShifts } from "../src/db/schema";

async function seed() {
  try {
    const filePath = path.resolve(process.cwd(), "src/data/operadores.json");
    const rawData = fs.readFileSync(filePath, "utf-8");
    const operadores = JSON.parse(rawData);

    // Delete existing data to ensure a clean slate
    await db.delete(operatorShifts).execute();
    await db.delete(operators).execute();

    for (const op of operadores) {
      await db
        .insert(operators)
        .values({
          id: op.id,
          name: op.name,
          status: "disponible",
          currentMode: "presencial",
          lastAutogestionAssignedAt: Date.now(),
        })
        .onConflictDoNothing();

      const shifts = op.shifts;
      if (shifts) {
        if (shifts.home) {
          await db.insert(operatorShifts).values({
            operatorId: op.id,
            type: "home",
            shiftStart: shifts.home.start,
            shiftEnd: shifts.home.end,
            breakTime: shifts.home.break,
          });
        }
        if (shifts.presencial) {
          await db.insert(operatorShifts).values({
            operatorId: op.id,
            type: "presencial",
            shiftStart: shifts.presencial.start,
            shiftEnd: shifts.presencial.end,
            breakTime: shifts.presencial.break,
          });
        }
      }
    }

    console.log("Siembra de operadores (y sus turnos) completada exitosamente.");
  } catch (error) {
    console.error("Error ejecutando el seed:", error);
  }
}

seed();
