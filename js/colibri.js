"use strict";
/* Colibrí: vuelos, seguidor del cursor, chispas y transición entre pantallas */
const clonar = mini => {
  const s = document.createElement("img");
  s.src = ruta(mini ? "assets/colibri-mini.png" : "assets/colibri.png");
  s.alt = ""; s.className = "colibri"; s.draggable = false;
  s.setAttribute("aria-hidden", "true");
  return s;
};

function chispas(x, y, n = 12, r0 = 30) {
  if (mov) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i"), a = Math.PI * 2 * i / n, r = r0 + Math.random() * r0;
    s.className = "chispa"; s.style.left = x + "px"; s.style.top = y + "px";
    document.body.append(s);
    s.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(0)`, opacity: 0 }], { duration: 600, easing: "ease-out" }).onfinish = () => s.remove();
  }
}

/* Colibrí que cruza la pantalla */
function volar(msg) {
  if (mov) { if (msg) aviso(msg); return; }
  const v = document.createElement("div"), der = Math.random() < .5, y = 80 + Math.random() * (innerHeight - 260);
  v.className = "vuelo" + (der ? " der" : "");
  v.append(clonar());
  document.body.append(v);
  const a = der ? -120 : innerWidth + 30, b = der ? innerWidth + 30 : -120;
  v.animate([
    { transform: `translate(${a}px,${y}px)` },
    { transform: `translate(${a + (b - a) * .3}px,${y - 70}px)` },
    { transform: `translate(${a + (b - a) * .65}px,${y + 40}px)` },
    { transform: `translate(${b}px,${y - 40}px)` }
  ], { duration: 3800, easing: "ease-in-out" }).onfinish = () => v.remove();
  if (msg) aviso(msg);
}

/* Colibrí pequeño que sigue el cursor (solo con mouse) */
if (!mov && matchMedia("(hover:hover)").matches) {
  const s = document.createElement("div");
  s.id = "seguidor"; s.append(clonar(true)); document.body.append(s);
  let x = 0, y = 0, px = 0, py = 0, activo = false;
  addEventListener("mousemove", e => {
    x = e.clientX + 18; y = e.clientY + 18;
    if (!activo) { activo = true; px = x; py = y; s.classList.add("ver"); requestAnimationFrame(sigue); }
  });
  document.addEventListener("mouseleave", () => s.classList.remove("ver"));
  document.addEventListener("mouseenter", () => { if (activo) s.classList.add("ver"); });
  function sigue() {
    s.classList.toggle("der", x - px > 2 ? true : x - px < -2 ? false : s.classList.contains("der"));
    px += (x - px) * .08; py += (y - py) * .08 + Math.sin(performance.now() / 260) * .5;
    s.style.transform = `translate(${px}px,${py}px)`;
    requestAnimationFrame(sigue);
  }
}

/* Las transiciones entre secciones están centralizadas en transiciones.js.
   Se conserva el efecto de chispas al pulsar botones. */
document.addEventListener("click", e => {
  if (e.target.closest("button,.boton")) chispas(e.clientX, e.clientY);
});
