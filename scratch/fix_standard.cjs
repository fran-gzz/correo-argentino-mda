const fs = require('fs');

const content = fs.readFileSync('src/data/mock_telegrafia.ts', 'utf8');
const match = content.match(/export const mockTelegrafia: Office\[\] = (\[[\s\S]*\]);/);
if (!match) { process.exit(1); }

let offices = eval('(' + match[1] + ')');

function toTitleCase(str) {
  if (!str) return "";
  return str.toLowerCase().split(' ').map(word => {
    if (word === "de" || word === "del" || word === "a" || word === "y") return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function handleAcronyms(str) {
  if (!str) return "";
  return str
    .replace(/\bcdd\b/gi, "CDD")
    .replace(/\bcdp\b/gi, "CDP")
    .replace(/\bost\b/gi, "OST")
    .replace(/\bctt\b/gi, "CTT")
    .replace(/\bitim\b/gi, "ITIM");
}

function formatTime(t) {
  if (!t) return "";
  t = t.trim();
  
  if (t.toLowerCase().includes("turno mañana")) return "Turno Mañana";
  if (t.toLowerCase().includes("turno tarde")) return "Turno Tarde";
  
  let rangeMatch = t.match(/(\d{1,2})(?::(\d{2}))?\s*(?:a|hs? a)\s*(\d{1,2})(?::(\d{2}))?\s*(?:hs?|h|hs)?/i);
  if (rangeMatch) {
    let h1 = rangeMatch[1].padStart(2, '0');
    let m1 = rangeMatch[2] || '00';
    let h2 = rangeMatch[3].padStart(2, '0');
    let m2 = rangeMatch[4] || '00';
    return `${h1}:${m1} a ${h2}:${m2}h`;
  }
  
  return t;
}

function formatRole(r) {
  if (!r) return "";
  r = r.trim();
  
  const mapping = {
    "jefe cdd": "Jefe de CDD",
    "jefe de cdd": "Jefe de CDD",
    "jefa de cdd": "Jefa de CDD",
    "jefe sucursal": "Jefe de Sucursal",
    "jefe de sucursal": "Jefe de Sucursal",
    "supervisor cdd": "Supervisor de CDD",
    "supervisor de cdd": "Supervisor de CDD",
    "encargado cdd": "Encargado de CDD",
    "auxiliar cdd": "Auxiliar de CDD",
    "supervisor del cdd/cdp": "Supervisor de CDD/CDP",
    "jefe del cdd/cdp": "Jefe de CDD/CDP",
    "auxiliar del cdd/cdp": "Auxiliar de CDD/CDP",
    "ost": "OST",
    "ost a cargo de telegrafía": "OST a cargo de Telegrafía"
  };
  
  let lowR = r.toLowerCase();
  if (mapping[lowR]) return mapping[lowR];
  
  return handleAcronyms(toTitleCase(r));
}

function formatPhone(p) {
  if (!p) return "";
  p = p.trim();
  p = p.replace(/15\s*(\d{4})[-\s]*(\d{4})/g, "15 $1-$2");
  p = p.replace(/(0\d{2,4})\s*(\d{3,4})[-\s]*(\d{4})/g, "$1 $2-$3");
  return p;
}

offices.forEach(office => {
  office.contacts.forEach(c => {
    c.name = toTitleCase(c.name);
    c.role = formatRole(c.role);
    c.timeSlot = formatTime(c.timeSlot);
    c.phone = formatPhone(c.phone);
  });
});

function serialize(obj) {
  if (Array.isArray(obj)) {
    return "[\n" + obj.map(o => "    " + serialize(o).replace(/\n/g, "\n    ")).join(",\n") + "\n  ]";
  } else if (typeof obj === 'object' && obj !== null) {
    let props = [];
    for (let key in obj) {
      let val = obj[key];
      if (val === undefined) continue;
      let strVal = (typeof val === 'string') ? JSON.stringify(val) : 
                   (typeof val === 'number') ? val : serialize(val);
      props.push(`${key}: ${strVal}`);
    }
    return "{\n      " + props.join(",\n      ") + "\n    }";
  }
  return JSON.stringify(obj);
}

const newArrayStr = "[\n" + offices.map(o => serialize(o)).join(",\n") + "\n]";
const newContent = content.substring(0, match.index) + "export const mockTelegrafia: Office[] = " + newArrayStr + ";\n";

fs.writeFileSync('src/data/mock_telegrafia.ts', newContent);
console.log("File standardized and updated with acronym support");
