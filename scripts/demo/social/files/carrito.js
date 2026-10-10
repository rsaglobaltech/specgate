const total = (lineas) =>
  Math.round(lineas.reduce((t, l) => t + l.precio * l.cantidad, 0) * 100) / 100;

module.exports = { total };
