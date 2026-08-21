var rec = new GlideRecord("incident");
if (rec.get(current.sys_id)) {
  rec.state = 7;
  rec.update();
  gs.addInfoMessage("Incident closed");
}
