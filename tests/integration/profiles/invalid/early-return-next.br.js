function run(skip) {
  var rec = new GlideRecord("incident");
  if (skip) {
    rec.next();
    return;
  }
  rec.query();
}
run(true);
