var CallerLookup = Class.create();
CallerLookup.prototype = {
  initialize: function () {},

  getEmail: function () {
    var user = new GlideRecord("sys_user");
    if (user.get(this.getParameter("sysparm_user"))) {
      return user.getValue("email");
    }
    return "";
  },

  type: "CallerLookup",
};
