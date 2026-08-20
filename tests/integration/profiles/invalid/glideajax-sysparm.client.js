function onChange() {
  var ajax = new GlideAjax("x_acme.UserLookup");
  ajax.addParam("sysparm_user_id", g_form.getValue("caller_id"));
  ajax.getXMLAnswer(function (answer) {
    g_form.setValue("u_manager", answer);
  });
}
