var incident = new GlideRecord("incident");
incident.query();
incident.addQuery("active", true);
while (incident.next()) {
  gs.info(incident.number);
}
