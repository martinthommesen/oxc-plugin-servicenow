var rec = new GlideRecord("incident");
rec.addQuery("active", true);
rec.query();
ready && rec.query();
if (rec.next()) {
  gs.info(rec.getValue("number"));
}
