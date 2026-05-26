const fs = require('fs');

const content = fs.readFileSync('src/data/mock_telegrafia.ts', 'utf8');

const match = content.match(/export const mockTelegrafia: Office\[\] = (\[[\s\S]*\]);/);
if (!match) {
  console.error("Could not find array");
  process.exit(1);
}

let arrayStr = match[1];
let offices = eval('(' + arrayStr + ')');

const roles = new Set();
const timeSlots = new Set();
const samplePhones = [];

offices.forEach(office => {
  office.contacts.forEach(c => {
    if (c.role) roles.add(c.role);
    if (c.timeSlot) timeSlots.add(c.timeSlot);
    if (c.phone) samplePhones.push(c.phone);
  });
});

console.log("--- UNIQUE ROLES ---");
console.log(Array.from(roles).sort());

console.log("\n--- TIME SLOT SAMPLES ---");
console.log(Array.from(timeSlots).slice(0, 50));

console.log("\n--- PHONE SAMPLES ---");
console.log(samplePhones.slice(0, 50));
