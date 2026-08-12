import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.resolve(fileURLToPath(new URL("../locales", import.meta.url)));
const broken = /(?:Ã.|Â.|Ð.|Ñ.|Ø.|Ù.|à¤|à¸|à®|â.|æ.|ç.|ï»¿)/;
const repair = (value) => {
  if (typeof value === "string" && broken.test(value)) return Buffer.from(value, "latin1").toString("utf8");
  if (Array.isArray(value)) return value.map(repair);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, repair(child)]));
  return value;
};
for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".json"))) {
  const full = path.join(directory, file);
  fs.writeFileSync(full, JSON.stringify(repair(JSON.parse(fs.readFileSync(full, "utf8"))), null, 2) + "\n", "utf8");
}
console.log("Repaired catalog encoding.");
