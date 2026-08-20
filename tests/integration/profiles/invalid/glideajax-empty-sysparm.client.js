function onChange() {
  var ajax = new GlideAjax("x_acme.UserLookup");
  ajax.addParam("sysparm_name", "");
  ajax.getXMLAnswer(function (answer) {
    g_form.setValue("u_manager", answer);
  });
}
