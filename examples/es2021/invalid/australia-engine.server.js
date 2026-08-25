const view = new DataView(buffer);
view.getBigInt64(0);

class RecordState {
  #value = 1;
}
