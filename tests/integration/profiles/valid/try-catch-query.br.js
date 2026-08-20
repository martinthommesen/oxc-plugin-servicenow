var rec = new GlideRecord("incident");
try {
  rec.addQuery("active", true);
  rec.query();
} catch (error) {
  gs.error(error);
  rec.query();
}
if (rec.next()) {
  gs.info(rec.getValue("number"));
}
