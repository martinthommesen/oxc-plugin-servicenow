var rec = new GlideRecord("incident");
if (flag) {
  gs.info("noop");
}
rec.addQuery("active", true);
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
