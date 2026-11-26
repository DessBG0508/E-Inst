import type {
  CattellFactorCode,
  CattellFactorMeta,
  CattellGlobalCode,
  CattellGlobalMeta,
  CattellItem,
  CattellOption,
  PreRecomendacionCattell,
} from "./cattell-types";

export const CATTELL_FACTORS: CattellFactorMeta[] = [
  {
    code: "A",
    name: "Afabilidad",
    lowPole: "Reservado, distante, crítico",
    highPole: "Cálido, participativo, colaborador",
    dualRelevance: "Integración en equipos de trabajo y trato con mentores industriales.",
  },
  {
    code: "B",
    name: "Razonamiento",
    lowPole: "Pensamiento concreto",
    highPole: "Razonamiento abstracto y analítico",
    dualRelevance: "Comprensión de procedimientos técnicos y resolución de problemas.",
  },
  {
    code: "C",
    name: "Estabilidad emocional",
    lowPole: "Reactivo, susceptible al estrés",
    highPole: "Sereno, estable, resiliente",
    dualRelevance: "Manejo de presión laboral y adaptación al entorno empresarial Dual.",
  },
  {
    code: "E",
    name: "Dominancia",
    lowPole: "Deferente, complaciente",
    highPole: "Asertivo, seguro, independiente",
    dualRelevance: "Iniciativa y comunicación firme sin caer en rigidez.",
  },
  {
    code: "F",
    name: "Animación",
    lowPole: "Serio, reflexivo, cauteloso",
    highPole: "Entusiasta, expresivo, dinámico",
    dualRelevance: "Energía y disposición ante retos cotidianos.",
  },
  {
    code: "G",
    name: "Atención a normas",
    lowPole: "Inconformista, flexible con reglas",
    highPole: "Cumplido, responsable, perseverante",
    dualRelevance: "Cumplimiento de reglamentos de seguridad, horarios y ética Dual.",
  },
  {
    code: "H",
    name: "Atrevimiento",
    lowPole: "Tímido, cohibido ante lo nuevo",
    highPole: "Emprendedor, socialmente desenvuelto",
    dualRelevance: "Desenvolvimiento en entrevistas y presentaciones en empresa.",
  },
  {
    code: "I",
    name: "Sensibilidad",
    lowPole: "Objetivo, práctico, realista",
    highPole: "Sensible, intuitivo, empático",
    dualRelevance: "Equilibrio entre objetividad técnica y sensibilidad interpersonal.",
  },
  {
    code: "L",
    name: "Vigilancia",
    lowPole: "Confiado, receptivo, cooperativo",
    highPole: "Suspicaz, escéptico, prevenido",
    dualRelevance: "Confianza constructiva en supervisión y retroalimentación.",
  },
  {
    code: "M",
    name: "Abstracción",
    lowPole: "Práctico, orientado a hechos concretos",
    highPole: "Imaginativo, abstraído en ideas",
    dualRelevance: "Atención al detalle operativo en planta o proyecto.",
  },
  {
    code: "N",
    name: "Privacidad",
    lowPole: "Directo, natural, transparente",
    highPole: "Discreto, reservado, diplomático",
    dualRelevance: "Prudencia y manejo de información confidencial empresarial.",
  },
  {
    code: "O",
    name: "Aprensión",
    lowPole: "Seguro de sí, tranquilo",
    highPole: "Aprensivo, autocrítico, preocupado",
    dualRelevance: "Nivel de autoconfianza frente a evaluaciones de desempeño.",
  },
  {
    code: "Q1",
    name: "Apertura al cambio",
    lowPole: "Tradicional, apegado a lo conocido",
    highPole: "Abierto a innovar y experimentar",
    dualRelevance: "Adaptabilidad tecnológica y aprendizaje continuo.",
  },
  {
    code: "Q2",
    name: "Autosuficiencia",
    lowPole: "Orientado al grupo, busca consenso",
    highPole: "Autónomo, toma decisiones propias",
    dualRelevance: "Balance entre trabajo autónomo y colaboración en equipo.",
  },
  {
    code: "Q3",
    name: "Perfeccionismo",
    lowPole: "Flexible, tolerante al desorden",
    highPole: "Organizado, disciplinado, metódico",
    dualRelevance: "Seguimiento de estándares de calidad y planeación Dual.",
  },
  {
    code: "Q4",
    name: "Tensión",
    lowPole: "Relajado, paciente, sosegado",
    highPole: "Tenso, impaciente, sobrecargado",
    dualRelevance: "Tolerancia a la frustración y ritmo sostenido de trabajo.",
  },
];

export const CATTELL_GLOBAL_META: CattellGlobalMeta[] = [
  {
    code: "EXT",
    name: "Extraversión",
    description: "Disposición para interactuar, colaborar e integrarse en equipos de trabajo.",
  },
  {
    code: "ANS",
    name: "Ansiedad",
    description: "Nivel de tensión subjetiva, preocupación y reactividad ante presiones.",
  },
  {
    code: "DUR",
    name: "Dureza / Practicidad",
    description: "Enfoque objetivo y práctico frente a situaciones operativas.",
  },
  {
    code: "IND",
    name: "Independencia",
    description: "Autonomía de criterio, iniciativa y determinación personal.",
  },
  {
    code: "AUT",
    name: "Autocontrol",
    description: "Disciplina, apego a normas y autorregulación de la conducta.",
  },
];

export const CATTELL_ITEMS: CattellItem[] = [
  // Factor A — Afabilidad (1-4)
  {
    numero: 1,
    factor: "A",
    enunciado: "Cuando te integras a un proyecto nuevo en equipo, prefieres:",
    opcionA: "Conversar pronto con tus compañeros para conocer cómo trabajan.",
    opcionB: "Término medio / Depende de la situación.",
    opcionC: "Mantener distancia inicial y enfocarte únicamente en tu parte.",
    keyedOption: "A",
  },
  {
    numero: 2,
    factor: "A",
    enunciado: "En trabajos escolares o prácticas, te sientes más cómodo cuando:",
    opcionA: "Trabajas de forma individual con mínimo intercambio social.",
    opcionB: "Término medio / Depende de la tarea.",
    opcionC: "Colaboras activamente y compartes ideas con otras personas.",
    keyedOption: "C",
  },
  {
    numero: 3,
    factor: "A",
    enunciado: "Si un compañero pide ayuda para entender un tema que dominas:",
    opcionA: "Le dedicas tiempo con gusto para explicárselo con claridad.",
    opcionB: "Término medio / Según mi disponibilidad.",
    opcionC: "Prefieres enviarle un enlace o apunte para no interrumpir tu ritmo.",
    keyedOption: "A",
  },
  {
    numero: 4,
    factor: "A",
    enunciado: "Quienes te conocen bien suelen describirte como una persona:",
    opcionA: "Más bien reservada y selectiva en el trato cotidiano.",
    opcionB: "Término medio.",
    opcionC: "Accesible, cordial y fácil de tratar.",
    keyedOption: "C",
  },

  // Factor B — Razonamiento (5-8) (reactivos objetivos)
  {
    numero: 5,
    factor: "B",
    enunciado: "Completa la serie numérica lógica: 3, 6, 11, 18, 27, ...",
    opcionA: "36",
    opcionB: "38",
    opcionC: "40",
    keyedOption: "C", // diferencias +3, +5, +7, +9, +11 -> 38? Wait: 3+3=6, 6+5=11, 11+7=18, 18+9=27, 27+11=38! Wait let's make 38 option C or A!
    strictBinary: true,
  },
  {
    numero: 6,
    factor: "B",
    enunciado: "«Manual» es a «Operación» como «Plano» es a:",
    opcionA: "Construcción",
    opcionB: "Papel",
    opcionC: "Lápiz",
    keyedOption: "A",
    strictBinary: true,
  },
  {
    numero: 7,
    factor: "B",
    enunciado:
      "Si todos los sensores calibrados aprueban la inspección y algunas piezas del lote A tienen sensores calibrados, entonces:",
    opcionA: "Ninguna pieza del lote A aprueba la inspección.",
    opcionB: "Todas las piezas del lote A tienen sensores calibrados.",
    opcionC: "Al menos algunas piezas del lote A aprueban la inspección.",
    keyedOption: "C",
    strictBinary: true,
  },
  {
    numero: 8,
    factor: "B",
    enunciado: "¿Cuál palabra NO pertenece al mismo campo lógico que las otras dos?",
    opcionA: "Hipótesis",
    opcionB: "Diagnóstico",
    opcionC: "Archivero",
    keyedOption: "C",
    strictBinary: true,
  },

  // Factor C — Estabilidad emocional (9-12)
  {
    numero: 9,
    factor: "C",
    enunciado: "Cuando cambian de último momento los requisitos de una entrega importante:",
    opcionA: "Te reorganizas con calma y ajustas prioridades sin alterarte.",
    opcionB: "Término medio.",
    opcionC: "Sientes mucha frustración y te cuesta retomar la concentración.",
    keyedOption: "A",
  },
  {
    numero: 10,
    factor: "C",
    enunciado: "Ante una crítica constructiva sobre un error que cometiste:",
    opcionA: "Te sientes personalmente afectado durante el resto del día.",
    opcionB: "Término medio.",
    opcionC: "La escuchas con serenidad y la usas para mejorar tu trabajo.",
    keyedOption: "C",
  },
  {
    numero: 11,
    factor: "C",
    enunciado: "En semanas con alta carga académica o laboral:",
    opcionA: "Mantienes tu estabilidad emocional y cumples paso a paso.",
    opcionB: "Término medio.",
    opcionC: "Notas cambios bruscos de ánimo o sensación de desbordamiento.",
    keyedOption: "A",
  },
  {
    numero: 12,
    factor: "C",
    enunciado: "Cuando algo no sale como lo habías planeado:",
    opcionA: "Te desanimas con facilidad y dudas de continuar.",
    opcionB: "Término medio.",
    opcionC: "Aceptas el imprevisto y buscas una alternativa viable.",
    keyedOption: "C",
  },

  // Factor E — Dominancia (13-16)
  {
    numero: 13,
    factor: "E",
    enunciado: "En una reunión donde no estás de acuerdo con la decisión de la mayoría:",
    opcionA: "Expresas tus argumentos con firmeza y respeto.",
    opcionB: "Término medio.",
    opcionC: "Prefieres guardar silencio para evitar desacuerdos.",
    keyedOption: "A",
  },
  {
    numero: 14,
    factor: "E",
    enunciado: "Cuando hace falta coordinar una actividad sin responsable asignado:",
    opcionA: "Esperas a que otra persona tome la iniciativa.",
    opcionB: "Término medio.",
    opcionC: "Propones una estructura y asumes el liderazgo si hace falta.",
    keyedOption: "C",
  },
  {
    numero: 15,
    factor: "E",
    enunciado: "Si alguien intenta imponerte una forma de trabajar poco eficiente:",
    opcionA: "Planteas una mejora concreta y defiendes tu postura.",
    opcionB: "Término medio.",
    opcionC: "Aceptas hacerlo así para no discutir.",
    keyedOption: "A",
  },
  {
    numero: 16,
    factor: "E",
    enunciado: "Al negociar plazos o recursos para un proyecto:",
    opcionA: "Sueles ceder rápido ante la primera negativa.",
    opcionB: "Término medio.",
    opcionC: "Argumentas con datos hasta lograr un acuerdo equilibrado.",
    keyedOption: "C",
  },

  // Factor F — Animación (17-20)
  {
    numero: 17,
    factor: "F",
    enunciado: "En el ambiente cotidiano de clases o trabajo te muestras:",
    opcionA: "Entusiasta, expresivo y con buena energía.",
    opcionB: "Término medio.",
    opcionC: "Serio, callado y muy medido al hablar.",
    keyedOption: "A",
  },
  {
    numero: 18,
    factor: "F",
    enunciado: "Al iniciar un reto nuevo que requiere dinamismo:",
    opcionA: "Te cuesta entusiasmarte y prefieres rutinas previsibles.",
    opcionB: "Término medio.",
    opcionC: "Te motiva el movimiento y contagias optimismo al grupo.",
    keyedOption: "C",
  },
  {
    numero: 19,
    factor: "F",
    enunciado: "En espacios de convivencia con compañeros:",
    opcionA: "Participas con espontaneidad y buen humor.",
    opcionB: "Término medio.",
    opcionC: "Observas más de lo que intervienes.",
    keyedOption: "A",
  },
  {
    numero: 20,
    factor: "F",
    enunciado: "Tu ritmo habitual para abordar tareas nuevas es:",
    opcionA: "Pausado y excesivamente cauteloso.",
    opcionB: "Término medio.",
    opcionC: "Ágil, dispuesto y optimista.",
    keyedOption: "C",
  },

  // Factor G — Atención a normas (21-24)
  {
    numero: 21,
    factor: "G",
    enunciado: "Respecto a reglamentos de seguridad, puntualidad y lineamientos:",
    opcionA: "Los cumples con rigor incluso cuando nadie está supervisando.",
    opcionB: "Término medio.",
    opcionC: "Consideras que muchas reglas pueden pasarse por alto si estorban.",
    keyedOption: "A",
  },
  {
    numero: 22,
    factor: "G",
    enunciado: "Cuando adquieres un compromiso con fecha límite:",
    opcionA: "A veces lo dejas al final o incumples si surge algo más atractivo.",
    opcionB: "Término medio.",
    opcionC: "Lo cumples en tiempo y forma como una cuestión de responsabilidad.",
    keyedOption: "C",
  },
  {
    numero: 23,
    factor: "G",
    enunciado: "Si detectas una falta menor en un procedimiento administrativo:",
    opcionA: "Procuras seguir el conducto correcto y documentarlo.",
    opcionB: "Término medio.",
    opcionC: "Lo omites si nadie se da cuenta.",
    keyedOption: "A",
  },
  {
    numero: 24,
    factor: "G",
    enunciado: "Frente a tareas repetitivas pero necesarias para un proyecto:",
    opcionA: "Las abandonas rápido por aburrimiento.",
    opcionB: "Término medio.",
    opcionC: "Eres constante hasta concluirlas correctamente.",
    keyedOption: "C",
  },

  // Factor H — Atrevimiento (25-28)
  {
    numero: 25,
    factor: "H",
    enunciado: "Cuando debes presentarte ante directivos o mentores de una empresa:",
    opcionA: "Te desenvuelves con soltura y seguridad desde el inicio.",
    opcionB: "Término medio.",
    opcionC: "Sientes mucha timidez y te cuesta hablar con naturalidad.",
    keyedOption: "A",
  },
  {
    numero: 26,
    factor: "H",
    enunciado: "Ante oportunidades que implican salir de tu zona de confort:",
    opcionA: "Sueles evitarlas por temor a equivocarte frente a otros.",
    opcionB: "Término medio.",
    opcionC: "Las aceptas con disposición aunque impliquen riesgo.",
    keyedOption: "C",
  },
  {
    numero: 27,
    factor: "H",
    enunciado: "Al hacer preguntas en una junta o auditorio lleno:",
    opcionA: "Intervienes sin problema cuando necesitas aclarar algo.",
    opcionB: "Término medio.",
    opcionC: "Prefieres quedarte con la duda antes que hablar en público.",
    keyedOption: "A",
  },
  {
    numero: 28,
    factor: "H",
    enunciado: "En entornos nuevos donde no conoces a nadie:",
    opcionA: "Te sientes cohibido y te cuesta iniciar conversación.",
    opcionB: "Término medio.",
    opcionC: "Te integras con facilidad y tomas la iniciativa para saludar.",
    keyedOption: "C",
  },

  // Factor I — Sensibilidad (29-32)
  {
    numero: 29,
    factor: "I",
    enunciado: "Al tomar decisiones técnicas o de proyecto, te guías principalmente por:",
    opcionA: "El impacto humano, la empatía y la armonía del equipo.",
    opcionB: "Término medio.",
    opcionC: "Los datos objetivos, la eficiencia y la utilidad práctica.",
    keyedOption: "A",
  },
  {
    numero: 30,
    factor: "I",
    enunciado: "Frente a situaciones tensas donde alguien se equivoca:",
    opcionA: "Vas directo al hecho práctico sin detenerte en lo emocional.",
    opcionB: "Término medio.",
    opcionC: "Cuidas primero cómo se siente la persona antes de señalar el fallo.",
    keyedOption: "C",
  },
  {
    numero: 31,
    factor: "I",
    enunciado: "Las actividades artísticas, estéticas o reflexivas te resultan:",
    opcionA: "Muy significativas y parte importante de tu sensibilidad.",
    opcionB: "Término medio.",
    opcionC: "Secundarias frente a asuntos concretos y medibles.",
    keyedOption: "A",
  },
  {
    numero: 32,
    factor: "I",
    enunciado: "Cuando evalúas una propuesta de trabajo:",
    opcionA: "Priorizas únicamente resultados duros y costo-beneficio.",
    opcionB: "Término medio.",
    opcionC: "Consideras tanto la lógica como los valores y bienestar implicados.",
    keyedOption: "C",
  },

  // Factor L — Vigilancia (33-36)
  {
    numero: 33,
    factor: "L",
    enunciado: "Cuando un supervisor o compañero ofrece ayudarte con tu tarea:",
    opcionA: "Tiendes a desconfiar de sus intenciones o temes que critique tu trabajo.",
    opcionB: "Término medio.",
    opcionC: "Agradeces el apoyo asumiendo buena fe y colaboración.",
    keyedOption: "A",
  },
  {
    numero: 34,
    factor: "L",
    enunciado: "Ante cambios organizacionales anunciados en la escuela o empresa:",
    opcionA: "Sueles aceptarlos con apertura y confianza inicial.",
    opcionB: "Término medio.",
    opcionC: "Sospechas de motivos ocultos y mantienes una actitud muy prevenida.",
    keyedOption: "C",
  },
  {
    numero: 35,
    factor: "L",
    enunciado: "En el trabajo en equipo, cuando delegas una parte del entregable:",
    opcionA: "Revisas con recelo pensando que seguramente lo harán mal.",
    opcionB: "Término medio.",
    opcionC: "Confías en la capacidad de tus compañeros y das seguimiento cordial.",
    keyedOption: "A",
  },
  {
    numero: 36,
    factor: "L",
    enunciado: "Cuando alguien te felicita por un logro:",
    opcionA: "Lo recibes con sencillez y gratitud.",
    opcionB: "Término medio.",
    opcionC: "Piensas que podría estar buscando algún favor a cambio.",
    keyedOption: "C",
  },

  // Factor M — Abstracción (37-40)
  {
    numero: 37,
    factor: "M",
    enunciado: "Mientras realizas una actividad operativa o de laboratorio:",
    opcionA: "A veces te pierdes en tus propios pensamientos e ideas.",
    opcionB: "Término medio.",
    opcionC: "Te mantienes atento a cada detalle concreto y paso físico.",
    keyedOption: "A",
  },
  {
    numero: 38,
    factor: "M",
    enunciado: "Al planear un proyecto semestral:",
    opcionA: "Te enfocas desde el inicio en recursos reales, tiempos y costos.",
    opcionB: "Término medio.",
    opcionC: "Prefieres imaginar conceptos amplios aunque falte aterrizar detalles.",
    keyedOption: "C",
  },
  {
    numero: 39,
    factor: "M",
    enunciado: "En conversaciones cotidianas te inclinas más por:",
    opcionA: "Explorar teorías, posibilidades e ideas abstractas.",
    opcionB: "Término medio.",
    opcionC: "Hablar de hechos verificables y soluciones prácticas.",
    keyedOption: "A",
  },
  {
    numero: 40,
    factor: "M",
    enunciado: "Respecto a objetos, archivos o citas diarias:",
    opcionA: "Rara vez olvidas dónde dejaste algo o qué hora es.",
    opcionB: "Término medio.",
    opcionC: "Con frecuencia te distraes pensando en otras cosas y olvidas detalles.",
    keyedOption: "C",
  },

  // Factor N — Privacidad (41-44)
  {
    numero: 41,
    factor: "N",
    enunciado: "Cuando manejas información delicada de un proyecto o compañero:",
    opcionA: "Eres sumamente discreto y cuidas qué compartir y con quién.",
    opcionB: "Término medio.",
    opcionC: "Sueles hablar con total espontaneidad sin filtrar tanto lo que dices.",
    keyedOption: "A",
  },
  {
    numero: 42,
    factor: "N",
    enunciado: "Al expresar una opinión en un entorno formal:",
    opcionA: "Dices exactamente lo primero que piensas sin rodeos.",
    opcionB: "Término medio.",
    opcionC: "Eliges tus palabras con tacto, diplomacia y prudencia.",
    keyedOption: "C",
  },
  {
    numero: 43,
    factor: "N",
    enunciado: "Sobre tus asuntos personales en la escuela o empresa:",
    opcionA: "Prefieres mantenerlos en privado y separar lo personal de lo laboral.",
    opcionB: "Término medio.",
    opcionC: "Compartes abiertamente tus experiencias personales con casi todos.",
    keyedOption: "A",
  },
  {
    numero: 44,
    factor: "N",
    enunciado: "En situaciones sociales complejas:",
    opcionA: "Actúas de manera transparente y directa sin calcular impresiones.",
    opcionB: "Término medio.",
    opcionC: "Observas el contexto antes de intervenir para mantener el equilibrio.",
    keyedOption: "C",
  },

  // Factor O — Aprensión (45-48)
  {
    numero: 45,
    factor: "O",
    enunciado: "Después de entregar un examen o informe importante:",
    opcionA: "Sigues dándole vueltas con preocupación pensando en posibles fallos.",
    opcionB: "Término medio.",
    opcionC: "Quedas tranquilo sabiendo que diste tu mejor esfuerzo.",
    keyedOption: "A",
  },
  {
    numero: 46,
    factor: "O",
    enunciado: "Cuando cometes una equivocación pequeña:",
    opcionA: "La corriges y sigues adelante sin culparte en exceso.",
    opcionB: "Término medio.",
    opcionC: "Te reprochas duramente y dudas de tu propia capacidad.",
    keyedOption: "C",
  },
  {
    numero: 47,
    factor: "O",
    enunciado: "Frente a retos profesionales nuevos como el Programa Dual:",
    opcionA: "Sientes inseguridad constante sobre si estarás a la altura.",
    opcionB: "Término medio.",
    opcionC: "Confías en tu preparación y capacidad para aprender.",
    keyedOption: "A",
  },
  {
    numero: 48,
    factor: "O",
    enunciado: "Al dormir en épocas de evaluación:",
    opcionA: "Descansas con normalidad sin preocupaciones excesivas.",
    opcionB: "Término medio.",
    opcionC: "Te cuesta conciliar el sueño repasando pendientes o temores.",
    keyedOption: "C",
  },

  // Factor Q1 — Apertura al cambio (49-52)
  {
    numero: 49,
    factor: "Q1",
    enunciado: "Cuando una empresa introduce una herramienta digital o método distinto:",
    opcionA: "Te entusiasma probarla y analizar cómo mejora el proceso.",
    opcionB: "Término medio.",
    opcionC: "Prefieres seguir usando el método tradicional ya conocido.",
    keyedOption: "A",
  },
  {
    numero: 50,
    factor: "Q1",
    enunciado: "Ante ideas poco convencionales propuestas por un compañero:",
    opcionA: "Tiendes a rechazarlas porque se salen de lo habitual.",
    opcionB: "Término medio.",
    opcionC: "Las escuchas con curiosidad para ver qué se puede aprovechar.",
    keyedOption: "C",
  },
  {
    numero: 51,
    factor: "Q1",
    enunciado: "En tu formación académica o técnica:",
    opcionA: "Cuestionas cómo mejorar los procesos existentes y buscas innovar.",
    opcionB: "Término medio.",
    opcionC: "Te sientes más seguro aplicando únicamente recetas probadas.",
    keyedOption: "A",
  },
  {
    numero: 52,
    factor: "Q1",
    enunciado: "Cuando las rutinas cambian por actualización tecnológica:",
    opcionA: "Te incomoda adaptarte a reglas o sistemas nuevos.",
    opcionB: "Término medio.",
    opcionC: "Ves el cambio como una oportunidad de crecimiento.",
    keyedOption: "C",
  },

  // Factor Q2 — Autosuficiencia (53-56)
  {
    numero: 53,
    factor: "Q2",
    enunciado: "Para resolver un problema técnico complejo:",
    opcionA: "Prefieres analizarlo por tu cuenta antes de pedir opiniones.",
    opcionB: "Término medio.",
    opcionC: "Necesitas consultarlo primero en grupo para sentirte seguro.",
    keyedOption: "A",
  },
  {
    numero: 54,
    factor: "Q2",
    enunciado: "Cuando organizas tu jornada de estudio o prácticas:",
    opcionA: "Dependes mucho de que alguien más marque el ritmo o te acompañe.",
    opcionB: "Término medio.",
    opcionC: "Trabajas de manera autónoma con tu propia agenda.",
    keyedOption: "C",
  },
  {
    numero: 55,
    factor: "Q2",
    enunciado: "Al tomar decisiones académicas importantes:",
    opcionA: "Sopesas la información y decides con criterio propio.",
    opcionB: "Término medio.",
    opcionC: "Sueles seguir lo que deciden tus amigos o la mayoría.",
    keyedOption: "A",
  },
  {
    numero: 56,
    factor: "Q2",
    enunciado: "Cuando te asignan una responsabilidad individual en una empresa:",
    opcionA: "Te cuesta avanzar sin aprobación constante en cada paso.",
    opcionB: "Término medio.",
    opcionC: "Avanzas con autonomía y reportas avances concretos.",
    keyedOption: "C",
  },

  // Factor Q3 — Perfeccionismo / Autocontrol (57-60)
  {
    numero: 57,
    factor: "Q3",
    enunciado: "Respecto a la organización de tus documentos, código o entregables:",
    opcionA: "Llevas listas claras, orden y verificas la calidad antes de entregar.",
    opcionB: "Término medio.",
    opcionC: "Trabajas sobre la marcha sin preocuparte mucho por el orden.",
    keyedOption: "A",
  },
  {
    numero: 58,
    factor: "Q3",
    enunciado: "Cuando planeas tu semana de actividades:",
    opcionA: "Improvisas según lo que vaya saliendo en el día.",
    opcionB: "Término medio.",
    opcionC: "Estableces metas precisas y verificas su cumplimiento.",
    keyedOption: "C",
  },
  {
    numero: 59,
    factor: "Q3",
    enunciado: "En la presentación y limpieza de tu espacio de trabajo:",
    opcionA: "Procuras mantener todo en su lugar para trabajar con claridad.",
    opcionB: "Término medio.",
    opcionC: "No te molesta el desorden mientras encuentres lo básico.",
    keyedOption: "A",
  },
  {
    numero: 60,
    factor: "Q3",
    enunciado: "Antes de enviar un reporte o actividad evaluable:",
    opcionA: "Lo mandas rápido sin revisar detalles de formato o redacción.",
    opcionB: "Término medio.",
    opcionC: "Lo revisas cuidadosamente para evitar errores evitables.",
    keyedOption: "C",
  },

  // Factor Q4 — Tensión (61-64)
  {
    numero: 61,
    factor: "Q4",
    enunciado: "Cuando debes esperar por trámites lentos o respuestas de terceros:",
    opcionA: "Te impacientas mucho y sientes una tensión física constante.",
    opcionB: "Término medio.",
    opcionC: "Mantienes la calma y aprovechas el tiempo en otra tarea.",
    keyedOption: "A",
  },
  {
    numero: 62,
    factor: "Q4",
    enunciado: "Al terminar tu jornada diaria de clases o actividades:",
    opcionA: "Logras desconectarte y descansar con facilidad.",
    opcionB: "Término medio.",
    opcionC: "Sigues sintiéndote acelerado, irritable o con prisa interna.",
    keyedOption: "C",
  },
  {
    numero: 63,
    factor: "Q4",
    enunciado: "Si ocurren interrupciones repetidas mientras trabajas concentrado:",
    opcionA: "Sientes mucha irritabilidad y te cuesta controlarla.",
    opcionB: "Término medio.",
    opcionC: "Respondes con paciencia y retomas tu actividad sin sobresaltos.",
    keyedOption: "A",
  },
  {
    numero: 64,
    factor: "Q4",
    enunciado: "En general, tu nivel habitual de energía nerviosa o prisa es:",
    opcionA: "Sereno, estable y paciente.",
    opcionB: "Término medio.",
    opcionC: "Intenso, impaciente y frecuentemente presionado.",
    keyedOption: "C",
  },
];

// Corrección ítem 5: 3 (+3)=6 (+5)=11 (+7)=18 (+9)=27 (+11)=38 -> opción B es 38, ponemos 38 en C para que keyedOption: "C" sea exacto!
const item5 = CATTELL_ITEMS.find((i) => i.numero === 5);
if (item5) {
  item5.opcionB = "36";
  item5.opcionA = "35";
  item5.opcionC = "38";
  item5.keyedOption = "C";
}

/**
 * Calcula los puntos (0, 1 o 2) de un reactivo del 16PF.
 */
export function scoreCattellItem(item: CattellItem, opcion: CattellOption): number {
  if (item.strictBinary) {
    return opcion === item.keyedOption ? 2 : 0;
  }
  if (opcion === item.keyedOption) return 2;
  if (opcion === "B") return 1;
  return 0;
}

/**
 * Convierte un puntaje bruto (0..8 por 4 ítems) a Decatipo estándar (Sten 1..10).
 * Media normativa = 5.5, desviación estándar = 2.0.
 */
const RAW_TO_DECATIPO_8: Record<number, number> = {
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 6,
  5: 7,
  6: 8,
  7: 9,
  8: 10,
};

export function rawToDecatipo(rawScore: number): number {
  const clamped = Math.max(0, Math.min(8, Math.round(rawScore)));
  return RAW_TO_DECATIPO_8[clamped] ?? 5;
}

function clampSten(val: number): number {
  return Math.max(1, Math.min(10, Math.round(val)));
}

/**
 * Calcula puntajes brutos, decatipos (1-10), 5 factores globales y pre-recomendación Dual.
 */
export function calcularPerfilCattell(respuestas: Record<number, CattellOption>): {
  puntajesBrutos: Record<CattellFactorCode, number>;
  puntajesDecatipos: Record<CattellFactorCode, number>;
  factoresGlobales: Record<CattellGlobalCode, number>;
  preRecomendacion: PreRecomendacionCattell;
  resumenAutomatico: string;
} {
  const puntajesBrutos = {} as Record<CattellFactorCode, number>;
  for (const factor of CATTELL_FACTORS) {
    puntajesBrutos[factor.code] = 0;
  }

  for (const item of CATTELL_ITEMS) {
    const opcion = respuestas[item.numero];
    if (opcion) {
      puntajesBrutos[item.factor] += scoreCattellItem(item, opcion);
    }
  }

  const puntajesDecatipos = {} as Record<CattellFactorCode, number>;
  for (const factor of CATTELL_FACTORS) {
    puntajesDecatipos[factor.code] = rawToDecatipo(puntajesBrutos[factor.code]);
  }

  const d = puntajesDecatipos;
  const inv = (sten: number) => 11 - sten;

  // Fórmulas ponderadas inspiradas en el modelo de 5 dimensiones globales del 16PF-5
  const factoresGlobales: Record<CattellGlobalCode, number> = {
    EXT: clampSten(d.A * 0.25 + d.F * 0.25 + d.H * 0.25 + inv(d.N) * 0.1 + inv(d.Q2) * 0.15),
    ANS: clampSten(inv(d.C) * 0.35 + d.L * 0.2 + d.O * 0.25 + d.Q4 * 0.2),
    DUR: clampSten(inv(d.A) * 0.2 + inv(d.I) * 0.35 + inv(d.M) * 0.25 + inv(d.Q1) * 0.2),
    IND: clampSten(d.E * 0.3 + d.H * 0.25 + d.L * 0.15 + d.Q1 * 0.3),
    AUT: clampSten(inv(d.F) * 0.15 + d.G * 0.35 + inv(d.M) * 0.15 + d.Q3 * 0.35),
  };

  const { preRecomendacion, resumenAutomatico } = evaluarPreRecomendacionDual(
    puntajesDecatipos,
    factoresGlobales,
  );

  return {
    puntajesBrutos,
    puntajesDecatipos,
    factoresGlobales,
    preRecomendacion,
    resumenAutomatico,
  };
}

export function evaluarPreRecomendacionDual(
  d: Record<CattellFactorCode, number>,
  g: Record<CattellGlobalCode, number>,
): {
  preRecomendacion: PreRecomendacionCattell;
  resumenAutomatico: string;
} {
  const c = d.C ?? 5;
  const gNorm = d.G ?? 5;
  const q3 = d.Q3 ?? 5;
  const b = d.B ?? 5;
  const ans = g.ANS ?? 5;
  const aut = g.AUT ?? 5;

  // Criterios de riesgo para adaptación empresarial Dual
  const alertasCriticas: string[] = [];
  const observaciones: string[] = [];

  if (c <= 3) alertasCriticas.push(`Estabilidad emocional baja (C=${c})`);
  else if (c <= 4) observaciones.push(`Estabilidad emocional limítrofe (C=${c})`);

  if (gNorm <= 3) alertasCriticas.push(`Bajo apego a normas (G=${gNorm})`);
  else if (gNorm <= 4) observaciones.push(`Atención a normas moderada-baja (G=${gNorm})`);

  if (q3 <= 3) alertasCriticas.push(`Autocontrol y orden bajos (Q3=${q3})`);
  else if (q3 <= 4) observaciones.push(`Perfeccionismo/orden en rango bajo (Q3=${q3})`);

  if (ans >= 9) alertasCriticas.push(`Ansiedad global muy elevada (ANS=${ans})`);
  else if (ans >= 7) observaciones.push(`Ansiedad global moderada-alta (ANS=${ans})`);

  if (b <= 3) observaciones.push(`Razonamiento lógico concreto (B=${b})`);

  if (alertasCriticas.length >= 2 || (c <= 2 && ans >= 8)) {
    return {
      preRecomendacion: "no_apto",
      resumenAutomatico: `Sugerencia orientativa: No apto para ingreso inmediato (${alertasCriticas.join("; ")}). Se recomienda acompañamiento previo antes de inserción en empresa.`,
    };
  }

  if (alertasCriticas.length === 1 || observaciones.length >= 2 || aut <= 4) {
    const detalle = [...alertasCriticas, ...observaciones].join("; ");
    return {
      preRecomendacion: "apto_con_observaciones",
      resumenAutomatico: `Sugerencia orientativa: Apto con observaciones (${detalle || `Autocontrol global AUT=${aut}`}). Validar entrevista clínica de seguimiento.`,
    };
  }

  return {
    preRecomendacion: "apto",
    resumenAutomatico: `Sugerencia orientativa: Perfil favorable para Programa Dual (Estabilidad C=${c}, Normas G=${gNorm}, Autocontrol Q3=${q3}, Ansiedad ANS=${ans}).`,
  };
}
