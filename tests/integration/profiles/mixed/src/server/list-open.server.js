const rec = new GlideRecord("incident");
rec.addActiveQuery();
rec.query();
while (rec.next()) {
  gs.info(rec.number);
}
