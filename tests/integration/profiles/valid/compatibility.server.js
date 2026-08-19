(function listOpenIncidents() {
  var gr = new GlideRecord("incident");
  gr.addActiveQuery();
  gr.query();
  while (gr.next()) {
    gs.info("Open incident " + gr.number);
  }
})();
