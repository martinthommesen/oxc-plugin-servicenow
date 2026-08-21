(function executeRule(current, previous) {
  current.assignment_group = gs.getProperty("x_acme.default_assignment_group");
  current.u_opened = new GlideDateTime();
  current.work_notes = "Assigned by default routing";
})(current, previous);
