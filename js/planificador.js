"use strict";
/* Planificador de estudio: días, horas diarias y fecha de inicio → calendario de sesiones,
   fecha de término, avance por módulos y archivo .ics con cada sesión. */
(function () {
  const DIAS = [["Lun", "Lunes", 1], ["Mar", "Martes", 2], ["Mié", "Miércoles", 3], ["Jue", "Jueves", 4], ["Vie", "Viernes", 5], ["Sáb", "Sábado", 6], ["Dom", "Domingo", 0]];
  const EXTRA_AVANZADO = { n: "Simulacro y evaluación final", h: 6 };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fecha = s => new Date(s + "T09:00:00");
  const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const larga = d => `${d.getDate()} de ${MES[d.getMonth()][0].toUpperCase() + MES[d.getMonth()].slice(1)}, ${d.getFullYear()}`;
  const corta = d => `${d.getDate()} ${MES[d.getMonth()].slice(0, 3)}`;
  const hTxt = h => String(h).replace(".", ",") + (h === 1 ? " hora" : " horas");
  const hCorto = h => String(h).replace(".", ",") + " h";

  const lunes = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return iso(d); };
  const BASE = () => ({ prog: "web", dias: [1, 3, 5], horas: 2, inicio: lunes(), dif: "basico", cuotas: 1 });
  const DEMO = () => ({ dias: [1, 3], horas: 3, inicio: "2026-11-10", dif: "basico", cuotas: 1 });

  const hechosGuardados = seguro(() => JSON.parse(localStorage.getItem("plan-hechos"))) || {};
  let hechos = hechosGuardados;
  let s = Object.assign(BASE(), seguro(() => JSON.parse(localStorage.getItem("plan"))) || {});
  if (!Array.isArray(s.dias) || !s.dias.length) s.dias = [1, 3, 5];
  const pre = params.get("programa") || seguro(() => localStorage.getItem("test"));
  if (TP.curso(params.get("programa"))) s.prog = params.get("programa");
  else if (!seguro(() => localStorage.getItem("plan")) && TP.curso(pre)) s.prog = pre;
  if (!TP.curso(s.prog)) s.prog = "web";
  if (s.inicio < iso(new Date()) && !TP.demo) s.inicio = lunes();

  const selP = $("#pl-prog"), hrs = $("#pl-horas"), ini = $("#pl-inicio"), cuo = $("#pl-cuotas");
  selP.innerHTML = TP.CURSOS.map(c => `<option value="${c.id}">${esc(c.t)}</option>`).join("");
  ini.min = iso(new Date());
  $("#pl-dias").innerHTML = DIAS.map(d => `<button type="button" class="dia${d[2] === 0 || d[2] === 6 ? " fin" : ""}" data-d="${d[2]}" aria-pressed="false" aria-label="${d[1]}">${d[0]}</button>`).join("");

  let plan = null;
  let demoActiva = false;
  const guardar = () => { if (demoActiva) return; seguro(() => localStorage.setItem("plan", JSON.stringify(s))); seguro(() => localStorage.setItem("plan-hechos", JSON.stringify(hechos))); };

  function aControles() {
    selP.value = s.prog; hrs.value = s.horas; ini.value = s.inicio; cuo.value = String(s.cuotas);
    $$("#pl-dias .dia").forEach(b => b.setAttribute("aria-pressed", s.dias.includes(+b.dataset.d)));
    $$(".sw").forEach(b => b.setAttribute("aria-checked", b.dataset.dif === s.dif));
  }

  function calcular() {
    const c = TP.curso(s.prog), det = TP.DET[c.id];
    const mods = det.mod.map(m => ({ n: m[0], h: m[1] }));
    if (s.dif === "avanzado") mods.push(EXTRA_AVANZADO);
    const total = mods.reduce((a, m) => a + m.h, 0);
    const inicio = fecha(s.inicio);
    if (isNaN(inicio)) return null;

    const sesiones = []; let acum = 0; const d = new Date(inicio);
    for (let g = 0; acum < total - 1e-9 && g < 1500; g++, d.setDate(d.getDate() + 1)) {
      if (!s.dias.includes(d.getDay())) continue;
      const h = Math.min(s.horas, total - acum); acum += h;
      sesiones.push({ d: new Date(d), h, acum });
    }
    let cum = 0, desde = 0;
    mods.forEach(m => {
      cum += m.h;
      const k = sesiones.findIndex(x => x.acum >= cum - 1e-9);
      m.fin = sesiones[k].d; m.desde = sesiones[desde].d;
      for (let j = desde; j <= k; j++) sesiones[j].mod = mods.indexOf(m);
      desde = Math.min(k + 1, sesiones.length - 1);
    });
    const fin = sesiones[sesiones.length - 1].d;
    const semanas = Math.max(1, Math.ceil((fin - inicio + 864e5) / (7 * 864e5)));
    const n = s.cuotas;
    return { c, mods, total, inicio, sesiones, fin, semanas, semanal: s.dias.length * s.horas, cuota: n === 1 ? TP.soles(c.p) : `${n} × ${TP.soles(Math.ceil(c.p / n))}` };
  }

  function pintar() {
    plan = calcular();
    if (!plan) return;
    const hs = (hechos[s.prog] || []).filter(i => i < plan.mods.length);
    $("#pl-bub").textContent = hTxt(s.horas);
    const pct = (s.horas - hrs.min) / (hrs.max - hrs.min);
    $("#pl-bub").style.left = `calc(${pct * 100}% + ${(0.5 - pct) * 22}px)`;
    hrs.style.setProperty("--p", pct * 100 + "%");
    $("#pl-dias-ayuda").textContent = s.dias.length === 1 ? "1 día por semana" : s.dias.length + " días por semana";
    $("#pl-dif-ayuda").textContent = s.dif === "avanzado" ? "Incluye un simulacro y una evaluación final de 6 horas." : "Evaluaciones cortas al final de cada módulo.";

    $("#pl-fin").textContent = larga(plan.fin);
    $("#pl-horario").innerHTML = DIAS.map(d => { const on = s.dias.includes(d[2]); return `<span class="bloque-d${on ? " on" : ""}" title="${d[1]}${on ? ": " + hCorto(s.horas) : ""}"><i></i><small>${d[0]}</small></span>`; }).join("");
    $("#pl-semanal").textContent = `${String(plan.semanal).replace(".", ",")} horas semanales`;
    $("#pl-stats").textContent = `${plan.sesiones.length} sesiones · ${plan.semanas} ${plan.semanas === 1 ? "semana" : "semanas"} · ${plan.total} h en total`;

    $("#pl-mods").innerHTML = plan.mods.map((m, i) => `
      <li><button type="button" class="mod${hs.includes(i) ? " ok" : ""}" data-m="${i}" aria-pressed="${hs.includes(i)}" aria-label="Módulo ${i + 1}: ${esc(m.n)}. ${hs.includes(i) ? "Completado" : "Pendiente"}. Tocar para cambiar">
        <span class="punto-m" aria-hidden="true">${hs.includes(i) ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 12.5 4 4 8-9"/></svg>' : ""}</span>
        <span class="mod-t"><b>Módulo ${i + 1}: ${esc(m.n)}</b><small>${corta(m.desde)}${+m.desde === +m.fin ? "" : " – " + corta(m.fin)}</small></span>
        <span class="mod-h">${m.h} hrs</span></button></li>`).join("");
    const hechasH = hs.reduce((a, i) => a + plan.mods[i].h, 0), p = Math.round(hechasH / plan.total * 100);
    $("#pl-avance").textContent = `${p}% completado`;
    $("#pl-avance-b").style.width = p + "%";
    $("#pl-cuota").textContent = plan.cuota;
    $("#pl-ins").href = `matricula.html?programa=${plan.c.id}`;
  }

  function cambiar(patch) { Object.assign(s, patch); guardar(); pintar(); }

  $("#pl-dias").addEventListener("click", e => {
    const b = e.target.closest(".dia"); if (!b) return;
    const d = +b.dataset.d, on = s.dias.includes(d);
    if (on && s.dias.length === 1) return aviso("Elige al menos un día de estudio");
    s.dias = on ? s.dias.filter(x => x !== d) : [...s.dias, d];
    b.setAttribute("aria-pressed", !on); guardar(); pintar();
  });
  selP.addEventListener("change", () => cambiar({ prog: selP.value }));
  hrs.addEventListener("input", () => cambiar({ horas: +hrs.value }));
  ini.addEventListener("change", () => { if (ini.value) cambiar({ inicio: ini.value }); });
  cuo.addEventListener("change", () => cambiar({ cuotas: +cuo.value }));
  $$(".sw").forEach(b => b.addEventListener("click", () => { s.dif = b.dataset.dif; $$(".sw").forEach(x => x.setAttribute("aria-checked", x === b)); guardar(); pintar(); }));
  $("#pl-mods").addEventListener("click", e => {
    const b = e.target.closest(".mod"); if (!b) return;
    const i = +b.dataset.m, l = new Set(hechos[s.prog] || []);
    l.has(i) ? l.delete(i) : l.add(i);
    hechos[s.prog] = [...l]; guardar(); pintar();
  });

  /* Texto del plan para copiar o descargar */
  const texto = () => `MI PLAN DE ESTUDIO · TUPLUSEDUCA
Programa: ${plan.c.t}
Días: ${DIAS.filter(d => s.dias.includes(d[2])).map(d => d[1]).join(", ")} · ${hTxt(s.horas)} por día
Inicio: ${larga(plan.inicio)}
Fin estimado: ${larga(plan.fin)} (${plan.sesiones.length} sesiones, ${plan.total} horas)
Dificultad de test: ${s.dif === "avanzado" ? "Avanzado" : "Básico"}
Pago: ${plan.cuota}

${plan.mods.map((m, i) => `Módulo ${i + 1}: ${m.n} (${m.h} h) · ${corta(m.desde)} – ${corta(m.fin)}`).join("\n")}
`;
  $("#pl-copiar").addEventListener("click", () => copiar(texto(), "Plan copiado"));
  $("#pl-txt").addEventListener("click", () => { descargar("mi-plan-tupluseduca.txt", texto(), "text/plain;charset=utf-8"); aviso("Plan descargado"); });

  /* Calendario: una sesión por día elegido, a las 19:00 */
  $("#pl-ics").addEventListener("click", () => {
    const p2 = n => String(n).padStart(2, "0");
    const f = (d, hh, mm) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(hh)}${p2(mm)}00`;
    const sello = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
    const ev = plan.sesiones.map((x, i) => {
      const m = plan.mods[x.mod], min = Math.round(x.h * 60), fin = new Date(2000, 0, 1, 19, min);
      return ["BEGIN:VEVENT", `UID:${Date.now()}-${i}@tupluseduca`, `DTSTAMP:${sello}`,
        `DTSTART:${f(x.d, 19, 0)}`, `DTEND:${f(x.d, 19 + Math.floor(min / 60), min % 60)}`,
        `SUMMARY:Estudiar ${plan.c.t} · ${m.n}`, `DESCRIPTION:Sesión ${i + 1} de ${plan.sesiones.length} (${hCorto(x.h)}). Plan de TUPLUSEDUCA.`,
        "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Hora de estudiar", "END:VALARM", "END:VEVENT"].join("\r\n");
    });
    descargar("estudio-tupluseduca.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TUPLUSEDUCA//ES", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n"), "text/calendar;charset=utf-8");
    aviso(`Calendario descargado con ${plan.sesiones.length} sesiones`);
  });

  /* Modo demostración: carga la configuración de ejemplo del diseño */
  function aplicarDemo(on) {
    if (on === demoActiva) return;
    demoActiva = on;
    if (on) { s = Object.assign({}, s, DEMO()); hechos = Object.assign({}, hechos, { [s.prog]: [0] }); }
    else {
      s = Object.assign(BASE(), seguro(() => JSON.parse(localStorage.getItem("plan"))) || {}, { prog: s.prog });
      if (s.inicio < iso(new Date())) s.inicio = lunes();
      hechos = seguro(() => JSON.parse(localStorage.getItem("plan-hechos"))) || {};
    }
    aControles(); pintar();
  }
  document.addEventListener("demo", e => aplicarDemo(e.detail));
  addEventListener("resize", pintar);

  aControles();
  if (TP.demo) { demoActiva = true; s = Object.assign({}, s, DEMO()); hechos = Object.assign({}, hechos, { [s.prog]: [0] }); aControles(); }
  pintar();
})();
