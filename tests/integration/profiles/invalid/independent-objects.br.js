var a = new GlideRecord("incident");
var b = new GlideRecord("problem");
a.addQuery("active", true);
a.query();
b.next();
