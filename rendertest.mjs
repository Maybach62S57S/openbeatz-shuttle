// Laufzeit-Test mit echtem React. Rendert (a) den App-Root und (b) den
// Fahrer-Dialog IssueModal ohne mc-Prop. Beide Zeichenzahlen muessen ueber
// den Umbau konstant bleiben.
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);
// Wegwerf-Kopie mit angehaengtem Export. Das Original wird NICHT angefasst.
const copy = "/tmp/rt-src-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") + "\nexport { IssueModal, StageIssueModal, GuestIssueModal, Field, Modal, RideForm, AssignModal, WhatsAppModal };\n");
const out = "/home/claude/repo/.rt-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);

const App = mod.default;
const { IssueModal, StageIssueModal, GuestIssueModal, Field } = mod;

const res = {};
try {
  res.app = renderToStaticMarkup(React.createElement(App)).length;
} catch (e) { res.app = "FEHLER: " + e.message; }

try {
  const ride = { id: "r1", time: "12:00", djName: "Testartist", fromId: "airport", toId: "festival", status: "planned", issues: [] };
  const setup = { locations: [{ id: "airport", short: "FLH", name: "Flughafen" }, { id: "festival", short: "FEST", name: "Festival" }], drivers: [], config: {} };
  const html = renderToStaticMarkup(React.createElement(IssueModal, { ride, setup, onClose: () => {}, onReport: () => {} }));
  res.issueModal = html.length;
  fs.writeFileSync(process.argv[3] || "/tmp/issuemodal.html", html);
} catch (e) { res.issueModal = "FEHLER: " + e.message; }

// Alle weiteren Field/Modal-Nutzer ausserhalb der Leitstelle.
const ride2 = { id: "r1", time: "12:00", djName: "Testartist", fromId: "airport", toId: "festival", status: "planned", issues: [] };
const setup2 = { locations: [{ id: "airport", short: "FLH" }, { id: "festival", short: "FEST" }], drivers: [], config: {} };
const raus = [];
for (const [name, Comp, props] of [
  ["stageIssueModal", StageIssueModal, { ride: ride2, setup: setup2, onClose: () => {}, onReport: () => {} }],
  ["guestIssueModal", GuestIssueModal, { ride: ride2, setup: setup2, onClose: () => {}, onReport: () => {}, coordPhone: "+49123" }],
  ["fieldOhneMc", Field, { label: "Testlabel", children: React.createElement("input", {}) }],
]) {
  try { const h = renderToStaticMarkup(React.createElement(Comp, props)); res[name] = h.length; raus.push(name + "\n" + h); }
  catch (e) { res[name] = "FEHLER: " + e.message; }
}
fs.writeFileSync((process.argv[3] || "/tmp/issuemodal.html") + ".rest", raus.join("\n----\n"));

console.log(JSON.stringify(res, null, 2));
fs.unlinkSync(out); fs.unlinkSync(copy);
