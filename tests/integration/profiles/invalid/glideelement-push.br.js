var numbers = [];
var incident = new GlideRecord("incident");
incident.query();
while (incident.next()) {
  numbers.push(incident.number);
}
