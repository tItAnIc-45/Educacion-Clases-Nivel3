"use strict";
/* Ficha de un programa: descripción, temario, docentes, comentarios y preguntas */
(function () {
  const id = params.get("id"), c = TP.curso(id), main = $("#ficha");
  if (!c) {
    main.innerHTML = `<section class="perdido"><div><h1>No encontramos ese programa</h1><p>El enlace puede estar incompleto. Elige uno de la lista.</p><a class="boton" href="programas.html">Ver todos los programas</a></div></section>`;
    return;
  }
  const d = TP.DET[id];
  document.title = c.t + " | TUPLUSEDUCA";
  const favs = new Set(seguro(() => JSON.parse(localStorage.getItem("fav"))) || []);
  const clave = "coment-" + id;
  const propios = seguro(() => JSON.parse(localStorage.getItem(clave))) || [];
  const ini = n => n.replace(/^(Ing\.|Lic\.|Dr\.)\s*/, "").split(" ").slice(0, 2).map(x => x[0]).join("").toUpperCase();
  const fmt = n => n.toLocaleString("es-PE");
  const otros = TP.CURSOS.filter(x => x.id !== id && x.cat === c.cat).concat(TP.CURSOS.filter(x => x.id !== id && x.cat !== c.cat)).slice(0, 3);

  function resumenComentarios() {
    const todos = [...propios, ...d.com];
    const n = todos.length, prom = todos.reduce((a, x) => a + x.e, 0) / n;
    return { todos, n, prom };
  }

  function barras(todos) {
    return [5, 4, 3, 2, 1].map(e => {
      const k = todos.filter(x => x.e === e).length, p = todos.length ? Math.round(k / todos.length * 100) : 0;
      return `<button type="button" class="bar-e" data-e="${e}" aria-label="Ver comentarios de ${e} estrellas (${k})"><span>${e} ★</span><i><b style="width:${p}%"></b></i><small>${p}%</small></button>`;
    }).join("");
  }

  function pintarComentarios(filtro) {
    const { todos, n, prom } = resumenComentarios();
    const lista = filtro ? todos.filter(x => x.e === filtro) : todos;
    $("#r-prom").textContent = d.r.toFixed(1);
    $("#r-est").textContent = TP.estrellas(d.r);
    $("#r-n").textContent = `${fmt(d.n)} reseñas de estudiantes`;
    $("#r-barras").innerHTML = barras(todos);
    $("#r-filtro").hidden = !filtro;
    $("#r-filtro span").textContent = filtro ? `Mostrando ${lista.length} de ${filtro} estrellas` : "";
    $("#r-lista").innerHTML = lista.length ? lista.map(x => `
      <article class="resena${x.mio ? " mio" : ""}">
        <span class="avatar-s" aria-hidden="true">${ini(x.n)}</span>
        <div><header><b>${esc(x.n)}</b><span class="est" aria-label="${x.e} de 5 estrellas">${"★".repeat(x.e)}${"☆".repeat(5 - x.e)}</span><small>${esc(x.f)}${x.mio ? " · tu comentario" : ""}</small></header>
        <p>${esc(x.t)}</p>
        <button type="button" class="util" data-util aria-pressed="false">👍 Me sirvió</button></div>
      </article>`).join("") : `<p class="vacio">Todavía no hay comentarios con esa puntuación.</p>`;
    return { n, prom };
  }

  const cuotaTxt = n => n === 1 ? TP.soles(c.p) : `${n} × ${TP.soles(Math.ceil(c.p / n))}`;
  const totalH = TP.horas(c);

  main.innerHTML = `
  <div class="ficha-grid">
    <div class="ficha-texto">
        <p class="migas"><a href="../index.html">Inicio</a> / <a href="programas.html">Programas</a> / ${esc(c.t)}</p>
        <p class="ficha-cat">${c.cat}${c.etiqueta ? ` <span class="badge-i badge-${sin(c.etiqueta)}">${c.etiqueta}</span>` : ""}</p>
        <h1>${esc(c.t)}</h1>
        <p class="lead">${esc(c.d)}</p>
        <div class="ficha-datos">
          <a href="#comentarios" class="valora grande"><b>${d.r.toFixed(1)}</b><span aria-hidden="true">${TP.estrellas(d.r)}</span><small>(${fmt(d.n)} reseñas)</small></a>
          <span>${fmt(d.al)} estudiantes</span><span>${c.dur} · ${totalH} horas</span><span>Nivel ${c.niv.toLowerCase()}</span><span>Actualizado en ${d.act}</span>
        </div>
        <p class="ficha-docs">Docentes: ${d.doc.map(x => `<a href="#docentes">${esc(x.n)}</a>`).join(" y ")}</p>
    </div>
      <aside class="inscripcion" aria-label="Inscripción">
        <div class="insc-img" style="background:linear-gradient(135deg,${c.g[0]},${c.g[1]})"><img src="../${c.imagen}" alt="${esc(c.t)}"></div>
        <div class="insc-cuerpo">
          <p class="precio">${TP.soles(c.p)}<small> pago único</small></p>
          <label class="cuotas">Pagar en <select id="c-cuotas" aria-label="Número de cuotas"><option value="1">1 pago</option><option value="3">3 cuotas</option><option value="6">6 cuotas</option></select><strong id="c-cuota">${cuotaTxt(1)}</strong></label>
          <a class="boton" id="c-ins" href="matricula.html?programa=${c.id}">Inscribirme</a>
          <a class="boton sec" id="c-plan" href="planificador.html?programa=${c.id}">Planificar mi estudio</a>
          <div class="insc-acc"><button type="button" class="enlace-btn" id="c-fav" aria-pressed="${favs.has(id)}">${favs.has(id) ? "♥ Guardado" : "♡ Guardar"}</button><button type="button" class="enlace-btn" id="c-comp">Compartir</button></div>
          <ul class="incluye"><li>${totalH} horas de clases y práctica</li><li>${d.mod.length} módulos con proyecto final</li><li>Feedback de tus docentes</li><li>Certificado digital al terminar</li></ul>
        </div>
      </aside>

  <nav class="subnav" id="subnav" aria-label="Secciones del programa">
    <a href="#descripcion" class="on">Descripción</a><a href="#temario">Temario</a><a href="#docentes">Docentes</a><a href="#comentarios">Comentarios</a><a href="#preguntas">Preguntas</a>
  </nav>

  <div class="ficha-cuerpo">
    <section id="descripcion" class="bloque">
      <h2>Lo que aprenderás</h2>
      <ul class="aprenderas">${d.apr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="dos-col">
        <div><h3>Requisitos</h3><ul class="puntos-l">${d.req.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3>Es para ti si eres…</h3><ul class="puntos-l">${d.pub.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </div>
    </section>

    <section id="temario" class="bloque">
      <div class="bloque-cab"><h2>Temario</h2><p>${d.mod.length} módulos · ${totalH} horas</p><button type="button" class="enlace-btn" id="t-todo">Expandir todo</button></div>
      <div class="modulos">${d.mod.map((m, i) => `
        <details${i === 0 ? " open" : ""}><summary><span class="m-n">Módulo ${i + 1}</span><span class="m-t">${esc(m[0])}</span><small>${m[1]} h</small></summary>
          <ul>${m[2].map(l => `<li>${esc(l)}</li>`).join("")}</ul></details>`).join("")}
      </div>
    </section>

    <section id="docentes" class="bloque">
      <h2>Tus docentes</h2>
      <div class="docs">${d.doc.map(x => `
        <article class="doc">
          <span class="avatar" aria-hidden="true">${ini(x.n)}</span>
          <div><h3>${esc(x.n)}</h3><p class="doc-c">${esc(x.c)}</p>
            <p>${esc(x.b)}</p>
            <dl class="doc-n"><div><dt>Valoración</dt><dd>★ ${x.r.toFixed(1)}</dd></div><div><dt>Estudiantes</dt><dd>${fmt(x.al)}</dd></div><div><dt>Programas</dt><dd>${x.cu}</dd></div></dl>
          </div>
        </article>`).join("")}</div>
    </section>

    <section id="comentarios" class="bloque">
      <h2>Lo que dicen los estudiantes</h2>
      <div class="resumen-r">
        <div class="r-gran"><b id="r-prom"></b><span id="r-est" class="est"></span><small id="r-n"></small></div>
        <div id="r-barras" class="r-barras"></div>
      </div>
      <p class="filtro-r" id="r-filtro" hidden><span></span> <button type="button" class="enlace-btn" id="r-quitar">Ver todos</button></p>
      <div id="r-lista" class="resenas"></div>
      <form class="dejar" id="dejar" novalidate>
        <h3>Deja tu comentario</h3>
        <label for="d-nombre">Tu nombre</label><input id="d-nombre" autocomplete="name" placeholder="Nombre y apellido">
        <small class="error" data-e="nombre"></small>
        <fieldset><legend>Tu puntuación</legend>
          <div class="estrellas-in" role="radiogroup" aria-label="Puntuación">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="e" id="e${n}" value="${n}"><label for="e${n}" title="${n} estrellas"><span class="sr">${n} estrellas</span>★</label>`).join("")}</div>
        </fieldset><small class="error" data-e="e"></small>
        <label for="d-texto">Tu experiencia</label><textarea id="d-texto" rows="3" maxlength="400" placeholder="¿Qué aprendiste? ¿Qué mejorarías?"></textarea>
        <small class="error" data-e="texto"></small>
        <button class="boton" type="submit">Publicar comentario</button>
      </form>
    </section>

    <section id="preguntas" class="bloque">
      <h2>Preguntas frecuentes</h2>
      <div class="faq">${d.faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</div>
    </section>

    <section class="bloque" id="otros">
      <h2>Otros programas que te pueden interesar</h2>
      <div class="cursos">${otros.map(o => TP.tarjeta(o, false)).join("")}</div>
    </section>
  </div>
  </div>

  <div class="barra-insc" id="barra-insc"><div><b>${esc(c.t)}</b><small>${TP.soles(c.p)}</small></div><a class="boton" href="matricula.html?programa=${c.id}">Inscribirme</a></div>`;

  pintarComentarios(0);
  let filtro = 0;

  /* Cuotas */
  $("#c-cuotas").addEventListener("change", e => { $("#c-cuota").textContent = cuotaTxt(+e.target.value); });

  /* Favorito y compartir */
  $("#c-fav").addEventListener("click", e => {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    seguro(() => localStorage.setItem("fav", JSON.stringify([...favs])));
    e.target.setAttribute("aria-pressed", favs.has(id));
    e.target.textContent = favs.has(id) ? "♥ Guardado" : "♡ Guardar";
    aviso(favs.has(id) ? "Guardado en favoritos ♥" : "Quitado de favoritos");
  });
  $("#c-comp").addEventListener("click", async () => {
    const texto = `${c.t} en TUPLUSEDUCA: ${c.d}`;
    if (navigator.share) { await seguro(() => navigator.share({ title: c.t, text: texto, url: location.href })); return; }
    copiar(texto + " " + location.href, "Enlace copiado");
  });

  /* Temario */
  let abiertos = false;
  $("#t-todo").addEventListener("click", e => {
    abiertos = !abiertos;
    $$(".modulos details").forEach(x => { x.open = abiertos; });
    e.target.textContent = abiertos ? "Contraer todo" : "Expandir todo";
  });

  /* Comentarios: filtro por estrellas, útil y nuevo comentario */
  $("#r-barras").addEventListener("click", e => {
    const b = e.target.closest(".bar-e"); if (!b) return;
    filtro = filtro === +b.dataset.e ? 0 : +b.dataset.e; pintarComentarios(filtro);
  });
  $("#r-quitar").addEventListener("click", () => { filtro = 0; pintarComentarios(0); });
  $("#r-lista").addEventListener("click", e => {
    const b = e.target.closest("[data-util]"); if (!b) return;
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", on); b.textContent = on ? "👍 Gracias por tu voto" : "👍 Me sirvió";
  });
  const form = $("#dejar");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const nombre = $("#d-nombre").value.trim(), texto = $("#d-texto").value.trim(), est = form.querySelector('input[name="e"]:checked');
    const err = { nombre: nombre.length >= 3 ? "" : "Escribe tu nombre.", e: est ? "" : "Elige de 1 a 5 estrellas.", texto: texto.length >= 10 ? "" : "Cuéntanos un poco más (mínimo 10 caracteres)." };
    Object.entries(err).forEach(([k, v]) => { $(`[data-e="${k}"]`, form).textContent = v; });
    $("#d-nombre").setAttribute("aria-invalid", !!err.nombre); $("#d-texto").setAttribute("aria-invalid", !!err.texto);
    if (err.nombre) return $("#d-nombre").focus();
    if (err.e) return form.querySelector('input[name="e"]').focus();
    if (err.texto) return $("#d-texto").focus();
    propios.unshift({ n: nombre, f: new Date().toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }), e: +est.value, t: texto, mio: true });
    seguro(() => localStorage.setItem(clave, JSON.stringify(propios.slice(0, 20))));
    form.reset(); filtro = 0; pintarComentarios(0);
    aviso("¡Gracias! Tu comentario ya aparece en la lista.");
    $("#r-lista").scrollIntoView({ behavior: mov ? "auto" : "smooth", block: "nearest" });
  });

  /* Menú de secciones: resalta la sección visible */
  const links = $$("#subnav a"), secs = links.map(a => $(a.getAttribute("href")));
  const spy = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
  }), { rootMargin: "-30% 0px -60% 0px" });
  secs.forEach(s => s && spy.observe(s));

  /* Barra inferior de inscripción en celulares */
  const barra = $("#barra-insc"), tarj = $(".inscripcion");
  new IntersectionObserver(([en]) => barra.classList.toggle("ver", !en.isIntersecting && en.boundingClientRect.top < 0)).observe(tarj);
})();
