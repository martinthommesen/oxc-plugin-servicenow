async function listOpenIncidents() {
  const rec = new GlideRecord("incident");
  rec.addActiveQuery();
  rec.query();
  const numbers = [];
  while (rec.next()) {
    numbers.push(rec.getValue("number"));
  }
  return numbers;
}
