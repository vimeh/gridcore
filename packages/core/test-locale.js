try {
  new Intl.NumberFormat("invalid-locale");
  console.log("Locale accepted");
} catch (e) {
  console.log("Locale rejected:", e.message);
}
