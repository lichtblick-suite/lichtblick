const r = require("/tmp/results.json");
const root = "/home/ctw3844/Desktop/Projects/lichtblick/";
const pat = process.argv[2];
const want = process.argv[3] ? Number(process.argv[3]) : 1;
let shown = 0;
for (const t of r.testResults) {
  for (const a of t.assertionResults) {
    if (a.status === "failed" && (a.failureMessages || []).join("\n").includes(pat)) {
      console.log("\n########## " + t.name.replace(root, "") + " :: " + a.title);
      console.log((a.failureMessages || []).join("\n").split("\n").slice(0, 18).join("\n"));
      if (++shown >= want) process.exit(0);
    }
  }
}
