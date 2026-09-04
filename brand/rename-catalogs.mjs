/**
 * Rewrite the product name in the translation catalogs.
 *
 *   node brand/rename-catalogs.mjs [--check]
 *
 * Only `msgstr` is touched — `msgid` is the lookup key and must keep matching
 * the English source, otherwise every string falls back to the untranslated
 * original. Doing the rename here instead of in the components means upstream
 * merges almost never conflict: after pulling, re-run this script.
 *
 * Domains are left alone: "stoat.chat" in a translation is a URL, not a brand
 * mention, and rewriting it would produce a link to a host that does not exist.
 *
 * `--check` exits non-zero if anything would change, for CI.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FROM = "Stoat";
const TO = "Vortex";

const here = dirname(fileURLToPath(import.meta.url));
const catalogs = resolve(
  here,
  "..",
  "vendor/stoat-web/packages/client/components/i18n/catalogs",
);

if (!existsSync(catalogs)) {
  console.error(`Catalog directory not found: ${catalogs}`);
  process.exit(1);
}

const check = process.argv.includes("--check");

// Not preceded by a word char (so "stoatchat" is untouched) and not followed by
// a domain suffix or another word char.
const brand = new RegExp(`(?<![\\w.])${FROM}(?![\\w.])`, "g");

const rename = (text) => text.replace(brand, TO);

let filesChanged = 0;
let entriesChanged = 0;

for (const locale of readdirSync(catalogs)) {
  const file = resolve(catalogs, locale, "messages.po");
  if (!existsSync(file)) continue;

  const lines = readFileSync(file, "utf-8").split("\n");
  const out = [];
  let changed = 0;

  // A PO entry is msgid lines followed by msgstr lines, each a quoted string
  // that may continue over several lines.
  let inMsgstr = false;
  let msgidText = "";
  let collectingMsgid = false;

  const quoted = (line) => {
    const m = line.match(/^(\s*(?:msgid|msgstr|msgid_plural|msgstr\[\d+\])?\s*)"(.*)"\s*$/);
    return m ? { prefix: m[1], body: m[2] } : null;
  };

  for (const line of lines) {
    // Obsolete entries (#~) are dead weight; leave them exactly as they are.
    if (line.startsWith("#~") || line.startsWith("#")) {
      out.push(line);
      inMsgstr = false;
      collectingMsgid = false;
      continue;
    }

    if (line.startsWith("msgid")) {
      collectingMsgid = true;
      inMsgstr = false;
      const q = quoted(line);
      msgidText = q ? q.body : "";
      out.push(line);
      continue;
    }

    if (line.startsWith("msgstr")) {
      collectingMsgid = false;
      inMsgstr = true;
      const q = quoted(line);
      if (q) {
        // Empty translation in a catalog whose source string mentions the
        // brand: seed it from the source so the rename actually shows up.
        const base = q.body === "" && brand.test(msgidText) ? msgidText : q.body;
        brand.lastIndex = 0;
        const next = rename(base);
        if (next !== q.body) {
          changed++;
          out.push(`${q.prefix}"${next}"`);
          continue;
        }
      }
      out.push(line);
      continue;
    }

    if (collectingMsgid) {
      const q = quoted(line);
      if (q) msgidText += q.body;
      out.push(line);
      continue;
    }

    if (inMsgstr) {
      const q = quoted(line);
      if (q) {
        const next = rename(q.body);
        if (next !== q.body) {
          changed++;
          out.push(`${q.prefix}"${next}"`);
          continue;
        }
        out.push(line);
        continue;
      }
      inMsgstr = false;
    }

    out.push(line);
  }

  if (changed) {
    filesChanged++;
    entriesChanged += changed;
    if (!check) writeFileSync(file, out.join("\n"));
  }
}

if (check) {
  if (entriesChanged) {
    console.error(
      `${entriesChanged} catalog string(s) in ${filesChanged} file(s) still say "${FROM}". Run: node brand/rename-catalogs.mjs`,
    );
    process.exit(1);
  }
  console.log("Catalogs are clean.");
} else {
  console.log(
    `Renamed ${entriesChanged} string(s) across ${filesChanged} catalog(s).`,
  );
}
