const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");

const API_KEY = "AIzaSyBAZ7pRtrrHfZ9SFNZ8NTjog8aUnBY1tEU";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

const scrollToBottom = () => chatsContainer.scrollTo({ top: chatsContainer.scrollHeight, behavior: "smooth" });

const typingEffect = (htmlText, textElement, botMsgDiv) => {
    textElement.innerHTML = "";
    const words = htmlText.split(" ");
    let wordIndex = 0;
    scrollToBottom();

    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.innerHTML += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
            botMsgDiv.classList.remove("loading");
            document.body.classList.remove("bot-responding");
            scrollToBottom();
        }
    }, 40);
};

const formatResponse = (text) => {
    text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    text = text.replace(/``````/g, '<pre><code>$1</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");

    text = text.replace(/^[\s•*-]+/gm, "");

    text = text.replace(/(?<!<\/\w{1,3}>)\n/g, "<br><br>");
    return text;
};

const generateResponse = async (botMsgDiv) => {
    const textElement = botMsgDiv.querySelector(".message-text");
    controller = new AbortController();

    const promptParts = [];

    if (window.useWebSearchContext && window.webSearchContext) {
        promptParts.push({
            text: `You are Delta, an AI assistant. Use ONLY the following latest web search results to answer the user's question. 
            Ignore any outdated or older knowledge you have. Give a clear, concise, and up-to-date answer based on these results:\n\n${window.webSearchContext}`
        });
        window.useWebSearchContext = false;
    } else {
        promptParts.push({
            text: "You are Delta. You respond clearly, helpfully. Use emojis occasionally to make the conversation engaging, but not in every reply. Feel free to engage in light conversation, playful remarks, while staying professional and accurate"
        });
    }

    promptParts.push({ text: userData.message });

    if (userData.file.data) {
        promptParts.push({ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) });
    }

    chatHistory.push({
        role: "user",
        parts: promptParts,
    });

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory }),
            signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message);

        const rawText = data.candidates[0].content.parts[0].text.trim();
        const formattedHTML = formatResponse(rawText);
        typingEffect(formattedHTML, textElement, botMsgDiv);

        chatHistory.push({ role: "model", parts: [{ text: rawText }] });
    } catch (error) {
        textElement.textContent = error.name === "AbortError" ? "Response stopped." : error.message;
        textElement.style.color = "#d62939";
        botMsgDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
        scrollToBottom();
    } finally {
        userData.file = {};
    }
};

const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    if (!userMessage || document.body.classList.contains("bot-responding")) return;

    userData.message = userMessage;
    promptInput.value = "";
    document.body.classList.add("chats-active", "bot-responding");
    fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

    const userMsgHTML = `
        <p class="message-text"></p>
        ${userData.file.data ? (userData.file.isImage ?
            `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />` :
            `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
    `;
    const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
    userMsgDiv.querySelector(".message-text").textContent = userData.message;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();

    setTimeout(() => {
        const botMsgHTML = `
            <div style="display: flex; align-items: flex-start;">
                <img class="avatar" src="Logo2.png" />
                <p class="message-text" style="margin-left: 10px;">Just a sec...</p>
            </div>
        `;
        const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        generateResponse(botMsgDiv);
    }, 600);
};

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        fileInput.value = "";
        const base64String = e.target.result.split(",")[1];
        fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
        userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
    };
});

document.querySelector("#stop-response-btn").addEventListener("click", () => {
    controller?.abort();
    userData.file = {};
    clearInterval(typingInterval);
    const loadingBotMsg = chatsContainer.querySelector(".bot-message.loading");
    if (loadingBotMsg) loadingBotMsg.classList.remove("loading");
    document.body.classList.remove("bot-responding");
});

document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
    suggestion.addEventListener("click", () => {
        promptInput.value = suggestion.querySelector(".text").textContent;
        promptForm.dispatchEvent(new Event("submit"));
    });
});

document.addEventListener("click", ({ target }) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    const shouldHide = target.classList.contains("prompt-input") ||
        (wrapper.classList.contains("hide-controls") &&
            (target.id === "add-file-btn" || target.id === "stop-response-btn"));
    wrapper.classList.toggle("hide-controls", shouldHide);
});

promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeIcon = document.getElementById("theme-icon");

if (localStorage.getItem("themeColor") === "dark") {
    document.body.classList.add("dark-theme");
    themeIcon.textContent = "light_mode";
} else {
    themeIcon.textContent = "dark_mode";
}

themeToggleBtn.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("themeColor", isDark ? "dark" : "light");
    themeIcon.textContent = isDark ? "light_mode" : "dark_mode";
});

window.addEventListener("DOMContentLoaded", () => {
    const welcomeMsgHTML = `
        <div style="display: flex; align-items: flex-start;">
            <img class="avatar" src="Logo2.png" />
            <p class="message-text" style="margin-left: 10px;">Hello Saikat, how can I help you?</p>
        </div>
    `;
    const welcomeMsgDiv = createMessageElement(welcomeMsgHTML, "bot-message");
    chatsContainer.appendChild(welcomeMsgDiv);
    scrollToBottom();
});

document.getElementById("delete-chat-btn").addEventListener("click", () => {
    if (confirm("Delete all chats? This cannot be undone.")) {
        chatsContainer.innerHTML = "";
        chatHistory.length = 0;
        const welcomeMsgHTML = `
            <div style="display: flex; align-items: flex-start;">
                <img class="avatar" src="Logo2.png" />
                <p class="message-text" style="margin-left: 10px;">Hello Saikat, how can I help you?</p>
            </div>
        `;
        const welcomeMsgDiv = createMessageElement(welcomeMsgHTML, "bot-message");
        chatsContainer.appendChild(welcomeMsgDiv);
        scrollToBottom();
    }
});
