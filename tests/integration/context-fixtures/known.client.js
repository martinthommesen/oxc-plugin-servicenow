gs.now();
var record = new GlideRecord("incident");
var GR = GlideRecord;
new GR("problem");
new global["GlideRecordSecure"]("task");

var ConditionalGR;
if (g_form.getValue("sys_class_name") === "incident") {
  ConditionalGR = LocalRecord;
} else {
  ConditionalGR = GlideRecord;
}
new ConditionalGR("task");
