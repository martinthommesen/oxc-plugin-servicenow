function LocalWeakRef(value) {
  this.value = value;
}

WeakRef = LocalWeakRef;
const reference = new WeakRef(target);

gs.info(reference);
