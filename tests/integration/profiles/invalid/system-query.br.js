var user = new GlideRecord("sys_user");
user.addSystemQuery("active", true);
user.query();
