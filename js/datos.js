"use strict";
/* Datos compartidos por todas las pantallas */
const TP = window.TP = {};

TP.soles = n => "S/ " + n;

TP.PAGINAS = [
  { id: "inicio", t: "Inicio", u: "index.html" },
  { id: "programas", t: "Programas", u: "pages/programas.html" },
  { id: "test", t: "Test", u: "pages/test.html" },
  { id: "nosotros", t: "Nosotros", u: "pages/nosotros.html" },
  { id: "planificador", t: "Planificador", u: "pages/planificador.html" },
  { id: "contacto", t: "Contacto", u: "pages/contacto.html" },
  { id: "matricula", t: "Matrícula", u: "pages/matricula.html", nav: false }
];

/* h = horas totales del programa */
TP.CURSOS = [
  { id: "web", cat: "Tecnología", t: "Desarrollo web", s: "</>", g: ["#2b5c72", "#122b40"], imagen: "assets/desarrollo-web.jpg", etiqueta: "Popular", d: "Aprende HTML, CSS y JavaScript desde cero y publica tu propio sitio.", dur: "12 semanas", niv: "Inicial", p: 249, h: 60, l: ["Maquetación con HTML y CSS", "JavaScript e interactividad", "Proyecto final publicado"] },
  { id: "datos", cat: "Tecnología", t: "Excel y análisis de datos", s: "Σ", g: ["#2c6b57", "#10302c"], imagen: "assets/excel-datos.jpg", d: "Ordena, analiza y presenta datos para tomar mejores decisiones.", dur: "8 semanas", niv: "Inicial", p: 189, h: 40, l: ["Fórmulas y tablas dinámicas", "Gráficos y paneles", "Caso práctico con datos reales"] },
  { id: "diseno", cat: "Creatividad", t: "Diseño gráfico", s: "✧", g: ["#6c4d78", "#29233f"], imagen: "assets/diseno-grafico.jpg", etiqueta: "Popular", d: "Transforma tus ideas en diseños atractivos y profesionales.", dur: "10 semanas", niv: "Inicial", p: 219, h: 50, l: ["Color, tipografía y composición", "Identidad de marca", "Portafolio de 3 proyectos"] },
  { id: "video", cat: "Creatividad", t: "Edición de video", s: "▶", g: ["#7a3f4d", "#2b1e2e"], imagen: "assets/edicion-video.jpg", d: "Edita videos para redes y proyectos con un flujo de trabajo ordenado.", dur: "8 semanas", niv: "Intermedio", p: 199, h: 40, l: ["Montaje y ritmo", "Audio y color", "Video final para redes"] },
  { id: "marketing", cat: "Negocios", t: "Marketing digital", s: "↗", g: ["#7a6031", "#2a2b31"], imagen: "assets/marketing.png", d: "Aprende a promocionar marcas y proyectos en redes y buscadores.", dur: "10 semanas", niv: "Inicial", p: 229, h: 50, l: ["Estrategia y contenido", "Publicidad en redes", "Métricas y resultados"] },
  { id: "emprende", cat: "Negocios", t: "Emprendimiento", s: "◆", g: ["#3d5a80", "#1b2a41"], imagen: "assets/emprendimiento.jpg", etiqueta: "Nuevo", d: "Convierte una idea en un negocio con un plan claro y validado.", dur: "6 semanas", niv: "Inicial", p: 169, h: 30, l: ["Validación de la idea", "Modelo de negocio", "Plan de lanzamiento"] }
];

TP.curso = id => TP.CURSOS.find(c => c.id === id);


/* ---------- Detalle de cada programa (ficha del curso) ----------
   r = valoración, n = reseñas, al = estudiantes, mod = [nombre, horas, lecciones]
   La suma de horas de los módulos es igual a la duración total del programa. */
TP.DET = {
  web: {
    r: 4.8, n: 312, al: 2480, act: "octubre de 2026",
    apr: ["Maquetar páginas responsive con HTML y CSS", "Programar interactividad con JavaScript", "Consumir datos de una API y mostrarlos en pantalla", "Publicar tu sitio en internet con tu propio enlace"],
    req: ["Una computadora con internet", "No necesitas experiencia previa en programación"],
    pub: ["Personas que empiezan desde cero", "Emprendedores que quieren su propia web", "Quienes buscan su primer empleo en tecnología"],
    top: ["html", "css", "javascript", "programacion", "codigo", "frontend", "paginas web", "responsive"],
    mod: [
      ["Introducción y diagnóstico", 4, ["Cómo funciona la web", "Editor y herramientas", "Diagnóstico de nivel"]],
      ["HTML semántico", 10, ["Estructura de una página", "Textos, enlaces e imágenes", "Formularios accesibles"]],
      ["CSS y diseño responsive", 14, ["Selectores y cascada", "Flexbox y Grid", "Diseño para celular"]],
      ["JavaScript esencial", 16, ["Variables y funciones", "El DOM y los eventos", "Arreglos y objetos"]],
      ["Interactividad y APIs", 10, ["Fetch y datos externos", "Validación de formularios", "Guardar datos en el navegador"]],
      ["Proyecto final y publicación", 6, ["Planificación del proyecto", "Revisión con tu docente", "Publicación del sitio"]]
    ],
    doc: [
      { n: "Lucía Paredes", c: "Ingeniera de software · Frontend", b: "Ocho años construyendo productos web para startups de Lima y Bogotá. Le gusta explicar con ejemplos que se pueden probar al instante.", al: 1820, cu: 3, r: 4.9 },
      { n: "Diego Salazar", c: "Desarrollador full stack", b: "Acompaña los proyectos finales y revisa tu código con comentarios concretos. Ha mentoreado a más de 400 personas en su primer sitio publicado.", al: 960, cu: 2, r: 4.7 }
    ],
    com: [
      { n: "María P.", f: "12 sep 2026", e: 5, t: "Empecé sin saber nada de código y hoy publiqué la web de mi negocio. Las revisiones de Lucía me ayudaron muchísimo." },
      { n: "Renzo A.", f: "29 ago 2026", e: 5, t: "Los ejercicios son cortos y se van sumando al proyecto final. Nunca me sentí perdido." },
      { n: "Valeria C.", f: "3 ago 2026", e: 4, t: "Muy buen contenido. Me gustaría que el módulo de JavaScript tuviera un par de ejercicios más." },
      { n: "Hugo M.", f: "17 jul 2026", e: 5, t: "Lo hice de noche después del trabajo. El ritmo es ideal si tienes poco tiempo." },
      { n: "Daniela R.", f: "28 jun 2026", e: 4, t: "Aprendí a maquetar de verdad, no solo a copiar código. El docente responde rápido." }
    ],
    faq: [["¿Necesito saber programar?", "No. Empezamos desde cómo funciona una página web y avanzamos paso a paso."], ["¿Qué computadora necesito?", "Cualquier laptop o PC con navegador e internet. Todas las herramientas son gratuitas."], ["¿Puedo usar mi proyecto como portafolio?", "Sí. Terminas con un sitio publicado que puedes mostrar a clientes y empleadores."]]
  },
  datos: {
    r: 4.7, n: 244, al: 1930, act: "septiembre de 2026",
    apr: ["Usar fórmulas y funciones para automatizar cálculos", "Armar tablas dinámicas para resumir miles de filas", "Limpiar y ordenar datos desordenados", "Presentar resultados en gráficos y paneles claros"],
    req: ["Excel 2016 o superior (o Google Sheets)", "Saber abrir y guardar un archivo"],
    pub: ["Personas que trabajan con reportes y planillas", "Estudiantes que quieren destacar en prácticas", "Dueños de negocio que quieren entender sus números"],
    top: ["excel", "datos", "formulas", "tablas dinamicas", "analisis", "reportes", "dashboard", "graficos"],
    mod: [
      ["Introducción y diagnóstico", 4, ["Entorno de Excel", "Tipos de datos", "Diagnóstico de nivel"]],
      ["Fórmulas esenciales", 8, ["SUMA, PROMEDIO y SI", "BUSCARX y funciones de búsqueda", "Errores comunes"]],
      ["Tablas dinámicas", 10, ["Crear y filtrar", "Campos calculados", "Segmentaciones"]],
      ["Limpieza de datos", 6, ["Duplicados y vacíos", "Texto a columnas", "Validación de datos"]],
      ["Gráficos y paneles", 8, ["Elegir el gráfico correcto", "Panel interactivo", "Formato condicional"]],
      ["Caso práctico con datos reales", 4, ["Planteamiento del caso", "Análisis guiado", "Presentación de resultados"]]
    ],
    doc: [
      { n: "Andrea Quispe", c: "Analista de datos senior", b: "Trabaja con datos de ventas y logística hace diez años. Enseña a pensar el problema antes de abrir la planilla.", al: 1410, cu: 2, r: 4.8 },
      { n: "Carlos Mendoza", c: "Consultor en inteligencia de negocios", b: "Ha armado paneles para empresas de retail y banca. Aporta casos reales con datos anonimizados.", al: 880, cu: 2, r: 4.6 }
    ],
    com: [
      { n: "Sofía T.", f: "20 sep 2026", e: 5, t: "Ahora hago en 10 minutos el reporte que antes me tomaba toda la tarde." },
      { n: "Luis V.", f: "5 sep 2026", e: 5, t: "Las tablas dinámicas por fin tienen sentido. El caso final con datos reales fue lo mejor." },
      { n: "Paola G.", f: "11 ago 2026", e: 4, t: "Muy práctico. Faltó un poco más de Power Query, pero el curso cumple lo que promete." },
      { n: "Jorge L.", f: "30 jul 2026", e: 4, t: "Ordenado y claro. Los archivos de práctica están bien preparados." }
    ],
    faq: [["¿Sirve Google Sheets?", "Sí para la mayor parte del curso. Algunas funciones avanzadas se explican con Excel."], ["¿Aprenderé Power BI?", "No. El programa se centra en Excel; al final te mostramos cómo seguir hacia Power BI."], ["¿Los archivos de práctica se descargan?", "Sí. Cada módulo incluye sus archivos y la solución comentada."]]
  },
  diseno: {
    r: 4.9, n: 287, al: 2210, act: "octubre de 2026",
    apr: ["Combinar color, tipografía y composición con criterio", "Crear una identidad de marca completa", "Usar herramientas profesionales de diseño", "Armar un portafolio de 3 proyectos"],
    req: ["Computadora con internet", "Ganas de practicar; no necesitas saber dibujar"],
    pub: ["Quienes quieren trabajar como diseñadores freelance", "Emprendedores que diseñan su propia marca", "Estudiantes de comunicación y publicidad"],
    top: ["diseno", "grafico", "logo", "marca", "color", "tipografia", "portafolio", "creatividad", "photoshop", "figma"],
    mod: [
      ["Introducción y diagnóstico", 4, ["Qué hace un diseñador", "Referentes y moodboards", "Diagnóstico de nivel"]],
      ["Color y tipografía", 10, ["Teoría del color aplicada", "Combinar tipografías", "Jerarquía visual"]],
      ["Composición y retícula", 8, ["Equilibrio y espacio", "Retículas", "Diseño de afiches"]],
      ["Identidad de marca", 12, ["Investigación de marca", "Logotipo y variantes", "Manual de marca"]],
      ["Herramientas de diseño", 8, ["Vectores e imágenes", "Plantillas para redes", "Exportar para impresión y web"]],
      ["Portafolio de 3 proyectos", 8, ["Selección de proyectos", "Presentación de casos", "Publicación de tu portafolio"]]
    ],
    doc: [
      { n: "Camila Rojas", c: "Directora de arte · Identidad visual", b: "Ha creado marcas para restaurantes, ONG y startups. Corrige tus trabajos como lo haría en un estudio real.", al: 1650, cu: 3, r: 4.9 },
      { n: "Mateo Ferreyra", c: "Diseñador gráfico y tipógrafo", b: "Apasionado por la tipografía y la composición. Sus clases van de lo simple a lo exigente sin saltos.", al: 1020, cu: 2, r: 4.8 }
    ],
    com: [
      { n: "Camila R.", f: "2 oct 2026", e: 5, t: "Armé mi portafolio en tres meses y ya tengo mis primeros clientes." },
      { n: "Ignacio S.", f: "14 sep 2026", e: 5, t: "Aprendí a justificar cada decisión de diseño. Las correcciones fueron muy valiosas." },
      { n: "Marcela D.", f: "22 ago 2026", e: 5, t: "El módulo de identidad de marca vale por todo el curso." },
      { n: "Bruno H.", f: "9 ago 2026", e: 4, t: "Excelente. Me hubiera gustado más tiempo en retículas." },
      { n: "Elena P.", f: "1 jul 2026", e: 5, t: "Pasé de usar plantillas a crear mis propias piezas." }
    ],
    faq: [["¿Debo saber dibujar?", "No. El diseño gráfico se basa en decisiones visuales, no en dibujar a mano."], ["¿Qué programas usamos?", "Herramientas gratuitas o con versión gratuita, para que no tengas que comprar nada."], ["¿Recibiré feedback de mis trabajos?", "Sí. Tus docentes revisan cada proyecto con comentarios por escrito."]]
  },
  video: {
    r: 4.6, n: 168, al: 1240, act: "agosto de 2026",
    apr: ["Montar un video con buen ritmo y narrativa", "Limpiar y mezclar audio", "Corregir color para un acabado consistente", "Exportar en los formatos de cada red social"],
    req: ["Computadora con 8 GB de RAM o más", "Conocimientos básicos de uso de archivos y carpetas", "Material propio para editar (celular o cámara)"],
    pub: ["Creadores de contenido", "Personas que ya graban y quieren editar mejor", "Equipos de marketing que producen sus videos"],
    top: ["video", "edicion", "montaje", "reels", "youtube", "audio", "color", "premiere", "capcut", "davinci"],
    mod: [
      ["Introducción y diagnóstico", 4, ["Flujo de trabajo de edición", "Organizar tu material", "Diagnóstico de nivel"]],
      ["Montaje y ritmo", 10, ["Cortes y transiciones", "Ritmo y narrativa", "Edición de entrevistas"]],
      ["Audio", 8, ["Limpieza de voz", "Música y efectos", "Mezcla final"]],
      ["Color", 8, ["Balance de blancos", "Corrección primaria", "Estilos y LUTs"]],
      ["Formatos para redes", 6, ["Vertical y horizontal", "Subtítulos", "Miniaturas"]],
      ["Video final para redes", 4, ["Guion y storyboard", "Edición del video final", "Entrega y feedback"]]
    ],
    doc: [
      { n: "Sebastián Ortega", c: "Editor y colorista", b: "Edita campañas y documentales desde hace nueve años. Enseña atajos de trabajo que ahorran horas.", al: 940, cu: 2, r: 4.7 },
      { n: "Natalia Vega", c: "Productora audiovisual", b: "Especialista en contenido para redes. Se enfoca en historias breves que mantienen la atención.", al: 610, cu: 1, r: 4.5 }
    ],
    com: [
      { n: "Tomás B.", f: "18 sep 2026", e: 5, t: "Mis reels se ven mucho más profesionales. Aprendí a cortar con intención." },
      { n: "Alejandra N.", f: "3 sep 2026", e: 4, t: "Muy buen módulo de audio. El de color es intenso pero se entiende." },
      { n: "Fabián C.", f: "15 ago 2026", e: 5, t: "Cumple lo que dice. Terminé con un video para el canal de mi negocio." },
      { n: "Rocío M.", f: "26 jul 2026", e: 4, t: "Recomiendo tener algo de material propio antes de empezar." }
    ],
    faq: [["¿Con qué software se trabaja?", "Las clases se explican con herramientas de uso común y los conceptos sirven para cualquier editor."], ["¿Puedo editar desde el celular?", "El curso está pensado para computadora, pero los principios aplican también a apps móviles."], ["¿Por qué es nivel intermedio?", "Asume que ya has usado un editor y sabes importar y exportar archivos."]]
  },
  marketing: {
    r: 4.7, n: 259, al: 2050, act: "octubre de 2026",
    apr: ["Definir una estrategia y un público objetivo", "Crear contenido que conecte en redes sociales", "Lanzar y optimizar campañas de publicidad pagada", "Medir resultados con métricas que sí importan"],
    req: ["Una cuenta en alguna red social", "No necesitas experiencia previa"],
    pub: ["Emprendedores que quieren vender más", "Quienes trabajan en redes sociales de una marca", "Personas que buscan empleo en marketing digital"],
    top: ["marketing", "redes sociales", "publicidad", "facebook ads", "seo", "contenido", "ventas", "metricas", "instagram", "tiktok"],
    mod: [
      ["Introducción y diagnóstico", 4, ["El embudo de marketing", "Auditoría de una marca", "Diagnóstico de nivel"]],
      ["Estrategia y público", 8, ["Buyer persona", "Propuesta de valor", "Objetivos medibles"]],
      ["Contenido para redes", 10, ["Calendario editorial", "Copywriting", "Formatos que funcionan"]],
      ["Publicidad en redes", 12, ["Estructura de campañas", "Segmentación", "Presupuesto y optimización"]],
      ["SEO y buscadores", 8, ["Palabras clave", "SEO on page", "Google Business"]],
      ["Métricas y resultados", 8, ["KPIs principales", "Paneles de seguimiento", "Informe de campaña"]]
    ],
    doc: [
      { n: "Gabriela Linares", c: "Estratega de marketing digital", b: "Ha liderado campañas para marcas de consumo masivo y e-commerce. Siempre parte de los números del negocio.", al: 1380, cu: 2, r: 4.8 },
      { n: "Rafael Cuba", c: "Especialista en publicidad pagada", b: "Gestiona inversión publicitaria mensual en redes y buscadores. Comparte campañas reales con sus resultados.", al: 910, cu: 2, r: 4.6 }
    ],
    com: [
      { n: "Jorge L.", f: "8 oct 2026", e: 5, t: "Estudio de noche, después del trabajo. Poder avanzar a mi ritmo me permitió terminar el programa." },
      { n: "Karen S.", f: "21 sep 2026", e: 5, t: "Dupliqué las ventas de mi tienda online aplicando el módulo de publicidad." },
      { n: "Andrés F.", f: "7 sep 2026", e: 4, t: "Muy completo. Los ejemplos de campañas reales son lo mejor." },
      { n: "Luz M.", f: "19 ago 2026", e: 5, t: "Por fin entiendo qué métricas mirar y cuáles ignorar." },
      { n: "Pedro Q.", f: "30 jul 2026", e: 4, t: "Buen ritmo y buenos docentes. SEO se me hizo un poco denso." }
    ],
    faq: [["¿Necesito presupuesto para practicar?", "No. Hacemos simulaciones guiadas y, si quieres, una campaña real con un presupuesto mínimo."], ["¿Sirve si ya tengo un negocio?", "Sí. Aplicas cada módulo a tu propio negocio como proyecto del curso."], ["¿Incluye certificado?", "Sí, al entregar tu informe de campaña final."]]
  },
  emprende: {
    r: 4.6, n: 96, al: 780, act: "noviembre de 2026",
    apr: ["Validar una idea antes de invertir dinero", "Diseñar tu modelo de negocio en una página", "Calcular costos, precios y punto de equilibrio", "Armar un plan de lanzamiento con fechas"],
    req: ["Una idea o interés en emprender", "Computadora o celular con internet"],
    pub: ["Personas con una idea de negocio", "Profesionales que quieren independizarse", "Estudiantes que desean emprender"],
    top: ["emprendimiento", "negocio", "startup", "plan de negocio", "ventas", "finanzas", "validacion", "modelo canvas"],
    mod: [
      ["Introducción y diagnóstico", 3, ["Mentalidad emprendedora", "Tu idea en una frase", "Diagnóstico de nivel"]],
      ["Validación de la idea", 6, ["Entrevistas a clientes", "Prototipo mínimo", "Primeras ventas de prueba"]],
      ["Modelo de negocio", 6, ["Lienzo de modelo de negocio", "Propuesta de valor", "Canales y relaciones"]],
      ["Finanzas básicas", 6, ["Costos y precios", "Punto de equilibrio", "Flujo de caja inicial"]],
      ["Marketing y ventas", 5, ["Primeros clientes", "Guion de venta", "Redes y boca a boca"]],
      ["Plan de lanzamiento", 4, ["Cronograma de 90 días", "Indicadores de avance", "Presentación del plan"]]
    ],
    doc: [
      { n: "Patricia Núñez", c: "Fundadora y mentora de negocios", b: "Ha creado dos empresas y acompañado a más de 60 emprendimientos en sus primeros meses.", al: 520, cu: 1, r: 4.7 },
      { n: "Óscar Valdivia", c: "Consultor financiero para pymes", b: "Hace que las finanzas básicas sean simples. Te ayuda a ponerle números a tu idea.", al: 410, cu: 1, r: 4.5 }
    ],
    com: [
      { n: "Mónica A.", f: "4 nov 2026", e: 5, t: "Validé mi idea en dos semanas y evité una inversión que no habría funcionado." },
      { n: "Eduardo R.", f: "15 oct 2026", e: 4, t: "Claro y directo. El módulo de finanzas me dio mucha tranquilidad." },
      { n: "Julia B.", f: "27 sep 2026", e: 5, t: "Salí con un plan de 90 días y ya estoy ejecutándolo." }
    ],
    faq: [["¿Necesito tener una idea definida?", "Mejor si la tienes, pero en el primer módulo te ayudamos a aterrizar una."], ["¿Cuánto dura el curso?", "Seis semanas con 5 horas semanales aproximadamente."], ["¿Ayudan con financiamiento?", "No gestionamos financiamiento, pero aprendes a presentar tu plan a posibles inversionistas."]]
  }
};
TP.det = id => TP.DET[id];
TP.horas = c => TP.DET[c.id].mod.reduce((a, m) => a + m[1], 0);
TP.estrellas = r => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
TP.url = id => (document.body.dataset.raiz || "") + "pages/curso.html?id=" + id;

TP.tarjeta = (c, fav) => {
  const raiz = document.body.dataset.raiz || "", d = TP.DET[c.id];
  return `
  <article class="curso" data-cat="${c.cat}" data-id="${c.id}">
    ${fav ? `<button class="fav" data-fav="${c.id}" aria-pressed="false" aria-label="Guardar ${c.t} en favoritos">♡</button>` : ""}
    <div class="curso-cabecera" style="background:linear-gradient(135deg,${c.g[0]},${c.g[1]})">
      <img src="${raiz}${c.imagen}" alt="${esc(c.t)}" class="curso-img" loading="lazy" width="640" height="360" />
      ${c.etiqueta ? `<span class="badge badge-${sin(c.etiqueta)}">${c.etiqueta}</span>` : ""}
    </div>
    <div class="curso-cont"><small>${c.cat}</small><h3>${c.t}</h3><p>${c.d}</p>
      <div class="valora" aria-label="Valoración ${d.r} de 5"><b>${d.r.toFixed(1)}</b><span aria-hidden="true">${TP.estrellas(d.r)}</span><small>(${d.n})</small></div>
      <div class="meta">${c.dur} · ${c.niv} · ${TP.soles(c.p)}</div>
      <a class="ver" href="${TP.url(c.id)}">Ver curso</a></div>
  </article>`;
};
