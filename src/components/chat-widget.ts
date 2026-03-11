// Lil Beaver Chat Widget
// Admin: Full tools | Customer: Account-only access

export const chatWidgetStyles = `
  .chat-fab {
    position: fixed;
    bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    right: 1rem;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8B4513, #A0522D);
    border: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    cursor: pointer;
    z-index: 1002;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }
  .chat-fab:active { transform: scale(0.95); }
  .chat-fab img { width: 36px; height: 36px; border-radius: 50%; }
  .chat-fab-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #ef4444;
    color: white;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 10px;
  }
  
  .chat-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 85dvh;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
    z-index: 1001;
    display: flex;
    flex-direction: column;
    transform: translateY(calc(100% + 120px));
    pointer-events: none;
    transition: transform 0.3s ease-out;
  }
  .chat-panel.open { transform: translateY(0); pointer-events: auto; }
  
  .chat-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid #eee;
    background: linear-gradient(135deg, #8B4513, #A0522D);
    color: white;
    border-radius: 20px 20px 0 0;
  }
  .chat-header img { width: 40px; height: 40px; border-radius: 50%; }
  .chat-header-info h3 { margin: 0; font-size: 1rem; }
  .chat-header-info p { margin: 0; font-size: 0.8rem; opacity: 0.9; }
  .chat-close {
    margin-left: auto;
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 1.25rem;
    cursor: pointer;
  }
  
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .chat-msg {
    max-width: 85%;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    font-size: 0.95rem;
    line-height: 1.4;
  }
  .chat-msg.user {
    align-self: flex-end;
    background: #8B4513;
    color: white;
    border-bottom-right-radius: 4px;
  }
  .chat-msg.assistant {
    align-self: flex-start;
    background: #f3f4f6;
    color: #333;
    border-bottom-left-radius: 4px;
  }
  .chat-msg.typing {
    background: #f3f4f6;
    color: #666;
  }
  .chat-msg.typing::after {
    content: '...';
    animation: typing 1s infinite;
  }
  @keyframes typing {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  
  .chat-input-area {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #eee;
    background: #fafafa;
  }
  .chat-input {
    flex: 1;
    padding: 0.875rem 1rem;
    border: 1px solid #ddd;
    border-radius: 24px;
    font-size: 16px;
    outline: none;
  }
  .chat-input:focus { border-color: #8B4513; }
  .chat-send {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #8B4513;
    border: none;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
  }
  .chat-send:disabled { opacity: 0.5; }
  
  .chat-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .chat-overlay.open { opacity: 1; pointer-events: auto; }

  @media (min-width: 640px) {
    .chat-fab { bottom: 2rem; right: 2rem; }
    .chat-panel {
      width: 400px;
      height: 600px;
      right: 2rem;
      bottom: 100px;
      left: auto;
      border-radius: 16px;
    }
    .chat-header { border-radius: 16px 16px 0 0; }
  }
`;

export const chatWidgetHTML = (mode: 'admin' | 'customer', context?: { customerId?: number; customerName?: string }) => `
  <button class="chat-fab" onclick="toggleChat()" aria-label="Chat with Lil Beaver">
    <img src="/api/assets/beaver-avatar.png" alt="Lil Beaver">
  </button>
  
  <div class="chat-overlay" onclick="toggleChat()"></div>
  
  <div class="chat-panel" id="chat-panel">
    <div class="chat-header">
      <img src="/api/assets/beaver-avatar.png" alt="Lil Beaver">
      <div class="chat-header-info">
        <h3>Lil Beaver</h3>
        <p>${mode === 'admin' ? 'Admin Assistant' : 'Your Account Helper'}</p>
      </div>
      <button class="chat-close" onclick="toggleChat()">×</button>
    </div>
    
    <div class="chat-messages" id="chat-messages">
      <div class="chat-msg assistant">
        ${mode === 'admin' 
          ? "Hey boss! 🦫 I can help you create quotes, send invoices, check stats, or manage customers. What do you need?"
          : `Hi${context?.customerName ? ' ' + context.customerName : ''}! 🦫 I'm here to help with your account, quotes, invoices, or scheduling. What can I do for you?`
        }
      </div>
    </div>
    
    <div class="chat-input-area">
      <input type="text" class="chat-input" id="chat-input" placeholder="Type a message..." 
        onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="chat-send" onclick="sendMessage()" id="chat-send">➤</button>
    </div>
  </div>
  
  <script>
    const chatMode = '${mode}';
    const chatContext = ${JSON.stringify(context || {})};
    let chatHistory = [];
    
    function toggleChat() {
      const panel = document.getElementById('chat-panel');
      const overlay = document.querySelector('.chat-overlay');
      if (!panel || !overlay) return;
      panel.classList.toggle('open');
      overlay.classList.toggle('open');
      if (panel.classList.contains('open')) {
        document.getElementById('chat-input')?.focus();
      }
    }
    
    async function sendMessage() {
      const input = document.getElementById('chat-input');
      const msg = input.value.trim();
      if (!msg) return;
      
      // Add user message
      addMessage(msg, 'user');
      input.value = '';
      
      // Show typing indicator
      const typingId = addMessage('', 'assistant typing');
      
      // Build context for the request
      const systemContext = chatMode === 'admin' 
        ? 'You are Lil Beaver, the admin assistant. You have access to admin tools via the API.'
        : \`You are Lil Beaver, helping customer #\${chatContext.customerId} (\${chatContext.customerName || 'Customer'}). Only discuss their account data.\`;
      
      chatHistory.push({ role: 'user', content: msg });
      
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: chatMode,
            context: chatContext,
            messages: chatHistory,
            message: msg
          })
        });
        
        const data = await res.json();
        
        // Remove typing indicator
        document.getElementById(typingId)?.remove();
        
        if (data.response) {
          addMessage(data.response, 'assistant');
          chatHistory.push({ role: 'assistant', content: data.response });
        } else {
          addMessage('Sorry, I had trouble understanding. Can you try again?', 'assistant');
        }
      } catch (err) {
        document.getElementById(typingId)?.remove();
        addMessage('Connection error. Please try again.', 'assistant');
      }
    }
    
    function addMessage(text, type) {
      const container = document.getElementById('chat-messages');
      const div = document.createElement('div');
      const id = 'msg-' + Date.now();
      div.id = id;
      div.className = 'chat-msg ' + type;
      div.textContent = text;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      return id;
    }
  </script>
`;
