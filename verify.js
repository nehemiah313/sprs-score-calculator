#!/usr/bin/env node
/* Verification for sprs-calculator lead capture.
 * app.js calls init() at load (needs document/fetch), so the pure lead
 * functions are extracted and evaluated in a sandbox instead of require().
 */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const dir = path.dirname(__filename);
const js = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(dir, "styles.css"), "utf8");

let pass = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "-", e.message); process.exitCode = 1; }
}

check("lead block present in app.js", () => {
  assert.ok(js.includes("const REPORT_INBOX = 'n.harvard@aitechpros.ai'"), "REPORT_INBOX missing or wrong");
  assert.ok(js.includes("function buildLeadSubject"), "buildLeadSubject missing");
  assert.ok(js.includes("function isValidEmail"), "isValidEmail missing");
  assert.ok(js.includes("function buildLeadBody"), "buildLeadBody missing");
  assert.ok(js.includes("function leadMailto"), "leadMailto missing");
  assert.ok(js.includes("function loadLead"), "loadLead missing");
  assert.ok(js.includes("function saveLead"), "saveLead missing");
});

check("no em dashes in user-facing source files", () => {
  ["app.js", "index.html"].forEach((f) => {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    assert.ok(!t.includes(" "), f + " contains an em dash");
  });
});

// Extract pure functions into a sandbox for behavioral tests.
function extract(name) {
  const re = new RegExp("function " + name + "\\([\\s\\S]*?\\n\\}", "m");
  const m = js.match(re);
  assert.ok(m, "could not extract function " + name);
  return m[0];
}
const sandbox = new Function(
  "deduction",
  extract("deduction") + "\n" +
  extract("buildLeadSubject") + "\n" +
  extract("buildLeadBody") + "\n" +
  extract("leadMailto") + "\n" +
  extract("isValidEmail") + "\n" +
  extract("buildSummaryMd") + "\n" +
  "return { deduction, buildLeadSubject, buildLeadBody, leadMailto, isValidEmail, buildSummaryMd };"
)((c, s) => 0);
const { deduction, buildLeadSubject, buildLeadBody, leadMailto, isValidEmail, buildSummaryMd } = sandbox;

check("mailto builder and email validation", () => {
  const url = leadMailto("n.harvard@aitechpros.ai", "Subject here", "Body here");
  assert.ok(url.startsWith("mailto:n.harvard@aitechpros.ai?subject="), "mailto prefix wrong");
  assert.ok(url.includes("body="), "mailto missing body");
  assert.ok(!url.includes("formsubmit"), "FormSubmit reference remains");
  assert.ok(isValidEmail("neo@aitechpros.ai"));
  assert.ok(!isValidEmail("not-an-email"));
  assert.ok(!isValidEmail(""));
});

check("subject and body carry email, company, score, gaps, and summary note", () => {
  const report = buildSummaryMd(88, [{ id: "3.1.20", weight: "5", requirement: "req text", never_deferrable: true }], { "3.1.20": "no" }, "2026-09-30");
  assert.ok(report.includes("**88**"), "summary must show the score");
  assert.ok(report.includes("3.1.20"), "summary must list the gap");
  const open = [{ id: "3.1.20", weight: "5", requirement: "req text", never_deferrable: true }];
  const subject = buildLeadSubject("Acme");
  assert.ok(subject.includes("Acme"), "subject missing company");
  const body = buildLeadBody("neo@aitechpros.ai", "Acme", 88, open);
  assert.ok(body.includes("neo@aitechpros.ai"), "body missing visitor email");
  assert.ok(body.includes("Acme"), "body missing company");
  assert.ok(body.includes("88"), "body missing score");
  assert.ok(body.includes("3.1.20"), "body missing gap");
  assert.ok(body.includes("never-deferrable"), "body missing never-deferrable flag");
});

check("exportMd refactored onto buildSummaryMd", () => {
  assert.ok(js.includes("buildSummaryMd(score, open, state,"), "exportMd no longer calls buildSummaryMd");
});

check("form fields and privacy copy in index.html", () => {
  assert.ok(html.includes('id="leadForm"'), "leadForm missing");
  assert.ok(html.includes('id="leadEmail"'), "leadEmail missing");
  assert.ok(html.includes('id="leadCompany"'), "leadCompany missing");
  assert.ok(html.includes("No spam, ever. We never sell your information."), "privacy copy missing");
  assert.ok(html.includes("Nothing is uploaded unless you choose to send your results for review below."),
    "the old 'Nothing is uploaded' claim must be updated");
});

check("lead form wired in init()", () => {
  assert.ok(js.includes("$('leadForm').addEventListener('submit'"), "submit wiring missing");
  assert.ok(js.includes("if (!REPORT_INBOX)"), "empty-inbox hide path missing");
});

check("lead styles exist", () => {
  assert.ok(css.includes(".lead-form"), "lead-form styles missing");
});

console.log("\n" + pass + " checks passed.");
