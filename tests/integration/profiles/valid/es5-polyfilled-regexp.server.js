function LocalRegExp(pattern) {
  return pattern;
}

RegExp = LocalRegExp;
const value = RegExp("(?<=a)b");
