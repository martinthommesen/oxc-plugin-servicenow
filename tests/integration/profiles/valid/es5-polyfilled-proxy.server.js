function LocalProxy(target) {
  return target;
}

LocalProxy.revocable = function (target) {
  return { proxy: target, revoke: function () {} };
};
Proxy = LocalProxy;
const pair = Proxy.revocable(target, handler);
