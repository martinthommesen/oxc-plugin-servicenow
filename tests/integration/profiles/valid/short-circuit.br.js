var rec = new GlideRecord("incident");
rec.addQuery("active", true) && rec.query();
if (rec.next()) {
  gs.info(rec.getValue("number"));
}
