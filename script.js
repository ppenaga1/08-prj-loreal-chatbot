/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

// Paste your deployed Cloudflare Worker URL here
const WORKER_URL = "https://loreal-worker.pauloerickoneb-penaga.workers.dev";

// Keep a running conversation so the assistant remembers context
const messages = [
  {
    role: "system",
    content:
      "You are the L'Oreal Beauty Assistant. Answer only beauty-related questions about L'Oreal products, ingredients, routines, shade matching, haircare, skincare, makeup, fragrance, and product recommendations. If the user asks anything outside beauty or outside L'Oreal context (for example math, coding, politics, history, or general trivia), politely refuse in 1-2 sentences and redirect them to ask about L'Oreal beauty products or routines. Use the conversation history and the provided memory context to maintain continuity, remember the user's name when available, and refer to earlier questions when helpful. For in-scope questions, give practical, concise recommendations with clear steps.",
  },
];

// Track simple memory outside the message list
const conversationState = {
  userName: "",
  recentQuestions: [],
};

// Helper: add a message line to the chat UI
function addMessage(role, text) {
  const rowEl = document.createElement("div");
  rowEl.className = `message-row ${role}`;

  const bubbleEl = document.createElement("div");
  bubbleEl.className = `message-bubble ${role}`;

  const speaker = role === "user" ? "You" : "L'Oreal Assistant";
  const speakerEl = document.createElement("div");
  speakerEl.className = "message-speaker";
  speakerEl.textContent = speaker;

  const textEl = document.createElement("div");
  textEl.className = "message-text";
  textEl.textContent = text;

  bubbleEl.appendChild(speakerEl);
  bubbleEl.appendChild(textEl);
  rowEl.appendChild(bubbleEl);
  chatWindow.appendChild(rowEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: show a temporary typing bubble while waiting for the API
function showTypingIndicator() {
  const existingIndicator = document.getElementById("typingIndicator");

  if (existingIndicator) {
    existingIndicator.remove();
  }

  const rowEl = document.createElement("div");
  rowEl.id = "typingIndicator";
  rowEl.className = "message-row ai typing-row";

  const bubbleEl = document.createElement("div");
  bubbleEl.className = "message-bubble ai typing-bubble";

  const speakerEl = document.createElement("div");
  speakerEl.className = "message-speaker";
  speakerEl.textContent = "L'Oreal Assistant";

  const dotsEl = document.createElement("div");
  dotsEl.className = "typing-dots";
  dotsEl.setAttribute("aria-label", "Assistant is typing");

  const dot1 = document.createElement("span");
  const dot2 = document.createElement("span");
  const dot3 = document.createElement("span");

  dotsEl.appendChild(dot1);
  dotsEl.appendChild(dot2);
  dotsEl.appendChild(dot3);

  bubbleEl.appendChild(speakerEl);
  bubbleEl.appendChild(dotsEl);
  rowEl.appendChild(bubbleEl);
  chatWindow.appendChild(rowEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: remove the typing bubble after the response finishes
function hideTypingIndicator() {
  const existingIndicator = document.getElementById("typingIndicator");

  if (existingIndicator) {
    existingIndicator.remove();
  }
}

// Helper: show only the latest user question above the assistant reply
function showLatestQuestion(text) {
  const existingQuestion = document.getElementById("latestQuestion");

  if (existingQuestion) {
    existingQuestion.remove();
  }

  const questionEl = document.createElement("div");
  questionEl.id = "latestQuestion";
  questionEl.className = "message-row latest-question-row";

  const bubbleEl = document.createElement("div");
  bubbleEl.className = "message-bubble latest-question";
  bubbleEl.textContent = `Latest question: ${text}`;

  questionEl.appendChild(bubbleEl);
  chatWindow.appendChild(questionEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Helper: remember the user's name when they share it
function extractUserName(text) {
  const namePatterns = [
    /\bmy name is ([A-Za-z][A-Za-z' -]{1,40})\b/i,
    /\bi am ([A-Za-z][A-Za-z' -]{1,40})\b/i,
    /\bi'm ([A-Za-z][A-Za-z' -]{1,40})\b/i,
    /\bcall me ([A-Za-z][A-Za-z' -]{1,40})\b/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return "";
}

// Helper: build a small memory summary for the API request
function buildMemoryContext() {
  const memoryLines = [];

  if (conversationState.userName) {
    memoryLines.push(`User name: ${conversationState.userName}`);
  }

  if (conversationState.recentQuestions.length > 0) {
    memoryLines.push(
      `Recent user questions: ${conversationState.recentQuestions.join(" | ")}`,
    );
  }

  if (memoryLines.length === 0) {
    return "No saved user memory yet.";
  }

  return memoryLines.join("\n");
}

// Helper: send a copy of the conversation plus memory context
function buildMessagesForRequest() {
  return [
    messages[0],
    {
      role: "system",
      content: `Conversation memory:\n${buildMemoryContext()}`,
    },
    ...messages.slice(1),
  ];
}

// Set initial message
addMessage("ai", "👋 Hello! Ask me about L'Oreal products and routines.");

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();

  if (!userMessage) {
    return;
  }

  // Show the user's message in the chat
  addMessage("user", userMessage);
  showLatestQuestion(userMessage);
  userInput.value = "";
  sendBtn.disabled = true;

  const detectedName = extractUserName(userMessage);

  if (detectedName) {
    conversationState.userName = detectedName;
  }

  conversationState.recentQuestions.push(userMessage);

  if (conversationState.recentQuestions.length > 5) {
    conversationState.recentQuestions.shift();
  }

  // Add user message to the conversation sent to the API
  messages.push({ role: "user", content: userMessage });
  showTypingIndicator();

  try {
    // Send the conversation to your Cloudflare Worker (which calls OpenAI)
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: buildMessagesForRequest(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const apiError = data.error?.message || "Request failed.";
      throw new Error(apiError);
    }

    // Read the assistant text from the standard chat completion shape
    const aiMessage = data.choices?.[0]?.message?.content;

    if (!aiMessage) {
      throw new Error("No response text was returned by the API.");
    }

    // Save and display the assistant response
    messages.push({ role: "assistant", content: aiMessage });
    hideTypingIndicator();
    addMessage("ai", aiMessage);
  } catch (error) {
    hideTypingIndicator();
    addMessage("ai", `Sorry, I couldn't connect right now. ${error.message}`);
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
});
