function generarQR(texto) {
  const qrCanvas = document.getElementById("qr");
  if (!qrCanvas) return;

  const qr = new QRious({
    element: qrCanvas,
    value: texto,
    size: 200,
  });
}
