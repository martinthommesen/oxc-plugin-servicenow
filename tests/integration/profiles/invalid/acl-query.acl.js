var membership = new GlideRecord("sys_user_grmember");
membership.addQuery("user", gs.getUserID());
membership.query();
answer = membership.hasNext();
