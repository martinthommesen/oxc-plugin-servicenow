function countByCaller(callerId) {
  var agg = new GlideAggregate("incident");
  agg.addQuery("caller_id", callerId);
  agg.addAggregate("COUNT");
  agg.query();
  if (agg.next()) {
    return agg.getAggregate("COUNT");
  }
  return "0";
}

countByCaller(gs.getUserID());
