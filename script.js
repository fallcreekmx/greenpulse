/* =========================================================
   GreenPulse v1.1 · Flujo + Animaciones + Envío estable
   ========================================================= */

// Pega aquí tu URL real de Power Automate.
const flowURL = "PEGA_AQUI_TU_URL_DE_POWER_AUTOMATE";

/*
  Estrategia:
  - Se guardan las respuestas en memoria mientras la persona avanza.
  - Al finalizar, se envían todas juntas, una por una.
  - Esto evita que Power Automate pierda llamadas rápidas entre preguntas.
*/
const SEND_DELAY_MS = 350;

const questions = [
  "¿Te sientes feliz y orgulloso de trabajar en Fall Creek?",
  "Tengo las herramientas adecuadas para hacer mi trabajo.",
  "Recibo el reconocimiento de mis líderes cuando realizo mi trabajo correctamente.",
  "Los valores de Fall Creek son claros para mí.",
  "¿Recomendarías Fall Creek a un amigo o familiar como un buen lugar para trabajar?"
];

const answerOptions = [
  {
    value: "1",
    emoji: "😡",
    title: "Totalmente en desacuerdo",
    description: "Hay mucho por mejorar.",
    tone: "danger"
  },
  {
    value: "2",
    emoji: "☹️",
    title: "En desacuerdo",
    description: "No me siento conforme.",
    tone: "orange"
  },
  {
    value: "3",
    emoji: "😐",
    title: "Indiferente",
    description: "No tengo una opinión clara.",
    tone: "yellow"
  },
  {
    value: "4",
    emoji: "🙂",
    title: "De acuerdo",
    description: "Me siento bien.",
    tone: "softgreen"
  },
  {
    value: "5",
    emoji: "😃",
    title: "Totalmente de acuerdo",
    description: "Me siento muy satisfecho.",
    tone: "happy"
  }
];

const $ = (selector) => document.querySelector(selector);

const screens = {
  welcome: $("#welcomeScreen"),
  survey: $("#surveyScreen"),
  comment: $("#commentScreen"),
  thanks: $("#thankYouScreen")
};

const startButton = $("#startButton");
const questionCounter = $("#questionCounter");
const progressPercent = $("#progressPercent");
const progressFill = $("#progressFill");
const questionText = $("#questionText");
const questionStage = $("#questionStage");
const answersContainer = $("#answersContainer");
const commentBox = $("#commentBox");
const finishButton = $("#finishButton");
const skipCommentButton = $("#skipCommentButton");
const loaderOverlay = $("#loaderOverlay");
const toast = $("#toast");
const toastMessage = $("#toastMessage");

let currentQuestion = 0;
let isLocked = false;
let responseQueue = [];

function showScreen(name) {
  Object.values(screens).forEach((screen) => {
    screen.classList.remove("screen-active");
    screen.hidden = true;
  });

  const nextScreen = screens[name];
  nextScreen.hidden = false;

  requestAnimationFrame(() => {
    nextScreen.classList.add("screen-active");
  });
}

function renderQuestion() {
  const total = questions.length;
  const displayNumber = currentQuestion + 1;
  const percent = Math.round((displayNumber / total) * 100);

  questionCounter.textContent = `Pregunta ${displayNumber} de ${total}`;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  questionText.textContent = questions[currentQuestion];

  renderAnswers();
}

function renderAnswers() {
  answersContainer.innerHTML = "";

  answerOptions.forEach((option) => {
    const card = document.createElement("article");
    card.className = "answer-card";
    card.dataset.value = option.value;
    card.dataset.tone = option.tone;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", option.title);

    const emoji = document.createElement("div");
    emoji.className = "answer-emoji";
    emoji.textContent = option.emoji;

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.className = "answer-title";
    title.textContent = option.title;

    const description = document.createElement("p");
    description.className = "answer-description";
    description.textContent = option.description;

    content.append(title, description);
    card.append(emoji, content);

    card.addEventListener("click", () => handleAnswer(option, card));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleAnswer(option, card);
      }
    });

    answersContainer.appendChild(card);
  });
}

function handleAnswer(option, card) {
  if (isLocked) return;

  isLocked = true;
  card.classList.add("selected");

  if ("vibrate" in navigator) {
    navigator.vibrate(35);
  }

  responseQueue.push({
    questionNumber: currentQuestion + 1,
    question: questions[currentQuestion],
    answer: option.value,
    timestamp: new Date().toISOString(),
    comment: ""
  });

  setTimeout(() => {
    currentQuestion++;

    if (currentQuestion < questions.length) {
      transitionQuestion();
    } else {
      showScreen("comment");
      isLocked = false;
    }
  }, 360);
}

function transitionQuestion() {
  questionStage.classList.remove("is-entering");
  questionStage.classList.add("is-leaving");

  setTimeout(() => {
    renderQuestion();
    questionStage.classList.remove("is-leaving");
    questionStage.classList.add("is-entering");
    isLocked = false;
  }, 270);
}

async function submitComment() {
  if (isLocked) return;

  isLocked = true;
  const comment = commentBox.value.trim();

  if (comment.length > 0) {
    responseQueue.push({
      questionNumber: 999,
      question: "¿Tienes algún comentario o sugerencia?",
      answer: "",
      timestamp: new Date().toISOString(),
      comment
    });
  }

  showLoader(true);

  const ok = await sendQueueToPowerAutomate();

  showLoader(false);

  if (ok) {
    showScreen("thanks");
    setTimeout(resetSurvey, 3200);
  } else {
    isLocked = false;
    showToast("No se pudo enviar. La encuesta quedó guardada en este dispositivo.");
    savePendingResponses();
  }
}

async function sendQueueToPowerAutomate() {
  if (!flowURL || flowURL.includes("PEGA_AQUI")) {
    console.warn("Power Automate URL pendiente. Respuestas simuladas:", responseQueue);
    showToast("Modo prueba: falta pegar la URL de Power Automate.");
    return true;
  }

  try {
    for (const payload of responseQueue) {
      await postToPowerAutomate(payload);
      await wait(SEND_DELAY_MS);
    }

    clearPendingResponses();
    return true;
  } catch (error) {
    console.error("Error al enviar cola:", error);
    return false;
  }
}

async function postToPowerAutomate(payload) {
  /*
    Modo principal: JSON normal.
    Si tu flujo fue creado con "When an HTTP request is received",
    este es el formato más compatible para triggerBody().
  */
  const response = await fetch(flowURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  /*
    Algunos flujos no devuelven body, pero sí devuelven 2xx.
    Si devuelve 4xx/5xx, entonces sí lo tratamos como error real.
  */
  if (!response.ok) {
    throw new Error(`Power Automate respondió ${response.status}`);
  }

  return true;
}

function savePendingResponses() {
  try {
    localStorage.setItem("greenpulse_pending_responses", JSON.stringify(responseQueue));
  } catch (error) {
    console.warn("No se pudo guardar respaldo local:", error);
  }
}

function clearPendingResponses() {
  try {
    localStorage.removeItem("greenpulse_pending_responses");
  } catch (error) {
    console.warn("No se pudo limpiar respaldo local:", error);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showLoader(show) {
  loaderOverlay.hidden = !show;
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.hidden = false;

  setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

function resetSurvey() {
  currentQuestion = 0;
  commentBox.value = "";
  isLocked = false;
  responseQueue = [];
  renderQuestion();
  showScreen("welcome");
}

startButton.addEventListener("click", () => {
  currentQuestion = 0;
  responseQueue = [];
  renderQuestion();
  showScreen("survey");
});

finishButton.addEventListener("click", submitComment);
skipCommentButton.addEventListener("click", () => {
  commentBox.value = "";
  submitComment();
});

renderQuestion();
