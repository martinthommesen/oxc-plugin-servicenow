var rec = new GlideRecord("incident");
rec.addQuery("active", true);
rec.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
