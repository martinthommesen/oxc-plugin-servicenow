function onLoad() {
  var ga = new GlideAjax("x_acme.UserUtils");
  ga.addParam("sysparm_name", "getDefaultCaller");
  ga.getXMLAnswer(function (answer) {
    if (answer) {
      g_form.setValue("caller_id", answer);
    }
  });
}
