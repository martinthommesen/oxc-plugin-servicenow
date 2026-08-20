var rec = new GlideRecord("incident");
switch (mode) {
  case "ready":
    rec.query();
    break;
}
rec.next();
