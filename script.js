/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

// Paste your deployed Cloudflare Worker URL here
const WORKER_URL = "https://your-worker-name.your-subdomain.workers.dev";

// Keep a running conversation so the assistant remembers context
const messages = [
  {
    role: "system",
    content:
      "You are a helpful beauty advisor for L'Oreal products. Keep answers short, beginner-friendly, and practical.",
  },
];

// Helper: add a message line to the chat UI
function addMessage(role, text) {
  const messageEl = document.createElement("p");
  messageEl.className = `msg ${role}`;
  messageEl.textContent = text;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
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
  userInput.value = "";
  sendBtn.disabled = true;

  // Add user message to the conversation sent to the API
  messages.push({ role: "user", content: userMessage });

  try {
    // Send the conversation to your Cloudflare Worker
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
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
    addMessage("ai", aiMessage);
  } catch (error) {
    addMessage(
      "ai",
      `Sorry, I couldn't connect right now. ${error.message}`
    );
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
});
