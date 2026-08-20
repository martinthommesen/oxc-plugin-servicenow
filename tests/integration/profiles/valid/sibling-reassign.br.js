var rec = new GlideRecord("incident");
var alias = rec;
rec = other;
alias.addQuery("active", true);
alias.query();
while (alias.next()) {
  gs.info(alias.getValue("number"));
}
