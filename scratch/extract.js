const fs = require('fs');

const content = fs.readFileSync('src/data/mock_telegrafia.ts', 'utf8');

// The contacts array might look like:
// contacts: [
//   {
//     name: "Barrios Gastón",
//     phone: "15 2398-9172",
//     timeSlot: "8 a 13h:",
//     role: "Supervisor",
//   },
// ]

// We need to figure out what is wrong with them. Let's dump all contacts and notes to see.
const officesRegex = /id: "(.*?)",[\s\S]*?name: "(.*?)",[\s\S]*?notes: "(.*?)",\s+contacts: (\[[\s\S]*?\]),/g;

let match;
const issues = [];
while ((match = officesRegex.exec(content)) !== null) {
  const id = match[1];
  const name = match[2];
  const notes = match[3];
  const contactsStr = match[4];
  
  // Let's print out offices with non-empty notes or contacts
  if (notes || contactsStr.length > 5) {
    issues.push({id, name, notes, contacts: contactsStr});
  }
}

fs.writeFileSync('scratch/issues.json', JSON.stringify(issues, null, 2));
