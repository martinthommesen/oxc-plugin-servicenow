function onChange() {
  var caller = g_form.getReference("caller_id");
  g_form.setValue("u_manager", caller.manager);
}
