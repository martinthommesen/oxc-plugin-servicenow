var rec = new GlideRecord("incident");
var alias = rec;
alias.addQuery("active", true);
alias.next();
