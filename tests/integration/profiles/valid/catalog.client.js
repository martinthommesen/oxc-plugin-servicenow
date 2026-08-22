function onChange(control, oldValue, newValue) {
  if (!newValue) {
    return;
  }
  var ga = new GlideAjax("x_acme.CallerLookup");
  ga.addParam("sysparm_name", "getEmail");
  ga.addParam("sysparm_user", newValue);
  ga.getXMLAnswer(function (answer) {
    g_form.setValue("u_caller_email", answer);
  });
}
