var rec = new GlideRecord("incident");
var alias = rec;
alias.addQuery("active", true);
alias.query();
while (rec.next()) {
  gs.info(rec.getValue("number"));
}
