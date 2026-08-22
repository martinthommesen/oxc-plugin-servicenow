gs.now();
var record = new GlideRecord("incident");
record.insert();
prepare(record);
record["addSystem" + "Query"]("active=true");
record[method]("active=true");
