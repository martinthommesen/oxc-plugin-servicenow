function LocalPromise(executor) {
  executor(function () {});
}

LocalPromise.resolve = function (value) {
  return value;
};
Promise = LocalPromise;
const ready = Promise.resolve(1);
