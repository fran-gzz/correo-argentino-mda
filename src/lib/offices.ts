import { db } from "@db/index";
import type {
  OfficeDirectoryItem,
  OfficeAssetType,
} from "@/data/directorio_oficinas";

/**
 * Consulta todas las oficinas de telegrafía desde la base de datos
 * y las devuelve mapeadas al formato OfficeDirectoryItem que espera el UI.
 *
 * La consulta usa el API Relacional de Drizzle para traer contactos
 * (a través de la tabla intermedia officeContacts) y activos en una sola query.
 */
export async function getTelegrafiaOfficesFromDB(): Promise<
  OfficeDirectoryItem[]
> {
  const dbOffices = await db.query.offices.findMany({
    where: (offices, { eq }) => eq(offices.type, "telegrafia"),
    orderBy: (offices, { asc }) => [asc(offices.code), asc(offices.name)],
    with: {
      assets: true,
      contacts: {
        with: {
          contact: true,
        },
      },
    },
  });

  return dbOffices.map((office) => ({
    id: `teleg-${office.code.toLowerCase()}`,
    type: "telegrafia" as const,
    code: office.code,
    name: office.name,
    location: office.region ?? "",
    costCenter: "",
    postalCode: "",
    region: office.region ?? "",
    address: office.address ?? "",
    email: office.email ?? "",
    notes: office.notes ?? "",
    contacts: office.contacts.map((oc) => ({
      name: oc.contact.name,
      phone: oc.contact.phone ?? "",
      timeSlot: oc.timeSlot ?? "",
    })),
    assets: office.assets.map((a) => ({
      type: a.type as OfficeAssetType,
      hostname: a.hostname ?? "",
      ip: a.ip ?? "",
    })),
  }));
}
