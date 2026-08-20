var rec = new GlideRecord("incident");
try {
  rec.addQuery("active", true);
  rec.query();
} catch (error) {
  gs.error(error);
}
if (rec.next()) {
  gs.info(rec.getValue("number"));
}
