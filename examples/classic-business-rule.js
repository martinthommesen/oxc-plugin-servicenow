/**
 * Example classic Business Rule — the good version.
 * The plugin flags hardcoded sys_ids, gs.now(), current.update(),
 * and unused GlideRecord returns.
 */
(function executeRule(current /* , previous */) {
  current.assignment_group = gs.getProperty("x_acme.default_assignment_group");
  current.u_opened = new GlideDateTime();

  var related = new GlideRecord("incident");
  related.addQuery("caller_id", current.caller_id);
  related.addQuery("sys_id", "!=", current.sys_id);
  related.query();
  while (related.next()) {
    gs.info("Related incident " + related.number);
  }
})(current);
