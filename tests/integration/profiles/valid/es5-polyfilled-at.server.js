Array.prototype.at = function (index) {
  return this[index < 0 ? this.length + index : index];
};

const last = [1, 2].at(-1);
