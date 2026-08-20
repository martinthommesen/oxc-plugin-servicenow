var rec = new GlideRecord("incident");
var bag = { rec: rec };
var list = [rec, ...[]];
rec.next();
