import { db } from "./src/db/index";
import { offices } from "./src/db/schema";
import { officeFormSchema } from "./src/lib/validations";

async function testInsert() {
  const rawData = {
    code: "TEST1234",
    name: "Oficina Test",
    type: "SUCURSAL",
    officeType: "AUTOMATIZADA",
    provinceCode: "B",
    address: "Calle Falsa 123",
    enRed: false,
    paqarAdmision: false,
    paqarEntrega: false,
    payroll: false,
    taxExempt: false,
  };

  const parsed = officeFormSchema.safeParse(rawData);
  if (!parsed.success) {
    console.error("Validation failed", parsed.error.issues);
    return;
  }

  try {
    const officeData = parsed.data;
    console.log("Office data:", officeData);
    const [created] = await db.insert(offices).values(officeData).returning({ id: offices.id });
    console.log("Created successfully:", created);
    
    // Cleanup
    await db.delete(offices).where(offices.id.eq(created.id));
  } catch (err: any) {
    console.error("Insert error:", err.message, err.stack);
  }
}

testInsert();
