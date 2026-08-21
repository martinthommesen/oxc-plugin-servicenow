var targetGroup = gs.getProperty("x_acme.target_group");
if (current.assignment_group.nil()) {
  current.assignment_group = targetGroup;
}
