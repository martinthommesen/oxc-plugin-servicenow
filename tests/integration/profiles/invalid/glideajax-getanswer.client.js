function onChange() {
  var ajax = new GlideAjax("x_acme.UserLookup");
  ajax.addParam("sysparm_name", "getManager");
  ajax.getXML(function () {});
  var answer = ajax.getAnswer();
  g_form.setValue("u_manager", answer);
}
