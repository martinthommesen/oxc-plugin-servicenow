function onLoad() {
  var gr = new GlideRecord("incident");
  gr.addActiveQuery();
  gr.query();
  if (gr.next()) {
    g_form.setValue("short_description", gr.short_description);
  }
}
