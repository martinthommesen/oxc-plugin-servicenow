function run(skip) {
  var rec = new GlideRecord("incident");
  if (skip) {
    return;
  }
  rec.addQuery("active", true);
  rec.query();
  while (rec.next()) {
    gs.info(rec.getValue("number"));
  }
}
run(false);
